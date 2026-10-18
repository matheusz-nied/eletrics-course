/**
 * CD-1, the course's generic gate controller board (docs/plano/05-portao.md,
 * section 3), laid out like the top-view figure of the lessons
 * (`src/lessons/m16/figuras/PlacaCD1.astro`, 0,25 mm per figure unit):
 * 172 × 102 mm, FR-4 1,6 mm, mains side on the left and along the bottom,
 * low-voltage side on the right, with an isolation slot milled between them.
 *
 * The blocks reuse the kit's parts at their real sizes: 5 × 20 mm glass fuse
 * in clips, 12 V switching supply (EE16 ferrite transformer, 22 µF 400 V bulk
 * capacitor, 470 µF output capacitor, PWM controller), TRIAC (TO-220) on an
 * aluminium heatsink, relays K1 (ABRE) and K2 (FECHA) (19 × 15,5 × 15 mm),
 * DIP-18 microcontroller, 433,92 MHz receiver module with a 17 cm wire
 * antenna, 3 mm LEDs, PROG button, buzzer, jumpers J1 and J2, 2-way DIP
 * switch, trimpots PAUSA and FORÇA, a 3-way KK header for the limit
 * switches, 7,5 mm power terminals along the bottom and 5,08 mm low-voltage
 * terminals on the right edge. Positions follow the figure, nudged where the
 * real sizes need it.
 *
 * All parts are baked into a few merged meshes (`_gate-batch.tsx`), so the
 * board stays inside the draw-call budget of a phone.
 */
import { GlowSprite } from '../fx/glow';
import { formatNumber } from '../core/format';
import { Anchor } from '../core/view';
import { boardPoint, type PcbLayout, type PcbPad, type PcbSilk, type Point } from '../pcb/layout';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { BakeBlock, BakeLayer, BakePart, BatchRoot } from './_gate-batch';
import { SlottedBoard, type BoardSlot } from './_gate-board';
import {
  FerriteTransformer,
  RF_ANTENNA,
  RF_PINS,
  RfModule,
  TRANSFORMER_PINS,
  WireAntenna,
} from './_gate-parts';
import Buzzer from './buzzer';
import ConnectorKk from './connector-kk';
import DipSwitch from './dip-switch';
import ElectrolyticCapacitor, { electrolyticSize } from './electrolytic-capacitor';
import FuseGlass from './fuse-glass';
import IcDip from './ic-dip';
import Led, { LED_COLORS, type LedColor } from './led';
import PinHeader from './pin-header';
import Relay, { RELAY_PINS } from './relay';
import ScrewTerminal from './screw-terminal';
import TactileButton from './tactile-button';
import TransistorTo220 from './transistor-to220';
import Trimpot from './trimpot';

export type GateBlock =
  | 'rede'
  | 'fonte'
  | 'potencia'
  | 'motor'
  | 'mcu'
  | 'rf'
  | 'entradas'
  | 'ajustes'
  | 'leds'
  | 'saidas';

export type GateMotion = 'parado' | 'abrindo' | 'fechando';
export type GateLimit = 'nenhum' | 'fca' | 'fcf';

export interface GateControlBoardProps {
  /** Block kept in colour while the rest is dimmed ('nenhum': all in colour). */
  highlight?: GateBlock | 'nenhum';
  /** Motor command: K1 energized while opening, K2 while closing. */
  motion?: GateMotion;
  /** Limit switch closed by the magnet (its LED lights): open end, closed end or none. */
  limitSwitch?: GateLimit;
  /** J1 FOTO placed (photocell input ignored). */
  jumperFoto?: boolean;
  /** J2 AUT placed (automatic closing). */
  jumperAuto?: boolean;
  /** DIP 1 INV on (direction inverted by software). */
  dipInvert?: boolean;
  /** DIP 2 LUZ on (garage light for 60 s more). */
  dipLight?: boolean;
  /** Trimpot PAUSA (s), 0 to 120. */
  pause?: number;
  /** Trimpot FORÇA (%), 0 to 100. */
  force?: number;
  /** Board powered from the mains. */
  powered?: boolean;
}

const BLOCKS: GateBlock[] = [
  'rede',
  'fonte',
  'potencia',
  'motor',
  'mcu',
  'rf',
  'entradas',
  'ajustes',
  'leds',
  'saidas',
];

const BLOCK_LABELS: Record<GateBlock, string> = {
  rede: 'Rede: bornes F, N e terra e o fusível',
  fonte: 'Fonte de 12 V',
  potencia: 'Potência: TRIAC e relés',
  motor: 'Bornes do motor e do capacitor',
  mcu: 'Microcontrolador',
  rf: 'Receptor de 433,92 MHz e antena',
  entradas: 'Entradas',
  ajustes: 'Ajustes',
  leds: 'LEDs',
  saidas: 'Saídas',
};

const MOTION_LABELS: Record<GateMotion, string> = {
  parado: 'Parado',
  abrindo: 'Abrindo (K1 ligado)',
  fechando: 'Fechando (K2 ligado)',
};

