/**
 * Generic 12 V / 1 A linear power supply board, as sold in kits and found
 * inside older equipment: 110 × 70 mm FR-4 (1,6 mm, green mask), through-hole
 * parts, stages left to right in signal order:
 *
 * - J1, 2-way 5,08 mm screw terminal for the 127 V mains input, and F1, a
 *   5 × 20 mm T 250 mA glass fuse in PCB clips;
 * - T1, a PCB-mount EI-48 transformer (core 48 × 40 mm, 25 mm stack, black
 *   bobbin with pin rails, typical of 10–20 VA board transformers);
 * - BR1, a KBP in-line bridge rectifier (14,2 × 10,3 × 3,6 mm);
 * - C1, the 3.300 µF 25 V filter capacitor (18 × 35 mm can, general-purpose
 *   105 °C series);
 * - U1, a 78xx regulator in TO-220 on the kit's 25 × 23 × 16 mm finned
 *   heatsink, with C2 (330 nF) at its input and C3 (100 nF) at its output,
 *   the values of the 78xx datasheet application circuit;
 * - C4, 100 µF 25 V at the output, the power LED D5 (green, 5 mm) with R1,
 *   and J2, the 2-way output terminal.
 *
 * The 5 V version uses a 9 V transformer (9 VA), a 7805 and R1 = 330 Ω, so
 * the LED keeps about the same current. Every part is the kit's own part at
 * its real size, baked into a few merged meshes (`_gate-batch.tsx`) to stay
 * inside the draw-call budget of a phone. No markings beyond generic codes.
 */
import { BoxGeometry, type BufferGeometry } from 'three';
import { GlowSprite } from '../fx/glow';
import { formatNumber } from '../core/format';
import { Anchor } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, useCanvasTexture } from '../materials/textures';
import { PrintedCircuitBoard } from '../pcb/PrintedCircuitBoard';
import { boardPoint, type PcbLayout, type PcbPad, type PcbSilk, type Point } from '../pcb/layout';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { roundedBox, mergeAll } from './_em-geometry';
import { BakeBlock, BakeLayer, BakePart, BatchRoot } from './_gate-batch';
import { useLaminationTexture } from './_power-shared';
import BridgeRectifier from './bridge-rectifier';
import CeramicCapacitor from './ceramic-capacitor';
import ElectrolyticCapacitor, { electrolyticSize } from './electrolytic-capacitor';
import FuseGlass from './fuse-glass';
import Led, { LED_COLORS } from './led';
import Resistor from './resistor';
import ScrewTerminal from './screw-terminal';
import TransistorTo220 from './transistor-to220';

export type PsuOutput = 5 | 12;

export interface LinearPsuBoardProps {
  /** Output voltage: sets the regulator (7805 or 7812), the transformer and R1. */
  output?: PsuOutput;
  /** Regulator screwed to its aluminium heatsink. */
  heatsink?: boolean;
  /** Board powered: the LED is lit. */
  powered?: boolean;
  /** Filter capacitor C1 swollen (failed). */
  bulged?: boolean;
}

/** What changes with the output voltage. */
const VERSIONS: Record<
  PsuOutput,
  { regulator: string; secondary: number; va: number; r1: number; out: string }
> = {
  12: { regulator: '7812', secondary: 15, va: 20, r1: 1000, out: '+12V' },
  5: { regulator: '7805', secondary: 9, va: 9, r1: 330, out: '+5V' },
};

const STAGES = ['rede', 'trafo', 'retificador', 'filtro', 'regulador', 'saida'];

// ---------------------------------------------------------------------------
// Layout (mm from the top-left corner, y down).

const W = 110;
const H = 70;
const T = 1.6;
const BOARD = { width: W, height: H, thickness: T };

/** Layout point → part space on the board surface (+ height). */
const on = ([x, y]: Point, up = 0): Vec3 => {
  const [px, py, pz] = boardPoint(BOARD, [x, y]);
  return [px, py + up, pz];
};

