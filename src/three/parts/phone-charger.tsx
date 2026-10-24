/**
 * USB wall charger (5 V, 1 A or 2,1 A) "por dentro": white case 50 × 45 ×
 * 26 mm with the two Ø 4,0 mm round pins of the NBR 14136 plug (19 mm
 * long, 19 mm apart, no earth) and a USB-A receptacle at the other end.
 * Inside, a 46 × 41 mm, 1,2 mm board laid out like the usual flyback
 * chargers (teardown photos of 5–10 W chargers):
 *
 * - primary: fusible resistor (10 Ω, 0,5 W), SOP-4 bridge, π filter (2,2 or
 *   4,7 µF 400 V, 1 mH drum choke, 4,7 µF 400 V), PWM controller (SOIC-8),
 *   switching MOSFET (TO-92), RCD snubber (1 nF 1 kV disc and a fast diode);
 * - EE16 transformer wrapped in yellow tape, DIP-4 optocoupler and blue Y1
 *   capacitor across a 1,2 mm isolation slot milled in the board;
 * - secondary: Schottky rectifier (DO-41 for 1 A, SMC for 2,1 A), 330 or
 *   470 µF 10 V output capacitor, SOT-23 shunt reference, USB-A receptacle.
 *
 * `quality: 'sem-certificacao'` is the cheap clone of the teardowns: a wire
 * link where the fuse goes, one small input capacitor and empty filter
 * footprints, a smaller EE13 transformer with bare enamelled wire, a plain
 * 1 kV ceramic disc instead of the Y capacitor, a phenolic board with no
 * slot and the mains track 0,4 mm from an output track.
 *
 * The board's parts are baked into a few merged meshes (`_gate-batch.tsx`).
 */
import { useMemo } from 'react';
import { Path, Shape, type BufferGeometry } from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode, ViewProvider } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import {
  boardPoint,
  type PcbLayout,
  type PcbPad,
  type PcbSilk,
  type PcbTrace,
  type Point,
} from '../pcb/layout';
import { useDisposable, Wire } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import {
  ChargerTransformer,
  PLUG,
  PlugPin,
  SMD_PADS,
  SmdParts,
  transformerPins,
  USB,
  USB_PINS,
  UsbReceptacle,
  WireLink,
  YCapacitor,
  Y_PITCH,
  type SmdItem,
} from './_charger-parts';
import { extrudeUp, mergeAll } from './_em-geometry';
import { BakeLayer, BakePart, BatchRoot } from './_gate-batch';
import { SlottedBoard, type BoardSlot } from './_gate-board';
import { roundedRectSlab } from './_power-shared';
import CeramicCapacitor from './ceramic-capacitor';
import Diode from './diode';
import ElectrolyticCapacitor, { electrolyticSize } from './electrolytic-capacitor';
import IcQfp from './ic-qfp';
import Inductor from './inductor';
import Optocoupler from './optocoupler';
import Resistor from './resistor';
import TransistorTo92 from './transistor-to92';

type Quality = 'certificado' | 'sem-certificacao';
type Current = 1 | 2.1;

export interface PhoneChargerProps {
  /** Certified charger, or the cheap clone without the safety parts. */
  quality?: Quality;
  /** Rated output current (A) at 5 V. */
  current?: Current;
}

// ---------------------------------------------------------------------------
// Case (mm): x from the plug face (−X) to the USB end (+X), y up.

const CASE = { l: 50, d: 45, h: 26, wall: 1.6, r: 5, split: 13 };
/** Height of the plug pins' axis (on the parting line) and their z. */
const PIN_Y = CASE.split;
const PIN_Z = PLUG.spacing / 2;

// ---------------------------------------------------------------------------
// Board (layout mm from the top-left corner, y down = +Z).

const W = 46;
const H = 41;
const T = 1.2;
/** Height of the board's underside above the bench (ribs in the bottom shell). */
const BOARD_Y = 6;
const BOARD = { width: W, height: H, thickness: T };

/** Layout point → board-group space on the top surface (+ height). */
const on = ([x, y]: Point, up = 0): Vec3 => {
  const [px, py, pz] = boardPoint(BOARD, [x, y]);
  return [px, py + up, pz];
};

/** A local pin (x, z) of a part placed at `at`, turned `deg` counter-clockwise from the top. */
function local(at: Point, deg: number, [lx, lz]: readonly [number, number]): Point {
  const a = (deg * Math.PI) / 180;
  return [at[0] + lx * Math.cos(a) + lz * Math.sin(a), at[1] - lx * Math.sin(a) + lz * Math.cos(a)];
}

const L_PAD: Point = [2.4, H / 2 - PIN_Z];
const N_PAD: Point = [2.4, H / 2 + PIN_Z];
const F1: Point = [5.5, 8.75];
const F1_PITCH = 12.7;
const BRIDGE: Point = [6.5, 21];
const C1: Point = [13.2, 7.6];
const L1: Point = [13.5, 17.6];
const C2: Point = [8, 35.5];
const IC: Point = [15.5, 27];
const Q1: Point = [21, 28];
const SNUB_C: Point = [18.5, 32.5];
const SNUB_D: Point = [18.78, 35.5];
const T1: Point = [26, 10.5];
const OPTO: Point = [26, 23];
const YCAP: Point = [26, 39];
const SLOT_X = 26;
const D_OUT: Point = [39.58, 2.5];
const D_SMC: Point = [40, 4.5];
const C_OUT: Point = [40.5, 18];
const USB_AT: Point = [W - USB.length / 2 + 1.8, 31];
const SHUNT: Point = [30.8, 28];
const DO41_PITCH = 10.16;

