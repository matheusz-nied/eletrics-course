/**
 * What an Arduino-style board does with its pins, shared by the module 12
 * firmware: the 10-bit ADC, debounced buttons and timers. Pure functions.
 */
import type { PinValue } from '../../engine/firmware';

/** Supply and ADC reference of the 5 V boards (V). */
export const VCC_5V = 5;

/** ADC steps: a 10-bit converter gives 0 to 1023. */
export const ADC_STEPS = 1024;

/**
 * Reading of a 10-bit ADC, like `analogRead()`: the voltage divided by the
 * reference, times 1024, rounded down and capped at 1023.
 */
export function adc10(volts: number, vref = VCC_5V): number {
  if (!Number.isFinite(volts) || volts <= 0) return 0;
  return Math.min(ADC_STEPS - 1, Math.floor((volts / vref) * ADC_STEPS));
}

/** Voltage that an ADC reading stands for, the inverse of `adc10`. */
export function adcVolts(reading: number, vref = VCC_5V): number {
  return (reading * vref) / ADC_STEPS;
}

/** Voltage on an analog pin as the firmware gets it (0 when missing). */
export function volts(pins: Record<string, PinValue>, name: string): number {
  const v = pins[name];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * A digital input with a pull-up and a contact to GND: closed reads low.
 * A missing value reads high, like an open contact.
 */
export function closed(pins: Record<string, PinValue>, name: string): boolean {
  return pins[name] === false;
}

/** A button that must hold a new level for `DEBOUNCE` seconds before it counts. */
export interface Debounced {
  /** Accepted level: true = pressed. */
  pressed: boolean;
  /** How long the raw level has differed from the accepted one (s). */
  differ: number;
  /** How long the accepted level has lasted (s). */
  held: number;
}

/** Contacts bounce for a few milliseconds; 30 ms is a common debounce time. */
export const DEBOUNCE = 0.03;

export const released = (): Debounced => ({ pressed: false, differ: 0, held: 0 });

/**
 * One step of the debounce. Returns the new button and the edge: "press"
 * when it was just pressed, "release" when it was just released.
 */
export function debounce(
  b: Debounced,
  raw: boolean,
  dt: number,
): { button: Debounced; edge: 'press' | 'release' | null } {
  if (raw === b.pressed) return { button: { ...b, differ: 0, held: b.held + dt }, edge: null };
  const differ = b.differ + dt;
  if (differ + 1e-9 < DEBOUNCE) return { button: { ...b, differ, held: b.held + dt }, edge: null };
  return { button: { pressed: raw, differ: 0, held: 0 }, edge: raw ? 'press' : 'release' };
}
