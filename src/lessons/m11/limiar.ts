/**
 * Lesson 11.1: a slow analog signal with noise read by a digital input, with
 * one threshold or with two (hysteresis, as a Schmitt trigger input). Pure,
 * unit tested in limiar.test.ts.
 */

/** Single threshold of the plain input (V). */
export const THRESHOLD = 2.5;
/** Thresholds of the input with hysteresis (V): goes high above 3 V, low below 2 V. */
export const HYSTERESIS = { up: 3, down: 2 } as const;

export type InputKind = 'simples' | 'histerese';

/**
 * The signal at instant `t` (0 to 1, the whole window): a sensor voltage that
 * rises from 0,5 V to 4,5 V and falls back, plus noise of peak `noise` volts.
 * The noise is a sum of fast sines, so it is the same on every render.
 */
export function signalAt(t: number, noise: number): number {
  const base = 2.5 - 2 * Math.cos(2 * Math.PI * t);
  const n =
    0.55 * Math.sin(2 * Math.PI * 41 * t) +
    0.3 * Math.sin(2 * Math.PI * 97 * t + 1.3) +
    0.15 * Math.sin(2 * Math.PI * 173 * t + 0.4);
  return base + noise * n;
}

/** The signal sampled at `points` evenly spaced instants from 0 to 1. */
export function sampleSignal(noise: number, points = 801): number[] {
  return Array.from({ length: points }, (_, k) => signalAt(k / (points - 1), noise));
}

/** What the input reads at each sample: true for 1. Starts at 0. */
export function readInput(samples: number[], kind: InputKind): boolean[] {
  let level = false;
  return samples.map((v) => {
    if (kind === 'simples') level = v > THRESHOLD;
    else if (v >= HYSTERESIS.up) level = true;
    else if (v <= HYSTERESIS.down) level = false;
    return level;
  });
}

/** How many times the reading changes. */
export function countChanges(levels: boolean[]): number {
  let n = 0;
  for (let k = 1; k < levels.length; k++) if (levels[k] !== levels[k - 1]) n++;
  return n;
}

/** Value of a list of bits, most significant first. */
export function bitsToNumber(bits: boolean[]): number {
  return bits.reduce((sum, b) => sum * 2 + (b ? 1 : 0), 0);
}
