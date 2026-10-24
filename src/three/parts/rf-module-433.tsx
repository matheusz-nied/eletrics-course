/**
 * 433,92 MHz radio modules of hobby projects and gate remotes (module 13):
 * - receptor: the superheterodyne receiver of the kit's gate board
 *   (`RfModule` from `_gate-parts.tsx`): green board 32 × 12 mm standing on
 *   four pins (VCC, DATA, DATA, GND), receiver chip, crystal and air-core
 *   coil;
 * - transmissor: the common generic ~19 × 19 mm transmitter: one transistor
 *   oscillator keyed by DATA (OOK), stabilized by a SAW resonator in a round
 *   metal can (Ø 8 mm, marked only with its frequency), an air-core coil that
 *   feeds the ANT hole, a few 0805 parts and three pins in a row (DATA, VCC,
 *   GND, 2,54 mm), generated with the kit's PCB generator.
 *
 * Antenna: a straight insulated wire ("fio", default 173 mm = ¼ of
 * λ = 691 mm at 433,92 MHz), a compressed helical spring wound from the same
 * length of 0,8 mm wire (Ø 5 mm, 1,3 mm pitch) or none.
 *
 * Category 'placas': both are ready-made boards that are plugged into a
 * project, and the transmitter is not a sensor. Generic shapes, no brand
 * markings. Exploded view: the antenna lifts off its hole; on the
 * transmitter the board also splits into its layers.
 */
import { BoxGeometry, type BufferGeometry } from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { OnBoard, PrintedCircuitBoard } from '../pcb/PrintedCircuitBoard';
import type { PcbLayout, Point } from '../pcb/layout';
import { axialLathe, smoothPath, tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { mergeAll, roundedBox } from './_em-geometry';
import { RF_ANTENNA, RF_PINS, RF_SIZE, RfModule, WireAntenna } from './_gate-parts';

type Kind = 'receptor' | 'transmissor';
type AntennaKind = 'fio' | 'mola' | 'nenhuma';

export interface RfModule433Props {
  kind?: Kind;
  antenna?: AntennaKind;
  /** Length of the antenna wire (mm), straight or wound into the spring. */
  antennaLength?: number;
}

const FREQ_MHZ = 433.92;
/** Quarter wavelength at 433,92 MHz (mm). */
const QUARTER = (299_792_458 / (FREQ_MHZ * 1e6) / 4) * 1000;

/** Receiver: the module's pins go 3,5 mm below its local y = 0. */
const RX_LIFT = 3.5;

// Transmitter board (layout mm, from the top-left corner, y towards the pins).
const TX_W = 19;
const TX_H = 19;
const TX_T = 1.6;
const TX_PIN_BELOW = 6;
const TX_SPACER = 2.5;
const TX_Y = TX_PIN_BELOW + TX_SPACER;
const TX_TOP = TX_Y + TX_T;
const TX_PINS: { label: string; at: Point }[] = [
  { label: 'DATA', at: [6.96, 17.2] },
  { label: 'VCC', at: [9.5, 17.2] },
  { label: 'GND', at: [12.04, 17.2] },
];
const TX_ANT: Point = [16.5, 1.9];
const TX_SAW: Point = [7.5, 7.5];
const TX_COIL = { x: 15.5, y0: 4.4, y1: 10.6 };
const TX_Q: Point = [15.5, 14.3];
const TX_SMD: { at: Point; kind: 'r' | 'c' }[] = [
  { at: [3, 13.2], kind: 'r' },
  { at: [6.6, 13.2], kind: 'c' },
  { at: [10.6, 13.2], kind: 'r' },
  { at: [17.4, 8.6], kind: 'c' },
];
const SAW_R = 4;
const SAW_H = 3.6;

/** Layout point → part space (transmitter), at height y. */
const tx = ([x, y]: Point, h: number): Vec3 => [x - TX_W / 2, h, y - TX_H / 2];

/** Spring antenna: mean diameter, pitch and wire radius (mm). */
const SPRING_D = 5;
const SPRING_PITCH = 1.3;
const SPRING_WIRE = 0.4;
const SPRING_LEAD = 2.5;

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

interface Resolved {
  kind: Kind;
  antenna: AntennaKind;
  length: number;
}

function resolve(p: PartProps): Resolved {
  const kind: Kind = p.kind === 'transmissor' ? 'transmissor' : 'receptor';
  const antenna: AntennaKind = p.antenna === 'mola' || p.antenna === 'nenhuma' ? p.antenna : 'fio';
  const n = Number(p.antennaLength);
  return { kind, antenna, length: clamp(Number.isFinite(n) ? n : 173, 10, 1000) };
}

/** Where the antenna is soldered (top of the hole). */
function antennaBase(kind: Kind): Vec3 {
  if (kind === 'receptor') return [RF_ANTENNA[0], RF_ANTENNA[1] + RX_LIFT, RF_ANTENNA[2]];
  return tx(TX_ANT, TX_TOP + 0.5);
}

function springTurns(length: number) {
  return Math.max(length - SPRING_LEAD, 1) / (Math.PI * SPRING_D);
}

function springHeight(length: number) {
  return SPRING_LEAD + springTurns(length) * SPRING_PITCH;
}

/** Radius of the insulated antenna wire (`WireAntenna`). */
const WIRE_R = 0.62;

function wirePoints(base: Vec3, reach: number): Vec3[] {
  const [x, y, z] = base;
  const out: Vec3[] = [
    [x, y, z],
    [x, y + 4, z],
    [x + 2.5, y + 7, z],
    [x + 9, y + 6, z - 0.5],
    [x + 17, 3.2, z - 1.4],
    [x + 25, WIRE_R, z - 2.4],
  ];
  // Laid on the bench in a wide arc that curls behind the board.
  const R = clamp(reach / 3, 12, 50);
  const n = Math.max(4, Math.ceil(reach / 12));
  for (let k = 1; k <= n; k++) {
    const a = ((reach / R) * k) / n;
    out.push([x + 25 + R * Math.sin(a), WIRE_R, z - 2.4 - R + R * Math.cos(a)]);
  }
  return out;
}

/**
 * Path of the wire antenna: up out of the hole, bent over and laid along the
 * bench in a wide arc behind the board (so the small board still fills the view), with
 * the length along the curve equal to `length`.
 */
function wirePath(base: Vec3, length: number): Vec3[] {
  let lo = 1;
  let hi = Math.max(length, 2);
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (smoothPath(wirePoints(base, mid), 0.5).getLength() < length) lo = mid;
    else hi = mid;
  }
  return wirePoints(base, (lo + hi) / 2);
}