interface Variant {
  certified: boolean;
  amps: Current;
  /** Bulk capacitors (F); the clone has only the first. */
  c1: number;
  c2: number;
  cOut: number;
}

function variantOf(props: PartProps): Variant {
  const certified = props.quality !== 'sem-certificacao';
  const amps: Current = Number(props.current) === 1 ? 1 : 2.1;
  return {
    certified,
    amps,
    c1: certified && amps > 1 ? 4.7e-6 : 2.2e-6,
    c2: 4.7e-6,
    cOut: certified ? (amps > 1 ? 470e-6 : 330e-6) : 220e-6,
  };
}

const watts = (amps: number) => formatNumber(5 * amps);

/** SMD parts in layout coordinates. */
function smdLayout(v: Variant): (SmdItem & { at: Point })[] {
  const items: (SmdItem & { at: Point })[] = [
    { kind: 'sop4', at: BRIDGE },
    { kind: 'r1206', at: [10.5, 26], rotation: 90 },
    { kind: 'r1206', at: [10.5, 29.6], rotation: 90 },
    { kind: 'c0805', at: [13.8, 31.8], rotation: 90 },
    { kind: 'sot23', at: SHUNT },
    { kind: 'r0805', at: [30.8, 31.5], rotation: 90 },
    { kind: 'r0805', at: [30.8, 34.5], rotation: 90 },
    { kind: 'c0805', at: [35, 23.8] },
  ];
  if (v.certified && v.amps > 1) items.push({ kind: 'smc', at: D_SMC });
  return items;
}

// ---------------------------------------------------------------------------
// Layout.

function pad(at: Point, drill: number, size: number, extra: Partial<PcbPad> = {}): PcbPad {
  return { at, drill, size, solder: true, ...extra };
}

