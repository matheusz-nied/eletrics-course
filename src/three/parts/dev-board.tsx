/**
 * Generic microcontroller development boards, in the two shapes the course
 * uses (no names or logos of any manufacturer on the model):
 *
 * - `uno`: the classic 68,6 × 53,4 mm board (the Arduino Uno R3 outline and
 *   hole/header positions from its published board drawing: holes at
 *   (14,0; 2,5), (15,3; 50,7), (66,1; 7,6) and (66,1; 35,5) mm, top headers
 *   at y = 50,8 mm with the 4,06 mm gap between D7 and D8, bottom headers at
 *   y = 2,54 mm). 8-bit microcontroller (DIP-28) in its socket, 16 MHz
 *   HC-49/S crystal, USB-serial converter (TQFP-32), SOT-223 5 V regulator,
 *   USB-B and 5,5/2,1 mm power jack, 8,5 mm female headers, 6 × 6 mm reset
 *   button, ICSP header (2 × 3), chip LEDs ON, L (pin 13), TX and RX.
 * - `esp32`: the 38-pin Wi-Fi board (51,5 × 28,0 mm, 2 × 19 male pins on the
 *   bottom at 2,54 mm, rows 25,4 mm apart, like the DevKitC layout), with the
 *   shielded Wi-Fi module (18 × 25,5 × 3,1 mm) whose PCB antenna sticks out
 *   past the shield and the board edge, micro-USB, USB-serial converter
 *   (SOIC-16), SOT-223 3,3 V regulator, EN and BOOT buttons (6 × 3,5 mm), a
 *   red power LED and the blue user LED on GPIO2.
 *
 * The parts are baked into a few merged meshes (`_gate-batch.tsx`), so a
 * whole board stays inside the draw-call budget of a phone.
 */
import { GlowSprite } from '../fx/glow';
import { Anchor, Explode } from '../core/view';
import {
  boardPoint,
  type PcbLayout,
  type PcbPad,
  type PcbSilk,
  type PcbTrace,
  type PcbVia,
  type Point,
} from '../pcb/layout';
import { PrintedCircuitBoard } from '../pcb/PrintedCircuitBoard';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { BakeBlock, BakeLayer, BakePart, BatchRoot } from './_gate-batch';
import {
  BarrelJack,
  ChipParts,
  CrystalHc49,
  FemaleHeader,
  MicroUsb,
  OutlineBoard,
  pinRow,
  SmaDiode,
  SmdButton,
  SmdElectrolytic,
  SmdLed,
  SMD_LED_TOP,
  Sot223,
  Sot23,
  UsbB,
  WIFI,
  WIFI_SHIELD_X,
  WifiModule,
  wifiPads,
  type ChipItem,
  type ChipKind,
  type ChipSize,
} from './_mcu-parts';
import IcDip from './ic-dip';
import IcQfp from './ic-qfp';
import { LED_COLORS } from './led';
import PinHeader from './pin-header';
import TactileButton from './tactile-button';

export type DevBoardVariant = 'uno' | 'esp32';

export interface DevBoardProps {
  variant?: DevBoardVariant;
  /** Board powered: the power LED is lit. */
  power?: boolean;
  /** The on-board user LED (pin 13 / GPIO2) is lit (only with `power`). */
  led?: boolean;
  /** Brightness of the user LED, 0 to 1. */
  ledBrightness?: number;
}

const T = 1.6;
const BLOCKS = ['all'];

const clamp01 = (v: number) => Math.min(Math.max(Number.isFinite(v) ? v : 1, 0), 1);

const resolve = (props: PartProps) => {
  const p = { ...meta.defaults, ...props };
  return {
    variant: (p.variant === 'esp32' ? 'esp32' : 'uno') as DevBoardVariant,
    power: p.power !== false,
    led: p.led === true,
    ledBrightness: clamp01(Number(p.ledBrightness)),
  };
};

// ---------------------------------------------------------------------------
// Layout helpers (layout mm from the top-left corner, y down)

interface Board {
  width: number;
  height: number;
  thickness: number;
}

/** A local pad (x, z) of a part placed at `at`, turned `deg` (counter-clockwise from the top). */
function local(at: Point, deg: number, [lx, lz]: readonly [number, number]): Point {
  const a = (deg * Math.PI) / 180;
  return [at[0] + lx * Math.cos(a) + lz * Math.sin(a), at[1] - lx * Math.sin(a) + lz * Math.cos(a)];
}

/** SMD pads [x, z, width, height] in a part's space, placed at `at` turned `deg`. */
function smd(
  at: Point,
  deg: number,
  list: [number, number, number, number][],
  net?: string,
): PcbPad[] {
  return list.map(([x, z, w, h]) => ({
    at: local(at, deg, [x, z]),
    size: [w, h] as Point,
    rotation: deg,
    shape: 'rect' as const,
    ...(net ? { net } : {}),
  }));
}

const CHIP_PAD: Record<ChipSize, [number, number, number]> = {
  '0402': [0.5, 0.6, 0.6],
  '0603': [0.8, 0.9, 0.95],
  '0805': [0.95, 1.0, 1.4],
  '1206': [1.5, 1.2, 1.8],
  '1812': [2.1, 1.2, 3.4],
};

const chipPads = (c: ChipSpec) => {
  const [x, w, h] = CHIP_PAD[c.size];
  return smd(c.at, c.deg ?? 0, [
    [-x, 0, w, h],
    [x, 0, w, h],
  ]);
};

interface ChipSpec {
  at: Point;
  deg?: number;
  size: ChipSize;
  kind: ChipKind;
}

const QFP32_PADS: [number, number, number, number][] = [0, 1, 2, 3].flatMap((side) =>
  pinRow(8, 0.8).map((t): [number, number, number, number] => {
    const d = 4.25;
    if (side === 0) return [t, d, 0.45, 1.5];
    if (side === 1) return [d, -t, 1.5, 0.45];
    if (side === 2) return [-t, -d, 0.45, 1.5];
    return [-d, t, 1.5, 0.45];
  }),
);