const LIMIT_LABELS: Record<GateLimit, string> = {
  nenhum: 'Nenhum (portão no meio)',
  fca: 'FCA (portão aberto)',
  fcf: 'FCF (portão fechado)',
};

// ---------------------------------------------------------------------------
// Layout (mm from the top-left corner, y down), from the figure.

const W = 172;
const H = 102;
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

const FUSE: Point = [22, 12.8];
const TRANSFORMER: Point = [20, 35];
const C_BULK: Point = [35.5, 34];
const C_OUT: Point = [47.5, 34];
const PWM_IC: Point = [22, 47.5];
const TRIAC: Point = [28.5, 66];
const K1: Point = [42, 64];
const K2: Point = [68.5, 64];
const MCU: Point = [81, 38];
const RF: Point = [79, 13];
const LEDS: { label: string; color: LedColor; x: number }[] = [
  { label: 'REDE', color: 'verde', x: 107 },
  { label: 'FCA', color: 'verde', x: 115.5 },
  { label: 'FCF', color: 'vermelho', x: 124 },
  { label: 'FOTO', color: 'amarelo', x: 132.5 },
  { label: 'PROG', color: 'azul', x: 141 },
];
const LED_Y = 29;
const BUTTON: Point = [107.75, 44.5];
const J1: Point = [119, 43.5];
const J2: Point = [132, 43.5];
const DIP: Point = [108.5, 61];
const PAUSA: Point = [125, 61.5];
const FORCA: Point = [138, 61.5];
const BUZZER: Point = [147, 13.5];
const LIMIT: Point = [105.5, 85];

/** Power terminals: 7,5 mm pitch (the 5,08 mm block scaled up), wire entries at the bottom edge. */
const POWER_SCALE = 7.5 / 5.08;
const POWER_Y = 96;
const POWER_MODULES = [
  { x: 20.75, labels: ['F', 'N', '⏚'] },
  { x: 50.75, labels: ['COM', 'ABRE', 'FECHA'] },
  { x: 75.75, labels: ['CAP', 'CAP'] },
];
/** Low-voltage terminals: 5,08 mm, turned so the wire entries face the right edge. */
const LOW_X = 167.9;
const LOW_MODULES = [
  { y: 37.25, labels: ['+12V', 'GND', 'FOTO'] },
  { y: 57.25, labels: ['BOT', 'GND'] },
  { y: 73.25, labels: ['TRAVA+', 'TRAVA−'] },
  { y: 88.25, labels: ['AUX NA', 'AUX C'] },
];

const powerWays = POWER_MODULES.flatMap((m) =>
  m.labels.map((label, i) => ({ label, x: m.x + (i - (m.labels.length - 1) / 2) * 7.5 })),
);
/** Turned 90°: the way with the lowest local x ends up lowest on the board. */
const lowWays = LOW_MODULES.flatMap((m) =>
  m.labels.map((label, i) => ({
    label,
    y: m.y - (m.labels.length - 1 - i - (m.labels.length - 1) / 2) * 5.08,
  })),
);

const C_BULK_SIZE = electrolyticSize(22e-6, 400);
const C_OUT_SIZE = electrolyticSize(470e-6, 25);

const SLOTS: BoardSlot[] = [{ from: [89.5, 54], to: [89.5, 98], width: 1.8 }];

function pad(at: Point, drill: number, size: number, extra: Partial<PcbPad> = {}): PcbPad {
  return { at, drill, size, ...extra };
}