/** A local pin (x, z) of a part placed at `at`, turned `deg` (counter-clockwise from the top). */
function local(at: Point, deg: number, [lx, lz]: readonly [number, number]): Point {
  const a = (deg * Math.PI) / 180;
  return [at[0] + lx * Math.cos(a) + lz * Math.sin(a), at[1] - lx * Math.sin(a) + lz * Math.cos(a)];
}

const J1: Point = [5, 55];
const J1_DEG = -90;
const FUSE: Point = [12, 24];
const TRAFO: Point = [39, 35];
const BR1: Point = [69, 16];
const C1: Point = [71, 44];
const U1: Point = [96, 27];
const C2: Point = [86, 34];
const C3: Point = [104, 34];
const C4: Point = [104, 44];
const R1: Point = [90, 50];
const D5: Point = [90, 59];
const J2: Point = [105, 56];
const J2_DEG = 90;

const C1_SIZE = electrolyticSize(3300e-6, 25);
const C4_SIZE = electrolyticSize(100e-6, 25);
const R1_PITCH = 10.16;

/** PCB transformer (local frame = board frame): EI-48 core, 25 mm stack along X. */
const TR = {
  a: 16,
  stack: 25,
  /** Core bottom above the board (the bobbin's standoffs). */
  base: 2,
  coil: { w: 40, d: 31 },
  railX: 17.5,
  pinZ: 10,
};
const TR_TOP = TR.base + 2.5 * TR.a;

/** Wire entries of the terminals, (x, z) of each way in the terminal (way 0 first). */
const ways = (at: Point, deg: number): Point[] =>
  [-2.54, 2.54].map((lx) => local(at, deg, [lx, -1.75]));
const J1_WAYS = ways(J1, J1_DEG);
const J2_WAYS = ways(J2, J2_DEG);

function pad(id: string, at: Point, drill: number, size: number, extra: Partial<PcbPad> = {}) {
  return { id, at, drill, size, ...extra } satisfies PcbPad;
}

const GND = { net: 'GND' } as const;