const soicPads = (n: number): [number, number, number, number][] =>
  [-1, 1].flatMap((s) =>
    pinRow(n / 2, 1.27).map((x): [number, number, number, number] => [x, s * 2.7, 0.6, 1.55]),
  );

const SOT223_PADS: [number, number, number, number][] = [
  ...pinRow(3, 2.3).map((x): [number, number, number, number] => [x, -2.95, 1.0, 1.8]),
  [0, 2.95, 3.3, 1.8],
];
const SOT23_PADS: [number, number, number, number][] = [
  [-0.95, -1.05, 0.8, 0.9],
  [0.95, -1.05, 0.8, 0.9],
  [0, 1.05, 0.8, 0.9],
];
const LED_PADS: [number, number, number, number][] = [
  [-0.9, 0, 0.9, 1.3],
  [0.9, 0, 0.9, 1.3],
];
const ELCO_PADS: [number, number, number, number][] = [
  [-2.65, 0, 2.6, 1.6],
  [2.65, 0, 2.6, 1.6],
];
const SMA_PADS: [number, number, number, number][] = [
  [-2.1, 0, 1.8, 1.8],
  [2.1, 0, 1.8, 1.8],
];
const BUTTON_PADS: [number, number, number, number][] = [-1, 1].flatMap((sx) =>
  [-1, 1].map((sz): [number, number, number, number] => [sx * 3.25, sz * 1.15, 1.2, 0.9]),
);

const text = (
  at: Point,
  value: string,
  size = 1,
  extra: Partial<Extract<PcbSilk, { kind: 'text' }>> = {},
): PcbSilk => ({ kind: 'text', at, text: value, size, ...extra });

const tht = (at: Point, drill: number, size: number, extra: Partial<PcbPad> = {}): PcbPad => ({
  at,
  drill,
  size,
  ...extra,
});

// ---------------------------------------------------------------------------
// Uno-style board. Positions in the board drawing's coordinates (mm from
// the bottom-left corner, USB on the left), turned into layout points.

const UW = 68.58;
const UH = 53.34;
const u = (x: number, y: number): Point => [x, UH - y];
const UNO_BOARD: Board = { width: UW, height: UH, thickness: T };

const UNO_OUTLINE: Point[] = [
  u(0, 0),
  u(66.04, 0),
  u(66.04, 1.27),
  u(68.58, 3.81),
  u(68.58, 38.1),
  u(66.04, 40.64),
  u(66.04, 51.56),
  u(64.26, 53.34),
  u(0, 53.34),
];

const DIGITAL_LEFT = ['SCL', 'SDA', 'AREF', 'GND', 'D13', 'D12', '~D11', '~D10', '~D9', 'D8'];
const DIGITAL_RIGHT = ['D7', '~D6', '~D5', 'D4', '~D3', 'D2', 'D1', 'D0'];
const POWER_PINS = ['', 'IOREF', 'RESET', '3V3', '5V', 'GND', 'GND', 'VIN'];
const ANALOG_PINS = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];

interface HeaderSpec {
  /** First pin x and row y (board drawing). */
  x0: number;
  y: number;
  labels: string[];
}

const UNO_HEADERS: HeaderSpec[] = [
  { x0: 18.796, y: 50.8, labels: DIGITAL_LEFT },
  { x0: 45.72, y: 50.8, labels: DIGITAL_RIGHT },
  { x0: 27.94, y: 2.54, labels: POWER_PINS },
  { x0: 50.8, y: 2.54, labels: ANALOG_PINS },
];

const headerCentre = (h: HeaderSpec): Point => u(h.x0 + ((h.labels.length - 1) / 2) * 2.54, h.y);

const U_USB = u(2.0, 38.1);
const U_JACK = u(5.4, 7.6);
const U_MCU = u(48.4, 17.8);
const U_XTAL = u(24.5, 30.5);
const U_U2 = u(17.0, 37.5);
const U_REG = u(18.5, 7.2);
const U_REG3 = u(23.6, 5.4);
const U_OPAMP = u(28.4, 9.6);
const U_C1 = u(14.5, 16.6);
const U_C2 = u(21.2, 16.6);
const U_DIODE = u(7.5, 15.8);
const U_BUTTON = u(6.0, 49.0);
const U_ICSP = u(64.77, 27.94);
const U_LEDS = {
  L: u(27.5, 43.8),
  TX: u(27.5, 41.0),
  RX: u(27.5, 38.8),
  ON: u(59.69, 41.5),
};

const UNO_CHIPS: ChipSpec[] = [
  { at: u(6.5, 28.0), deg: 90, size: '1812', kind: 'f' },
  { at: u(25.0, 43.8), deg: 90, size: '0603', kind: 'r' },
  { at: u(25.0, 41.0), deg: 90, size: '0603', kind: 'r' },
  { at: u(25.0, 38.8), deg: 90, size: '0603', kind: 'r' },
  { at: u(59.69, 38.3), deg: 90, size: '0603', kind: 'r' },
  { at: u(29.4, 17.8), deg: 90, size: '0603', kind: 'c' },
  { at: u(14.0, 31.2), deg: 0, size: '0603', kind: 'c' },
  { at: u(11.6, 33.6), deg: 90, size: '0603', kind: 'c' },
  { at: u(22.0, 27.3), deg: 0, size: '0603', kind: 'c' },
  { at: u(27.0, 27.3), deg: 0, size: '0603', kind: 'c' },
  { at: u(14.2, 11.6), deg: 0, size: '0805', kind: 'c' },
  { at: u(33.0, 9.0), deg: 90, size: '0603', kind: 'r' },
  { at: u(35.5, 9.0), deg: 90, size: '0603', kind: 'r' },
  { at: u(11.5, 49.0), deg: 90, size: '0603', kind: 'r' },
  { at: u(26.2, 13.8), deg: 0, size: '0603', kind: 'c' },
  { at: u(13.2, 41.6), deg: 0, size: '0603', kind: 'r' },
  { at: u(13.2, 43.2), deg: 0, size: '0603', kind: 'r' },
];

