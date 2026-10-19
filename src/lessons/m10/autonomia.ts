/**
 * Lesson 10.3: how long a lead-acid battery lasts, with the losses that the
 * plain "Ah ÷ A" of lesson 1.2 leaves out: only part of the charge should be
 * used (depth of discharge), high currents give fewer ampere-hours (Peukert)
 * and an inverter (nobreak) wastes part of the energy. Typical values for
 * sealed lead-acid batteries, not a datasheet. Unit-tested in autonomia.test.ts.
 */

import { NBSP, formatNumber } from '../m00/formato';

/** Hours of the discharge the label capacity refers to (C20). */
export const RATED_HOURS = 20;
/** Peukert exponent, typical of sealed lead-acid batteries (1,1 to 1,3). */
export const PEUKERT = 1.15;

export interface BatteryOption {
  id: string;
  label: string;
  volts: number;
  ah: number;
}

export const BATTERIES: BatteryOption[] = [
  { id: '7ah', label: '12 V 7 Ah (selada)', volts: 12, ah: 7 },
  { id: '18ah', label: '12 V 18 Ah (selada)', volts: 12, ah: 18 },
  { id: '45ah', label: '12 V 45 Ah (estacionária)', volts: 12, ah: 45 },
];

/**
 * Current that drains the battery as fast as `amps` really does: above the
 * rated current (capacity ÷ 20 h) each ampere costs more than one, by
 * Peukert's law. Below it, no bonus is counted.
 */
export function effectiveCurrent(amps: number, ah: number, k = PEUKERT): number {
  if (amps <= 0) return 0;
  const rated = ah / RATED_HOURS;
  return amps * Math.max(1, amps / rated) ** (k - 1);
}

export interface GateLoad {
  /** Controller current while waiting for the remote (A). */
  standby: number;
  /** Motor current during an opening or closing (A). */
  motor: number;
  /** Duration of one movement (s). */
  seconds: number;
  /** Movements per hour. */
  perHour: number;
}

export interface Autonomy {
  /** Hours with depth of discharge and Peukert. */
  hours: number;
  /** Hours by the plain account: full capacity ÷ average current. */
  naive: number;
  /** Average current from the battery (A). */
  average: number;
}

/** Fraction of each hour the motor runs. */
export function motorDuty(load: GateLoad): number {
  return Math.min(1, (load.perHour * load.seconds) / 3600);
}

/** A gate (DC motor) on its backup battery: standby plus some movements per hour. */
export function gateAutonomy(battery: BatteryOption, load: GateLoad, depth: number): Autonomy {
  const duty = motorDuty(load);
  const average = load.standby * (1 - duty) + load.motor * duty;
  const effective =
    effectiveCurrent(load.standby, battery.ah) * (1 - duty) +
    effectiveCurrent(load.motor, battery.ah) * duty;
  return {
    hours: (battery.ah * depth) / effective,
    naive: battery.ah / average,
    average,
  };
}

/** Battery current of a nobreak feeding `watts` through an inverter of efficiency `eff`. */
export function inverterCurrent(watts: number, volts: number, eff: number): number {
  return watts / (volts * eff);
}

/** A nobreak (inverter) feeding a constant load of `watts`. */
export function upsAutonomy(
  battery: BatteryOption,
  watts: number,
  eff: number,
  depth: number,
): Autonomy & { current: number } {
  const current = inverterCurrent(watts, battery.volts, eff);
  return {
    hours: (battery.ah * depth) / effectiveCurrent(current, battery.ah),
    naive: (battery.volts * battery.ah) / watts,
    average: current,
    current,
  };
}

/** "19 h", "2 h 30 min", "17 min". */
export function formatDuration(hours: number): string {
  if (!Number.isFinite(hours)) return '∞';
  const minutes = Math.round(hours * 60);
  if (minutes < 60) return `${minutes}${NBSP}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 10 || m === 0) return `${formatNumber(Math.round(hours), 0)}${NBSP}h`;
  return `${h}${NBSP}h ${m}${NBSP}min`;
}
