/**
 * 08.3: the torque × speed curve of the lesson's 1 CV motor, from the same
 * equivalent circuit as the simulator's three-phase motor (ac-motor-3ph), for
 * the <Plot data={…}> of the lesson. Checked in curva-torque.test.ts.
 */
import { REF } from '../../engine/devices/ac-motor-3ph';
import { gapImpedance } from '../../engine/models/induction';

export interface CurveSeries {
  label: string;
  unit: string;
  points: [number, number][];
}

/** Synchronous speed of the 4-pole motor at 60 Hz (rad/s). */
const SYNC = (2 * Math.PI * 60) / 2;

/** Torque (N·m) of the motor at slip `s` with `volts` on each winding. */
export function motorTorque(volts: number, s: number): number {
  const eq = { r1: REF.r1, x1: REF.x1, xm: REF.xm, r2: REF.r2, x2: REF.x2 };
  const z = gapImpedance(eq, s);
  const re = REF.r1 + z.re;
  const im = REF.x1 + z.im;
  const i2 = (volts * volts) / (re * re + im * im);
  return (3 / SYNC) * i2 * z.re;
}

/** Line current (A) of the motor at slip `s`: delta has √3 times the winding current. */
export function lineCurrent(volts: number, s: number, delta: boolean): number {
  const z = gapImpedance({ r1: REF.r1, x1: REF.x1, xm: REF.xm, r2: REF.r2, x2: REF.x2 }, s);
  const i = volts / Math.hypot(REF.r1 + z.re, REF.x1 + z.im);
  return delta ? Math.sqrt(3) * i : i;
}

/** Rated torque of the lesson: 750 W at about 1.720 rpm. */
export const RATED_TORQUE = 4.15;

/** Speed in percent of the synchronous one, 0 (stopped) to 100. */
const SPEEDS = Array.from({ length: 101 }, (_, k) => k);
const slipOf = (pct: number) => Math.max(1e-4, 1 - pct / 100);

export const TORQUE_CURVES: CurveSeries[] = [
  {
    label: 'Motor em triângulo (220 V por bobina)',
    unit: 'N·m',
    points: SPEEDS.map((p) => [p, motorTorque(220, slipOf(p))]),
  },
  {
    label: 'Motor em estrela (127 V por bobina)',
    unit: 'N·m',
    points: SPEEDS.map((p) => [p, motorTorque(220 / Math.sqrt(3), slipOf(p))]),
  },
  {
    label: 'Carga nominal (4,15 N·m)',
    unit: 'N·m',
    points: [
      [0, RATED_TORQUE],
      [100, RATED_TORQUE],
    ],
  },
];
