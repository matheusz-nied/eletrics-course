/*
 * Lesson 4.1: the resistor colour code (IEC 60062), without UI. Used by the
 * colour code game (ColorCodeGame.tsx) and by the resistor drawing
 * (figures/ResistorBands.astro), and unit-tested in color-code.test.ts.
 */
import { formatSI } from '../../circuit/format';

export type BandColor =
  | 'preto'
  | 'marrom'
  | 'vermelho'
  | 'laranja'
  | 'amarelo'
  | 'verde'
  | 'azul'
  | 'violeta'
  | 'cinza'
  | 'branco'
  | 'dourado'
  | 'prateado';

/** Digit colours, 0 to 9. */
export const DIGIT_COLORS: readonly BandColor[] = [
  'preto',
  'marrom',
  'vermelho',
  'laranja',
  'amarelo',
  'verde',
  'azul',
  'violeta',
  'cinza',
  'branco',
];

/** Multiplier band: the power of ten. */
export const MULTIPLIER_EXPONENT: Partial<Record<BandColor, number>> = {
  prateado: -2,
  dourado: -1,
  preto: 0,
  marrom: 1,
  vermelho: 2,
  laranja: 3,
  amarelo: 4,
  verde: 5,
  azul: 6,
  violeta: 7,
  cinza: 8,
  branco: 9,
};

/** Tolerance band, in percent. */
export const TOLERANCE_PERCENT: Partial<Record<BandColor, number>> = {
  marrom: 1,
  vermelho: 2,
  verde: 0.5,
  azul: 0.25,
  violeta: 0.1,
  cinza: 0.05,
  dourado: 5,
  prateado: 10,
};

/** Paint colours as they look on real resistors (the same as the 3D kit). */
export const BAND_HEX: Record<BandColor, string> = {
  preto: '#151515',
  marrom: '#5e2f12',
  vermelho: '#c41a12',
  laranja: '#e8650f',
  amarelo: '#f2c21b',
  verde: '#1f8a3a',
  azul: '#1d4fb8',
  violeta: '#7b2fa8',
  cinza: '#7d7d7d',
  branco: '#f1f1ec',
  dourado: '#b8913c',
  prateado: '#b9bcc0',
};

/** Body colour: beige carbon film (4 bands) or blue metal film (5 bands). */
export function bodyHex(bandCount: number): string {
  return bandCount === 5 ? '#3f74a6' : '#c9ae84';
}

/** Commercial values of the E12 (±10 %) and E24 (±5 %) series, one decade. */
export const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82] as const;
export const E24 = [
  10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91,
] as const;

export type BandCount = 4 | 5;

/**
 * Bands for a resistance: 2 significant digits with 4 bands, 3 with 5 bands,
 * then the multiplier and the tolerance.
 */
export function encode(ohms: number, tolerance = 5, bandCount: BandCount = 4): BandColor[] {
  const digits = bandCount === 5 ? 3 : 2;
  let exponent = Math.floor(Math.log10(ohms) + 1e-9) - (digits - 1);
  let mantissa = Math.round(ohms / 10 ** exponent);
  if (mantissa >= 10 ** digits) {
    mantissa = Math.round(mantissa / 10);
    exponent += 1;
  }
  if (exponent < -2) {
    // Below the silver multiplier, the first digits are zeros: 0,1 Ω in 5 bands is 010 × 0,01.
    mantissa = Math.round(ohms / 0.01);
    exponent = -2;
  }
  if (exponent > 9 || mantissa < 1) throw new Error(`Valor fora do código de cores: ${ohms} Ω`);
  const bands = [...String(mantissa).padStart(digits, '0')].map((d) => DIGIT_COLORS[Number(d)]!);
  const multiplier = (Object.keys(MULTIPLIER_EXPONENT) as BandColor[]).find(
    (c) => MULTIPLIER_EXPONENT[c] === exponent,
  )!;
  const tol = (Object.keys(TOLERANCE_PERCENT) as BandColor[]).find(
    (c) => TOLERANCE_PERCENT[c] === tolerance,
  );
  if (!tol) throw new Error(`Tolerância sem cor: ${tolerance} %`);
  return [...bands, multiplier, tol];
}

export interface Decoded {
  ohms: number;
  /** Percent. */
  tolerance: number;
  /** "47 × 100" */
  digits: string;
  exponent: number;
}