function buildLayout(output: PsuOutput): PcbLayout {
  const v = VERSIONS[output];
  const tr = (sx: number, sz: number): Point => [TRAFO[0] + sx * TR.railX, TRAFO[1] + sz * TR.pinZ];
  const pads: PcbPad[] = [
    // Input terminal: way 0 is the line (to the fuse), way 1 the neutral.
    pad('J1.1', J1_WAYS[0]!, 1.3, 2.6, { shape: 'square' }),
    pad('J1.2', J1_WAYS[1]!, 1.3, 2.6),
    // Fuse clips, two pins each (fuse along y).
    ...[-9, -6.2, 6.2, 9].map((x, i) => pad(`F1.${i + 1}`, local(FUSE, 90, [x, 0]), 1.2, 2.4)),
    // Transformer: primary on the left rail, secondary on the right one.
    pad('T1.1', tr(-1, -1), 1.2, 2.6, { shape: 'square' }),
    pad('T1.2', tr(-1, 1), 1.2, 2.6),
    pad('T1.3', tr(1, -1), 1.2, 2.6),
    pad('T1.4', tr(1, 1), 1.2, 2.6),
    // Bridge: + ~ ~ − along +x.
    ...['+', '~a', '~b', '−'].map((m, i) =>
      pad(
        `BR1.${m}`,
        [BR1[0] + (i - 1.5) * 3.8, BR1[1]],
        1.0,
        2.0,
        m === '+' ? { shape: 'square' } : m === '−' ? GND : {},
      ),
    ),
    pad('C1.-', [C1[0] - C1_SIZE.pitch / 2, C1[1]], 1.0, 2.2, GND),
    pad('C1.+', [C1[0] + C1_SIZE.pitch / 2, C1[1]], 1.0, 2.2, { shape: 'square' }),
    // Regulator: IN, GND (tab), OUT.
    pad('U1.IN', [U1[0] - 2.54, U1[1] - 0.385], 1.2, 2.2, { shape: 'square' }),
    pad('U1.GND', [U1[0], U1[1] - 0.385], 1.2, 2.2, GND),
    pad('U1.OUT', [U1[0] + 2.54, U1[1] - 0.385], 1.2, 2.2),
    pad('C2.1', [C2[0] - 2.54, C2[1]], 0.8, 1.6),
    pad('C2.2', [C2[0] + 2.54, C2[1]], 0.8, 1.6, GND),
    pad('C3.1', [C3[0] - 2.54, C3[1]], 0.8, 1.6),
    pad('C3.2', [C3[0] + 2.54, C3[1]], 0.8, 1.6, GND),
    pad('C4.-', [C4[0] - C4_SIZE.pitch / 2, C4[1]], 0.8, 1.6, GND),
    pad('C4.+', [C4[0] + C4_SIZE.pitch / 2, C4[1]], 0.8, 1.6, { shape: 'square' }),
    pad('R1.1', [R1[0] + R1_PITCH / 2, R1[1]], 0.8, 1.6),
    pad('R1.2', [R1[0] - R1_PITCH / 2, R1[1]], 0.8, 1.6),
    pad('D5.K', [D5[0] - 1.27, D5[1]], 0.8, 1.5, { shape: 'square', ...GND }),
    pad('D5.A', [D5[0] + 1.27, D5[1]], 0.8, 1.5),
    // Output terminal: way 0 (lower) GND, way 1 the output.
    pad('J2.GND', J2_WAYS[0]!, 1.3, 2.6, { shape: 'square', ...GND }),
    pad('J2.OUT', J2_WAYS[1]!, 1.3, 2.6),
  ];

  const text = (
    at: Point,
    value: string,
    size = 1.4,
    extra: Partial<Extract<PcbSilk, { kind: 'text' }>> = {},
  ): PcbSilk => ({ kind: 'text', at, text: value, size, ...extra });
  const brMarks = ['+', '~', '~', '−'];
  const silk: PcbSilk[] = [
    text([39, 4.6], `FONTE LINEAR ${output} V 1 A`, 2.2),
    // Mains side.
    text([6, 46.4], '~ 127 V', 1.4),
    text([6, 48.6], 'J1', 1.2),
    text([5.6, 21], 'F1', 1.3),
    text([5.6, 24.4], 'T250', 1.0),
    text([5.6, 26.4], 'mA', 1.0),
    text([15.6, 46], 'LADO DA REDE', 1.1, { rotation: 90 }),
    {
      kind: 'line',
      points: [
        [17.2, 2],
        [17.2, 68],
      ],
      width: 0.22,
    },
    // Transformer.
    text([TRAFO[0], 62.6], 'T1  TRANSFORMADOR', 1.3),
    text([TRAFO[0] - TR.railX, 65], 'PRI', 1.0),
    text([TRAFO[0] + TR.railX, 65], 'SEC', 1.0),
    { kind: 'rect', at: TRAFO, size: [42.6, 49], width: 0.2 },
    // Bridge and filter.
    ...brMarks.map((m, i) => text([BR1[0] + (i - 1.5) * 3.8, 20.4], m, 1.4)),
    text([BR1[0], 23], 'BR1', 1.2),
    { kind: 'rect', at: BR1, size: [14.8, 4.4], width: 0.2 },
    { kind: 'circle', at: C1, r: C1_SIZE.D / 2 + 0.4, width: 0.2 },
    text([C1[0] + C1_SIZE.pitch / 2 + 2.4, C1[1] - 2.6], '+', 1.6),
    text([C1[0], 56.4], 'C1  3.300 µF 25 V', 1.2),
    text([C1[0], 59.2], 'RETIFICAÇÃO E FILTRO', 1.1),
    // Regulator.
    text([U1[0], 4.6], 'REGULADOR', 1.2),
    { kind: 'rect', at: [U1[0], U1[1] - 11], size: [25.6, 17], width: 0.2 },
    text([U1[0], 31.2], `U1  ${v.regulator}`, 1.2),
    text([C2[0], 38.4], 'C2', 1.1),
    text([C2[0], 40.4], '330 nF', 1.0),
    text([C3[0] - 4.6, 37.8], 'C3', 1.1, { align: 'right' }),
    text([C3[0] - 4.6, 39.8], '100 nF', 1.0, { align: 'right' }),
    { kind: 'circle', at: C4, r: C4_SIZE.D / 2 + 0.3, width: 0.2 },
    text([C4[0] - 4.4, C4[1] + 0.6], 'C4', 1.1, { align: 'right' }),
    text([C4[0] + C4_SIZE.pitch / 2 + 2.2, C4[1] - 3.2], '+', 1.3),
    text([R1[0], R1[1] - 2.8], `R1  ${output === 12 ? '1 kΩ' : '330 Ω'}`, 1.1),
    text([D5[0] - 4.2, D5[1]], 'D5', 1.1, { align: 'right' }),
    text([D5[0], 64.6], 'LIGADO', 1.1),
    { kind: 'circle', at: D5, r: 3.1, width: 0.2 },
    // Output.
    text([J2[0] - 5, J2_WAYS[1]![1]], v.out, 1.3, { align: 'right' }),
    text([J2[0] - 5, J2_WAYS[0]![1]], 'GND', 1.3, { align: 'right' }),
    text([J2[0], 47.6], 'J2', 1.1),
    text([96, 67.2], 'SAÍDA', 1.2),
  ];

  const tr1 = tr(-1, -1);
  const tr2 = tr(-1, 1);
  const tr3 = tr(1, -1);
  const tr4 = tr(1, 1);
  const p = (id: string) => pads.find((x) => x.id === id)!.at;
  return {
    width: W,
    height: H,
    thickness: T,
    corner: 2.5,
    copper: 'both',
    mask: 'verde',
    finish: 'hasl',
    pads,
    holes: [
      { at: [4, 4], drill: 3.2 },
      { at: [106, 4], drill: 3.2 },
      { at: [4, 66], drill: 3.2 },
      { at: [106, 66], drill: 3.2 },
    ],
    traces: [
      // Mains on the bottom, wide.
      { points: [p('J1.1'), [6.75, 40], [12, 36], p('F1.1')], width: 1.8, side: 'bottom' },
      { points: [p('F1.4'), [17, 15], [tr1[0], 19], tr1], width: 1.8, side: 'bottom' },
      { points: [p('J1.2'), [6.75, 63], [16, 63], [tr2[0], 55], tr2], width: 1.8, side: 'bottom' },
      // Secondary to the bridge (top).
      { points: [tr3, [60.5, 21.5], [67.1, 21.5], p('BR1.~a')], width: 1.4 },
      {
        points: [tr4, [60, 42], [60, 30], [64, 27], [70.9, 27], p('BR1.~b')],
        width: 1.4,
      },
      // Rectified, unregulated voltage to C1, C2 and the regulator input.
      { points: [p('BR1.+'), [63.3, 10.5], [81, 10.5], [81, 41], [78, 44], p('C1.+')], width: 1.6 },
      { points: [[81, 34], p('C2.1')], width: 1.2 },
      { points: [p('C2.1'), [86, 31], [91, 31], [93.46, 28.5], p('U1.IN')], width: 1.2 },
      // Regulated output to C3, C4, the LED and the terminal.
      {
        points: [p('U1.OUT'), [98.54, 30], [101.46, 32.5], p('C3.1'), [100, 36], [100, 47.5]],
        width: 1.2,
      },
      { points: [[100, 47.5], [105.25, 47.5], p('C4.+')], width: 1.2 },
      { points: [[103.25, 47.5], p('J2.OUT')], width: 1.4 },
      { points: [[100, 47.5], [97, 50], p('R1.1')], width: 0.8 },
      { points: [p('R1.2'), [84.92, 55], [91.27, 55], p('D5.A')], width: 0.8 },
    ],
    pours: [
      {
        outline: [
          [62, 7],
          [109, 7],
          [109, 63],
          [62, 63],
        ],
        side: 'top',
        net: 'GND',
        clearance: 0.6,
      },
    ],
    silk,
  };
}