function buildLayout(): PcbLayout {
  const pads: PcbPad[] = [];
  // Fuse clips: two pins each.
  for (const x of [-9, -6.2, 6.2, 9]) pads.push(pad([FUSE[0] + x, FUSE[1]], 1.2, 2.4));
  for (const p of TRANSFORMER_PINS) pads.push(pad(local(TRANSFORMER, 0, p), 1, 2));
  for (const [c, s] of [
    [C_BULK, C_BULK_SIZE],
    [C_OUT, C_OUT_SIZE],
  ] as const)
    for (const side of [-1, 1])
      pads.push(
        pad([c[0] + (side * s.pitch) / 2, c[1]], 1, 2, side < 0 ? {} : { shape: 'square' }),
      );
  for (let i = 0; i < 4; i++)
    for (const side of [-1, 1])
      pads.push(pad([PWM_IC[0] + (i - 1.5) * 2.54, PWM_IC[1] + side * 3.81], 0.9, 1.6));
  for (const x of [-2.54, 0, 2.54]) pads.push(pad(local(TRIAC, 90, [x, -0.385]), 1.2, 2.2));
  for (const k of [K1, K2])
    for (const p of Object.values(RELAY_PINS)) pads.push(pad([k[0] + p[0], k[1] + p[1]], 1.3, 2.6));
  for (let i = 0; i < 9; i++)
    for (const side of [-1, 1])
      pads.push(
        pad([MCU[0] + (i - 4) * 2.54, MCU[1] + side * 3.81], 0.9, 1.6, {
          ...(i === 0 && side > 0 ? { shape: 'square' } : {}),
        }),
      );
  for (const p of RF_PINS) pads.push(pad(local(RF, 0, p), 0.9, 1.6));
  for (const l of LEDS)
    for (const side of [-1, 1])
      pads.push(pad([l.x + side * 1.27, LED_Y], 0.8, 1.5, side < 0 ? { shape: 'square' } : {}));
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      pads.push(pad([BUTTON[0] + sx * 3.25, BUTTON[1] + sz * 2.25], 1, 1.8));
  for (const j of [J1, J2])
    for (const side of [-1, 1])
      pads.push(pad([j[0] + side * 1.27, j[1]], 1, 1.7, { shape: 'square' }));
  for (const lx of [-1.27, 1.27])
    for (const lz of [-3.81, 3.81]) pads.push(pad(local(DIP, -90, [lx, lz]), 0.9, 1.6));
  for (const t of [PAUSA, FORCA])
    for (const p of [
      [-2.5, 2.5],
      [0, -2.5],
      [2.5, 2.5],
    ] as const)
      pads.push(pad(local(t, 0, p), 1, 1.9));
  for (const side of [-1, 1]) pads.push(pad([BUZZER[0] + side * 3.8, BUZZER[1]], 0.9, 1.7));
  for (const x of [-2.54, 0, 2.54])
    pads.push(pad([LIMIT[0] + x, LIMIT[1]], 1, 1.7, x === 0 ? { net: 'GND' } : {}));
  for (const w of powerWays)
    pads.push(pad([w.x, POWER_Y - 1.75 * POWER_SCALE], 1.7, 3.4, { shape: 'oval' }));
  for (const w of lowWays)
    pads.push(
      pad([LOW_X - 1.75, w.y], 1.3, 2.6, w.label === 'GND' ? { net: 'GND', shape: 'square' } : {}),
    );

  const text = (
    at: Point,
    value: string,
    size = 1.4,
    extra: Partial<Extract<PcbSilk, { kind: 'text' }>> = {},
  ): PcbSilk => ({ kind: 'text', at, text: value, size, ...extra });
  const silk: PcbSilk[] = [
    text([124, 9], 'CD-1', 4.2),
    text([124, 14.2], 'CENTRAL GENÉRICA', 1.2),
    text([36.5, 13.4], 'FUSÍVEL 10 A', 1.3, { align: 'left' }),
    text([7.2, 12.8], 'F1', 1.2),
    text([43, 46.5], 'FONTE 12 V', 1.5),
    text([35.75, 78.4], 'TRIAC', 1.3),
    text([42, 74.4], 'K1 ABRE', 1.4),
    text([68.5, 74.4], 'K2 FECHA', 1.4),
    text([55, 77.2], 'RELÉS DE SENTIDO', 1.1),
    text([86.7, 80], 'LADO DA REDE', 1.2, { rotation: 90 }),
    text([81, 45], 'MICROCONTROLADOR', 1.2),
    text([79, 22], 'RECEPTOR 433,92 MHz', 1.3),
    text([100, 4.5], 'ANTENA 17 cm', 1.1, { align: 'left' }),
    text([107.75, 50.6], 'PROG', 1.2),
    text([119, 47.4], 'J1', 1.2),
    text([119, 49.6], 'FOTO', 1.1),
    text([132, 47.4], 'J2', 1.2),
    text([132, 49.6], 'AUT', 1.1),
    text([108.5, 55.6], 'DIP', 1.1),
    text([114.4, 59.73], 'INV', 1.1, { align: 'left' }),
    text([114.4, 62.27], 'LUZ', 1.1, { align: 'left' }),
    text([PAUSA[0], 68.2], 'PAUSA', 1.2),
    text([FORCA[0], 68.2], 'FORÇA', 1.2),
    text([BUZZER[0], 22], 'BUZZER', 1.1),
    text([LIMIT[0], 92.6], 'FIM DE CURSO', 1.2),
    text([LIMIT[0] - 2.54, 90], 'FCA', 0.9),
    text([LIMIT[0], 90], 'GND', 0.9),
    text([LIMIT[0] + 2.54, 90], 'FCF', 0.9),
    text([131, 89.5], 'BAIXA TENSÃO', 1.4),
    text([44, 5.4], 'PERIGO', 1.1, { align: 'left' }),
    text([44, 7.4], 'REDE 127/220 V', 1.0, { align: 'left' }),
    // Hazard triangle.
    {
      kind: 'line',
      points: [
        [39, 7.8],
        [40.8, 4.6],
        [42.6, 7.8],
      ],
      width: 0.22,
      closed: true,
    },
    text([40.8, 6.7], '!', 1.3),
    ...LEDS.map((l) => text([l.x, LED_Y + 4.3], l.label, 1.0)),
    ...powerWays
      .filter((w) => w.label !== '⏚')
      .map((w) => text([w.x, 88.6], w.label, w.label.length > 3 ? 1.3 : 1.6)),
    // Earth symbol (drawn: fonts may not have ⏚).
    ...earthSymbol(powerWays.find((w) => w.label === '⏚')!.x, 88.6),
    ...lowWays.map((w) => text([162.6, w.y], w.label, 1.3, { align: 'right' })),
    // Footprint outlines of the big parts.
    { kind: 'rect', at: K1, size: [19.6, 16.1], width: 0.2 },
    { kind: 'rect', at: K2, size: [19.6, 16.1], width: 0.2 },
    { kind: 'rect', at: [TRIAC[0] - 11, TRIAC[1]], size: [17, 26], width: 0.2 },
    { kind: 'rect', at: TRANSFORMER, size: [17.6, 15.6], width: 0.2 },
    { kind: 'circle', at: C_BULK, r: C_BULK_SIZE.D / 2 + 0.4, width: 0.2 },
    { kind: 'circle', at: C_OUT, r: C_OUT_SIZE.D / 2 + 0.4, width: 0.2 },
    { kind: 'circle', at: BUZZER, r: 6.4, width: 0.2 },
    // Isolation boundary next to the slot.
    {
      kind: 'line',
      points: [
        [91.6, 99],
        [91.6, 52],
        [60, 52],
        [57, 25],
        [57, 1.5],
      ],
      width: 0.2,
    },
  ];

  return {
    width: W,
    height: H,
    thickness: T,
    corner: 3.5,
    copper: 'both',
    mask: 'verde',
    finish: 'hasl',
    pads,
    holes: [
      { at: [5, 5], drill: 3.5 },
      { at: [167, 5], drill: 3.5 },
      { at: [5, 97], drill: 3.5 },
      { at: [167, 97], drill: 3.5 },
    ],
    traces: [
      // Low voltage on top: LEDs, jumpers and inputs to the microcontroller.
      ...LEDS.map((l, i) => ({
        points: [
          [l.x + 1.27, LED_Y],
          [l.x + 1.27, LED_Y - 3],
          [91.16 - i * 2.54, 31],
          [91.16 - i * 2.54, MCU[1] - 3.81],
        ] as Point[],
        width: 0.4,
      })),
      { points: [J1, [119, 52], [96, 52], [91.16, 41.81]] as Point[], width: 0.4 },
      { points: [J2, [134, 52.6], [94, 52.6], [88.62, 41.81]] as Point[], width: 0.4 },
      {
        points: [
          [LIMIT[0] - 2.54, LIMIT[1]],
          [98, 78],
          [98, 50],
          [86.08, 41.81],
        ] as Point[],
        width: 0.4,
      },
      // Mains on top: fuse to the supply, relay contacts to the motor terminals.
      {
        points: [
          [FUSE[0] + 9, FUSE[1]],
          [33, 20],
          [33, 28],
        ] as Point[],
        width: 2,
      },
      {
        points: [
          [K1[0] + 7.8, K1[1] - 6],
          [K1[0] + 7.8, 84],
          [50.75, 84],
          [50.75, POWER_Y - 2.58],
        ] as Point[],
        width: 2.2,
      },
      {
        points: [
          [K2[0] + 7.8, K2[1] - 6],
          [K2[0] + 9.5, 84],
          [58.25, 86],
          [58.25, POWER_Y - 2.58],
        ] as Point[],
        width: 2.2,
      },
      // Mains on the bottom.
      {
        points: [
          [13.25, POWER_Y - 2.58],
          [13.25, 86],
          [6.5, 80],
          [6.5, 20],
          [FUSE[0] - 9, FUSE[1]],
        ],
        width: 2.5,
        side: 'bottom',
      },
      {
        points: [
          [FUSE[0] + 6.2, FUSE[1]],
          [28.1, 40],
          [28.1, 63.46],
        ],
        width: 2.5,
        side: 'bottom',
      },
      {
        points: [
          [28.1, 66],
          [K1[0] - 7.4, K1[1]],
          [K2[0] - 7.4, K2[1]],
        ],
        width: 2.5,
        side: 'bottom',
      },
    ],
    pours: [
      {
        outline: [
          [93.5, 24],
          [159, 24],
          [159, 99.5],
          [93.5, 99.5],
        ],
        side: 'bottom',
        net: 'GND',
        clearance: 0.5,
      },
    ],
    silk,
  };
}

