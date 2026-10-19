/**
 * Module 9: the diode equations behind the interactive figures (the PN
 * junction of 9.1, the I×V curve of 9.2). The parameters are the engine's
 * own (src/engine/devices/diode.ts and led.ts), so the figures and the
 * simulations give the same numbers; diodo-modelo.test.ts checks them against
 * the simulator.
 */

/** Thermal voltage kT/q at 27 °C, as SPICE and the engine use it (V). */
export const VT = 0.025864917;

export interface DiodeParams {
  /** Saturation current (A). */
  is: number;
  /** Emission coefficient. */
  n: number;
  /** Series resistance (Ω). */
  rs: number;
}

export type DiodeKind = 'signal' | 'rectifier' | 'schottky';

/** SPICE parameters of the engine's diode models (src/engine/devices/diode.ts). */
export const DIODES: Record<DiodeKind, DiodeParams & { label: string }> = {
  signal: { label: '1N4148 (sinal)', is: 2.52e-9, n: 1.752, rs: 0.568 },
  rectifier: { label: '1N4007 (retificador)', is: 7.03e-9, n: 1.808, rs: 0.0342 },
  schottky: { label: '1N5819 (Schottky)', is: 3.17e-5, n: 1.373, rs: 0.051 },
};

/** The engine's LEDs: forward voltage at 20 mA and series resistance (src/engine/devices/led.ts). */
const LED_N = 2;
const LED_NOMINAL = 0.02;
export const LED_COLORS = {
  red: { label: 'LED vermelho', vf: 2.0, rs: 10 },
  blue: { label: 'LED azul', vf: 3.1, rs: 12 },
} as const;

export function ledParams(color: keyof typeof LED_COLORS): DiodeParams {
  const c = LED_COLORS[color];
  const is = LED_NOMINAL / Math.expm1((c.vf - LED_NOMINAL * c.rs) / (LED_N * VT));
  return { is, n: LED_N, rs: c.rs };
}

/** Voltage across the diode for a forward current (A): junction plus series resistance. */
export function diodeVoltage(current: number, d: DiodeParams): number {
  if (current <= -d.is) return -Infinity;
  return d.n * VT * Math.log1p(current / d.is) + current * d.rs;
}

/**
 * Current for a voltage across the whole diode (V), Shockley equation with
 * the series resistance, solved by bisection on the current. Reverse:
 * the saturation current, a few nanoamperes (no breakdown).
 */
export function diodeCurrent(volts: number, d: DiodeParams): number {
  if (volts <= 0) return d.is * Math.expm1(volts / (d.n * VT));
  let lo = 0;
  let hi = volts / Math.max(d.rs, 1e-9);
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (diodeVoltage(mid, d) > volts) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Operating point of a source, a resistor and a diode in series: where the
 * diode curve meets the load line I = (V − Vd)/R. Returns the current and
 * the diode voltage.
 */
export function operatingPoint(
  source: number,
  ohms: number,
  d: DiodeParams,
): { current: number; voltage: number } {
  if (source <= 0) {
    const current = diodeCurrent(source, d);
    return { current, voltage: source - current * ohms };
  }
  let lo = 0;
  let hi = source / ohms;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (diodeVoltage(mid, d) + mid * ohms > source) hi = mid;
    else lo = mid;
  }
  const current = (lo + hi) / 2;
  return { current, voltage: diodeVoltage(current, d) };
}

/* The PN junction of lesson 9.1: an abrupt silicon junction doped with
   10¹⁶ atoms per cm³ on both sides, at room temperature. */

/** Built-in (barrier) potential of the junction (V). */
export const BUILT_IN = 0.71;
/** Width of the depletion region with no voltage applied (µm). */
export const WIDTH_AT_ZERO = 0.43;

/**
 * Width of the depletion region (µm) with `volts` applied, anode (P) minus
 * cathode (N): it grows with the square root of the total barrier. Forward,
 * the barrier almost vanishes and the junction conducts; the formula stops
 * holding near the built-in potential, so the width is held at its 0,6 V value.
 */
export function depletionWidth(volts: number): number {
  const v = Math.min(volts, 0.6);
  return WIDTH_AT_ZERO * Math.sqrt((BUILT_IN - v) / BUILT_IN);
}