/** Pads of the TQFP-32 USB converter, rotated 45°. */
const U2_PADS = smd(U_U2, 45, QFP32_PADS);

function unoLayout(): PcbLayout {
  const pads: PcbPad[] = [];
  const silk: PcbSilk[] = [];
  for (const h of UNO_HEADERS) {
    const top = h.y > 20;
    h.labels.forEach((label, i) => {
      const at = u(h.x0 + i * 2.54, h.y);
      pads.push(
        tht(at, 1.0, 1.7, {
          solder: true,
          ...(label === 'GND' ? { net: 'GND' } : {}),
          ...(i === 0 ? { shape: 'square' as const } : {}),
        }),
      );
      if (!label) return;
      silk.push(
        top
          ? text([at[0], at[1] + 1.85], label, 0.92, { rotation: 90, align: 'right' })
          : text([at[0], at[1] - 1.85], label, 0.92, { rotation: 90, align: 'left' }),
      );
    });
  }
  // USB-B: four contacts and the two shell tabs.
  for (const x of [3.5, 5.5])
    for (const z of [-1.25, 1.25]) pads.push(tht(local(U_USB, 0, [x, z]), 0.9, 1.6));
  for (const z of [-5.85, 5.85])
    pads.push(tht(local(U_USB, 0, [2.5, z]), 2.3, 3.4, { net: 'GND' }));
  // Power jack.
  for (const p of [
    [6.0, 0],
    [-0.5, 0],
    [3.5, 3.9],
  ] as const)
    pads.push(tht(local(U_JACK, 0, p), 1.6, 3.2, { shape: 'oval' }));
  // DIP-28 socket.
  for (let i = 0; i < 14; i++)
    for (const s of [-1, 1])
      pads.push(
        tht(local(U_MCU, 0, [(i - 6.5) * 2.54, s * 3.81]), 0.9, 1.6, {
          ...(i === 13 && s < 0 ? { shape: 'square' as const } : {}),
        }),
      );
  // Crystal, reset button, ICSP.
  for (const s of [-1, 1]) pads.push(tht(local(U_XTAL, 0, [s * 2.44, 0]), 0.8, 1.6));
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) pads.push(tht(local(U_BUTTON, 0, [sx * 3.25, sz * 2.25]), 1.0, 1.8));
  for (const x of [-2.54, 0, 2.54])
    for (const z of [-1.27, 1.27])
      pads.push(
        tht(local(U_ICSP, 90, [x, z]), 0.9, 1.6, {
          solder: true,
          ...(x < 0 && z < 0 ? { shape: 'square' as const } : {}),
        }),
      );
  // SMD parts.
  pads.push(...U2_PADS);
  pads.push(...smd(U_REG, 0, SOT223_PADS));
  pads.push(...smd(U_REG3, 0, SOT23_PADS));
  pads.push(...smd(U_OPAMP, 90, soicPads(8)));
  pads.push(...smd(U_C1, 0, ELCO_PADS), ...smd(U_C2, 0, ELCO_PADS));
  pads.push(...smd(U_DIODE, 0, SMA_PADS));
  for (const at of Object.values(U_LEDS)) pads.push(...smd(at, 90, LED_PADS));
  for (const c of UNO_CHIPS) pads.push(...chipPads(c));

  // Traces: header pins to the microcontroller, USB to the converter.
  const traces: PcbTrace[] = [];
  const mcuTop = UH - 17.8 - 3.81; // layout y of the row towards the top edge
  const mcuBottom = UH - 17.8 + 3.81;
  const mcuX = (j: number) => 48.4 + (j - 6.5) * 2.54;
  DIGITAL_RIGHT.forEach((_, i) => {
    const x = 45.72 + i * 2.54;
    const xm = mcuX(6 + i);
    traces.push({
      points: [u(x, 50.8), u(x, 25.0), u(xm, 23.6), [xm, mcuTop]],
      width: 0.3,
    });
  });
  for (let i = 4; i < 10; i++) {
    const x = 18.796 + i * 2.54;
    if (DIGITAL_LEFT[i] === 'GND') continue;
    const xm = mcuX(i - 4);
    traces.push({ points: [u(x, 50.8), u(x, 26.6), u(xm, 23.7), [xm, mcuTop]], width: 0.3 });
  }
  ANALOG_PINS.forEach((_, i) => {
    const x = 50.8 + i * 2.54;
    const xm = mcuX(8 + i);
    traces.push({ points: [u(x, 2.54), u(x, 10.6), u(xm, 12.0), [xm, mcuBottom]], width: 0.3 });
  });
  traces.push({
    points: [u(38.1, 2.54), u(38.1, 9.4), u(42.0, 9.4), u(44.59, 12.0), [mcuX(5), mcuBottom]],
    width: 0.6,
  });
  // USB data pair into the converter's lower-left pads.
  const usbPad = (z: number) => local(U_USB, 0, [5.5, z]);
  const u2a = U2_PADS[23]!.at;
  const u2b = U2_PADS[24]!.at;
  traces.push({
    points: [usbPad(-1.25), [usbPad(-1.25)[0] + 2.2, usbPad(-1.25)[1]], u2a],
    width: 0.3,
  });
  traces.push({
    points: [usbPad(1.25), [usbPad(1.25)[0] + 2.2, usbPad(1.25)[1]], u2b],
    width: 0.3,
  });
  // Crystal to the converter, LEDs to their resistors.
  traces.push({ points: [local(U_XTAL, 0, [-2.44, 0]), U2_PADS[3]!.at], width: 0.3 });
  traces.push({ points: [local(U_XTAL, 0, [2.44, 0]), u(24.5, 33.4), U2_PADS[4]!.at], width: 0.3 });
  for (const key of ['L', 'TX', 'RX'] as const) {
    const at = U_LEDS[key];
    traces.push({
      points: [
        [at[0], at[1] + 0.9],
        [at[0] - 2.5, at[1] + 0.8],
      ],
      width: 0.3,
    });
  }
  // Supply: jack to the diode and regulator.
  traces.push({
    points: [local(U_JACK, 0, [6.0, 0]), u(11.4, 13.2), local(U_DIODE, 0, [2.1, 0])],
    width: 1.0,
  });
  traces.push({
    points: [local(U_REG, 0, [-2.3, -2.95]), u(13.0, 13.2), local(U_C1, 0, [-2.65, 0])],
    width: 1.0,
  });
  traces.push({
    points: [local(U_REG, 0, [0, -2.95]), u(18.5, 13.0), local(U_C2, 0, [-2.65, 0])],
    width: 1.0,
  });

  const vias: PcbVia[] = [
    u(10.5, 21.0),
    u(31.0, 33.5),
    u(42.0, 30.5),
    u(56.0, 30.0),
    u(36.5, 22.0),
    u(23.5, 22.0),
    u(64.0, 20.0),
    u(9.5, 46.0),
    u(52.0, 36.0),
    u(33.5, 45.0),
  ].map((at) => ({ at, net: 'GND' }));

  silk.push(
    text(u(46.5, 35.6), 'MC-1', 3.6),
    text(u(46.5, 31.6), '16 MHz · 5 V', 1.3),
    text(u(46.6, 45.6), 'DIGITAL (PWM ~)', 1.2),
    text(u(36.8, 11.2), 'ALIMENTAÇÃO', 1.1),
    text(u(57.2, 11.2), 'ENTRADAS ANALÓGICAS', 1.05),
    text(u(29.4, 43.8), 'L', 1.0, { align: 'left' }),
    text(u(29.4, 41.0), 'TX', 1.0, { align: 'left' }),
    text(u(29.4, 38.8), 'RX', 1.0, { align: 'left' }),
    text(u(61.4, 41.5), 'ON', 1.0, { align: 'left' }),
    text(u(6.0, 45.2), 'RESET', 0.9),
    text(u(64.77, 32.4), 'ICSP', 1.0),
    text(u(48.4, 24.4), 'U1', 1.0),
    text(u(24.5, 34.0), 'Y1 16 MHz', 0.8),
    text(u(18.5, 2.2), '7–12 V', 1.0),
    // Pin 1 dot of the ICSP header and footprint outlines.
    { kind: 'circle', at: u(62.4, 25.2), r: 0.35, fill: true },
    { kind: 'rect', at: U_ICSP, size: [5.4, 8.0], width: 0.15 },
    { kind: 'rect', at: U_BUTTON, size: [6.6, 6.6], width: 0.15 },
    { kind: 'rect', at: U_MCU, size: [36.6, 10.6], width: 0.15 },
  );

  return {
    width: UW,
    height: UH,
    thickness: T,
    corner: 0.4,
    copper: 'both',
    mask: '#06505c',
    finish: 'hasl',
    pads,
    traces,
    vias,
    holes: [
      { at: u(13.97, 2.54), drill: 3.2 },
      { at: u(15.24, 50.8), drill: 3.2 },
      { at: u(66.04, 7.62), drill: 3.2 },
      { at: u(66.04, 35.56), drill: 3.2 },
    ],
    pours: [
      {
        outline: [
          [0.6, 0.6],
          [UW - 0.6, 0.6],
          [UW - 0.6, UH - 0.6],
          [0.6, UH - 0.6],
        ],
        side: 'bottom',
        net: 'GND',
        clearance: 0.32,
      },
    ],
    silk,
  };
}