function earthSymbol(x: number, y: number): PcbSilk[] {
  const w = 0.22;
  return [
    {
      kind: 'line',
      points: [
        [x, y - 1.2],
        [x, y - 0.1],
      ],
      width: w,
    },
    {
      kind: 'line',
      points: [
        [x - 1.2, y - 0.1],
        [x + 1.2, y - 0.1],
      ],
      width: w,
    },
    {
      kind: 'line',
      points: [
        [x - 0.8, y + 0.45],
        [x + 0.8, y + 0.45],
      ],
      width: w,
    },
    {
      kind: 'line',
      points: [
        [x - 0.4, y + 1],
        [x + 0.4, y + 1],
      ],
      width: w,
    },
  ];
}

const LAYOUT = buildLayout();

/** Exploded view: parts lift off the board in three tiers, above the board's own layers. */
const LIFT_LOW: Vec3 = [0, 64, -32];
const LIFT_MID: Vec3 = [0, 84, -42];
const LIFT_TALL: Vec3 = [0, 104, -52];

/** Cut through the relays and the TRIAC: removes the front of the board. */
const CUT_Z = K1[1] - H / 2;

/** Antenna path in the receiver module's space: up, over the back edge, then loose on the bench. */
/**
 * The 17 cm antenna wire: (x, z) from its pad on the receiver and the height
 * in the module. Up from the pad, over the back edge and down onto the
 * bench, then along the back and the right side of the board.
 */