const LAYOUTS: Record<PsuOutput, PcbLayout> = { 12: buildLayout(12), 5: buildLayout(5) };

/** Exploded view: parts lift off the board in three tiers. */
const LIFT_LOW: Vec3 = [0, 48, -24];
const LIFT_MID: Vec3 = [0, 66, -33];
const LIFT_TALL: Vec3 = [0, 84, -42];

// ---------------------------------------------------------------------------

const resolve = (props: PartProps) =>
  ({ ...meta.defaults, ...props }) as Required<LinearPsuBoardProps>;

const outputOf = (value: unknown): PsuOutput => (Number(value) === 5 ? 5 : 12);

export const meta: PartMeta = {
  id: 'linear-psu-board',
  label: 'Fonte linear de 12 V',
  category: 'placas',
  summary:
    'Placa de fonte linear de 12 V e 1 A, como nos kits e nos aparelhos antigos: fusível, transformador, ponte retificadora, capacitor de filtro, regulador 7812 no dissipador, LED e bornes.',
  defaults: { output: 12, heatsink: true, powered: false, bulged: false },
  controls: {
    output: {
      kind: 'select',
      label: 'Tensão de saída',
      options: [
        { value: 12, label: '12 V (7812, transformador de 15 V)' },
        { value: 5, label: '5 V (7805, transformador de 9 V)' },
      ],
    },
    heatsink: { kind: 'toggle', label: 'Regulador no dissipador' },
    powered: { kind: 'toggle', label: 'Ligada (LED aceso)' },
    bulged: { kind: 'toggle', label: 'Capacitor de filtro estufado (defeito)' },
  },
  annotations: (props) => {
    const p = resolve(props);
    const v = VERSIONS[outputOf(p.output)];
    const list: PartAnnotation[] = [
      {
        at: [0, 0, 0],
        anchor: 'psu-entrada',
        text: 'Entrada da rede (127 V): só mexa com a fonte desligada da tomada',
      },
      { at: [0, 0, 0], anchor: 'psu-fusivel', text: 'Fusível de entrada (lado da rede)' },
      {
        at: [0, 0, 0],
        anchor: 'psu-trafo',
        text: `Transformador: baixa de 127 V para ${v.secondary} V e isola a saída da rede`,
      },
      {
        at: [0, 0, 0],
        anchor: 'psu-ponte',
        text: 'Ponte retificadora: quatro diodos, de alternada para contínua pulsante',
      },
      {
        at: [0, 0, 0],
        anchor: 'psu-filtro',
        text: p.bulged
          ? 'Capacitor de filtro estufado: a fonte perde o filtro, troque-o'
          : 'Capacitor de filtro: alisa a tensão pulsante',
      },
      {
        at: [0, 0, 0],
        anchor: 'psu-regulador',
        text: p.heatsink
          ? `Regulador ${v.regulator} no dissipador: mantém a saída em ${outputOf(p.output)} V`
          : `Regulador ${v.regulator} sem dissipador: com carga alta, esquenta e desliga`,
      },
      {
        at: [0, 0, 0],
        anchor: 'psu-ceramicos',
        text: 'Capacitores do regulador: 330 nF na entrada e 100 nF na saída',
      },
      {
        at: [0, 0, 0],
        anchor: 'psu-led',
        text: p.powered ? 'LED de ligado: aceso, há tensão na saída' : 'LED de ligado',
      },
      { at: [0, 0, 0], anchor: 'psu-saida', text: `Saída ${outputOf(p.output)} V` },
      {
        at: [0, 0, 0],
        anchor: 'pcb-substrate',
        text: 'Placa de FR-4 de 1,6 mm',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        anchor: 'pcb-copper',
        text: 'Cobre: trilhas e o plano de terra (GND)',
        exploded: true,
      },
    ];
    return list;
  },
  explode: true,
  describe: (props) => {
    const p = resolve(props);
    const output = outputOf(p.output);
    const v = VERSIONS[output];
    const r1 = output === 12 ? '1 kΩ' : '330 Ω';
    const parts = [
      `Placa de fonte linear de ${output} V e 1 A (110 × 70 mm) vista de cima, com as etapas da esquerda para a direita: borne de entrada da rede de 127 V e fusível de vidro de 250 mA (lado da rede), transformador de 127 V para ${v.secondary} V e ${v.va} VA, ponte retificadora, capacitor de filtro de ${formatNumber(3300)} µF e 25 V, regulador ${v.regulator} ${p.heatsink ? 'parafusado num dissipador de alumínio' : 'sem dissipador'}, com capacitores de 330 nF na entrada e 100 nF na saída, capacitor de saída de 100 µF, LED verde de ligado com resistor de ${r1} e borne de saída ${v.out} e GND.`,
    ];
    if (output === 5)
      parts.push(
        'Na versão de 5 V, o transformador é de 9 V e o resistor do LED é de 330 Ω, para o LED receber quase a mesma corrente.',
      );
    parts.push(p.powered ? 'Fonte ligada: LED aceso.' : 'Fonte desligada: LED apagado.');
    if (p.bulged)
      parts.push(
        'O capacitor de filtro C1 está estufado, com o topo abaulado: sinal de defeito; a saída fica com ondulação e a fonte pode falhar com carga.',
      );
    return parts.join(' ');
  },
  view: [0.2, 1.35, 1],
};