const UNO_LAYOUT = unoLayout();

// ---------------------------------------------------------------------------
// ESP32-style board (layout coordinates directly: USB on the left, antenna
// on the right).

const EW = 51.5;
const EH = 28;
const ESP_BOARD: Board = { width: EW, height: EH, thickness: T };
const ROW_A = 1.3;
const ROW_B = ROW_A + 25.4;
const pinX = (i: number) => EW / 2 + (i - 9) * 2.54;
/** Labels from the USB end (x small) to the antenna end. */
const ESP_ROW_A = [
  '5V',
  'CMD',
  'D3',
  'D2',
  '13',
  'GND',
  '12',
  '14',
  '27',
  '26',
  '25',
  '33',
  '32',
  '35',
  '34',
  'VN',
  'VP',
  'EN',
  '3V3',
];
const ESP_ROW_B = [
  'CLK',
  'D0',
  'D1',
  '15',
  '2',
  '0',
  '4',
  '16',
  '17',
  '5',
  '18',
  '19',
  'GND',
  '21',
  'RX',
  'TX',
  '22',
  '23',
  'GND',
];
const MODULE_AT: Point = [EW - WIFI.L / 2 + 4.0, EH / 2];
const E_USB: Point = [2.0, EH / 2];
const E_EN: Point = [7.5, 7.6];
const E_BOOT: Point = [7.5, 20.4];
const E_REG: Point = [15.5, 8.6];
const E_UART: Point = [20.5, 15.2];
const E_Q1: Point = [22.5, 8.0];
const E_Q2: Point = [26.0, 8.0];
const E_DIODE: Point = [12.5, 15.0];
const E_LED_ON: Point = [12.5, 21.0];
const E_LED_IO2: Point = [27.5, 20.5];

const ESP_CHIPS: ChipSpec[] = [
  { at: [10.2, 11.4], deg: 90, size: '0603', kind: 'r' },
  { at: [19.0, 20.4], size: '0603', kind: 'c' },
  { at: [21.6, 20.4], size: '0603', kind: 'r' },
  { at: [24.2, 20.4], size: '0603', kind: 'r' },
  { at: [28.7, 14.5], deg: 90, size: '0805', kind: 'c' },
  { at: [24.5, 10.0], size: '0603', kind: 'r' },
  { at: [28.6, 7.4], deg: 90, size: '0805', kind: 'c' },
  { at: [15.4, 21.0], size: '0603', kind: 'r' },
];

const MODULE_PADS: Point[] = wifiPads().map((p) => [
  MODULE_AT[0] + p.x + (p.side === 'w' ? 0.3 : 0),
  MODULE_AT[1] + p.z + (p.side === 'n' ? 0.3 : p.side === 's' ? -0.3 : 0),
]);