const BENCH = -T + 0.62;
const ANTENNA_PATH: [number, number, number][] = [
  [0, 0, 5.9],
  [0.3, -0.9, 7],
  [0.9, -3, 7.4],
  [1.6, -5.6, 6.2],
  [2.2, -7.6, 3],
  [2.6, -8.8, 1],
  [3, -9.8, -0.6],
  [3.6, -11.2, BENCH + 0.3],
  [5, -13, BENCH],
  [12, -14.8, BENCH],
  [40, -15.6, BENCH],
  [62, -14.6, BENCH],
  [77, -12, BENCH],
  [84, -4, BENCH],
  [86.4, 10, BENCH],
  [87, 30, BENCH],
  [86.2, 50, BENCH],
  [85.2, 60, BENCH],
];
const ANTENNA: Vec3[] = ANTENNA_PATH.map(([x, z, y]) => [RF_ANTENNA[0] + x, y, RF_ANTENNA[2] + z]);

// ---------------------------------------------------------------------------

const resolve = (props: PartProps) =>
  ({ ...meta.defaults, ...props }) as Required<GateControlBoardProps>;

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

function ledStates(p: Required<GateControlBoardProps>): Record<string, boolean> {
  const on = p.powered;
  return {
    REDE: on,
    FCA: on && p.limitSwitch === 'fca',
    FCF: on && p.limitSwitch === 'fcf',
    FOTO: on,
    PROG: false,
  };
}

function blockOf(value: unknown): GateBlock | 'nenhum' {
  return BLOCKS.includes(value as GateBlock) ? (value as GateBlock) : 'nenhum';
}

const top = (at: Point, up: number): Vec3 => on(at, up);

