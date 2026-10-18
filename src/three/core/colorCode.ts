/**
 * Resistor colour code (IEC 60062). Pure, unit-tested.
 * Colours are the paint pigments as they look on real resistors, in sRGB.
 */

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

export const DIGIT_COLORS: BandColor[] = [
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

/** Paint colours, slightly desaturated like real lacquer. */
export const BAND_RGB: Record<BandColor, string> = {
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

const TOLERANCE_COLORS: Record<number, BandColor> = {
  1: 'marrom',
  2: 'vermelho',
  0.5: 'verde',
  0.25: 'azul',
  0.1: 'violeta',
  5: 'dourado',
  10: 'prateado',
};

const MULTIPLIER_COLORS: Record<number, BandColor> = {
  [-2]: 'prateado',
  [-1]: 'dourado',
  0: 'preto',
  1: 'marrom',
  2: 'vermelho',
  3: 'laranja',
  4: 'amarelo',
  5: 'verde',
  6: 'azul',
  7: 'violeta',
  8: 'cinza',
  9: 'branco',
};

export interface ColorCode {
  bands: BandColor[];
  /** The value actually encoded (rounded to the number of significant digits). */
  ohms: number;
}

/**
 * Bands for a resistance. With 4 bands the value is rounded to 2 significant
 * digits; 5 bands use 3 (precision resistors, 1 % and below).
 */
export function resistorBands(ohms: number, tolerance = 5, bandCount: 4 | 5 = 4): ColorCode {
  const digits = bandCount === 5 ? 3 : 2;
  const value = Math.max(ohms, 0.01);
  let exponent = Math.floor(Math.log10(value)) - (digits - 1);
  let mantissa = Math.round(value / 10 ** exponent);
  if (mantissa >= 10 ** digits) {
    mantissa /= 10;
    exponent += 1;
  }
  exponent = Math.min(Math.max(exponent, -2), 9);
  const significant = String(mantissa).padStart(digits, '0').slice(0, digits);
  const bands = [...significant].map((d) => DIGIT_COLORS[Number(d)]!);
  bands.push(MULTIPLIER_COLORS[exponent]!);
  bands.push(TOLERANCE_COLORS[tolerance] ?? 'dourado');
  return { bands, ohms: Number(significant) * 10 ** exponent };
}

/** Body colour: beige carbon film (4 bands) or blue metal film (5 bands, 1 %). */
export function resistorBodyColor(bandCount: 4 | 5): string {
  return bandCount === 5 ? '#3f74a6' : '#c9ae84';
}