/** Point the antenna marker points at. */
function antennaMarker(r: Resolved): Vec3 {
  const [x, y, z] = antennaBase(r.kind);
  if (r.antenna === 'nenhuma') return [x, y, z];
  if (r.antenna === 'mola')
    return [x - SPRING_D / 2, y + springHeight(r.length) * 0.6, z + SPRING_D / 2];
  const point = smoothPath(wirePath([x, y, z], r.length), 0.5).getPointAt(0.7);
  return [point.x, point.y, point.z];
}

const cm = (mm: number) => formatNumber(mm / 10, 3);
const onResonance = (length: number) => Math.abs(length - QUARTER) <= 3;

function antennaNote(r: Resolved): string {
  if (r.antenna === 'nenhuma')
    return 'Furo da antena (ANT): sem antena, o alcance cai para poucos metros';
  if (r.antenna === 'mola')
    return onResonance(r.length)
      ? `Antena em mola: ${cm(r.length)} cm de fio enrolados; menor, mas alcança menos que o fio esticado`
      : `Antena em mola de ${cm(r.length)} cm de fio: fora da ressonância (¼ de onda em 433,92 MHz são ${cm(QUARTER)} cm)`;
  return onResonance(r.length)
    ? `Antena de ¼ de onda: ${cm(r.length)} cm em 433,92 MHz`
    : `Antena de ${cm(r.length)} cm: fora da ressonância (¼ de onda em 433,92 MHz são ${cm(QUARTER)} cm)`;
}

// Receiver marker points (part space).
const RX_CHIP: Vec3 = [3, RF_SIZE.lift + 2.5 + RX_LIFT, -1.2];
const RX_CRYSTAL: Vec3 = [-6, RF_SIZE.lift + 4.4 + RX_LIFT, -1.6];
const RX_COIL: Vec3 = [10, RF_SIZE.lift + 3.1 + RX_LIFT, 3.4];
const RX_PINS: Vec3 = [
  RF_PINS.reduce((s, [x]) => s + x, 0) / RF_PINS.length,
  1.2,
  RF_PINS[0]![1] + 0.4,
];
// Transmitter marker points.
const TX_SAW_TOP: Vec3 = tx([TX_SAW[0] + 1.5, TX_SAW[1] - 1.5], TX_TOP + SAW_H);
const TX_COIL_TOP: Vec3 = tx([TX_COIL.x, (TX_COIL.y0 + TX_COIL.y1) / 2], TX_TOP + 3.2);
const TX_Q_TOP: Vec3 = tx(TX_Q, TX_TOP + 1.1);
const TX_PINS_AT: Vec3 = [0, 2, TX_PINS[0]!.at[1] - TX_H / 2];