export const meta: PartMeta = {
  id: 'gate-control-board',
  label: 'Central de portão CD-1',
  category: 'placas',
  summary:
    'A central genérica CD-1 do curso: fusível, fonte de 12 V, TRIAC, relés de sentido, microcontrolador, receptor de 433,92 MHz, ajustes e bornes, com o rasgo que separa a rede da baixa tensão.',
  defaults: {
    highlight: 'nenhum',
    motion: 'parado',
    limitSwitch: 'fcf',
    jumperFoto: false,
    jumperAuto: true,
    dipInvert: false,
    dipLight: false,
    pause: 30,
    force: 50,
    powered: true,
  },
  controls: {
    highlight: {
      kind: 'select',
      label: 'Destaque',
      options: [
        { value: 'nenhum', label: 'Nenhum' },
        ...BLOCKS.map((b) => ({ value: b, label: BLOCK_LABELS[b] })),
      ],
    },
    motion: {
      kind: 'select',
      label: 'Motor',
      options: (Object.keys(MOTION_LABELS) as GateMotion[]).map((m) => ({
        value: m,
        label: MOTION_LABELS[m],
      })),
    },
    limitSwitch: {
      kind: 'select',
      label: 'Fim de curso acionado',
      options: (Object.keys(LIMIT_LABELS) as GateLimit[]).map((m) => ({
        value: m,
        label: LIMIT_LABELS[m],
      })),
    },
    jumperFoto: { kind: 'toggle', label: 'Jumper J1 FOTO colocado' },
    jumperAuto: { kind: 'toggle', label: 'Jumper J2 AUT colocado' },
    dipInvert: { kind: 'toggle', label: 'Chave DIP INV ligada' },
    dipLight: { kind: 'toggle', label: 'Chave DIP LUZ ligada' },
    pause: { kind: 'number', label: 'Trimpot PAUSA', min: 0, max: 120, step: 1, unit: 's' },
    force: { kind: 'number', label: 'Trimpot FORÇA', min: 0, max: 100, step: 1, unit: '%' },
    powered: { kind: 'toggle', label: 'Placa ligada na rede' },
  },
  annotations: (props) => {
    const p = resolve(props);
    const focus = blockOf(p.highlight);
    const list: (PartAnnotation & { block?: GateBlock | GateBlock[]; detail?: boolean })[] = [
      {
        block: 'rede',
        at: [0, 0, 0],
        anchor: 'gate-fusivel',
        text: 'Fusível de vidro 5 × 20 mm, 10 A: troque só por outro igual, nunca por um maior',
      },
      {
        block: 'rede',
        at: [0, 0, 0],
        anchor: 'gate-rede',
        text: 'Bornes F, N e terra: a rede chega aqui (127 V ou 220 V), antes do fusível',
      },
      {
        block: 'fonte',
        at: [0, 0, 0],
        anchor: 'gate-fonte',
        text: 'Fonte chaveada: de 90–240 V CA para 12 V CC; o transformador de ferrite isola os dois lados',
      },
      {
        block: 'fonte',
        at: [0, 0, 0],
        anchor: 'gate-capacitor',
        text: 'Capacitor de 400 V da fonte: pode guardar carga mesmo com a placa desligada',
      },
      {
        block: 'potencia',
        at: [0, 0, 0],
        anchor: 'gate-triac',
        text: 'TRIAC no dissipador: liga o motor e dosa a força. O dissipador pode estar na tensão da rede',
      },
      {
        block: 'potencia',
        at: [0, 0, 0],
        anchor: 'gate-reles',
        text: 'Relés K1 (ABRE) e K2 (FECHA): escolhem o sentido, nunca os dois juntos; os contatos ficam na rede',
      },
      {
        block: 'motor',
        at: [0, 0, 0],
        anchor: 'gate-motor',
        text: 'Bornes COM, ABRE e FECHA do motor e CAP, CAP do capacitor: tensão da rede',
      },
      {
        block: ['rede', 'fonte', 'potencia', 'motor'],
        at: [0, 0, 0],
        anchor: 'gate-rasgo',
        text: 'Rasgo na placa: aumenta a distância entre a rede e a baixa tensão',
        exploded: false,
      },
      {
        block: 'mcu',
        at: [0, 0, 0],
        anchor: 'gate-mcu',
        text: 'Microcontrolador: lê as entradas e comanda relés, TRIAC, LEDs e buzzer',
      },
      {
        block: 'rf',
        at: [0, 0, 0],
        anchor: 'gate-rf',
        text: 'Receptor de 433,92 MHz: recebe o código de cada aperto do controle',
      },
      {
        block: 'rf',
        at: [0, 0, 0],
        anchor: 'gate-antena',
        detail: true,
        text: 'Antena: fio de uns 17 cm (um quarto de onda); não corte, não enrole',
      },
      {
        block: 'leds',
        at: [0, 0, 0],
        anchor: 'gate-leds',
        text: 'LEDs REDE, FCA, FCF, FOTO e PROG: REDE apagado não prova que a placa está sem tensão',
      },
      {
        block: 'ajustes',
        at: [0, 0, 0],
        anchor: 'gate-jumpers',
        detail: true,
        text: 'Jumpers J1 FOTO e J2 AUT: o J1 colocado deixa a central cega à fotocélula; não use',
      },
      {
        block: 'ajustes',
        at: [0, 0, 0],
        anchor: 'gate-ajustes',
        text: 'Botão PROG, chave DIP (INV e LUZ) e trimpots PAUSA e FORÇA',
      },
      {
        block: 'entradas',
        at: [0, 0, 0],
        anchor: 'gate-fim-de-curso',
        detail: true,
        text: 'Conector do fim de curso: FCA, GND e FCF',
      },
      {
        block: 'entradas',
        at: [0, 0, 0],
        anchor: 'gate-entradas',
        text: 'Bornes +12V, GND, FOTO, BOT e GND: fotocélula e botoeira (12 V, máx. 300 mA no +12V)',
      },
      {
        block: 'saidas',
        at: [0, 0, 0],
        anchor: 'gate-saidas',
        text: 'TRAVA± (12 V) e AUX NA/AUX C, contato seco: com lâmpada da rede, o AUX fica com tensão da rede',
      },
      {
        block: 'saidas',
        at: [0, 0, 0],
        anchor: 'gate-buzzer',
        detail: true,
        text: 'Buzzer: apita para avisar erro e confirmar comandos',
      },
      {
        at: [0, 0, 0],
        anchor: 'pcb-substrate',
        text: 'Placa de FR-4 de 1,6 mm',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        anchor: 'pcb-copper',
        text: 'Cobre: trilhas largas para a corrente do motor',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        anchor: 'pcb-silk',
        text: 'Serigrafia: nomes dos bornes e dos ajustes',
        exploded: true,
      },
    ];
    return list
      .filter((a) =>
        focus === 'nenhum'
          ? !a.detail
          : !a.block || (Array.isArray(a.block) ? a.block.includes(focus) : a.block === focus),
      )
      .map(({ block: _block, detail: _detail, ...a }) => a);
  },
  explode: true,
  cutaway: true,
  cut: { normal: [0, 0, -1], through: [0, 0, CUT_Z] },
  describe: (props) => {
    const p = resolve(props);
    const focus = blockOf(p.highlight);
    const leds = ledStates(p);
    const lit = LEDS.filter((l) => leds[l.label]).map((l) => l.label);
    const pause = Math.round(clamp(Number(p.pause), 0, 120));
    const force = Math.round(clamp(Number(p.force), 0, 100));
    const parts = [
      'Placa da central genérica CD-1 (172 × 102 mm) vista de cima. À esquerda e embaixo, o lado da rede: bornes F, N e terra, fusível de vidro de 10 A, fonte de 12 V, TRIAC no dissipador, relés K1 (abre) e K2 (fecha) e os bornes COM, ABRE, FECHA, CAP e CAP. Um rasgo na placa separa esse lado da baixa tensão, à direita: microcontrolador, receptor de 433,92 MHz com a antena de fio, LEDs, botão PROG, jumpers, chave DIP, trimpots, buzzer, conector do fim de curso e os bornes +12V, GND, FOTO, BOT, GND, TRAVA+, TRAVA−, AUX NA e AUX C.',
    ];
    if (!p.powered) parts.push('Placa desligada: LEDs apagados e relés soltos.');
    else {
      const motion =
        p.motion === 'abrindo'
          ? 'Abrindo: o relé K1 está energizado.'
          : p.motion === 'fechando'
            ? 'Fechando: o relé K2 está energizado.'
            : 'Motor parado: os dois relés estão soltos.';
      parts.push(`${motion} LEDs acesos: ${lit.join(', ')}.`);
    }
    parts.push(
      `Jumper J1 FOTO ${p.jumperFoto ? 'colocado (a central ignora a fotocélula)' : 'retirado'}; J2 AUT ${p.jumperAuto ? 'colocado (fecha sozinho)' : 'retirado'}.`,
      `Chave DIP: INV ${p.dipInvert ? 'ligada' : 'desligada'}, LUZ ${p.dipLight ? 'ligada' : 'desligada'}.`,
      `Trimpot PAUSA em ${formatNumber(pause)} s e FORÇA em ${formatNumber(force)} %.`,
    );
    if (focus !== 'nenhum') parts.push(`Em destaque: ${BLOCK_LABELS[focus].toLowerCase()}.`);
    return parts.join(' ');
  },
  view: [0.18, 1.5, 0.8],
};

