/**
 * Lesson 9.4: the current-limiting resistor of one or more LEDs in series.
 * The LEDs are the engine's own (src/engine/devices/led.ts): forward voltage
 * at 20 mA, series resistance and emission coefficient 2, so the "real"
 * current the calculator shows is the one the simulations give; leds.test.ts
 * checks it against the simulator.
 */
import { VT, diodeVoltage, type DiodeParams } from './diodo-modelo';

/** Current at which the forward voltage of each color is given (A). */
const LED_NOMINAL = 0.02;
const LED_N = 2;

export type LedColor = 'red' | 'yellow' | 'green' | 'blue' | 'white';

/** Forward voltage at 20 mA and series resistance of the engine's LEDs. */
export const LEDS: Record<LedColor, { label: string; vf: number; rs: number }> = {
  red: { label: 'Vermelho', vf: 2.0, rs: 10 },
  yellow: { label: 'Amarelo', vf: 2.1, rs: 10 },
  green: { label: 'Verde comum', vf: 2.2, rs: 10 },
  blue: { label: 'Azul', vf: 3.1, rs: 12 },
  white: { label: 'Branco', vf: 3.1, rs: 12 },
};

/** Shockley parameters of an LED color, as the engine builds them. */
export function ledModel(color: LedColor): DiodeParams {
  const c = LEDS[color];
  const is = LED_NOMINAL / Math.expm1((c.vf - LED_NOMINAL * c.rs) / (LED_N * VT));
  return { is, n: LED_N, rs: c.rs };
}

/** Standard resistor values of the E12 series in one decade. */
const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];

/** The smallest E12 value that is not below `ohms` (a little less current, never more). */
export function nextE12(ohms: number): number {
  const decade = 10 ** Math.floor(Math.log10(ohms) - 1);
  for (const base of [...E12, 100]) {
    const value = Number((base * decade).toPrecision(3));
    if (value >= ohms * (1 - 1e-9)) return value;
  }
  return 100 * decade;
}

/** Usual resistor power ratings (W). */
const RATINGS = [0.125, 0.25, 0.5, 1, 2, 3, 5];

/** The smallest usual rating with twice the dissipated power as margin (W). */
export function ratingFor(watts: number): number {
  return RATINGS.find((r) => r >= 2 * watts) ?? RATINGS[RATINGS.length - 1]!;
}

/**
 * Current through `count` LEDs and a resistor in series on `supply` volts,
 * solving count·V_LED(I) + I·R = supply by bisection.
 */
export function stringCurrent(supply: number, ohms: number, color: LedColor, count = 1): number {
  const d = ledModel(color);
  if (supply <= 0) return 0;
  let lo = 0;
  let hi = supply / ohms;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (count * diodeVoltage(mid, d) + mid * ohms > supply) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export interface LedDesign {
  /** Voltage left for the resistor, with the table forward voltage (V). */
  headroom: number;
  /**
   * Less than a quarter of the supply is left for the resistor: a small change
   * of the supply or of the LEDs changes the current a lot.
   */
  tight: boolean;
  /** The calculated resistance (Ω), or undefined when the supply is too low. */
  ideal?: number;
  /** The E12 value chosen (Ω). */
  chosen?: number;
  /** Current with the chosen resistor (A). */
  current: number;
  /** Voltage across each LED with that current (V). */
  ledVoltage: number;
  /** Power in the resistor (W) and the rating to buy (W). */
  power: number;
  rating: number;
}

/**
 * The resistor for `count` LEDs of one color in series on `supply` volts, at
 * the `target` current (A): R = (supply − count·Vf)/I with the table Vf, the
 * next E12 value up, and the current that value really gives.
 */
export function designResistor(
  supply: number,
  color: LedColor,
  count: number,
  target: number,
): LedDesign {
  const vf = LEDS[color].vf;
  const headroom = supply - count * vf;
  if (headroom <= 0) {
    return { headroom, tight: true, current: 0, ledVoltage: 0, power: 0, rating: RATINGS[0]! };
  }
  const ideal = headroom / target;
  const chosen = nextE12(ideal);
  const current = stringCurrent(supply, chosen, color, count);
  const ledVoltage = diodeVoltage(current, ledModel(color));
  const power = current * current * chosen;
  return {
    headroom,
    tight: headroom < 0.25 * supply,
    ideal,
    chosen,
    current,
    ledVoltage,
    power,
    rating: ratingFor(power),
  };
}
