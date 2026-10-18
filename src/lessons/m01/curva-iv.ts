/**
 * Lesson 1.4 (Ohm's law): the numbers behind CurvaIV.tsx. Pure, unit-tested
 * in curva-iv.test.ts.
 */

/** Rated values of the lamp in the lesson (and in lampada-nao-ohmica.circuit.ts). */
export const LAMP_VOLTAGE = 12;
export const LAMP_POWER = 5;

/* The same filament model as the engine's lamp (src/engine/devices/lamp.ts). */
const T_AMBIENT = 25 + 273.15;
const T_RATED = 2700;
const R_EXPONENT = 1.2;

/**
 * Steady-state current of an incandescent lamp: the filament temperature T
 * balances the electric power V²/R(T) with the radiated power
 * k·(T⁴ − T0⁴), and R(T) = R_hot·(T/T_rated)^1,2. Solved by bisection.
 */
export function lampCurrent(volts: number, rated = LAMP_VOLTAGE, power = LAMP_POWER): number {
  if (volts <= 0) return 0;
  const hot = rated ** 2 / power;
  const k = power / (T_RATED ** 4 - T_AMBIENT ** 4);
  const resistance = (t: number) => hot * (t / T_RATED) ** R_EXPONENT;
  const excess = (t: number) => volts ** 2 / resistance(t) - k * (t ** 4 - T_AMBIENT ** 4);
  let lo = T_AMBIENT;
  let hi = 4000;
  for (let n = 0; n < 60; n++) {
    const mid = (lo + hi) / 2;
    if (excess(mid) > 0) lo = mid;
    else hi = mid;
  }
  return volts / resistance((lo + hi) / 2);
}

/** Current through a resistor: Ohm's law, I = V / R. */
export const ohmCurrent = (volts: number, ohms: number) => volts / ohms;