function buildLayout(v: Variant): PcbLayout {
  const pads: PcbPad[] = [];
  const two = (at: Point, pitch: number, deg = 0, drill = 0.9, size = 1.8) => {
    pads.push(pad(local(at, deg, [-pitch / 2, 0]), drill, size, { shape: 'square' }));
    pads.push(pad(local(at, deg, [pitch / 2, 0]), drill, size));
  };
  // Mains wires from the plug pins.
  pads.push(pad(L_PAD, 1.3, 2.4, { lead: 1.0 }), pad(N_PAD, 1.3, 2.4, { lead: 1.0 }));
  two(F1, F1_PITCH, 90, 0.9, 1.9);
  const c1 = electrolyticSize(v.c1, 400);
  const c2 = electrolyticSize(v.c2, 400);
  const cOut = electrolyticSize(v.cOut, 10);
  two(C1, c1.pitch, 0, 0.9, 1.8);
  two(L1, 5, 0, 1, 1.8);
  two(C2, c2.pitch, 0, 0.9, 1.8);
  two(C_OUT, cOut.pitch, 0, 0.9, 1.8);
  two(SNUB_C, 5.08);
  two(SNUB_D, DO41_PITCH, 0, 1, 1.9);
  if (!(v.certified && v.amps > 1)) two(D_OUT, DO41_PITCH, 0, 1, 1.9);
  for (const x of [-2.54, 0, 2.54]) pads.push(pad([Q1[0] + x, Q1[1]], 0.8, 1.5));
  for (const p of transformerPins(!v.certified)) pads.push(pad(local(T1, 90, p), 0.9, 1.8));
  for (const lx of [-1.27, 1.27])
    for (const lz of [-3.81, 3.81]) pads.push(pad(local(OPTO, 90, [lx, lz]), 0.8, 1.6));
  two(YCAP, Y_PITCH, 0, 0.8, 1.6);
  for (const p of USB_PINS)
    pads.push(
      pad([USB_AT[0] + p[0], USB_AT[1] + p[1]], p[0] === 0 ? 1.2 : 0.8, p[0] === 0 ? 2.2 : 1.4),
    );
  // SMD pads: SOIC-8 controller and the small parts.
  for (let i = 0; i < 4; i++)
    for (const s of [-1, 1])
      pads.push({
        at: [IC[0] + (i - 1.5) * 1.27, IC[1] + s * 2.7],
        size: [0.6, 1.5],
        shape: 'rect',
      });
  for (const item of smdLayout(v)) {
    const spec = SMD_PADS[item.kind];
    for (const p of spec.pads)
      pads.push({
        at: local(item.at, item.rotation ?? 0, p),
        size: spec.size,
        shape: 'rect',
        rotation: item.rotation ?? 0,
      });
  }

  const tp = transformerPins(!v.certified).map((p) => local(T1, 90, p));
  // Primary pins at the left (low x), secondary at the right; sorted top to bottom.
  const primary = tp.filter((p) => p[0] < T1[0]).sort((a, b) => a[1] - b[1]);
  const secondary = tp.filter((p) => p[0] > T1[0]).sort((a, b) => a[1] - b[1]);
  const c1L = C1[0] - c1.pitch / 2;
  const c1R = C1[0] + c1.pitch / 2;
  const c2L = C2[0] - c2.pitch / 2;
  const coutL = C_OUT[0] - cOut.pitch / 2;
  const coutR = C_OUT[0] + cOut.pitch / 2;
  const t = (points: Point[], width: number, side: 'top' | 'bottom' = 'top'): PcbTrace => ({
    points,
    width,
    side,
  });
  const traces: PcbTrace[] = [
    // Mains in: L through the fuse, N straight to the bridge.
    t([L_PAD, [2.4, 2.4], [F1[0], F1[1] - F1_PITCH / 2]], 1.2),
    t(
      [
        [F1[0], F1[1] + F1_PITCH / 2],
        [5.23, 18.1],
      ],
      1,
    ),
    t([N_PAD, [2.4, 26], [5.23, 23.9]], 1.2),
    // Rectified mains: bridge +, C1, the filter choke, C2 and the transformer.
    t(
      [
        [7.77, 18.1],
        [9.5, 17.6],
        [11, 17.6],
      ],
      1,
    ),
    t(
      [
        [9.5, 17.6],
        [9.5, 9],
        [c1L, C1[1]],
      ],
      1,
    ),
    t([[16, 17.6], [18.2, 17.6], primary[3]!], 1),
    t(
      [
        [16, 17.6],
        [16, 20.5],
        [12, 22.5],
        [12, 33],
        [C2[0] + c2.pitch / 2, C2[1]],
      ],
      1,
    ),
    // Primary return.
    t(
      [
        [7.77, 23.9],
        [7.77, 28],
        [c2L, 31],
        [c2L, C2[1]],
      ],
      1.2,
    ),
    t(
      [
        [c1R, C1[1]],
        [15.7, 13],
        [8.5, 23.5],
      ],
      1,
      'bottom',
    ),
    // Gate drive, start-up and supply of the controller.
    t(
      [
        [IC[0] + 1.905, IC[1] + 2.7],
        [Q1[0] - 2.54, Q1[1]],
      ],
      0.4,
    ),
    t(
      [
        [10.5, 24.5],
        [12, 23.2],
      ],
      0.4,
    ),
    t(
      [
        [10.5, 27.5],
        [10.5, 28.1],
      ],
      0.4,
    ),
    t(
      [
        [IC[0] - 1.905, IC[1] + 2.7],
        [13.8, 30.85],
      ],
      0.4,
    ),
    // Snubber across the primary winding.
    t(
      [
        [SNUB_D[0] - DO41_PITCH / 2, SNUB_D[1]],
        [12, 33],
      ],
      0.8,
    ),
    t(
      [
        [SNUB_C[0] - 2.54, SNUB_C[1]],
        [14.5, 34],
        [SNUB_D[0] - DO41_PITCH / 2, SNUB_D[1]],
      ],
      0.6,
    ),
    t(
      [
        [SNUB_C[0] + 2.54, SNUB_C[1]],
        [22.6, 32.5],
      ],
      0.6,
    ),
    // Feedback from the optocoupler to the controller (under the board).
    t(
      [
        [OPTO[0] - 3.81, OPTO[1] + 1.27],
        [18.5, 24.8],
        [IC[0] + 1.905, IC[1] - 2.7],
      ],
      0.4,
      'bottom',
    ),
    // Y capacitor: primary return side.
    t(
      [
        [YCAP[0] - Y_PITCH / 2, YCAP[1]],
        [14, 39.8],
        [c2L, 39.8],
        [c2L, C2[1]],
      ],
      0.8,
    ),
    // Secondary: winding, Schottky, output capacitor, USB.
    t([secondary[3]!, [34.5, 18.5], [coutL, C_OUT[1]]], 1.5),
    t(
      [
        [coutR, C_OUT[1]],
        [44.8, 21],
        [44.8, 23],
        [36.8, 23],
      ],
      1.2,
      'bottom',
    ),
    t(
      [
        [36.8, 23],
        [USB_AT[0] + USB_PINS[0]![0], USB_AT[1] + USB_PINS[0]![1]],
      ],
      1.2,
      'bottom',
    ),
    // Shunt reference, divider and optocoupler LED.
    t(
      [
        [OPTO[0] + 3.81, OPTO[1] + 1.27],
        [29.85, 26.9],
      ],
      0.4,
    ),
    t(
      [
        [OPTO[0] + 3.81, OPTO[1] - 1.27],
        [31, 20.2],
        [33.6, 20.2],
      ],
      0.4,
    ),
    t(
      [
        [30.8, 29.1],
        [30.8, 30.55],
      ],
      0.4,
    ),
    t(
      [
        [30.8, 32.45],
        [30.8, 33.55],
      ],
      0.4,
    ),
    t(
      [
        [30.8, 35.45],
        [32, 36.5],
        [USB_AT[0] + USB_PINS[3]![0], USB_AT[1] + USB_PINS[3]![1]],
      ],
      0.6,
    ),
    t(
      [
        [YCAP[0] + Y_PITCH / 2, YCAP[1]],
        [32.5, 39],
        [32.9, 36.5],
      ],
      0.8,
    ),
  ];
  if (v.certified) {
    traces.push(
      // Drain: transformer to the MOSFET and the snubber, kept left of the slot.
      t([primary[0]!, [20.8, 6.2], [20.8, 26.5], [Q1[0], Q1[1]]], 1),
      t(
        [
          [Q1[0], Q1[1]],
          [23, 31],
          [SNUB_D[0] + DO41_PITCH / 2, SNUB_D[1]],
        ],
        0.8,
      ),
    );
    if (v.amps > 1)
      traces.push(
        t([secondary[0]!, [36.6, D_SMC[1]]], 1.5),
        t(
          [
            [43.4, D_SMC[1]],
            [44.8, 6],
            [44.8, 16],
            [coutR, C_OUT[1]],
          ],
          1.5,
        ),
      );
    else
      traces.push(
        t([secondary[0]!, [D_OUT[0] - DO41_PITCH / 2, D_OUT[1]]], 1.5),
        t(
          [
            [D_OUT[0] + DO41_PITCH / 2, D_OUT[1]],
            [44.8, 4],
            [44.8, 16],
            [coutR, C_OUT[1]],
          ],
          1.5,
        ),
      );
  } else {
    traces.push(
      // The clone's drain track runs along the would-be barrier, 0,4 mm from
      // the output track that feeds the optocoupler.
      t([primary[3]!, [24.9, 16.5], [24.9, 27], [Q1[0], Q1[1]]], 1),
      t(
        [
          [Q1[0], Q1[1]],
          [23, 31],
          [SNUB_D[0] + DO41_PITCH / 2, SNUB_D[1]],
        ],
        0.8,
      ),
      t([secondary[3]!, [26.2, 17.5], [26.2, 21.1], [OPTO[0] + 3.81, OPTO[1] - 1.27]], 0.6),
      t([secondary[0]!, [D_OUT[0] - DO41_PITCH / 2, D_OUT[1]]], 1.2),
      t(
        [
          [D_OUT[0] + DO41_PITCH / 2, D_OUT[1]],
          [44.8, 4],
          [44.8, 16],
          [coutR, C_OUT[1]],
        ],
        1.2,
      ),
    );
  }

  const text = (
    at: Point,
    value: string,
    size = 1.1,
    extra: Partial<Extract<PcbSilk, { kind: 'text' }>> = {},
  ): PcbSilk => ({ kind: 'text', at, text: value, size, ...extra });
  const silk: PcbSilk[] = [
    text([2.4, 8.4], 'L', 1.3),
    text([2.4, 32.6], 'N', 1.3),
    text([2.6, 16.8], 'F1', 1.1),
    text([6.5, 26.6], 'BD1', 1.0),
    text([C1[0], 1.6], 'C1', 1.0),
    text([L1[0] + 5.6, L1[1] + 3.6], 'L1', 1.0),
    text([C2[0] + 6.2, 40.4], 'C2', 1.0),
    text([IC[0], 23.6], 'U1', 1.0),
    text([Q1[0], Q1[1] + 2.6], 'Q1', 1.0),
    text([44.8, 9.6], 'D1', 1.0, { align: 'right' }),
    text([45, 12], 'C3', 1.0, { align: 'right' }),
    text([26, 1.2], 'T1', 1.0),
    text([31.6, 25.8], 'U3', 0.9),
    text([USB_AT[0] - 2, 39.8], '+5V  USB', 1.0),
    { kind: 'circle', at: C1, r: electrolyticSize(v.c1, 400).D / 2 + 0.3, width: 0.18 },
    { kind: 'circle', at: C2, r: electrolyticSize(v.c2, 400).D / 2 + 0.3, width: 0.18 },
    { kind: 'circle', at: C_OUT, r: cOut.D / 2 + 0.3, width: 0.18 },
    { kind: 'circle', at: L1, r: 4.8, width: 0.18 },
    { kind: 'rect', at: [F1[0], F1[1]], size: [3.8, 9.6], width: 0.16 },
  ];
  if (v.certified) {
    silk.push(
      text([22, 39.9], 'CY1', 0.9, { align: 'right' }),
      // Hazard triangle on the mains side.
      {
        kind: 'line',
        points: [
          [16.2, 40.2],
          [17.9, 37.3],
          [19.6, 40.2],
        ],
        width: 0.2,
        closed: true,
      },
      text([17.9, 39.3], '!', 1.2),
    );
    // Dashed isolation line along the slot.
    for (let y = 0.8; y < 40.4; y += 2) {
      silk.push({
        kind: 'line',
        points: [
          [SLOT_X + 1.6, y],
          [SLOT_X + 1.6, Math.min(y + 1.1, 40.4)],
        ],
        width: 0.18,
      });
    }
  }

  return {
    width: W,
    height: H,
    thickness: T,
    corner: 1,
    substrate: v.certified ? 'fr4' : 'fenolite',
    copper: 'both',
    mask: 'verde',
    finish: 'hasl',
    pads,
    traces,
    silk,
  };
}

