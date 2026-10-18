/**
 * 04.2: the curves the lesson plots with <Plot data={…}>, from the same
 * formulas as the engine's potentiometer and NTC models (checked against the
 * simulator in resistores-variaveis.test.ts).
 */

export interface CurveSeries {
  label: string;
  unit: string;
  points: [number, number][];
}

export type Taper = 'linear' | 'log';

/** Fraction of the track between A and the wiper for a position from 0 (at A) to 1 (at B). */
export function taperFraction(position: number, taper: Taper): number {
  const p = Math.min(1, Math.max(0, position));
  return taper === 'log' ? (10 ** (2 * p) - 1) / 99 : p;
}

const KELVIN = 273.15;

/** NTC resistance by the Beta model: R = R25·e^(B·(1/T − 1/298,15 K)). */
export function ntcResistance(r25: number, beta: number, celsius: number): number {
  return r25 * Math.exp(beta * (1 / (celsius + KELVIN) - 1 / (25 + KELVIN)));
}

/** Output of a divider with the sensor on top and `bottom` ohms below it. */
export function dividerOutput(supply: number, top: number, bottom: number): number {
  return (supply * bottom) / (top + bottom);
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let k = 0; from + k * step <= to + 1e-9; k++) out.push(from + k * step);
  return out;
}

/** Share of the track between A and the wiper (%), for the wiper position (%). */
export const TAPER_CURVES: CurveSeries[] = (['linear', 'log'] as const).map((taper) => ({
  label: taper === 'linear' ? 'Linear (B)' : 'Logarítmica (A)',
  unit: '%',
  points: range(0, 100, 2.5).map((x) => [x, 100 * taperFraction(x / 100, taper)]),
}));

/** The lesson's NTC: 10 kΩ at 25 °C, B = 3950 K, from 0 °C to 90 °C. */
export const NTC_CURVE: CurveSeries[] = [
  {
    label: 'NTC de 10 kΩ (B = 3950 K)',
    unit: 'Ω',
    points: range(0, 90, 2).map((t) => [t, ntcResistance(10000, 3950, t)]),
  },
];