export const meta: PartMeta = {
  id: 'rf-module-433',
  label: 'Módulo de rádio 433 MHz',
  category: 'placas',
  summary:
    'Módulos receptor e transmissor de 433,92 MHz, os mesmos dos controles de portão: placa pequena com pinos, ressonador que fixa a frequência e antena de ¼ de onda.',
  defaults: { kind: 'receptor', antenna: 'fio', antennaLength: 173 },
  controls: {
    kind: {
      kind: 'select',
      label: 'Módulo',
      options: [
        { value: 'receptor', label: 'Receptor' },
        { value: 'transmissor', label: 'Transmissor' },
      ],
    },
    antenna: {
      kind: 'select',
      label: 'Antena',
      options: [
        { value: 'fio', label: 'Fio esticado' },
        { value: 'mola', label: 'Mola (helicoidal)' },
        { value: 'nenhuma', label: 'Nenhuma' },
      ],
    },
    antennaLength: {
      kind: 'number',
      label: 'Comprimento do fio da antena',
      min: 40,
      max: 250,
      step: 1,
      unit: 'mm',
    },
  },
  annotations: (p) => {
    const r = resolve(p);
    const notes: PartAnnotation[] = [
      { at: antennaMarker(r), text: antennaNote(r), anchor: 'rf-antenna' },
    ];
    if (r.kind === 'receptor')
      notes.push(
        { at: RX_CRYSTAL, text: 'Cristal ou ressonador SAW: fixa a frequência em 433,92 MHz' },
        { at: RX_CHIP, text: 'Chip receptor: amplifica, filtra e transforma o rádio em bits' },
        {
          at: RX_COIL,
          text: 'Bobina de núcleo de ar: com um capacitor, sintoniza a entrada de rádio',
        },
        { at: RX_PINS, text: 'Pinos: VCC, DATA, DATA, GND' },
      );
    else
      notes.push(
        {
          at: TX_SAW_TOP,
          text: 'Cristal ou ressonador SAW: fixa a frequência em 433,92 MHz',
          anchor: 'rf-saw',
        },
        {
          at: TX_Q_TOP,
          text: 'Transistor: liga e desliga o oscilador conforme o pino DATA (modulação OOK)',
          anchor: 'rf-transistor',
        },
        {
          at: TX_COIL_TOP,
          text: 'Bobina de núcleo de ar: leva o sinal de 433,92 MHz até a antena',
          anchor: 'rf-coil',
        },
        { at: TX_PINS_AT, text: 'Pinos: DATA, VCC, GND' },
      );
    return notes;
  },
  explode: true,
  describe: (p) => {
    const r = resolve(p);
    const antenna =
      r.antenna === 'nenhuma'
        ? 'Está sem antena: assim o alcance cai para poucos metros.'
        : r.antenna === 'mola'
          ? `A antena é uma mola de fio de cobre com ${cm(r.length)} cm de fio enrolados em ${cm(springHeight(r.length))} cm de altura${onResonance(r.length) ? ' (o ¼ de onda enrolado)' : `, fora do ¼ de onda de ${cm(QUARTER)} cm`}; ocupa pouco espaço, mas alcança menos que um fio esticado.`
          : `A antena é um fio esticado de ${cm(r.length)} cm${onResonance(r.length) ? ', ¼ do comprimento de onda de 69,1 cm' : `, fora da ressonância: o ¼ de onda em 433,92 MHz tem ${cm(QUARTER)} cm`}.`;
    const board =
      r.kind === 'receptor'
        ? 'Módulo receptor de 433,92 MHz: placa verde de 32 × 12 mm sobre quatro pinos (VCC, DATA, DATA, GND), com o chip receptor, um cristal em lata metálica e uma bobina de núcleo de ar. Ele capta o rádio e entrega no pino DATA os bits que o controle enviou.'
        : 'Módulo transmissor de 433,92 MHz: placa verde de 19 × 19 mm com um ressonador SAW em lata metálica redonda, um transistor, uma bobina de núcleo de ar, alguns componentes SMD e três pinos em fila (DATA, VCC, GND). Quando o pino DATA vai a nível alto, ele emite; em nível baixo, fica em silêncio.';
    return `${board} ${antenna}`;
  },
  view: [0.75, 0.62, 1],
};

