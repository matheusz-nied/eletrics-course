/**
 * Voltage colour scale of the schematic: blue (negative) ↔ grey (0 V) ↔ red
 * (positive). Blue/red stays distinguishable for the common colour-vision
 * deficiencies, and node voltage labels give a non-colour alternative.
 */

type RGB = [number, number, number];

const LIGHT = {
  neg: [37, 99, 235] as RGB,
  zero: [134, 144, 160] as RGB,
  pos: [220, 38, 38] as RGB,
};
const DARK = {
  neg: [96, 165, 250] as RGB,
  zero: [118, 128, 145] as RGB,
  pos: [248, 113, 113] as RGB,
};

const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/** Position on the scale, -1…1, with a mild curve so small voltages still show. */
export function voltageScale(v: number, vmax: number): number {
  if (!Number.isFinite(v) || vmax <= 0) return 0;
  const r = Math.min(1, Math.abs(v) / vmax);
  return Math.sign(v) * r ** 0.65;
}

export function voltageColor(v: number, vmax: number, dark = false): string {
  const p = dark ? DARK : LIGHT;
  const s = voltageScale(v, vmax);
  const c = s >= 0 ? mix(p.zero, p.pos, s) : mix(p.zero, p.neg, -s);
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

/** CSS gradient stops for the legend. */
export function legendGradient(dark = false): string {
  const stops = [-1, -0.5, 0, 0.5, 1].map((s) => voltageColor(s, 1, dark));
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/** Colours of the two oscilloscope channels and of chart series. */
export const SERIES_COLORS = ['#e8b400', '#00a3c4', '#d0457e', '#4f8f2f', '#8a63d2', '#e06c1f'];
