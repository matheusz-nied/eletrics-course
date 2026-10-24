/**
 * Keychain remote for gate openers (433,92 MHz, fixed or rolling code), the
 * generic kind sold for most Brazilian gate controllers: 68 × 36 × 14,5 mm
 * dark ABS shell in two halves with a round key-ring end, two or four hard
 * plastic button caps numbered 1 to 4. Sizes follow common remotes of this
 * type (60–70 mm long, 34–38 mm wide, 13–16 mm thick).
 *
 * Inside: a 1 mm board with the loop antenna printed around its edge (the
 * copper trace is the oscillator's inductor and the radiator at once), 6 × 6
 * tactile switches under the caps, the encoder chip (SOIC-8, 4,9 × 3,9 mm),
 * the SAW resonator that fixes the frequency (round metal can, Ø 8,6 mm),
 * the RF transistor (SOT-23, 2,9 × 1,3 mm), a few 0603 parts and a 3 mm red
 * LED that shows through the top. Battery: a 12 V A23 (Ø 10,3 × 28,5 mm,
 * IEC "8LR932") across the end of the shell between a flat contact and a
 * conical spring, or a 3 V CR2032 coin cell (Ø 20 × 3,2 mm) in a holder on
 * the board.
 *
 * Category "placas": what this part teaches is the assembled board inside
 * (antenna printed on it, resonator, encoder), not a light or a motor, so it
 * sits with the boards rather than with "saídas".
 *
 * Generic shapes and markings only: no brand.
 */