// ---------------------------------------------------------------------------

function buildTxLayout(): PcbLayout {
  const smdPads = TX_SMD.flatMap(({ at }) =>
    [-1, 1].map((s) => ({
      at: [at[0] + s * 0.95, at[1]] as Point,
      size: [0.9, 1.3] as Point,
      shape: 'rect' as const,
    })),
  );
  return {
    width: TX_W,
    height: TX_H,
    thickness: TX_T,
    corner: 0.6,
    mask: 'verde',
    pads: [
      ...TX_PINS.map(({ label, at }, i) => ({
        id: `J1.${label}`,
        at,
        drill: 1,
        size: 1.7,
        shape: i === 0 ? ('square' as const) : ('round' as const),
      })),
      { id: 'ANT', at: TX_ANT, drill: 1, size: 2 },
      { at: [TX_COIL.x, TX_COIL.y0], drill: 0.8, size: 1.5 },
      { at: [TX_COIL.x, TX_COIL.y1], drill: 0.8, size: 1.5 },
      ...smdPads,
      { at: [TX_Q[0], TX_Q[1] - 1.1], size: [0.8, 0.9], shape: 'rect' },
      { at: [TX_Q[0] - 0.95, TX_Q[1] + 1.1], size: [0.8, 0.9], shape: 'rect' },
      { at: [TX_Q[0] + 0.95, TX_Q[1] + 1.1], size: [0.8, 0.9], shape: 'rect' },
    ],
    traces: [
      {
        points: [
          [6.96, 17.2],
          [6.96, 15.3],
          [3.95, 15.3],
          [3.95, 13.2],
        ],
        width: 0.5,
      },
      {
        points: [
          [2.05, 13.2],
          [1.6, 12.4],
          [1.6, 8.4],
        ],
        width: 0.5,
      },
      {
        points: [
          [9.5, 17.2],
          [9.5, 15.3],
          [11.55, 15.3],
          [11.55, 13.2],
        ],
        width: 0.6,
      },
      {
        points: [
          [9.65, 13.2],
          [7.55, 13.2],
        ],
        width: 0.5,
      },
      {
        points: [
          [TX_COIL.x, TX_COIL.y1],
          [TX_Q[0], TX_Q[1] - 1.1],
        ],
        width: 0.6,
      },
      {
        points: [
          [TX_COIL.x, TX_COIL.y0],
          [TX_COIL.x, 3.2],
          [TX_ANT[0], TX_ANT[1]],
        ],
        width: 0.7,
      },
      {
        points: [
          [12.04, 17.2],
          [12.04, 16.3],
          [TX_Q[0] - 0.95, 16.3],
          [TX_Q[0] - 0.95, TX_Q[1] + 1.1],
        ],
        width: 0.6,
      },
      {
        points: [
          [TX_Q[0] + 0.95, TX_Q[1] + 1.1],
          [17.9, 15.4],
          [17.9, 9.55],
          [17.4 + 0.95, 8.6],
        ],
        width: 0.4,
      },
      {
        points: [
          [17.4 - 0.95, 8.6],
          [12.2, 8.6],
        ],
        width: 0.4,
      },
    ],
    pours: [
      {
        outline: [
          [0.6, 0.6],
          [TX_W - 0.6, 0.6],
          [TX_W - 0.6, TX_H - 0.6],
          [0.6, TX_H - 0.6],
        ],
        side: 'bottom',
        net: 'GND',
        clearance: 0.5,
      },
    ],
    vias: [
      { at: [13.2, 16.3], net: 'GND' },
      { at: [2.2, 16.6], net: 'GND' },
      { at: [17.6, 17.6], net: 'GND' },
    ],
    silk: [
      ...TX_PINS.map(({ label, at }) => ({
        kind: 'text' as const,
        at: [at[0], 18.5] as Point,
        text: label,
        size: 0.55,
      })),
      { kind: 'text', at: [13.3, TX_ANT[1]], text: 'ANT', size: 1 },
      { kind: 'circle', at: TX_SAW, r: SAW_R + 0.45, width: 0.15 },
      {
        kind: 'rect',
        at: [TX_COIL.x, (TX_COIL.y0 + TX_COIL.y1) / 2],
        size: [3.6, TX_COIL.y1 - TX_COIL.y0 + 1.8],
        width: 0.12,
      },
      { kind: 'text', at: [1.4, 1.4], text: '433,92', size: 0.7, align: 'left' },
    ],
  };
}