function espLayout(): PcbLayout {
  const pads: PcbPad[] = [];
  const silk: PcbSilk[] = [];
  for (const [y, labels, top] of [
    [ROW_A, ESP_ROW_A, true],
    [ROW_B, ESP_ROW_B, false],
  ] as const) {
    labels.forEach((label, i) => {
      const at: Point = [pinX(i), y];
      pads.push(
        tht(at, 1.0, 1.7, {
          ...(label === 'GND' ? { net: 'GND' } : {}),
          ...(i === 0 ? { shape: 'square' as const } : {}),
        }),
      );
      silk.push(
        top
          ? text([at[0], y + 1.25], label, 0.82, { rotation: 90, align: 'right' })
          : text([at[0], y - 1.25], label, 0.82, { rotation: 90, align: 'left' }),
      );
    });
  }
  // Module castellations, micro-USB, buttons and SMD parts.
  for (const at of MODULE_PADS) pads.push({ at, size: [0.9, 0.9], shape: 'rect' });
  pads.push(
    ...smd(E_USB, 0, [
      ...pinRow(5, 0.65).map((z): [number, number, number, number] => [3.2, z, 1.2, 0.4]),
      [0.8, -4.0, 1.8, 1.6],
      [0.8, 4.0, 1.8, 1.6],
    ]),
  );
  pads.push(...smd(E_EN, 0, BUTTON_PADS), ...smd(E_BOOT, 0, BUTTON_PADS));
  pads.push(...smd(E_REG, 90, SOT223_PADS));
  pads.push(...smd(E_UART, 0, soicPads(16)));
  pads.push(...smd(E_Q1, 0, SOT23_PADS), ...smd(E_Q2, 0, SOT23_PADS));
  pads.push(...smd(E_DIODE, 0, SMA_PADS));
  pads.push(...smd(E_LED_ON, 0, LED_PADS), ...smd(E_LED_IO2, 0, LED_PADS));
  for (const c of ESP_CHIPS) pads.push(...chipPads(c));

  // Traces: the pins near the module to its castellations.
  const traces: PcbTrace[] = [];
  const north = MODULE_PADS.filter((_, i) => i % 2 === 0 && i < 28);
  const south = MODULE_PADS.filter((_, i) => i % 2 === 1 && i < 28);
  for (const [row, list, dir] of [
    [ROW_A, north, 1],
    [ROW_B, south, -1],
  ] as const) {
    for (let i = 12; i < 19; i++) {
      const x = pinX(i);
      const target = list.reduce((best, p) =>
        Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best,
      );
      if (Math.abs(target[0] - x) > 1.4) continue;
      traces.push({ points: [[x, row], [x, row + dir * 1.6], target], width: 0.3 });
    }
  }
  // USB data lines into the converter, supply to the regulator.
  for (const [z, bend, y] of [
    [-0.65, 17.0, 18.8],
    [0.65, 17.6, 19.4],
  ] as const) {
    const from = local(E_USB, 0, [3.2, z]);
    const to = local(E_UART, 0, [z < 0 ? -4.445 : -3.175, 2.7]);
    traces.push({
      points: [from, [7.0, from[1]], [9.3, bend], [z < 0 ? 12.0 : 12.6, y], [to[0], y], to],
      width: 0.25,
    });
  }
  traces.push({
    points: [local(E_USB, 0, [3.2, -1.3]), [8.0, 12.5], local(E_DIODE, 0, [-2.1, 0])],
    width: 0.6,
  });
  traces.push({
    points: [local(E_DIODE, 0, [2.1, 0]), [12.55, 12.4], local(E_REG, 90, [-2.3, -2.95])],
    width: 0.6,
  });
  traces.push({
    points: [local(E_LED_IO2, 0, [0.9, 0]), [29.5, 20.5], [31.5, 22.4]],
    width: 0.25,
  });

  const vias: PcbVia[] = (
    [
      [11.0, 4.6],
      [18.0, 4.6],
      [25.0, 4.6],
      [17.0, 23.4],
      [24.0, 23.4],
      [29.4, 17.8],
      [5.0, 4.6],
      [5.0, 23.4],
    ] as Point[]
  ).map((at) => ({ at, net: 'GND' }));

  silk.push(
    text([2.6, 7.6], 'EN', 1.0),
    text([2.5, 20.4], 'BOOT', 0.85),
    text([12.5, 22.6], 'ON', 0.8),
    text([27.5, 18.9], 'IO2', 0.8),
    text([20.5, 10.9], 'MC-2  Wi-Fi/BT', 0.85),
    { kind: 'rect', at: E_UART, size: [11.0, 4.6], width: 0.12 },
  );

  return {
    width: EW,
    height: EH,
    thickness: T,
    corner: 0.8,
    copper: 'both',
    mask: 'preta',
    finish: 'hasl',
    pads,
    traces,
    vias,
    holes: [],
    pours: [
      {
        outline: [
          [0.5, 0.5],
          [EW - 0.5, 0.5],
          [EW - 0.5, EH - 0.5],
          [0.5, EH - 0.5],
        ],
        side: 'bottom',
        net: 'GND',
        clearance: 0.3,
      },
    ],
    silk,
  };
}

const ESP_LAYOUT = espLayout();

// ---------------------------------------------------------------------------

/** Board height above the bench: the Uno rests on its solder joints, the ESP32 on its pins. */
const BASE: Record<DevBoardVariant, number> = { uno: 1.9, esp32: 8.5 };

const boardOf = (v: DevBoardVariant) => (v === 'uno' ? UNO_BOARD : ESP_BOARD);

/** Layout point → part space (board resting at its base height). */
function at(v: DevBoardVariant, point: Point, up = 0): Vec3 {
  const [x, y, z] = boardPoint(boardOf(v), point);
  return [x, y + up + BASE[v], z];
}

/** Cut through the microcontroller (Uno) or the Wi-Fi module (ESP32). */
const cutZ = (v: DevBoardVariant) => (v === 'uno' ? U_MCU[1] - UH / 2 : MODULE_AT[1] - EH / 2);