import { useRef, type RefObject } from 'react';
import { type BufferGeometry, type Group } from 'three';
import { Anchor, Explode } from '../core/view';
import { emission, GLOW, GlowSprite } from '../fx/glow';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { PrintedCircuitBoard } from '../pcb/PrintedCircuitBoard';
import type { PcbLayout, PcbPad, PcbSilk, PcbTrace, PcbVia, Point } from '../pcb/layout';
import { axialLathe, roundedCylinderProfile, smoothPath, tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { mergeAll } from './_em-geometry';
import { useSmooth } from './_em-kit';
import { moldedBlock } from './_semi-geometry';
import { usePrintedTop } from './_semi-parts';
import {
  ConeSpring,
  boxAt,
  bottomShellGeometry,
  gullWings,
  postAt,
  topShellGeometry,
  type Hole,
  type ShellSpec,
} from './_remote-geometry';

type Battery = 'a23' | 'cr2032';

export interface RemoteControl433Props {
  /** Number of buttons: 2 or 4. */
  buttons?: 2 | 4;
  battery?: Battery;
  /** Button held down (1 to `buttons`); 0 = none. The LED lights while it transmits. */
  pressed?: number;
}

/* ---------------------------------------------------------------- sizes */

const SHELL: ShellSpec = {
  outline: { length: 68, width: 36, corner: 6 },
  height: 14.5,
  parting: 6,
  wall: 1.4,
  fillet: 1.6,
  ring: { x: -29, z: 0, r: 2.4, boss: 3.6 },
};
const H = SHELL.height;
const CEILING = H - SHELL.wall;

/** Board: 1,0 mm FR-4, bottom at y = 5, from x = −24; 28 mm wide (Z). */
const BOARD = { x0: -24, y: 5, t: 1, depth: 28 };
const BOARD_W: Record<Battery, number> = { a23: 36, cr2032: 56.4 };
const BOARD_TOP = BOARD.y + BOARD.t;

/** Tactile switch 6 × 6 × 4,3 mm (SMD): base, steel plate, plunger. */
const SW = { size: 6, base: 3.4, plate: 0.25, plunger: 1.75, top: 4.3, travel: 0.25 };
/** Cap: hangs from its flange under the ceiling, 0,3 mm above the plunger. */
const CAP = { gap: 0.3, flange: 1, above: 0.8 };
const CAP_BOTTOM = BOARD_TOP + SW.top + CAP.gap;
const CAP_TOP = H + CAP.above;

/** Button columns and rows in board coordinates (mm from the board's top-left corner). */
const COLUMNS = [14.5, 29.5];
const ROWS: Record<2 | 4, number[]> = { 2: [14], 4: [7.5, 20.5] };
const STEM_R: Record<2 | 4, number> = { 2: 4.6, 4: 3.6 };

/** Parts in board coordinates. */
const LED_AT: Point = [4.5, 14];
const U1: Point = [22, 11];
const Y1: Point = [22, 20.6];
const Q1: Point = [22, 4.4];
const COIN: Point = [45.2, 14];

/** A23: axis along Z, centre x = 23 mm; + end towards −Z. */
const A23 = { x: 23, r: 5.15, length: 28.5, plus: -14.85, minus: 13.65, plate: 15.6 };
const A23_Y = SHELL.wall + 0.3 + A23.r;

/** 3 mm LED (Kingbright L-934 class): body r 1,5, flange r 1,9, height 5,3 mm. */
const LED = { r: 1.5, flange: 1.9, flangeH: 0.9, height: 5.3, base: 9.5 };
const LED_RED = '#ff2414';

/* ------------------------------------------------------------- helpers */

const buttonsOf = (v: unknown): 2 | 4 => (Number(v) === 4 ? 4 : 2);
const batteryOf = (v: unknown): Battery => (v === 'cr2032' ? 'cr2032' : 'a23');
function pressedOf(v: unknown, buttons: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= buttons ? n : 0;
}

/** Button centres in board coordinates, numbered left to right, back row first. */
function buttonPoints(buttons: 2 | 4): Point[] {
  return ROWS[buttons].flatMap((y) => COLUMNS.map((x): Point => [x, y]));
}

/** World position of a board point at height y. */
function world([x, y]: Point, h: number): Vec3 {
  return [BOARD.x0 + x, h, y - BOARD.depth / 2];
}

/* -------------------------------------------------------------- layout */

const layouts = new Map<string, PcbLayout>();

/** Board layout for this combination (cached: the board maps are drawn once). */
function layoutFor(buttons: 2 | 4, battery: Battery): PcbLayout {
  const key = `${buttons}-${battery}`;
  const cached = layouts.get(key);
  if (cached) return cached;
  const W = BOARD_W[battery];
  const D = BOARD.depth;
  const pads: PcbPad[] = [];
  const traces: PcbTrace[] = [];
  const vias: PcbVia[] = [];
  const silk: PcbSilk[] = [];
  const smd = (id: string, at: Point, size: Point, net?: string) =>
    pads.push({ id, at, size, shape: 'roundrect', net });
  const chip0603 = (id: string, [x, y]: Point, vertical: boolean) => {
    const d = 0.75;
    smd(`${id}.1`, vertical ? [x, y - d] : [x - d, y], vertical ? [0.9, 0.8] : [0.8, 0.9]);
    smd(`${id}.2`, vertical ? [x, y + d] : [x + d, y], vertical ? [0.9, 0.8] : [0.8, 0.9]);
  };
  const line = (points: Point[], width = 0.35, side: 'top' | 'bottom' = 'top') =>
    traces.push({ points, width, side });

  // Loop antenna around the edge, open at the RF stage (C1 on one end, Q1 on the other).
  // Left without solder mask (tinned), as on many remotes, so it reads at a glance.
  const loop: Point[] = [
    [18.5, 3.6],
    [18.5, 1.5],
    [1.5, 1.5],
    [1.5, D - 1.5],
    [W - 1.5, D - 1.5],
    [W - 1.5, 1.5],
    [25.5, 1.5],
    [25.5, 3.4],
    [22.4, 3.4],
  ];
  line(loop, 1);
  loop.slice(1).forEach(([x1, y1], i) => {
    const [x0, y0] = loop[i]!;
    const at: Point = [(x0 + x1) / 2, (y0 + y1) / 2];
    const size: Point = [Math.abs(x1 - x0) + 1, Math.abs(y1 - y0) + 1];
    pads.push({ id: `ANT.${i}`, at, size, shape: 'rect' });
  });
  silk.push({ kind: 'text', at: [9, 3.6], text: 'ANT', size: 1 });

  // RF stage: Q1 (SOT-23), C1, R2.
  smd('Q1.3', [Q1[0], Q1[1] - 1], [0.9, 0.8]);
  smd('Q1.1', [Q1[0] - 0.95, Q1[1] + 1], [0.8, 0.9]);
  smd('Q1.2', [Q1[0] + 0.95, Q1[1] + 1], [0.8, 0.9], 'GND');
  chip0603('C1', [18.5, 4.4], true);
  chip0603('R2', [24.6, 6.3], true);
  line([
    [18.5, 5.15],
    [18.5, 5.4],
    [Q1[0] - 0.95, 5.4],
  ]);
  line([
    [Q1[0] + 0.95, 5.55],
    [24.6, 5.55],
  ]);
  line([
    [24.6, 7.05],
    [24.6, 7.6],
    [23.905, 7.6],
    [23.905, 8.3],
  ]);
  silk.push({ kind: 'text', at: [20.4, 7], text: 'U1', size: 0.9 });

  // Encoder U1 (SOIC-8, pins along X at 1,27 mm) and its decoupling capacitor.
  [-1.905, -0.635, 0.635, 1.905].forEach((dx, i) => {
    smd(`U1.${i + 1}`, [U1[0] + dx, U1[1] + 2.7], [0.6, 1.5]);
    smd(`U1.${8 - i}`, [U1[0] + dx, U1[1] - 2.7], [0.6, 1.5]);
  });
  chip0603('C3', [22, 15.6], false);
  line([
    [U1[0] - 0.635, U1[1] + 2.7],
    [U1[0] - 0.635, 15.6],
    [21.25, 15.6],
  ]);

  // SAW resonator Y1: three leads of the metal can.
  for (const [i, at] of (
    [
      [Y1[0] - 1.8, Y1[1] + 1],
      [Y1[0] + 1.8, Y1[1] + 1],
      [Y1[0], Y1[1] - 1.9],
    ] as Point[]
  ).entries())
    pads.push({ id: `Y1.${i + 1}`, at, drill: 0.7, size: 1.3, solder: true, lead: 0.45 });
  silk.push({ kind: 'circle', at: Y1, r: 4.5, width: 0.15 });
  line([
    [Y1[0], Y1[1] - 1.9],
    [Y1[0], 17.4],
    [23.4, 17.4],
    [23.4, 15.6],
    [22.75, 15.6],
  ]);

  // LED D1 with R1.
  pads.push({
    id: 'D1.A',
    at: [LED_AT[0], LED_AT[1] - 1.27],
    drill: 0.8,
    size: 1.5,
    shape: 'square',
    solder: true,
    lead: 0.5,
  });
  pads.push({
    id: 'D1.K',
    at: [LED_AT[0], LED_AT[1] + 1.27],
    drill: 0.8,
    size: 1.5,
    net: 'GND',
    solder: true,
    lead: 0.5,
  });
  silk.push({ kind: 'circle', at: LED_AT, r: 2.1, width: 0.15 });
  chip0603('R1', [7.5, 9.5], true);
  line([
    [LED_AT[0], LED_AT[1] - 1.27],
    [LED_AT[0], 11.2],
    [7.5, 11.2],
    [7.5, 10.25],
  ]);
  line([
    [7.5, 8.75],
    [7.5, 6.6],
  ]);
  vias.push({ at: [7.5, 6.6] }, { at: [LED_AT[0], 17.6], net: 'GND' });
  line([
    [LED_AT[0], LED_AT[1] + 1.27],
    [LED_AT[0], 17.6],
  ]);

  // Tactile switches: four SMD legs each, joined to the encoder through vias.
  buttonPoints(buttons).forEach(([x, y], i) => {
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        smd(`SW${i + 1}.${sx}${sy}`, [x + sx * 3.6, y + sy * 2.25], [1.4, 1], sx > 0 ? 'GND' : '');
    silk.push({ kind: 'rect', at: [x, y], size: [6.4, 6.4], width: 0.15 });
    silk.push({ kind: 'text', at: [x, y + 4.1], text: `SW${i + 1}`, size: 0.9 });
    const inner = x < U1[0] ? 1 : -1;
    const legX = x + inner * 3.6;
    const via: Point = [legX + inner * 1.1, y - 2.25];
    line([[legX, y - 2.25], via]);
    vias.push({ at: via });
  });
  for (const dx of [-1.905, 1.905]) vias.push({ at: [U1[0] + dx, U1[1] - 4.6] });

  // Battery contacts.
  if (battery === 'a23') {
    for (const [id, y] of [
      ['BAT+', 3],
      ['BAT-', D - 3],
    ] as const)
      pads.push({ id, at: [33, y], drill: 0.9, size: 1.8, solder: true, lead: 0.6 });
    line(
      [
        [33, 3],
        [27, 3],
      ],
      0.6,
    );
    vias.push({ at: [27, 3] });
  } else {
    pads.push({ id: 'BT1-', at: COIN, size: 9, shape: 'round', net: 'GND' });
    smd('BT1+a', [COIN[0], 2.95], [5.6, 1]);
    smd('BT1+b', [COIN[0], D - 2.95], [5.6, 1]);
    silk.push({ kind: 'circle', at: COIN, r: 11.2, width: 0.15 });
    line(
      [
        [COIN[0] - 2.8, 2.95],
        [36, 2.95],
        [36, 5.5],
      ],
      0.6,
    );
    vias.push({ at: [36, 5.5] });
  }

  const layout: PcbLayout = {
    width: W,
    height: D,
    thickness: BOARD.t,
    corner: 3,
    mask: 'verde',
    finish: 'hasl',
    pads,
    traces,
    vias,
    // Ground on the bottom, kept away from the loop (it would short the antenna's field).
    pours: [
      {
        outline: [
          [3.2, 3.2],
          [W - 3.2, 3.2],
          [W - 3.2, D - 3.2],
          [3.2, D - 3.2],
        ],
        side: 'bottom',
        net: 'GND',
        clearance: 0.4,
      },
    ],
    silk,
  };
  layouts.set(key, layout);
  return layout;
}

/* ---------------------------------------------------------------- meta */

const resolve = (props: PartProps) => ({ ...meta.defaults, ...props });
const EXPLODE_Z = -2 * Math.min(16, Math.max(3, BOARD.depth * 0.24));

export const meta: PartMeta = {
  id: 'remote-control-433',
  label: 'Controle remoto de portão (433 MHz)',
  category: 'placas',
  summary:
    'Controle de chaveiro de portão: botões, chip codificador, ressonador SAW de 433,92 MHz, transistor de RF e a antena de laço impressa na borda da placa.',
  defaults: { buttons: 2, battery: 'a23', pressed: 0 },
  controls: {
    buttons: {
      kind: 'select',
      label: 'Botões',
      options: [
        { value: 2, label: '2 botões' },
        { value: 4, label: '4 botões' },
      ],
    },
    battery: {
      kind: 'select',
      label: 'Bateria',
      options: [
        { value: 'a23', label: '12 V (A23)' },
        { value: 'cr2032', label: '3 V (CR2032)' },
      ],
    },
    pressed: {
      kind: 'select',
      label: 'Botão apertado',
      options: [
        { value: 0, label: 'Nenhum' },
        { value: 1, label: 'Botão 1' },
        { value: 2, label: 'Botão 2' },
        { value: 3, label: 'Botão 3 (4 botões)' },
        { value: 4, label: 'Botão 4 (4 botões)' },
      ],
    },
  },
  annotations: (props) => {
    const p = resolve(props);
    const a23 = batteryOf(p.battery) === 'a23';
    const list: PartAnnotation[] = [
      { at: [0, 0, 0], anchor: 'antena', text: 'Antena de laço impressa na placa' },
      {
        at: [0, 0, 0],
        anchor: 'saw',
        text: 'Ressonador SAW: fixa a frequência em 433,92 MHz',
      },
      {
        at: [0, 0, 0],
        anchor: 'chip',
        text: 'Chip codificador: monta o código (serial, botão e contador no rolling code)',
      },
      {
        at: [0, 0, 0],
        anchor: 'transistor',
        text: 'Transistor de RF: oscila e entrega a potência à antena',
      },
      {
        at: [0, 0, 0],
        anchor: 'bateria',
        text: a23 ? 'Bateria de 12 V (A23)' : 'Bateria de 3 V (CR2032)',
      },
      { at: [0, 0, 0], anchor: 'led', text: 'LED: acende enquanto o controle transmite' },
      { at: [0, 0, 0], anchor: 'botao', text: 'Botões: cada um manda um código diferente' },
    ];
    return list;
  },
  explode: true,
  cutaway: true,
  // Horizontal cut under the top face: the board is seen from above.
  cut: { normal: [0, -1, 0], through: [0, CEILING - 0.8, 0] },
  describe: (props) => {
    const p = resolve(props);
    const n = buttonsOf(p.buttons);
    const a23 = batteryOf(p.battery) === 'a23';
    const pressed = pressedOf(p.pressed, n);
    const battery = a23
      ? 'bateria de 12 V (A23) presa entre um contato e uma mola'
      : 'bateria de 3 V (CR2032) num suporte sobre a placa';
    const state =
      pressed > 0
        ? `O botão ${pressed} está apertado: o LED acende e o controle transmite o código desse botão em 433,92 MHz.`
        : 'Nenhum botão apertado: o controle está em repouso e não transmite.';
    return `Controle remoto de chaveiro para portão, de ${n} botões, com ${battery}. Por dentro, a placa tem a antena de laço impressa na borda, o ressonador SAW de 433,92 MHz, o chip codificador, o transistor de RF e o LED. ${state}`;
  },
  view: [0.35, 1.05, 0.85],
};

/* ---------------------------------------------------------------- part */

export default function RemoteControl433(props: RemoteControl433Props) {
  const p = resolve(props as PartProps);
  const buttons = buttonsOf(p.buttons);
  const battery = batteryOf(p.battery);
  const pressed = pressedOf(p.pressed, buttons);
  const layout = layoutFor(buttons, battery);
  const W = BOARD_W[battery];
  const points = buttonPoints(buttons);
  const stem = STEM_R[buttons];
  const noise = getNoiseTexture();

  const caps = useRef<(Group | null)[]>([]);
  const plungers = useRef<(Group | null)[]>([]);
  useSmooth(
    points.map((_, i) => (pressed === i + 1 ? 1 : 0)),
    (values) => {
      values.forEach((v, i) => {
        const cap = caps.current[i];
        const plunger = plungers.current[i];
        if (cap) cap.position.y = -(CAP.gap + SW.travel) * v;
        if (plunger) plunger.position.y = -SW.travel * v;
      });
    },
    24,
  );

  const holes: Hole[] = [
    ...points.map(([x, y]) => {
      const [wx, , wz] = world([x, y], 0);
      return { x: wx, z: wz, r: stem + 0.25 };
    }),
    { x: world(LED_AT, 0)[0], z: world(LED_AT, 0)[2], r: LED.r + 0.12 },
  ];
  const topShell = useDisposable(() => topShellGeometry(SHELL, holes), [holes]);

  const bottomShell = useDisposable(() => {
    const x1 = BOARD.x0 + W;
    const extras: BufferGeometry[] = [
      [BOARD.x0 + 3.5, -10.5],
      [BOARD.x0 + 3.5, 10.5],
      [x1 - 3.5, -10.5],
      [x1 - 3.5, 10.5],
    ].map(([x, z]) => postAt(x!, z!, 1.2, SHELL.wall - 0.05, BOARD.y));
    if (battery === 'a23') {
      // Divider between the board and the battery, cradle pads under the battery.
      extras.push(boxAt(13.3, (SHELL.wall + 4.6) / 2, 0, 0.9, 4.6 - SHELL.wall, 31));
      for (const z of [-8, 8]) extras.push(boxAt(A23.x, SHELL.wall + 0.15, z, 6, 0.4, 1.6));
    }
    return bottomShellGeometry(SHELL, extras);
  }, [battery, W]);

  const capGeometry = useDisposable(() => {
    const r = stem;
    const y0 = CAP_BOTTOM;
    const f = 0.6;
    const profile: [number, number][] = [
      [0, y0],
      [1.4, y0],
      [1.4, y0 + 0.5],
      [r - 0.3, y0 + 0.5],
      [r + CAP.flange, CEILING - 1.05],
      [r + CAP.flange, CEILING - 0.1],
      [r, CEILING - 0.1],
    ];
    for (let i = 0; i <= 6; i++) {
      const a = (Math.PI / 2) * (i / 6);
      profile.push([r - f + f * Math.cos(a), CAP_TOP - f + f * Math.sin(a)]);
    }
    profile.push([0, CAP_TOP]);
    return axialLathe(profile, 40);
  }, [stem]);

  const shellMaterial = {
    color: '#202226',
    roughness: 0.42,
    roughnessMap: noise,
    clearcoat: 0.15,
    clearcoatRoughness: 0.5,
  };

  const bx = BOARD.x0 + W / 2;
  const local = (pt: Point, h = BOARD.t): Vec3 => [pt[0] - W / 2, h, pt[1] - BOARD.depth / 2];
  const lit = pressed > 0 ? 1 : 0;

  return (
    <group>
      {/* Bottom half of the shell. */}
      <Explode offset={[0, -20, 0]}>
        <mesh geometry={bottomShell}>
          <Material {...shellMaterial} clip cutColor="#121315" />
        </mesh>
      </Explode>

      {/* Board with everything soldered on it. */}
      <group position={[bx, BOARD.y, 0]}>
        <PrintedCircuitBoard layout={layout}>
          <Switches points={points.map((pt) => local(pt))} plungers={plungers} />
          <group position={local(U1)}>
            <Soic8 />
            <Anchor name="chip" position={[1.2, 1.6, 0.6]} />
          </group>
          <group position={local(Y1)}>
            <SawResonator />
            <Anchor name="saw" position={[1.5, 3.7, 1.5]} />
          </group>
          <group position={local(Q1)}>
            <Sot23 />
            <Anchor name="transistor" position={[0, 1.1, 0]} />
          </group>
          <Passives
            parts={[
              { at: local([18.5, 4.4]), vertical: true, kind: 'c' },
              { at: local([24.6, 6.3]), vertical: true, kind: 'r' },
              { at: local([22, 15.6]), vertical: false, kind: 'c' },
              { at: local([7.5, 9.5]), vertical: true, kind: 'r' },
            ]}
          />
          <group position={local(LED_AT, 0)}>
            <RemoteLed level={lit} />
            <Anchor name="led" position={[0, H + 0.3 - BOARD.y, 0]} />
          </group>
          {battery === 'cr2032' && (
            <group position={local(COIN)}>
              <CoinCellHolder />
              <Anchor name="bateria" position={[3, 3.6, 3]} />
            </group>
          )}
        </PrintedCircuitBoard>
        <Anchor name="antena" position={local([30, BOARD.depth - 1.5], BOARD.t + 0.05)} />
      </group>

      {battery === 'a23' && (
        <Explode offset={[0, -7, 0]}>
          <A23Battery />
          <Anchor name="bateria" position={[A23.x, A23_Y + A23.r, -4]} />
        </Explode>
      )}

      {/* Button caps. */}
      <Explode offset={[0, 44, EXPLODE_Z]}>
        {points.map((pt, i) => (
          <group key={i} position={world(pt, 0)}>
            <group
              ref={(g) => {
                caps.current[i] = g;
              }}
            >
              <mesh geometry={capGeometry}>
                <Material
                  color="#b4b7bb"
                  roughness={0.36}
                  roughnessMap={noise}
                  clearcoat={0.3}
                  clearcoatRoughness={0.35}
                  clip
                  cutColor="#c4c7cb"
                />
              </mesh>
              <CapMark label={String(i + 1)} radius={stem - 0.75} y={CAP_TOP + 0.005} />
              {i === 0 && <Anchor name="botao" position={[stem * 0.6, CAP_TOP, stem * 0.6]} />}
            </group>
          </group>
        ))}
      </Explode>

      {/* Top half of the shell. */}
      <Explode offset={[0, 64, EXPLODE_Z * 2]}>
        <mesh geometry={topShell}>
          <Material {...shellMaterial} clip cutColor="#121315" />
        </mesh>
      </Explode>
    </group>
  );
}

/* ---------------------------------------------------------- components */

/** Number engraved on the cap top: darker, matte, slightly sunk. */
function CapMark({ label, radius, y }: { label: string; radius: number; y: number }) {
  const map = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(52,55,60,0.92)';
      fitText(ctx, label, w / 2, h / 2 + h * 0.03, w * 0.5, h * 0.62, {
        weight: 700,
        family: FONT_SANS,
      });
    },
    `remote-cap-${label}`,
    { width: 128, height: 128, fonts: [`700 40px ${FONT_SANS}`] },
  );
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius, 32]} />
      <Material
        color="#ffffff"
        map={map}
        transparent
        alphaTest={0.2}
        roughness={0.7}
        polygonOffset
        polygonOffsetFactor={-2}
        clip
      />
    </mesh>
  );
}