const TX_LAYOUT = buildTxLayout();

/** Box from y = 0 to h, centred on (x, z). */
function box(w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry {
  return new BoxGeometry(w, h, d).translate(x, y + h / 2, z);
}

function TransmitterBoard() {
  const noise = getNoiseTexture();
  // SAW resonator: TO-39-like can with a flange, on the board.
  const saw = useDisposable(
    () =>
      axialLathe(
        [
          [0, 0.25],
          [SAW_R + 0.5, 0.25],
          [SAW_R + 0.5, 0.75],
          [SAW_R, 0.8],
          [SAW_R, SAW_H - 0.35],
          [SAW_R - 0.35, SAW_H],
          [0, SAW_H],
        ],
        48,
      ),
    [],
  );
  const sawMark = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = 'rgba(45,45,48,0.85)';
      fitText(ctx, '433,92', w / 2, h * 0.42, w * 0.7, h * 0.2, { weight: 700 });
      fitText(ctx, 'SAW', w / 2, h * 0.64, w * 0.4, h * 0.13, { weight: 600 });
    },
    'rf433-saw-mark',
    { width: 256, height: 256, fonts: [`700 40px ${FONT_SANS}`] },
  );
  const coil = useDisposable(() => {
    const turns = 4;
    const R = 1.25;
    const hc = 1.9;
    const len = TX_COIL.y1 - TX_COIL.y0;
    const pts: Vec3[] = [
      [0, -1.6, 0],
      [0, 0, 0],
      [0, hc - R - 0.4, 0],
    ];
    const n = turns * 16;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = t * turns * Math.PI * 2;
      pts.push([R * Math.sin(a), hc - R * Math.cos(a), 0.35 + (len - 0.7) * t]);
    }
    pts.push([0, hc - R - 0.4, len], [0, 0, len], [0, -1.6, len]);
    return tube(smoothPath(pts, 0.5), 0.3, { radial: 6, segments: 220 });
  }, []);
  const black = useDisposable(() => {
    const parts = TX_SMD.filter((s) => s.kind === 'r').map(({ at }) =>
      box(1.3, 0.48, 1.25, at[0] - TX_W / 2, 0.02, at[1] - TX_H / 2),
    );
    parts.push(box(1.3, 0.95, 2.9, TX_Q[0] - TX_W / 2, 0.12, TX_Q[1] - TX_H / 2));
    return mergeAll(parts);
  }, []);
  const tan = useDisposable(
    () =>
      mergeAll(
        TX_SMD.filter((s) => s.kind === 'c').map(({ at }) =>
          box(1.3, 0.62, 1.25, at[0] - TX_W / 2, 0.02, at[1] - TX_H / 2),
        ),
      ),
    [],
  );
  const metal = useDisposable(() => {
    const parts: BufferGeometry[] = [];
    for (const { at, kind } of TX_SMD)
      for (const s of [-1, 1])
        parts.push(
          box(
            0.36,
            kind === 'r' ? 0.5 : 0.64,
            1.27,
            at[0] - TX_W / 2 + s * 0.83,
            0.01,
            at[1] - TX_H / 2,
          ),
        );
    // SOT-23 leads: one on the far side, two on the near side (gull wing, flattened).
    const qx = TX_Q[0] - TX_W / 2;
    const qz = TX_Q[1] - TX_H / 2;
    parts.push(box(0.42, 0.14, 0.75, qx, 0.02, qz - 1.25));
    for (const s of [-1, 1]) parts.push(box(0.42, 0.14, 0.75, qx + s * 0.95, 0.02, qz + 1.25));
    return mergeAll(parts);
  }, []);
  return (
    <group>
      <group position={tx(TX_SAW, 0)}>
        <mesh geometry={saw}>
          <Material preset="nickel" roughness={0.24} roughnessMap={noise} />
        </mesh>
        <mesh position={[0, SAW_H + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[SAW_R - 0.4, 32]} />
          <meshBasicMaterial map={sawMark} transparent depthWrite={false} />
        </mesh>
      </group>
      <mesh geometry={coil} position={tx([TX_COIL.x, TX_COIL.y0], 0)}>
        <Material preset="magnetWire" color="#c8783f" />
      </mesh>
      <mesh geometry={black}>
        <Material preset="epoxyBlack" />
      </mesh>
      <mesh geometry={tan}>
        <Material color="#b59a72" roughness={0.6} />
      </mesh>
      <mesh geometry={metal}>
        <Material preset="tin" />
      </mesh>
      <Anchor name="rf-saw" position={[TX_SAW_TOP[0], TX_SAW_TOP[1] - TX_TOP, TX_SAW_TOP[2]]} />
      <Anchor name="rf-coil" position={[TX_COIL_TOP[0], TX_COIL_TOP[1] - TX_TOP, TX_COIL_TOP[2]]} />
      <Anchor name="rf-transistor" position={[TX_Q_TOP[0], TX_Q_TOP[1] - TX_TOP, TX_Q_TOP[2]]} />
    </group>
  );
}