/** Mains wire from a plug pin's lug down to its pad (board-group space). */
function mainsWire(z: number): Vec3[] {
  const [px] = on(L_PAD);
  const y = PIN_Y - BOARD_Y;
  return [
    [-18.2, y - 0.5, z],
    [-19.4, y - 1.6, z],
    [px, T + 2.4, z],
    [px, T + 0.2, z],
  ];
}
const WIRE_L = mainsWire(-PIN_Z);
const WIRE_N = mainsWire(PIN_Z);

const SLOTS: BoardSlot[] = [{ from: [SLOT_X, 2.4], to: [SLOT_X, 37], width: 1.2 }];
const NO_SLOTS: BoardSlot[] = [];

// ---------------------------------------------------------------------------
// Meta.

const resolve = (props: PartProps) => ({ ...meta.defaults, ...props });

/** Where the cutaway takes the lid off: everything above this height. */
const CUT_Y = 17;

/** Exploded view: the lid lifts high, the board halfway. */
const LIFT_LID: Vec3 = [0, 62, 0];
const LIFT_BOARD: Vec3 = [0, 30, 0];

export const meta: PartMeta = {
  id: 'phone-charger',
  label: 'Carregador de celular por dentro',
  category: 'energia',
  summary:
    'Carregador USB de tomada (5 V) aberto: fonte chaveada com fusível, ponte, filtro, controlador, transformador de alta frequência, optoacoplador e capacitor Y atravessando o rasgo de isolação; também na versão sem certificação, sem essas proteções.',
  defaults: { quality: 'certificado', current: 2.1 },
  controls: {
    quality: {
      kind: 'select',
      label: 'Fabricação',
      options: [
        { value: 'certificado', label: 'Certificado (com as proteções)' },
        { value: 'sem-certificacao', label: 'Sem certificação (clone barato)' },
      ],
    },
    current: {
      kind: 'select',
      label: 'Corrente de saída',
      options: [
        { value: 1, label: '1 A (5 W)' },
        { value: 2.1, label: '2,1 A (10,5 W)' },
      ],
    },
  },
  annotations: (props) => {
    const v = variantOf(resolve(props));
    const list: PartAnnotation[] = [
      {
        at: [0, 0, 0],
        anchor: 'charger-plug',
        text: 'Entrada da rede: perigo de choque. Os pinos vão direto para a placa',
      },
      v.certified
        ? { at: [0, 0, 0], anchor: 'charger-fuse', text: 'Fusível de entrada (resistor fusível)' }
        : {
            at: [0, 0, 0],
            anchor: 'charger-fuse',
            text: 'Sem fusível: no lugar dele, só um pedaço de fio',
          },
      { at: [0, 0, 0], anchor: 'charger-bridge', text: 'Ponte retificadora' },
      {
        at: [0, 0, 0],
        anchor: 'charger-bulk',
        text: 'Capacitor de entrada: carrega com cerca de 180 V (127 V) ou 311 V (220 V)',
      },
      {
        at: [0, 0, 0],
        anchor: 'charger-switch',
        text: 'Chave e controlador: liga e desliga dezenas de milhares de vezes por segundo',
      },
      v.certified
        ? {
            at: [0, 0, 0],
            anchor: 'charger-transformer',
            text: 'Transformador de alta frequência: isola a saída da rede (fita amarela entre os enrolamentos)',
          }
        : {
            at: [0, 0, 0],
            anchor: 'charger-transformer',
            text: 'Transformador menor e sem fita isolante: só o verniz do fio separa a rede da saída',
          },
      {
        at: [0, 0, 0],
        anchor: 'charger-opto',
        text: 'Optoacoplador: avisa o primário sem ligar os dois lados',
      },
      v.certified
        ? { at: [0, 0, 0], anchor: 'charger-ycap', text: 'Capacitor Y: tipo de segurança' }
        : {
            at: [0, 0, 0],
            anchor: 'charger-ycap',
            text: 'No lugar do capacitor Y, um cerâmico comum, que pode falhar em curto',
          },
      v.certified
        ? {
            at: [0, 0, 0],
            anchor: 'charger-slot',
            text: 'Rasgo de isolação na placa: mais distância entre a rede e a saída',
            exploded: false,
          }
        : {
            at: [0, 0, 0],
            anchor: 'charger-slot',
            text: 'Sem rasgo: a trilha da rede passa a menos de 1 mm da trilha da saída',
            exploded: false,
          },
    ];
    if (!v.certified)
      list.push({
        at: [0, 0, 0],
        anchor: 'charger-missing',
        text: 'Lugares vazios: o segundo capacitor e o filtro ficaram de fora',
      });
    list.push(
      {
        at: [0, 0, 0],
        anchor: 'charger-output',
        text: 'Diodo Schottky e capacitor de saída',
      },
      { at: [0, 0, 0], anchor: 'charger-usb', text: 'Saída USB 5 V' },
    );
    return list;
  },
  explode: true,
  cutaway: true,
  cut: { normal: [0, -1, 0], through: [0, CUT_Y, 0] },
  describe: (props) => {
    const v = variantOf(resolve(props));
    const amps = formatNumber(v.amps);
    const head = `Carregador de celular USB de 5 V e ${amps} A (${watts(v.amps)} W), aberto: caixa branca de 50 × 45 × 26 mm com os dois pinos redondos de 4 mm do plugue e a tomada USB na outra ponta.`;
    const bulk =
      'O capacitor de entrada carrega com cerca de 180 V numa rede de 127 V, ou 311 V em 220 V, e pode guardar carga depois de desligado.';
    if (v.certified)
      return [
        head,
        `Do lado da rede: resistor fusível, ponte retificadora, filtro π (capacitores de ${formatNumber(v.c1 * 1e6)} µF e ${formatNumber(v.c2 * 1e6)} µF de 400 V com um indutor), controlador e transistor chaveador.`,
        bulk,
        'O transformador de ferrite com fita amarela, o optoacoplador e o capacitor Y azul atravessam um rasgo na placa que afasta a rede da saída.',
        `Do lado da saída: diodo Schottky, capacitor de ${formatNumber(v.cOut * 1e6)} µF e 10 V, referência de tensão e a tomada USB-A.`,
      ].join(' ');
    return [
      head,
      `Versão sem certificação: por fora parece igual, mas por dentro faltam as proteções. Um fio no lugar do fusível, um só capacitor de entrada (${formatNumber(v.c1 * 1e6)} µF) e lugares vazios onde iriam o filtro e o segundo capacitor.`,
      bulk,
      'O transformador é menor e não tem fita isolante, um capacitor cerâmico comum ocupa o lugar do capacitor Y e a placa não tem rasgo: a trilha da rede passa a menos de 1 mm da trilha da saída.',
      `${v.amps > 1 ? 'Promete 2,1 A com um diodo de 1 A. ' : ''}Uma falha nesses pontos pode levar a tensão da rede ao cabo e ao celular.`,
    ].join(' ');
  },
  view: [0.55, 0.85, 1],
};