/** 6 × 6 mm SMD tactile switches; the plungers move (refs filled per switch). */
function Switches({ points, plungers }: { points: Vec3[]; plungers: RefObject<(Group | null)[]> }) {
  const key = points.map((p) => p.join(',')).join('|');
  const bases = useDisposable(
    () =>
      mergeAll(
        points.map(([x, y, z]) => boxAt(x, y + SW.base / 2, z, SW.size, SW.base, SW.size - 0.2)),
      ),
    [key],
  );
  const plates = useDisposable(
    () =>
      mergeAll(
        points.flatMap(([x, y, z]) => [
          boxAt(x, y + SW.base + SW.plate / 2, z, SW.size - 0.1, SW.plate, SW.size - 0.1),
          // Crimp tabs down the two sides.
          ...[-1, 1].map((s) =>
            boxAt(x, y + SW.base - 1, z + s * (SW.size / 2 - 0.05), 2, 2, SW.plate),
          ),
        ]),
      ),
    [key],
  );
  const legs = useDisposable(
    () =>
      mergeAll(
        points.flatMap(([x, y, z]) =>
          [-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => {
              const g = mergeAll([
                boxAt(sx * 3.35, 0.6, 0, 0.7, 0.2, 0.7),
                boxAt(sx * 3.75, 0.1, 0, 0.9, 0.2, 0.7),
                boxAt(sx * 3.05, 0.4, 0, 0.2, 0.8, 0.7),
              ]);
              g.translate(x, y, z + sz * 2.25);
              return g;
            }),
          ),
        ),
      ),
    [key],
  );
  const plunger = useDisposable(
    () =>
      axialLathe(
        [
          [0, SW.base],
          [SW.plunger, SW.base],
          [SW.plunger, SW.top - 0.15],
          [SW.plunger - 0.15, SW.top],
          [0, SW.top],
        ],
        24,
      ),
    [],
  );
  return (
    <group>
      <mesh geometry={bases}>
        <Material preset="pbtBlack" roughness={0.6} />
      </mesh>
      <mesh geometry={plates}>
        <Material preset="steel" color="#c9cbce" roughness={0.3} />
      </mesh>
      <mesh geometry={legs}>
        <Material preset="tin" roughness={0.3} />
      </mesh>
      {points.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <group
            ref={(g) => {
              plungers.current[i] = g;
            }}
          >
            <mesh geometry={plunger}>
              <Material preset="absBlack" roughness={0.45} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

/** SOIC-8 encoder: 4,9 × 3,9 × 1,45 mm, gull-wing leads at 1,27 mm (JEDEC MS-012). */
function Soic8() {
  const body = useDisposable(
    () =>
      moldedBlock({
        width: 4.9,
        depth: 3.9,
        height: 1.45,
        corner: 0.15,
        fillet: 0.12,
        draft: 0.05,
        chamferFront: 0.25,
      }).translate(0, 0.1, 0),
    [],
  );
  const leads = useDisposable(() => {
    const xs = [-1.905, -0.635, 0.635, 1.905];
    return mergeAll([
      ...gullWings(xs, 1, 1.9, 3.0, 0.75, 0.42),
      ...gullWings(xs, -1, 1.9, 3.0, 0.75, 0.42),
    ]);
  }, []);
  const marking = usePrintedTop({
    width: 4.9,
    height: 3.9,
    lines: [
      { text: 'RC08', size: 0.75, weight: 600 },
      { text: '2414', size: 0.55, mono: true },
    ],
    dimple: { x: 0.8, y: 3.1, d: 0.6 },
  });
  return (
    <group>
      <mesh geometry={body}>
        <Material attach="material-0" preset="epoxyBlack" roughness={0.62} />
        <Material
          attach="material-1"
          preset="epoxyBlack"
          color="#ffffff"
          map={marking.map}
          roughness={1}
          roughnessMap={marking.roughnessMap}
          bumpMap={marking.bumpMap}
          bumpScale={1.2}
          specularIntensity={0.55}
        />
      </mesh>
      <mesh geometry={leads}>
        <Material preset="tin" roughness={0.3} />
      </mesh>
    </group>
  );
}

/** SOT-23 RF transistor: 2,9 × 1,3 × 1,0 mm, two leads on +Z, one on −Z. */
function Sot23() {
  const body = useDisposable(
    () =>
      moldedBlock({ width: 2.9, depth: 1.3, height: 0.95, corner: 0.08, fillet: 0.08 }).translate(
        0,
        0.08,
        0,
      ),
    [],
  );
  const leads = useDisposable(
    () =>
      mergeAll([
        ...gullWings([-0.95, 0.95], 1, 0.6, 1.2, 0.45, 0.4, 0.12),
        ...gullWings([0], -1, 0.6, 1.2, 0.45, 0.4, 0.12),
      ]),
    [],
  );
  return (
    <group>
      <mesh geometry={body}>
        <Material preset="epoxyBlack" roughness={0.6} />
      </mesh>
      <mesh geometry={leads}>
        <Material preset="tin" roughness={0.3} />
      </mesh>
    </group>
  );
}

/** 0603 capacitors (tan ceramic) and resistors (black top), 1,6 × 0,8 × 0,45 mm. */
function Passives({ parts }: { parts: { at: Vec3; vertical: boolean; kind: 'r' | 'c' }[] }) {
  const key = JSON.stringify(parts);
  const build = (kind: 'r' | 'c' | 'ends') =>
    mergeAll(
      parts
        .filter((part) => kind === 'ends' || part.kind === kind)
        .flatMap(({ at: [x, y, z], vertical }) => {
          const along = (d: number, w: number, h: number, depth: number, yy: number) =>
            vertical ? boxAt(x, y + yy, z + d, depth, h, w) : boxAt(x + d, y + yy, z, w, h, depth);
          return kind === 'ends'
            ? [-0.65, 0.65].map((d) => along(d, 0.3, 0.46, 0.82, 0.23))
            : [along(0, 1.0, 0.44, 0.8, 0.22)];
        }),
    );
  const caps = useDisposable(() => build('c'), [key]);
  const resistors = useDisposable(() => build('r'), [key]);
  const ends = useDisposable(() => build('ends'), [key]);
  return (
    <group>
      <mesh geometry={caps}>
        <Material preset="ceramicTan" color="#b89a6e" roughness={0.55} />
      </mesh>
      <mesh geometry={resistors}>
        <Material color="#151517" roughness={0.5} />
      </mesh>
      <mesh geometry={ends}>
        <Material preset="tin" roughness={0.25} />
      </mesh>
    </group>
  );
}

/** SAW resonator in a round nickel-plated can (TO-39 class, low profile), marked with its frequency. */
function SawResonator() {
  const can = useDisposable(
    () =>
      axialLathe(
        [
          [0, 0.2],
          [4.3, 0.2],
          [4.3, 0.55],
          [4.0, 0.6],
          [4.0, 3.25],
          [3.7, 3.6],
          [0, 3.6],
        ],
        48,
      ),
    [],
  );
  const mark = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(30,32,36,0.85)';
      fitText(ctx, '433,92', w / 2, h * 0.5, w * 0.78, h * 0.26, {
        weight: 700,
        family: FONT_SANS,
      });
    },
    'remote-saw',
    { width: 256, height: 256, fonts: [`700 40px ${FONT_SANS}`] },
  );
  return (
    <group>
      <mesh geometry={can}>
        <Material preset="nickel" color="#d0cfca" roughness={0.24} />
      </mesh>
      <mesh position={[0, 3.605, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.6, 40]} />
        <Material
          color="#ffffff"
          map={mark}
          transparent
          alphaTest={0.25}
          roughness={0.6}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
    </group>
  );
}