export default function LinearPsuBoard(props: LinearPsuBoardProps) {
  const p = resolve(props as PartProps);
  const output = outputOf(p.output);
  const v = VERSIONS[output];
  const layout = LAYOUTS[output];

  const place = (at: Point, deg = 0, up = 0) => ({
    position: on(at, up),
    rotation: [0, (deg * Math.PI) / 180, 0] as Vec3,
  });
  const top = (at: Point, up: number): Vec3 => on(at, up);

  return (
    <BatchRoot blocks={STAGES}>
      <PrintedCircuitBoard layout={layout} />

      {/* Low tier: terminals, fuse, bridge, small capacitors, resistor, LED. */}
      <BakeLayer
        lift={LIFT_LOW}
        extras={
          <>
            <Anchor name="psu-entrada" position={top([J1[0] - 1, J1[1] + 2.5], 10)} />
            <Anchor name="psu-fusivel" position={top(FUSE, 11)} />
            <Anchor name="psu-ponte" position={top(BR1, 16)} />
            <Anchor name="psu-ceramicos" position={top(C2, 11)} />
            <Anchor name="psu-saida" position={top([J2[0], J2[1]], 10.5)} />
          </>
        }
      >
        <BakeBlock id="rede">
          <BakePart {...place(J1, J1_DEG, -3.5)}>
            <ScrewTerminal ways={2} pitch={5.08} color="azul" screwTurns={0} />
          </BakePart>
          <BakePart {...place(FUSE, 90, -3.5)}>
            <FuseGlass amps={0.25} type="retardo" size="5x20" holder="clip-pcb" />
          </BakePart>
        </BakeBlock>
        <BakeBlock id="retificador">
          <BakePart {...place(BR1, 0, -9.7)}>
            <BridgeRectifier variant="kbp" />
          </BakePart>
        </BakeBlock>
        <BakeBlock id="regulador">
          <BakePart {...place(C2, 0, -(T + 1.5))}>
            <CeramicCapacitor farads={330e-9} voltage={50} leadLength={T + 1.5 + 2} />
          </BakePart>
          <BakePart {...place(C3, 0, -(T + 1.5))}>
            <CeramicCapacitor farads={100e-9} voltage={50} leadLength={T + 1.5 + 2} />
          </BakePart>
        </BakeBlock>
        <BakeBlock id="saida">
          <BakePart {...place(R1, 0, -(T + 1.4))}>
            <Resistor ohms={v.r1} leads="dobrados" leadDrop={1.2 + 1 + T + 1.4} />
          </BakePart>
          <BakePart {...place(J2, J2_DEG, -3.5)}>
            <ScrewTerminal ways={2} pitch={5.08} color="verde" screwTurns={0} />
          </BakePart>
        </BakeBlock>
      </BakeLayer>

      {/* The LED (its own layer: it changes with `powered`). */}
      <BakeLayer
        lift={LIFT_LOW}
        extras={
          <>
            <GlowSprite
              always
              color={LED_COLORS.verde.light}
              intensity={p.powered ? 0.8 : 0}
              size={14}
              position={top(D5, 3 + 6)}
            />
            <Anchor name="psu-led" position={top(D5, 10)} />
          </>
        }
      >
        <BakeBlock id="saida">
          <BakePart {...place(D5, 0, -4)}>
            <Led size={5} color="verde" brightness={p.powered ? 1 : 0} leadLength={5} />
          </BakePart>
        </BakeBlock>
      </BakeLayer>

      {/* Middle tier: the electrolytic capacitors. */}
      <BakeLayer
        lift={LIFT_MID}
        delay={0.08}
        extras={<Anchor name="psu-filtro" position={top(C1, C1_SIZE.L + 2)} />}
      >
        <BakeBlock id="filtro">
          <BakePart {...place(C1, 0, -7.5)}>
            <ElectrolyticCapacitor
              farads={3300e-6}
              voltage={25}
              sleeve="preto"
              bulged={p.bulged}
              leadLength={4}
            />
          </BakePart>
        </BakeBlock>
        <BakeBlock id="saida">
          <BakePart {...place(C4, 0, -7.5)}>
            <ElectrolyticCapacitor farads={100e-6} voltage={25} sleeve="azul" leadLength={4} />
          </BakePart>
        </BakeBlock>
      </BakeLayer>

      {/* Tall tier: transformer and the regulator on its heatsink. */}
      <BakeLayer
        lift={LIFT_TALL}
        delay={0.16}
        extras={
          <>
            <Anchor name="psu-trafo" position={top([TRAFO[0] - 6, TRAFO[1] - 12], TR_TOP + 0.5)} />
            <Anchor
              name="psu-regulador"
              position={top([U1[0] - 8, U1[1] - (p.heatsink ? 10 : 0)], p.heatsink ? 23 : 16)}
            />
          </>
        }
      >
        <BakeBlock id="trafo">
          <BakePart {...place(TRAFO)}>
            <PcbTransformer secondary={v.secondary} va={v.va} />
          </BakePart>
        </BakeBlock>
        <BakeBlock id="regulador">
          <BakePart {...place(U1, 0, -4)}>
            <TransistorTo220
              code={v.regulator}
              dateCode="2337"
              heatsink={p.heatsink}
              insulator={false}
              leadLength={5}
            />
          </BakePart>
        </BakeBlock>
      </BakeLayer>
    </BatchRoot>
  );
}