// ---------------------------------------------------------------------------
// Case.

/** Outline of the case walls (rounded rectangle) as a 2D shape with the inside as a hole. */
function ringShape(notch?: [number, number]): Shape {
  const { l, d, r, wall: t } = CASE;
  const xo = l / 2;
  const yo = d / 2;
  const xi = xo - t;
  const yi = yo - t;
  const ri = r - t;
  const shape = new Shape();
  const outer = (p: Path, start: [number, number]) => {
    p.moveTo(...start);
    p.lineTo(xo, yo - r);
    p.absarc(xo - r, yo - r, r, 0, Math.PI / 2, false);
    p.lineTo(-xo + r, yo);
    p.absarc(-xo + r, yo - r, r, Math.PI / 2, Math.PI, false);
    p.lineTo(-xo, -yo + r);
    p.absarc(-xo + r, -yo + r, r, Math.PI, Math.PI * 1.5, false);
    p.lineTo(xo - r, -yo);
    p.absarc(xo - r, -yo + r, r, Math.PI * 1.5, Math.PI * 2, false);
  };
  const inner = (p: Path, end: [number, number]) => {
    p.lineTo(xi, -yi + ri);
    p.absarc(xi - ri, -yi + ri, ri, 0, -Math.PI / 2, true);
    p.lineTo(-xi + ri, -yi);
    p.absarc(-xi + ri, -yi + ri, ri, -Math.PI / 2, -Math.PI, true);
    p.lineTo(-xi, yi - ri);
    p.absarc(-xi + ri, yi - ri, ri, Math.PI, Math.PI / 2, true);
    p.lineTo(xi - ri, yi);
    p.absarc(xi - ri, yi - ri, ri, Math.PI / 2, 0, true);
    p.lineTo(...end);
  };
  if (notch) {
    // A C-shaped ring: the wall at +X is open between shape y = n0 and n1.
    const [n0, n1] = notch;
    outer(shape, [xo, n1]);
    shape.lineTo(xo, n0);
    shape.lineTo(xi, n0);
    inner(shape, [xi, n1]);
    shape.closePath();
    return shape;
  }
  outer(shape, [xo, 0]);
  shape.lineTo(xo, 0);
  const hole = new Path();
  hole.moveTo(xi, 0);
  inner(hole, [xi, 0]);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function wallBand(y0: number, y1: number, notch?: [number, number]): BufferGeometry {
  const g = extrudeUp(ringShape(notch), y1 - y0, 0, { curveSegments: 6 });
  return g.translate(0, y0, 0);
}

/** Bottom and top shells, split on the plug pins' axis; USB opening in the bottom one. */
function useCaseGeometry() {
  const usbZ = USB_AT[1] - H / 2;
  const usbBottom = BOARD_Y + T - 0.2;
  // extrudeUp turns shape y into −z.
  const notch: [number, number] = [-(usbZ + USB.width / 2 + 0.2), -(usbZ - USB.width / 2 - 0.2)];
  const bottom = useDisposable(() => {
    const { l, d, r, wall } = CASE;
    const posts = [-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) =>
        extrudeUp(roundedRect(2.6, 2.6, 1.2), BOARD_Y - wall + 0.2, 0).translate(
          sx * (W / 2 - 1.2),
          wall - 0.1,
          sz * (H / 2 - 1.2),
        ),
      ),
    );
    return mergeAll([
      roundedRectSlab(l, d, r, 0, wall, 0.8),
      wallBand(wall - 0.6, usbBottom),
      wallBand(usbBottom, CASE.split, notch),
      ...posts,
    ]);
  }, []);
  const top = useDisposable(() => {
    const { l, d, r, h, wall } = CASE;
    return mergeAll([
      wallBand(CASE.split + 0.06, h - wall + 0.6),
      roundedRectSlab(l, d, r, h - wall, h, 0.8),
    ]);
  }, []);
  return { bottom, top };
}