/** 3 mm red LED standing on its leads, its dome through the hole in the top. */
function RemoteLed({ level }: { level: number }) {
  const y0 = LED.base - BOARD.y;
  const body = useDisposable(() => {
    const profile: [number, number][] = [
      [0, y0],
      [LED.flange, y0],
      [LED.flange, y0 + LED.flangeH],
      [LED.r, y0 + LED.flangeH],
      [LED.r, y0 + LED.height - LED.r],
    ];
    for (let i = 1; i <= 12; i++) {
      const a = (Math.PI / 2) * (i / 12);
      profile.push([LED.r * Math.cos(a), y0 + LED.height - LED.r + LED.r * Math.sin(a)]);
    }
    return axialLathe(profile, 32);
  }, []);
  const leads = useDisposable(
    () =>
      mergeAll(
        [-1.27, 1.27].map((z) => boxAt(0, (y0 + 1.6 - 1.5) / 2, z, 0.5, y0 + 1.6 + 1.5, 0.5)),
      ),
    [],
  );
  const lens = emission(LED_RED, level * 3, 1);
  const chip = emission(LED_RED, level, GLOW);
  return (
    <group>
      <mesh geometry={body}>
        <Material
          preset="ledEpoxy"
          clip
          color="#d8261c"
          transmission={0.15}
          roughness={0.45}
          thickness={3}
          attenuationColor="#d8261c"
          attenuationDistance={2}
          emissive={lens.emissive}
          emissiveIntensity={lens.emissiveIntensity}
          cutColor="#a81e16"
        />
      </mesh>
      <mesh position={[0, y0 + 1.8, -0.6]}>
        <boxGeometry args={[0.3, 0.16, 0.3]} />
        <Material
          color="#3a3a40"
          roughness={0.4}
          emissive={chip.emissive}
          emissiveIntensity={chip.emissiveIntensity}
        />
      </mesh>
      <mesh geometry={leads}>
        <Material preset="tin" />
      </mesh>
      <GlowSprite
        always
        color={LED_RED}
        intensity={level}
        size={8}
        position={[0, y0 + LED.height - 0.6, 0]}
      />
    </group>
  );
}