const LIFT_LOW: Vec3 = [0, 46, -23];
const LIFT_MID: Vec3 = [0, 60, -30];
const LIFT_TALL: Vec3 = [0, 74, -37];

const LED_ON_COLOR = { uno: LED_COLORS.verde, esp32: LED_COLORS.vermelho };
const LED_USER_COLOR = { uno: LED_COLORS.amarelo, esp32: LED_COLORS.azul };

export const meta: PartMeta = {
  id: 'dev-board',
  label: 'Placa de desenvolvimento',
  category: 'placas',
  summary:
    'Placa de desenvolvimento com microcontrolador, nos formatos estilo Arduino Uno (USB, pinos D0–D13 e A0–A5) e estilo ESP32 DevKit (módulo Wi-Fi blindado com antena na placa).',
  defaults: { variant: 'uno', power: true, led: true, ledBrightness: 1 },
  controls: {
    variant: {
      kind: 'select',
      label: 'Modelo',
      options: [
        { value: 'uno', label: 'Estilo Arduino Uno' },
        { value: 'esp32', label: 'Estilo ESP32 DevKit' },
      ],
    },
    power: { kind: 'toggle', label: 'Placa alimentada' },
    led: { kind: 'toggle', label: 'LED da placa aceso' },
    ledBrightness: {
      kind: 'number',
      label: 'Brilho do LED da placa',
      min: 0,
      max: 1,
      step: 0.05,
    },
  },
  annotations: (props) => {
    const p = resolve(props);
    const pin = (name: string, text: string, exploded?: boolean): PartAnnotation => ({
      at: [0, 0, 0],
      anchor: name,
      text,
      ...(exploded === undefined ? {} : { exploded }),
    });
    const board: PartAnnotation[] = [
      pin('pcb-substrate', 'Placa de FR-4 de 1,6 mm', true),
      pin('pcb-copper', 'Cobre: trilhas e plano de terra', true),
      pin('pcb-silk', 'Serigrafia: o nome de cada pino', true),
    ];
    if (p.variant === 'esp32')
      return [
        pin(
          'dev-modulo',
          'Módulo Wi-Fi: sob a blindagem de metal ficam o microcontrolador de 32 bits (com Wi-Fi e Bluetooth) e a memória flash',
        ),
        pin('dev-antena', 'Antena de trilha na placa (2,4 GHz): não a cubra com metal'),
        pin('dev-cristal', 'Cristal de 40 MHz, sob a blindagem: o relógio do microcontrolador'),
        pin('dev-usb', 'Conector micro-USB: grava o programa e alimenta a placa com 5 V'),
        pin('dev-serial', 'Conversor USB-serial: liga o USB do computador ao microcontrolador'),
        pin('dev-regulador', 'Regulador de tensão: baixa os 5 V do USB para os 3,3 V do módulo'),
        pin('dev-en', 'Botão EN: reinicia o programa (reset)'),
        pin('dev-boot', 'Botão BOOT: segurado ao ligar, deixa a placa pronta para gravar'),
        pin('dev-gpio', 'Pinos digitais (GPIO): entradas e saídas de 3,3 V; não ligue 5 V neles'),
        pin('dev-adc', 'Entradas analógicas (ADC): VP, VN, 34, 35, 32 e 33 medem de 0 a 3,3 V'),
        pin('dev-alimentacao', 'Pinos de alimentação: 5V, 3V3 e GND'),
        pin('dev-led', 'LED azul da placa, ligado ao GPIO2'),
        pin('dev-on', 'LED vermelho: placa alimentada'),
        ...board,
      ];
    return [
      pin(
        'dev-mcu',
        'Microcontrolador de 8 bits, no soquete: executa o programa e comanda os pinos',
      ),
      pin('dev-cristal', 'Cristal de 16 MHz: o relógio que marca o ritmo do circuito'),
      pin('dev-regulador', 'Regulador de tensão: transforma os 7–12 V do conector em 5 V estáveis'),
      pin('dev-usb', 'Conector USB: grava o programa e alimenta a placa com 5 V'),
      pin('dev-jack', 'Conector de alimentação: fonte de 7 a 12 V'),
      pin('dev-serial', 'Conversor USB-serial: liga o USB do computador ao microcontrolador'),
      pin(
        'dev-gpio',
        'Pinos digitais D0–D13 (GPIO): entradas e saídas de 5 V; os marcados com ~ fazem PWM',
      ),
      pin('dev-adc', 'Entradas analógicas A0–A5 (ADC): medem tensões de 0 a 5 V'),
      pin('dev-alimentacao', 'Pinos de alimentação: 5V, 3V3, GND e VIN'),
      pin('dev-reset', 'Botão de reset: reinicia o programa do começo'),
      pin('dev-led', 'LED L, ligado ao pino 13: o primeiro programa costuma piscá-lo'),
      pin('dev-on', 'LED ON: placa alimentada'),
      pin('dev-icsp', 'Conector ICSP: grava o microcontrolador sem passar pelo USB'),
      ...board,
    ];
  },
  explode: true,
  cutaway: true,
  cut: (props) => ({ normal: [0, 0, -1], through: [0, 0, cutZ(resolve(props).variant)] }),
  describe: (props) => {
    const p = resolve(props);
    const user = p.power && p.led && p.ledBrightness > 0;
    if (p.variant === 'esp32')
      return [
        'Placa de desenvolvimento estilo ESP32 DevKit (51,5 × 28 mm), vista de cima: o módulo Wi-Fi com blindagem de metal e a antena de trilha saindo da placa, o conector micro-USB, o conversor USB-serial, o regulador de 3,3 V, os botões EN e BOOT e as duas fileiras de 19 pinos por baixo, com o nome de cada pino na serigrafia.',
        p.power ? 'Placa alimentada: LED vermelho aceso.' : 'Placa desligada: LEDs apagados.',
        user ? 'LED azul do GPIO2 aceso.' : p.power ? 'LED azul apagado.' : '',
      ]
        .filter(Boolean)
        .join(' ');
    return [
      'Placa de desenvolvimento estilo Arduino Uno (68,6 × 53,4 mm), vista de cima: microcontrolador de 8 bits num soquete, cristal de 16 MHz, conversor USB-serial, regulador de 5 V, conector USB e conector de alimentação à esquerda, barras de pinos D0–D13 em cima e de alimentação e A0–A5 embaixo, botão de reset, conector ICSP e os LEDs ON, L, TX e RX.',
      p.power ? 'Placa alimentada: LED ON aceso.' : 'Placa desligada: LEDs apagados.',
      user ? 'LED L (pino 13) aceso.' : p.power ? 'LED L apagado.' : '',
    ]
      .filter(Boolean)
      .join(' ');
  },
  view: [0.55, 1.15, 1.0],
};