function roundedRect(w: number, d: number, r: number): Shape {
  const s = new Shape();
  const x = w / 2;
  const z = d / 2;
  s.moveTo(-x + r, -z);
  s.lineTo(x - r, -z);
  s.absarc(x - r, -z + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x, z - r);
  s.absarc(x - r, z - r, r, 0, Math.PI / 2, false);
  s.lineTo(-x + r, z);
  s.absarc(-x + r, z - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-x, -z + r);
  s.absarc(-x + r, -z + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Draws the DC symbol (a line over a dashed line) at (x, y), `w` wide; returns the width used. */
function dcSymbol(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, lw: number) {
  ctx.fillRect(x, y - lw * 1.6, w, lw);
  const dash = (w - lw * 2) / 3;
  for (let i = 0; i < 3; i++) ctx.fillRect(x + i * (dash + lw), y + lw * 0.6, dash, lw);
}

function useLabel(v: Variant) {
  return useCanvasTexture(
    (ctx, w, h) => {
      const ink = '#1c1e21';
      ctx.fillStyle = ink;
      ctx.strokeStyle = ink;
      const left = w * 0.06;
      const line = h / 7.2;
      const size = line * 0.5;
      const font = (s: number, weight = 600) => `${weight} ${s}px ${FONT_SANS}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      fitText(ctx, 'Carregador USB', left, line * 0.9, w * 0.88, line * 0.78, {
        weight: 700,
        align: 'left',
      });
      fitText(
        ctx,
        `Entrada: 100–240 V~  50/60 Hz  ${v.amps > 1 ? '0,35' : '0,15'} A`,
        left,
        line * 2.1,
        w * 0.88,
        size,
        { align: 'left' },
      );
      // "Saída: 5 V ⎓ 2,1 A" with the DC symbol drawn (fonts may lack it).
      ctx.font = font(size);
      const a = 'Saída: 5 V ';
      ctx.fillText(a, left, line * 3.05);
      const x = left + ctx.measureText(a).width;
      dcSymbol(ctx, x, line * 3.05, size * 0.9, size * 0.11);
      ctx.fillText(` ${formatNumber(v.amps)} A  (${watts(v.amps)} W)`, x + size * 0.9, line * 3.05);
      let y = line * 4.25;
      if (v.certified) {
        // Class II symbol: double insulation.
        const s = size * 1.1;
        ctx.lineWidth = size * 0.09;
        ctx.strokeRect(left, y - s / 2, s, s);
        ctx.strokeRect(left + s * 0.25, y - s * 0.25, s * 0.5, s * 0.5);
        fitText(ctx, 'Isolação dupla', left + s * 1.5, y, w * 0.6, size * 0.86, { align: 'left' });
        y += line;
      }
      fitText(ctx, 'Uso interno, em local seco', left, y, w * 0.88, size * 0.86, {
        weight: 600,
        align: 'left',
      });
      fitText(
        ctx,
        'Não abra: alta tensão por dentro',
        left,
        y + line * 0.85,
        w * 0.88,
        size * 0.86,
        {
          weight: 600,
          align: 'left',
        },
      );
    },
    `charger-label|${v.certified}|${v.amps}`,
    { width: 1024, height: 768, fonts: [`700 40px ${FONT_SANS}`, `500 40px ${FONT_SANS}`] },
  );
}

function ChargerCase({ v }: { v: Variant }) {
  const { bottom, top } = useCaseGeometry();
  const noise = getNoiseTexture();
  const label = useLabel(v);
  const plastic = {
    preset: 'absWhite' as const,
    color: '#f1f0eb',
    roughness: 0.38,
    roughnessMap: noise,
    clearcoat: 0.25,
    clearcoatRoughness: 0.4,
    clip: true,
    cutColor: '#d9d7cf',
  };
  const plugX = -CASE.l / 2;
  return (
    <group>
      <mesh geometry={bottom}>
        <Material {...plastic} />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <group key={s} position={[plugX, PIN_Y, s * PIN_Z]}>
          <PlugPin wall={CASE.wall} />
        </group>
      ))}
      <Anchor name="charger-plug" position={[plugX - PLUG.length * 0.6, PIN_Y + 2, -PIN_Z]} />
      <Explode offset={LIFT_LID}>
        <mesh geometry={top}>
          <Material {...plastic} />
        </mesh>
        <mesh position={[0, CASE.h + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[40, 30]} />
          <Material
            color="#ffffff"
            map={label}
            transparent
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            roughness={0.5}
            clip
          />
        </mesh>
      </Explode>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Board.

function ChargerBoard({ v }: { v: Variant }) {
  const layout = useMemo(() => buildLayout(v), [v]);
  const slots = v.certified ? SLOTS : NO_SLOTS;
  const smd = useMemo(
    () =>
      smdLayout(v).map((item) => {
        const [x, , z] = on(item.at);
        return { ...item, at: [x, z] as [number, number] };
      }),
    [v],
  );
  const c1 = electrolyticSize(v.c1, 400);
  const cOut = electrolyticSize(v.cOut, 10);
  const place = (at: Point, deg = 0, up = 0) => ({
    position: on(at, up),
    rotation: [0, (deg * Math.PI) / 180, 0] as Vec3,
  });
  const tSize = !v.certified;
  return (
    <BatchRoot blocks={['placa']} cutNormal={[0, -1, 0]} cutThrough={[0, CUT_Y - BOARD_Y, 0]}>
      {/* The board alone: its layer-by-layer exploded view would cross the parts. */}
      <ViewProvider>
        <SlottedBoard layout={layout} slots={slots} />
      </ViewProvider>
      <BakeLayer lift={[0, 0, 0]}>
        {v.certified ? (
          <BakePart {...place(F1, 90, -2)}>
            <Resistor ohms={10} watts={0.5} leads="dobrados" leadDrop={4.2} />
          </BakePart>
        ) : (
          <BakePart {...place(F1, 90)}>
            <WireLink pitch={F1_PITCH} />
          </BakePart>
        )}
        <BakePart {...place(C1, 0, -6.5)}>
          <ElectrolyticCapacitor farads={v.c1} voltage={400} sleeve="preto" leadLength={3} />
        </BakePart>
        {v.certified ? (
          <>
            <BakePart {...place(L1, 0, -2.5)}>
              <Inductor variant="tambor" microhenries={1000} turns={20} leadLength={3} />
            </BakePart>
            <BakePart {...place(C2, 0, -6.5)}>
              <ElectrolyticCapacitor farads={v.c2} voltage={400} sleeve="preto" leadLength={3} />
            </BakePart>
          </>
        ) : (
          <BakePart {...place(L1)}>
            <WireLink pitch={5} />
          </BakePart>
        )}
        <BakePart {...place(IC)}>
          <IcQfp package="soic" pins={8} code="PWM 5V" dateCode="2334" />
        </BakePart>
        <BakePart {...place(Q1, 0, -3)}>
          <TransistorTo92 code="2N60" dateCode="M34" pitch={2.54} leadLength={6} />
        </BakePart>
        <BakePart {...place(SNUB_C, 0, -2.5)}>
          <CeramicCapacitor farads={1e-9} voltage={1000} variant="disco" leadLength={4} />
        </BakePart>
        <BakePart {...place(SNUB_D, 0, -6.7)}>
          <Diode variant="retificador" code="FR107" leads="dobrados" />
        </BakePart>
        <BakePart {...place(T1, 90)}>
          <ChargerTransformer small={tSize} taped={v.certified} />
        </BakePart>
        <BakePart {...place(OPTO, 90, -3.3)}>
          <Optocoupler package="dip4" code="OPTO" />
        </BakePart>
        {v.certified ? (
          <BakePart {...place(YCAP)}>
            <YCapacitor />
          </BakePart>
        ) : (
          <BakePart {...place(YCAP, 0, -2.5)}>
            <CeramicCapacitor farads={1e-9} voltage={1000} variant="disco" leadLength={4} />
          </BakePart>
        )}
        {!(v.certified && v.amps > 1) && (
          <BakePart {...place(D_OUT, 0, -6.7)}>
            <Diode variant="retificador" code="1N5819" leads="dobrados" />
          </BakePart>
        )}
        <BakePart {...place(C_OUT, 0, -6.5)}>
          <ElectrolyticCapacitor farads={v.cOut} voltage={10} sleeve="azul" leadLength={3} />
        </BakePart>
        <BakePart {...place(USB_AT)}>
          <UsbReceptacle />
        </BakePart>
        <BakePart>
          <group position={[0, T, 0]}>
            <SmdParts items={smd} />
          </group>
        </BakePart>
        <Wire points={WIRE_L} radius={0.65} smooth material={{ preset: 'pvc', color: '#1d1d1f' }} />
        <Wire points={WIRE_N} radius={0.65} smooth material={{ preset: 'pvc', color: '#1d1d1f' }} />
      </BakeLayer>

      <Anchor name="charger-fuse" position={on(F1, v.certified ? 4 : 1.2)} />
      <Anchor name="charger-bridge" position={on(BRIDGE, 1.8)} />
      <Anchor name="charger-bulk" position={on(C1, c1.L + 1)} />
      <Anchor name="charger-switch" position={on([19, 27], 5.5)} />
      <Anchor name="charger-transformer" position={on(T1, v.certified ? 15.4 : 12)} />
      <Anchor name="charger-opto" position={on(OPTO, 4.2)} />
      <Anchor name="charger-ycap" position={on(YCAP, v.certified ? 9 : 8)} />
      <Anchor name="charger-slot" position={on(v.certified ? [SLOT_X, 30] : [25.6, 19.5], 0.1)} />
      <Anchor name="charger-missing" position={on(C2, 0.3)} />
      <Anchor name="charger-output" position={on(C_OUT, cOut.L + 1)} />
      <Anchor name="charger-usb" position={on([W + 1.8, USB_AT[1]], USB.height / 2)} />
    </BatchRoot>
  );
}

export default function PhoneCharger(props: PhoneChargerProps) {
  const p = resolve(props as PartProps);
  const quality = p.quality;
  const current = p.current;
  const v = useMemo(() => variantOf({ quality, current }), [quality, current]);
  return (
    <group>
      <ChargerCase v={v} />
      <Explode offset={LIFT_BOARD} delay={0.1}>
        <group position={[0, BOARD_Y, 0]}>
          <ChargerBoard v={v} />
        </group>
      </Explode>
    </group>
  );
}