/** Value of a set of 4 or 5 bands, or undefined if a band is not valid where it is. */
export function decode(bands: readonly BandColor[]): Decoded | undefined {
  if (bands.length !== 4 && bands.length !== 5) return undefined;
  const digitBands = bands.slice(0, bands.length - 2);
  const digits = digitBands.map((c) => DIGIT_COLORS.indexOf(c));
  if (digits.some((d) => d < 0)) return undefined;
  const exponent = MULTIPLIER_EXPONENT[bands[bands.length - 2]!];
  const tolerance = TOLERANCE_PERCENT[bands[bands.length - 1]!];
  if (exponent === undefined || tolerance === undefined) return undefined;
  const significant = Number(digits.join(''));
  return {
    ohms: clean(significant * 10 ** exponent),
    tolerance,
    digits: digits.join(''),
    exponent,
  };
}

/** Removes floating point noise: 47 × 0,1 = 4,7 and not 4,700000000000001. */
function clean(value: number): number {
  return Number(value.toPrecision(12));
}

/** Lowest and highest resistance the tolerance allows. */
export function toleranceRange(ohms: number, tolerance: number): [number, number] {
  return [clean(ohms * (1 - tolerance / 100)), clean(ohms * (1 + tolerance / 100))];
}

/**
 * "4,7 kΩ", "470 Ω", "0,47 Ω" (below 1 Ω, as written on resistors, not in mΩ).
 * `digits` significant digits at most: 4 shows a tolerance limit as 4,465 kΩ.
 */
export function formatOhms(ohms: number, digits = 3): string {
  if (ohms < 1) {
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(ohms)}\u00a0Ω`;
  }
  return formatSI(ohms, 'Ω', { digits });
}

/** "×100", "×1.000", "×0,1", "×1 M": what the multiplier band does. */
export function formatMultiplier(exponent: number): string {
  if (exponent >= 6)
    return `×${10 ** (exponent - 6 - (exponent >= 9 ? 3 : 0))} ${exponent >= 9 ? 'G' : 'M'}`;
  return `×${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(10 ** exponent)}`;
}

/** Whether the value is in a series (any decade). */
export function inSeries(ohms: number, series: readonly number[]): boolean {
  const exponent = Math.floor(Math.log10(ohms) + 1e-9);
  const mantissa = clean(ohms / 10 ** (exponent - 1));
  return series.includes(mantissa);
}

/** The colour names, capitalized for labels: "Vermelho". */
export function colorLabel(color: BandColor): string {
  return color[0]!.toUpperCase() + color.slice(1);
}

/** What one band means, for drawings and the game: "4", "×100", "±5 %". */
export function bandMeaning(bands: readonly BandColor[], index: number): string {
  const color = bands[index]!;
  if (index < bands.length - 2) return String(DIGIT_COLORS.indexOf(color));
  if (index === bands.length - 2) return formatMultiplier(MULTIPLIER_EXPONENT[color] ?? 0);
  return `±${formatSI(TOLERANCE_PERCENT[color] ?? 0, '%')}`;
}

/** One question of the game: a value from E12 (4 bands) or E24 (5 bands, 1 %). */
export interface Round {
  ohms: number;
  tolerance: number;
  bands: BandColor[];
}

/**
 * A random resistor between 1 Ω and 1 MΩ, the range found on most boards.
 * `random` returns numbers in [0, 1) (Math.random, or a seeded one in tests).
 */
export function randomRound(random: () => number): Round {
  const five = random() < 0.3;
  const series = five ? E24 : E12;
  const mantissa = series[Math.floor(random() * series.length)]!;
  // 10^-1 … 10^4 times the two-digit mantissa: 1 Ω … 910 kΩ.
  const exponent = Math.floor(random() * 6) - 1;
  const ohms = clean(mantissa * 10 ** exponent);
  const tolerance = five ? 1 : random() < 0.8 ? 5 : 10;
  return { ohms, tolerance, bands: encode(ohms, tolerance, five ? 5 : 4) };
}

/** The answer is right when it is within 0,5 % of the value. */
export function isRightAnswer(answer: number, ohms: number): boolean {
  return Math.abs(answer - ohms) <= ohms * 0.005;
}

export interface BandShape {
  x: number;
  width: number;
  color: BandColor;
}

/**
 * Where the bands go on a body `width` wide: the digits and the multiplier
 * evenly spaced from the left end, the tolerance band apart near the right
 * end, as on real resistors (that gap tells which side to read from).
 */
export function bandLayout(bands: readonly BandColor[], width: number): BandShape[] {
  const n = bands.length;
  const bandWidth = width * (n === 5 ? 0.075 : 0.09);
  const start = width * 0.14;
  const step = width * (n === 5 ? 0.13 : 0.16);
  return bands.map((color, i) => ({
    x: i === n - 1 ? width * 0.86 - bandWidth : start + i * step,
    width: bandWidth,
    color,
  }));
}