/** 12 V A23 battery between its contacts, with the two wires to the board. */
function A23Battery() {
  const sleeve = useDisposable(() => {
    const g = axialLathe(roundedCylinderProfile(A23.r, 0.35, A23.length - 0.9, 0.35, 4), 48);
    g.rotateX(-Math.PI / 2);
    g.translate(A23.x, A23_Y, A23.minus);
    return g;
  }, []);
  const ends = useDisposable(() => {
    const neg = axialLathe(
      [
        [0, 0],
        [4.4, 0],
        [4.6, 0.4],
        [0, 0.4],
      ],
      32,
    );
    const pos = axialLathe(
      [
        [0, A23.length - 1.0],
        [4.5, A23.length - 1.0],
        [4.3, A23.length - 0.65],
        [2.7, A23.length - 0.6],
        [2.6, A23.length - 0.05],
        [2.4, A23.length],
        [0, A23.length],
      ],
      32,
    );
    const g = mergeAll([neg, pos]);
    g.rotateX(-Math.PI / 2);
    g.translate(A23.x, A23_Y, A23.minus);
    return g;
  }, []);
  const contacts = useDisposable(() => {
    const plate = (z: number) => boxAt(A23.x, 1.6 + 4.7, z, 8, 9.4, 0.3);
    const spring = tube(new ConeSpring(3.4, 1.6, A23.plate - A23.minus - 0.2, 3.5), 0.28, {
      radial: 6,
      segments: 120,
    });
    spring.translate(A23.x, A23_Y, A23.plate);
    const dimple = axialLathe(
      [
        [0, 0],
        [1.6, 0],
        [1.2, 0.3],
        [0, 0.35],
      ],
      20,
    );
    dimple.rotateX(Math.PI / 2);
    dimple.translate(A23.x, A23_Y, A23.plus);
    return mergeAll([plate(A23.plus - 0.15), plate(A23.plate + 0.15), spring, dimple]);
  }, []);
  const red = useDisposable(() => tube(smoothPath(wireRoute(-1), 0.4), 0.45, { radial: 8 }), []);
  const black = useDisposable(() => tube(smoothPath(wireRoute(1), 0.4), 0.45, { radial: 8 }), []);
  const label = useCanvasTexture(
    (ctx, w, h) => {
      // u: around the battery, v: along it (− end at the bottom of the canvas).
      const g = ctx.createLinearGradient(0, 0, w, 0);
      for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, i % 2 ? '#c9ccd1' : '#9ea3aa');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1d3f8f';
      ctx.fillRect(0, h * 0.18, w, h * 0.5);
      ctx.fillStyle = '#e8b21c';
      ctx.fillRect(0, h * 0.66, w, h * 0.04);
      for (const u of [0.25, 0.75]) {
        ctx.save();
        ctx.translate(w * u, h * 0.43);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#ffffff';
        fitText(ctx, '12 V', -h * 0.12, -w * 0.05, h * 0.2, w * 0.13, {
          weight: 800,
          family: FONT_SANS,
        });
        fitText(ctx, 'A23', h * 0.13, -w * 0.05, h * 0.2, w * 0.11, {
          weight: 700,
          family: FONT_SANS,
        });
        fitText(ctx, 'ALCALINA', 0, w * 0.1, h * 0.42, w * 0.06, {
          weight: 600,
          family: FONT_SANS,
        });
        ctx.restore();
      }
    },
    'remote-a23',
    { width: 512, height: 512, fonts: [`800 40px ${FONT_SANS}`] },
  );
  return (
    <group>
      <mesh geometry={sleeve}>
        <Material color="#ffffff" map={label} roughness={0.3} clearcoat={0.6} />
      </mesh>
      <mesh geometry={ends}>
        <Material preset="nickel" roughness={0.22} />
      </mesh>
      <mesh geometry={contacts}>
        <Material preset="nickel" color="#d4d3cf" roughness={0.28} />
      </mesh>
      <mesh geometry={red}>
        <Material preset="pvc" color="#c4231c" />
      </mesh>
      <mesh geometry={black}>
        <Material preset="pvc" color="#1c1c1e" />
      </mesh>
    </group>
  );
}