export default function DevBoard(props: DevBoardProps) {
  const p = resolve(props as PartProps);
  const v = p.variant;
  const powerLevel = p.power ? 1 : 0;
  const userLevel = p.power && p.led ? p.ledBrightness : 0;
  const z = cutZ(v);
  return (
    <group position={[0, BASE[v], 0]}>
      <BatchRoot blocks={BLOCKS} cutNormal={[0, 0, -1]} cutThrough={[0, 0, z]}>
        {v === 'uno' ? (
          <Uno power={powerLevel} user={userLevel} />
        ) : (
          <Esp32 power={powerLevel} user={userLevel} />
        )}
      </BatchRoot>
    </group>
  );
}

/** Placement in BatchRoot space (the board's own space). */
function place(v: DevBoardVariant, point: Point, deg = 0, up = 0) {
  const [x, y, z] = at(v, point, up);
  return { position: [x, y - BASE[v], z] as Vec3, rotation: [0, (deg * Math.PI) / 180, 0] as Vec3 };
}

/** Same, for anchors and halos (BatchRoot space). */
const spot = (v: DevBoardVariant, point: Point, up = 0): Vec3 => place(v, point, 0, up).position;

const chipItems = (list: ChipSpec[], v: DevBoardVariant): ChipItem[] =>
  list.map((c) => {
    const [x, , zz] = spot(v, c.at);
    return { at: [x, zz], rot: c.deg ?? 0, size: c.size, kind: c.kind };
  });

function Leds({
  v,
  list,
}: {
  v: DevBoardVariant;
  list: { at: Point; deg: number; color: { light: string; lens: string }; level: number }[];
}) {
  return (
    <BakeLayer
      lift={LIFT_LOW}
      extras={list.map((l, i) => (
        <GlowSprite
          key={i}
          color={l.color.light}
          intensity={l.level * 0.8}
          size={5}
          position={spot(v, l.at, SMD_LED_TOP + 0.3)}
        />
      ))}
    >
      <BakeBlock id="all">
        {list.map((l, i) => (
          <BakePart key={i} {...place(v, l.at, l.deg)}>
            <SmdLed light={l.color.light} lens={l.color.lens} brightness={l.level} />
          </BakePart>
        ))}
      </BakeBlock>
    </BakeLayer>
  );
}

function Uno({ power, user }: { power: number; user: number }) {
  const v = 'uno';
  const s = (point: Point, up = 0) => spot(v, point, up);
  return (
    <>
      <OutlineBoard layout={UNO_LAYOUT} outline={UNO_OUTLINE} />

      {/* Low tier: SMD parts, crystal, button, ICSP. */}
      <BakeLayer
        lift={LIFT_LOW}
        extras={
          <>
            <Anchor name="dev-cristal" position={s(U_XTAL, 4.2)} />
            <Anchor name="dev-serial" position={s(U_U2, 1.4)} />
            <Anchor name="dev-regulador" position={s(U_REG, 2)} />
            <Anchor name="dev-reset" position={s(U_BUTTON, 5.2)} />
            <Anchor name="dev-icsp" position={s(U_ICSP, 11.5)} />
          </>
        }
      >
        <BakeBlock id="all">
          <BakePart {...place(v, U_U2, 45)}>
            <IcQfp package="qfp" pins={32} code="USB-SERIAL" dateCode="2411" />
          </BakePart>
          <BakePart {...place(v, U_OPAMP, 90)}>
            <IcQfp package="soic" pins={8} code="DUAL OP" dateCode="2408" />
          </BakePart>
          <BakePart {...place(v, U_REG)}>
            <Sot223 lines={['1117', '5.0']} />
          </BakePart>
          <BakePart {...place(v, U_REG3)}>
            <Sot23 />
          </BakePart>
          <BakePart {...place(v, U_DIODE)}>
            <SmaDiode />
          </BakePart>
          <BakePart {...place(v, U_XTAL)}>
            <CrystalHc49 label="16.000" />
          </BakePart>
          <BakePart {...place(v, U_BUTTON, 0, -3.5)}>
            <TactileButton size={6} capColor="preto" />
          </BakePart>
          <BakePart {...place(v, U_ICSP, 90, -3)}>
            <PinHeader rows={2} pins={3} jumperAt={-1} />
          </BakePart>
          <BakePart position={[0, T, 0]}>
            <ChipParts items={chipItems(UNO_CHIPS, v)} />
          </BakePart>
        </BakeBlock>
      </BakeLayer>

      <Leds
        v={v}
        list={[
          { at: U_LEDS.ON, deg: 90, color: LED_ON_COLOR.uno, level: power },
          { at: U_LEDS.L, deg: 90, color: LED_USER_COLOR.uno, level: user },
          { at: U_LEDS.TX, deg: 90, color: LED_USER_COLOR.uno, level: 0 },
          { at: U_LEDS.RX, deg: 90, color: LED_USER_COLOR.uno, level: 0 },
        ]}
      />
      <Explode offset={LIFT_LOW}>
        <Anchor name="dev-led" position={s(U_LEDS.L, 1)} />
        <Anchor name="dev-on" position={s(U_LEDS.ON, 1)} />
      </Explode>

      {/* Middle tier: headers, microcontroller, capacitors. */}
      <BakeLayer
        lift={LIFT_MID}
        delay={0.08}
        extras={
          <>
            <Anchor name="dev-mcu" position={s(U_MCU, 7.6)} />
            <Anchor name="dev-gpio" position={s(u(54.6, 50.8), 8.6)} />
            <Anchor name="dev-adc" position={s(u(57.15, 2.54), 8.6)} />
            <Anchor name="dev-alimentacao" position={s(u(36.83, 2.54), 8.6)} />
          </>
        }
      >
        <BakeBlock id="all">
          {UNO_HEADERS.map((h) => (
            <BakePart key={h.x0 + h.y} {...place(v, headerCentre(h))}>
              <FemaleHeader pins={h.labels.length} />
            </BakePart>
          ))}
          <BakePart {...place(v, U_MCU, 180, -3)}>
            <IcDip pins={28} socket code="MCU 8 BITS" dateCode="2419" />
          </BakePart>
          <BakePart {...place(v, U_C1)}>
            <SmdElectrolytic label="47" volts="16V" />
          </BakePart>
          <BakePart {...place(v, U_C2)}>
            <SmdElectrolytic label="47" volts="16V" />
          </BakePart>
        </BakeBlock>
      </BakeLayer>

      {/* Tall tier: the connectors. */}
      <BakeLayer
        lift={LIFT_TALL}
        delay={0.16}
        extras={
          <>
            <Anchor name="dev-usb" position={s(local(U_USB, 0, [-4, 0]), 11)} />
            <Anchor name="dev-jack" position={s(local(U_JACK, 0, [-2, 0]), 11)} />
          </>
        }
      >
        <BakeBlock id="all">
          <BakePart {...place(v, U_USB)}>
            <UsbB />
          </BakePart>
          <BakePart {...place(v, U_JACK)}>
            <BarrelJack />
          </BakePart>
        </BakeBlock>
      </BakeLayer>
    </>
  );
}