export default function GateControlBoard(props: GateControlBoardProps) {
  const p = resolve(props as PartProps);
  const focus = blockOf(p.highlight);
  const leds = ledStates(p);
  const k1 = p.powered && p.motion === 'abrindo';
  const k2 = p.powered && p.motion === 'fechando';
  const pause = clamp(Number(p.pause), 0, 120) / 120;
  const force = clamp(Number(p.force), 0, 100) / 100;

  const place = (at: Point, deg = 0, up = 0) => ({
    position: on(at, up),
    rotation: [0, (deg * Math.PI) / 180, 0] as Vec3,
  });
  const relayZ = K1[1] - H / 2;

  return (
    <BatchRoot
      blocks={BLOCKS}
      highlight={focus === 'nenhum' ? '' : focus}
      cutNormal={[0, 0, -1]}
      cutThrough={[0, 0, CUT_Z]}
    >
      <SlottedBoard layout={LAYOUT} slots={SLOTS} />
      <Anchor name="gate-rasgo" position={on([89.5, 70], 0.2)} />

      {/* Low tier: chips, receiver, button, connector, buzzer. */}
      <BakeLayer
        lift={LIFT_LOW}
        extras={
          <>
            <Anchor name="gate-mcu" position={top(MCU, 4)} />
            <Anchor name="gate-rf" position={top([RF[0] - 4, RF[1] - 2], 7)} />
            <Anchor name="gate-antena" position={top([RF[0] + 14.2 + 40, -7], -T + 1.3)} />
            <Anchor name="gate-fim-de-curso" position={top(LIMIT, 6)} />
            <Anchor name="gate-buzzer" position={top(BUZZER, 9.5)} />
          </>
        }
      >
        <BakeBlock id="fonte">
          <BakePart {...place(PWM_IC, 0, -3.3)}>
            <IcDip pins={8} code="PWM 12V" dateCode="2402" />
          </BakePart>
        </BakeBlock>
        <BakeBlock id="mcu">
          <BakePart {...place(MCU, 0, -3.3)}>
            <IcDip pins={18} code="MCU 8 BITS" dateCode="2419" />
          </BakePart>
        </BakeBlock>
        <BakeBlock id="rf">
          <BakePart {...place(RF)}>
            <RfModule />
            <WireAntenna points={ANTENNA} />
          </BakePart>
        </BakeBlock>
        <BakeBlock id="ajustes">
          <BakePart {...place(BUTTON, 0, -3.5)}>
            <TactileButton size={6} capColor="preto" />
          </BakePart>
        </BakeBlock>
        <BakeBlock id="entradas">
          <BakePart {...place(LIMIT, 0, -3.3)} dropAbove={12}>
            <ConnectorKk family="kk" pins={3} mated={false} />
          </BakePart>
        </BakeBlock>
        <BakeBlock id="saidas">
          <BakePart {...place(BUZZER, 0, -6)}>
            <Buzzer variant="ativo" sticker={false} />
          </BakePart>
        </BakeBlock>
      </BakeLayer>

      {/* LEDs (their own layer: they change with the state). */}
      <BakeLayer
        lift={LIFT_LOW}
        extras={
          <>
            {LEDS.map((l) => (
              <GlowSprite
                key={l.label}
                always
                color={LED_COLORS[l.color].light}
                intensity={leds[l.label] ? 0.75 : 0}
                size={9}
                position={top([l.x, LED_Y], 1 + 3.2)}
              />
            ))}
            <Anchor name="gate-leds" position={top([LEDS[0]!.x, LED_Y], 6.5)} />
          </>
        }
      >
        <BakeBlock id="leds">
          {LEDS.map((l) => (
            <BakePart key={l.label} {...place([l.x, LED_Y], 0, 1 - 5 - 2)}>
              <Led size={3} color={l.color} brightness={leds[l.label] ? 1 : 0} leadLength={5} />
            </BakePart>
          ))}
        </BakeBlock>
      </BakeLayer>

      {/* Adjustments that the props move. */}
      <BakeLayer
        lift={LIFT_LOW}
        extras={
          <>
            <Anchor name="gate-jumpers" position={top(J1, 8.5)} />
            <Anchor name="gate-ajustes" position={top(PAUSA, 5)} />
          </>
        }
      >
        <BakeBlock id="ajustes">
          <BakePart {...place(J1, 0, -3)}>
            <PinHeader pins={2} jumperAt={p.jumperFoto ? 0 : -1} jumperColor="preto" />
          </BakePart>
          <BakePart {...place(J2, 0, -3)}>
            <PinHeader pins={2} jumperAt={p.jumperAuto ? 0 : -1} jumperColor="preto" />
          </BakePart>
          <BakePart {...place(DIP, -90, -3.5)}>
            <DipSwitch
              positions={2}
              color="azul"
              states={`${p.dipInvert ? 1 : 0}${p.dipLight ? 1 : 0}`}
            />
          </BakePart>
          <BakePart {...place(PAUSA, 0, -3.5)}>
            <Trimpot variant="aberto" ohms={100_000} rotation={pause} />
          </BakePart>
          <BakePart {...place(FORCA, 0, -3.5)}>
            <Trimpot variant="aberto" ohms={10_000} rotation={force} />
          </BakePart>
        </BakeBlock>
      </BakeLayer>

      {/* Middle tier: fuse and terminal blocks. */}
      <BakeLayer
        lift={LIFT_MID}
        delay={0.08}
        extras={
          <>
            <Anchor name="gate-fusivel" position={top(FUSE, 9)} />
            <Anchor name="gate-rede" position={top([20.75, POWER_Y], 15)} />
            <Anchor name="gate-motor" position={top([50.75, POWER_Y], 15)} />
            <Anchor name="gate-entradas" position={top([LOW_X, 37.25], 10.5)} />
            <Anchor name="gate-saidas" position={top([LOW_X, 80.75], 10.5)} />
          </>
        }
      >
        <BakeBlock id="rede">
          <BakePart {...place(FUSE, 0, -3.5)}>
            <FuseGlass amps={10} type="rapido" size="5x20" holder="clip-pcb" />
          </BakePart>
        </BakeBlock>
        {POWER_MODULES.map((m, i) => (
          <BakeBlock key={m.x} id={i === 0 ? 'rede' : 'motor'}>
            <BakePart {...place([m.x, POWER_Y], 0, -3.5 * POWER_SCALE)} scale={POWER_SCALE}>
              <ScrewTerminal
                ways={m.labels.length}
                pitch={5.08}
                color="azul"
                screwTurns={0}
                labels={m.labels.join(',')}
              />
            </BakePart>
          </BakeBlock>
        ))}
        {LOW_MODULES.map((m, i) => (
          <BakeBlock key={m.y} id={i < 2 ? 'entradas' : 'saidas'}>
            <BakePart {...place([LOW_X, m.y], 90, -3.5)}>
              <ScrewTerminal ways={m.labels.length} pitch={5.08} color="verde" screwTurns={0} />
            </BakePart>
          </BakeBlock>
        ))}
      </BakeLayer>

      {/* Relays (their own layer: the armature moves). */}
      <BakeLayer
        lift={LIFT_MID}
        delay={0.08}
        extras={<Anchor name="gate-reles" position={[K1[0] - W / 2 + 6, T + 16, relayZ]} />}
      >
        <BakeBlock id="potencia">
          <BakePart {...place(K1, 0, -3.5)}>
            <Relay coilVoltage={12} energized={k1} />
          </BakePart>
          <BakePart {...place(K2, 0, -3.5)}>
            <Relay coilVoltage={12} energized={k2} />
          </BakePart>
        </BakeBlock>
      </BakeLayer>

      {/* Tall tier: TRIAC on its heatsink and the supply. */}
      <BakeLayer
        lift={LIFT_TALL}
        delay={0.16}
        extras={
          <>
            <Anchor name="gate-triac" position={top([TRIAC[0] - 11, TRIAC[1] - 6], 23)} />
            <Anchor name="gate-fonte" position={top(TRANSFORMER, 17.5)} />
            <Anchor name="gate-capacitor" position={top(C_BULK, C_BULK_SIZE.L + 1)} />
          </>
        }
      >
        <BakeBlock id="potencia">
          <BakePart {...place(TRIAC, 90, -4)}>
            <TransistorTo220 code="BTA16-600B" dateCode="2338" heatsink leadLength={5} />
          </BakePart>
        </BakeBlock>
        <BakeBlock id="fonte">
          <BakePart {...place(TRANSFORMER)}>
            <FerriteTransformer />
          </BakePart>
          <BakePart {...place(C_BULK, 0, -7.5)}>
            <ElectrolyticCapacitor farads={22e-6} voltage={400} sleeve="preto" leadLength={4} />
          </BakePart>
          <BakePart {...place(C_OUT, 0, -7.5)}>
            <ElectrolyticCapacitor farads={470e-6} voltage={25} sleeve="azul" leadLength={4} />
          </BakePart>
        </BakeBlock>
      </BakeLayer>
    </BatchRoot>
  );
}