// ---------------------------------------------------------------------------
// PCB-mount EI transformer.

/** Box from its centre and size. */
function box(size: Vec3, at: Vec3): BufferGeometry {
  return new BoxGeometry(...size).translate(...at);
}

/**
 * Sheet edges of the stack: on every face but the two flat sides (±X, the
 * faces of the outer sheets) the lamination texture runs along X, one tile
 * per eight 0,5 mm sheets; the flat sides sample a plain row of it.
 */
function laminationUv(g: BufferGeometry): BufferGeometry {
  const pos = g.attributes.position!;
  const nor = g.attributes.normal!;
  const uv = g.attributes.uv!;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(nor.getX(i)) > 0.5) uv.setXY(i, 0.5, 0.06);
    else uv.setXY(i, (pos.getY(i) + pos.getZ(i)) * 0.05, pos.getX(i) / 4);
  }
  uv.needsUpdate = true;
  return g;
}

/**
 * Open-frame PCB transformer: EI-48 core (48 × 40 mm, 25 mm stack) standing
 * on a black bobbin whose pin rails reach the board, the winding wrapped in
 * yellow polyester tape, four pins (primary on the −X rail, secondary on
 * +X) and a printed label on top. Rests on y = 0, pins through the board.
 */
function PcbTransformer({ secondary, va }: { secondary: number; va: number }) {
  const { a, stack: S, base: b, coil } = TR;
  const lamColor = useLaminationTexture('color');
  const lamRough = useLaminationTexture('rough');

  const core = useDisposable(() => {
    const w = 3 * a;
    return laminationUv(
      mergeAll([
        // Bottom yoke (E back), outer legs, and the I on top (thin seam below it).
        box([S, a / 2, w], [0, b + a / 4, 0]),
        box([S, 1.5 * a, a / 2], [0, b + a * 1.25, -(w / 2 - a / 4)]),
        box([S, 1.5 * a, a / 2], [0, b + a * 1.25, w / 2 - a / 4]),
        box([S, a / 2 - 0.15, w], [0, b + 2 * a + 0.15 + (a / 2 - 0.15) / 2, 0]),
      ]),
    );
  }, []);

  const bobbin = useDisposable(() => {
    const flange = (y: number) =>
      roundedBox(coil.w + 2, 1.2, coil.d + 2, 1.2, 0.3).translate(0, y, 0);
    const rails = [-1, 1].map((s) =>
      roundedBox(7, b + a / 2, coil.d + 2, 0.8, 0.3).translate(s * TR.railX, 0, 0),
    );
    return mergeAll([flange(b + a / 2), flange(b + 2 * a - 1.2), ...rails]);
  }, []);

  const winding = useDisposable(
    () => roundedBox(coil.w, 1.5 * a - 2.4, coil.d, 3, 0.6).translate(0, b + a / 2 + 1.2, 0),
    [],
  );

  const pins = useDisposable(
    () =>
      mergeAll(
        [-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => box([0.8, 4.7, 0.8], [sx * TR.railX, -3.5 + 4.7 / 2, sz * TR.pinZ])),
        ),
      ),
    [],
  );

  const label = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#f2efe6';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1d1d1f';
      fitText(ctx, 'TRANSFORMADOR', w / 2, h * 0.08, w * 0.9, h * 0.06, { weight: 700 });
      ctx.fillRect(w * 0.08, h * 0.13, w * 0.84, h * 0.006);
      fitText(ctx, '127 V', w / 2, h * 0.26, w * 0.86, h * 0.13, { weight: 800 });
      fitText(ctx, `${secondary} V`, w / 2, h * 0.44, w * 0.86, h * 0.13, { weight: 800 });
      fitText(ctx, `${va} VA  60 Hz`, w / 2, h * 0.6, w * 0.86, h * 0.08, { weight: 700 });
      ctx.fillStyle = '#4a4d52';
      fitText(ctx, 'PRI: lado esquerdo', w / 2, h * 0.72, w * 0.9, h * 0.05, { weight: 600 });
      fitText(ctx, 'SEC: lado direito', w / 2, h * 0.79, w * 0.9, h * 0.05, { weight: 600 });
      ctx.fillStyle = '#8a1d17';
      fitText(ctx, 'CUIDADO: REDE', w / 2, h * 0.9, w * 0.9, h * 0.06, { weight: 800 });
    },
    `psu-trafo|${secondary}|${va}`,
    {
      width: 256,
      height: 512,
      fonts: [`800 40px ${FONT_SANS}`, `700 40px ${FONT_SANS}`, `600 40px ${FONT_SANS}`],
    },
  );

  return (
    <group>
      <mesh geometry={core}>
        <Material
          preset="siliconSteel"
          color="#ffffff"
          map={lamColor}
          roughnessMap={lamRough}
          roughness={0.6}
          metalness={0.85}
        />
      </mesh>
      <mesh geometry={bobbin}>
        <Material preset="pbtBlack" roughness={0.5} />
      </mesh>
      <mesh geometry={winding}>
        <Material color="#e8c234" roughness={0.32} clearcoat={0.6} clearcoatRoughness={0.3} />
      </mesh>
      <mesh geometry={pins}>
        <Material preset="tin" roughness={0.3} />
      </mesh>
      <mesh position={[0, TR_TOP + 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[S - 3, 3 * a - 4]} />
        <Material color="#ffffff" map={label} roughness={0.7} />
      </mesh>
    </group>
  );
}
