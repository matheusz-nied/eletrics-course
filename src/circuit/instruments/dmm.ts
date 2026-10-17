/**
 * What a 3½-digit autoranging multimeter shows for a value: the digits, the
 * unit prefix and "OL" on overload. Pure, so it can be tested.
 */

export interface DmmReading {
  /** Characters for the 7-segment display, with "." for the decimal point. */
  digits: string;
  /** Unit with prefix: "mV", "A", "kΩ". */
  unit: string;
  overload: boolean;
}

const PREFIX: Record<number, string> = { [-6]: 'µ', [-3]: 'm', 0: '', 3: 'k', 6: 'M' };

/** Ranges 2·10ⁿ from 2 µ to 2000 (in the base unit). */
const RANGES = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3].map((n) => 2 * 10 ** n);

/** Lowest range of a common meter: 200 mV and 200 µA. */
const MIN_RANGE: Record<string, number> = { V: 0.2, A: 2e-4 };

/**
 * The value as the meter sees it: under half a count of the lowest range
 * (leakage of an open switch, solver residue) it reads zero.
 */
export function meterValue(value: number, unit: string): number {
  return Math.abs(value) < (MIN_RANGE[unit] ?? 2e-6) / 4000 ? 0 : value;
}

export function dmmReading(value: number, unit: string, maxRange = 2000): DmmReading {
  if (!Number.isFinite(value)) return { digits: ' OL', unit, overload: true };
  const abs = Math.abs(meterValue(value, unit));
  const minRange = MIN_RANGE[unit] ?? 2e-6;
  const ranges = RANGES.filter((r) => r >= minRange * 0.999 && r <= maxRange);
  // Zero reads on the 2-unit range, like an idle meter.
  const range = abs === 0 ? 2 : ranges.find((r) => abs < r * 0.99975);
  if (range === undefined) return { digits: '  OL', unit, overload: true };
  const n = Math.round(Math.log10(range / 2));
  const exp = 3 * Math.floor(n / 3);
  const decimals = 3 - (n - exp);
  const scaled = value / 10 ** exp;
  let text = Math.abs(scaled).toFixed(decimals);
  if (text.replace('.', '').replace(/^0+/, '').length > 4)
    text = Math.abs(scaled).toFixed(Math.max(0, decimals - 1));
  const sign = scaled < 0 && Number(text) !== 0 ? '-' : ' ';
  return { digits: sign + text, unit: `${PREFIX[exp] ?? ''}${unit}`, overload: false };
}

/** Mean (DC) and AC-coupled true RMS of a set of samples. */
export function dcAndRms(values: number[]): { mean: number; rms: number } {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return { mean: Number.NaN, rms: Number.NaN };
  const mean = finite.reduce((s, v) => s + v, 0) / finite.length;
  const variance = finite.reduce((s, v) => s + (v - mean) ** 2, 0) / finite.length;
  return { mean, rms: Math.sqrt(variance) };
}