/** Battery wire from the board pad (side −1: +, red; 1: −, black) to the top of its contact. */
function wireRoute(side: -1 | 1): Vec3[] {
  return [
    [BOARD.x0 + 33, BOARD_TOP + 0.2, side * 11],
    [BOARD.x0 + 33, BOARD_TOP + 1.6, side * 11],
    [12.5, 9.2, side * 13],
    [17.5, 11.3, side * 14.6],
    [20.5, 11.3, side * 15.2],
  ];
}

/** CR2032 coin cell in an open plastic ring with the nickel top clip (+); the board pad is −. */
function CoinCellHolder() {
  const ring = useDisposable(
    () =>
      axialLathe(
        [
          [10.25, 0],
          [10.8, 0],
          [10.8, 3.4],
          [10.25, 3.4],
          [10.25, 0],
        ],
        64,
      ).translate(0, BOARD.t, 0),
    [],
  );
  const cell = useDisposable(
    () =>
      axialLathe(
        [
          [0, 0],
          [8.0, 0],
          [8.3, 0.2],
          [9.6, 0.32],
          [10, 0.6],
          [10, 2.9],
          [9.7, 3.2],
          [0, 3.2],
        ],
        64,
      ).translate(0, BOARD.t + 0.1, 0),
    [],
  );
  const clip = useDisposable(() => {
    const y = BOARD.t + 3.45;
    return mergeAll([
      boxAt(0, y, 0, 5, 0.22, 22.2),
      ...[-1, 1].map((s) => boxAt(0, (BOARD.t + y) / 2, s * 11.1, 5, y - BOARD.t, 0.22)),
    ]);
  }, []);
  const mark = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(40,42,46,0.8)';
      fitText(ctx, '+', w * 0.5, h * 0.2, w * 0.2, h * 0.14, { weight: 700, family: FONT_SANS });
      fitText(ctx, 'CR2032', w * 0.5, h * 0.74, w * 0.5, h * 0.11, {
        weight: 700,
        family: FONT_SANS,
      });
      fitText(ctx, '3 V', w * 0.5, h * 0.86, w * 0.3, h * 0.08, {
        weight: 600,
        family: FONT_SANS,
      });
    },
    'remote-cr2032',
    { width: 512, height: 512, fonts: [`700 40px ${FONT_SANS}`] },
  );
  return (
    <group>
      <mesh geometry={ring}>
        <Material preset="pbtBlack" roughness={0.6} />
      </mesh>
      <mesh geometry={cell}>
        <Material preset="steel" color="#c8cacd" roughness={0.22} />
      </mesh>
      <mesh position={[0, BOARD.t + 3.305, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[9.6, 48]} />
        <Material
          color="#ffffff"
          map={mark}
          transparent
          alphaTest={0.25}
          roughness={0.5}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
      <mesh geometry={clip}>
        <Material preset="nickel" color="#d6d5d0" roughness={0.26} />
      </mesh>
    </group>
  );
}