function Esp32({ power, user }: { power: number; user: number }) {
  const v = 'esp32';
  const s = (point: Point, up = 0) => spot(v, point, up);
  const moduleX = (x: number): Point => [MODULE_AT[0] + x, MODULE_AT[1]];
  return (
    <>
      <PrintedCircuitBoard layout={ESP_LAYOUT} />

      {/* Low tier: SMD parts. */}
      <BakeLayer
        lift={LIFT_LOW}
        extras={
          <>
            <Anchor name="dev-serial" position={s(E_UART, 1.6)} />
            <Anchor name="dev-regulador" position={s(E_REG, 1.8)} />
            <Anchor name="dev-en" position={s(E_EN, 2.6)} />
            <Anchor name="dev-boot" position={s(E_BOOT, 2.6)} />
          </>
        }
      >
        <BakeBlock id="all">
          <BakePart {...place(v, E_UART)}>
            <IcQfp package="soic" pins={16} code="USB-UART" dateCode="2414" />
          </BakePart>
          <BakePart {...place(v, E_REG, 90)}>
            <Sot223 lines={['1117', '3.3']} />
          </BakePart>
          <BakePart {...place(v, E_Q1)}>
            <Sot23 />
          </BakePart>
          <BakePart {...place(v, E_Q2)}>
            <Sot23 />
          </BakePart>
          <BakePart {...place(v, E_DIODE)}>
            <SmaDiode />
          </BakePart>
          <BakePart {...place(v, E_EN)}>
            <SmdButton />
          </BakePart>
          <BakePart {...place(v, E_BOOT)}>
            <SmdButton />
          </BakePart>
          <BakePart position={[0, T, 0]}>
            <ChipParts items={chipItems(ESP_CHIPS, v)} />
          </BakePart>
        </BakeBlock>
      </BakeLayer>

      <Leds
        v={v}
        list={[
          { at: E_LED_ON, deg: 0, color: LED_ON_COLOR.esp32, level: power },
          { at: E_LED_IO2, deg: 0, color: LED_USER_COLOR.esp32, level: user },
        ]}
      />
      <Explode offset={LIFT_LOW}>
        <Anchor name="dev-led" position={s(E_LED_IO2, 1)} />
        <Anchor name="dev-on" position={s(E_LED_ON, 1)} />
      </Explode>

      {/* Middle tier: the Wi-Fi module and the micro-USB. */}
      <BakeLayer
        lift={LIFT_MID}
        delay={0.08}
        extras={
          <>
            <Anchor name="dev-modulo" position={s(moduleX(WIFI_SHIELD_X), WIFI.T + WIFI.shieldH)} />
            <Anchor name="dev-antena" position={s(moduleX(WIFI.L / 2 - 3), WIFI.T + 0.1)} />
            <Anchor
              name="dev-cristal"
              position={s([MODULE_AT[0] + WIFI_SHIELD_X - 4.6, MODULE_AT[1] + 3.6], WIFI.T + 1)}
            />
            <Anchor name="dev-usb" position={s(local(E_USB, 0, [-1.5, 0]), 2.6)} />
          </>
        }
      >
        <BakeBlock id="all">
          <BakePart {...place(v, MODULE_AT)}>
            <WifiModule />
          </BakePart>
          <BakePart {...place(v, E_USB)}>
            <MicroUsb />
          </BakePart>
        </BakeBlock>
      </BakeLayer>

      {/* Pins under the board (they drop down in the exploded view). */}
      <BakeLayer
        lift={[0, -26, 13]}
        delay={0.08}
        extras={
          <>
            <Anchor name="dev-gpio" position={[pinX(9) - EW / 2, -8, ROW_B - EH / 2]} />
            <Anchor name="dev-adc" position={[pinX(14) - EW / 2, -8, ROW_A - EH / 2]} />
            <Anchor name="dev-alimentacao" position={[pinX(0) - EW / 2, -8, ROW_A - EH / 2]} />
          </>
        }
      >
        <BakeBlock id="all">
          {[ROW_A, ROW_B].map((y) => (
            <BakePart key={y} position={[0, 3, y - EH / 2]} rotation={[Math.PI, 0, 0]}>
              <PinHeader rows={1} pins={19} jumperAt={-1} plated="estanho" />
            </BakePart>
          ))}
        </BakeBlock>
      </BakeLayer>
    </>
  );
}