function Transmitter() {
  const header = useDisposable(() => {
    const [x0, , z] = tx(TX_PINS[1]!.at, 0);
    return box(7.62, TX_SPACER, 2.5, x0, TX_PIN_BELOW, z);
  }, []);
  const pins = useDisposable(
    () =>
      mergeAll(
        TX_PINS.map(({ at }) => {
          const [x, , z] = tx(at, 0);
          return box(0.64, TX_TOP + 1.2, 0.64, x, 0, z);
        }),
      ),
    [],
  );
  const solder = useDisposable(
    () =>
      mergeAll(
        TX_PINS.map(({ at }) => {
          const [x, , z] = tx(at, 0);
          return roundedBox(1.5, 0.55, 1.5, 0.7, 0.25).translate(x, TX_TOP, z);
        }),
      ),
    [],
  );
  return (
    <group>
      <group position={[0, TX_Y, 0]}>
        <PrintedCircuitBoard layout={TX_LAYOUT}>
          <OnBoard layout={TX_LAYOUT} at={[TX_W / 2, TX_H / 2]} lift={0}>
            <TransmitterBoard />
          </OnBoard>
        </PrintedCircuitBoard>
      </group>
      <mesh geometry={header}>
        <Material preset="pbtBlack" />
      </mesh>
      <mesh geometry={pins}>
        <Material preset="tin" />
      </mesh>
      <mesh geometry={solder}>
        <Material preset="solder" />
      </mesh>
    </group>
  );
}

function SpringAntenna({ base, length }: { base: Vec3; length: number }) {
  const geometry = useDisposable(() => {
    const [x, y, z] = base;
    const R = SPRING_D / 2;
    const turns = springTurns(length);
    const pts: Vec3[] = [
      [x, y - 1.4, z],
      [x, y + SPRING_LEAD * 0.5, z],
      [x, y + SPRING_LEAD, z],
    ];
    const n = Math.ceil(turns * 20);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const a = t * turns * Math.PI * 2;
      pts.push([
        x - R + R * Math.cos(a),
        y + SPRING_LEAD + t * turns * SPRING_PITCH,
        z + R * Math.sin(a),
      ]);
    }
    return tube(smoothPath(pts, 0.5), SPRING_WIRE, { radial: 7, segments: Math.min(n * 3, 400) });
  }, [base, length]);
  return (
    <mesh geometry={geometry}>
      <Material preset="copper" roughness={0.28} />
    </mesh>
  );
}

export default function RfModule433(props: RfModule433Props) {
  const p = { ...meta.defaults, ...props } as Required<RfModule433Props>;
  const r = resolve(p as unknown as PartProps);
  const base = antennaBase(r.kind);
  const marker = antennaMarker(r);
  return (
    <group>
      {r.kind === 'receptor' ? (
        <group position={[0, RX_LIFT, 0]}>
          <RfModule />
        </group>
      ) : (
        <Transmitter />
      )}
      <Explode offset={[0, r.antenna === 'mola' ? 14 : 28, 0]}>
        {r.antenna === 'fio' && <WireAntenna points={wirePath(base, r.length)} />}
        {r.antenna === 'mola' && <SpringAntenna base={base} length={r.length} />}
        <Anchor name="rf-antenna" position={marker} />
      </Explode>
    </group>
  );
}
