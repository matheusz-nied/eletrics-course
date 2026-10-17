/**
 * Number formatting for everything the student reads in simulations:
 * Brazilian decimal comma, thousands dot and SI prefixes ("4,7 kΩ", "2,55 mA").
 * The engine works in SI units; only the interface formats.
 */

const PREFIXES: [number, string][] = [
  [1e12, 'T'],
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
];

/** Units that read better without SI prefixes ("1.750 rpm", "85 %"). */
const PLAIN_UNITS = new Set(['%', '°C', '°', 'rpm', 'dB', 'Hz/s', 'x', '×']);

const formatters = new Map<string, Intl.NumberFormat>();

function numberFormat(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(options);
  let nf = formatters.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat('pt-BR', options);
    formatters.set(key, nf);
  }
  return nf;
}

/** Rounds to `digits` significant digits. */
export function roundSignificant(value: number, digits: number): number {
  if (value === 0 || !Number.isFinite(value)) return value;
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const factor = 10 ** (digits - 1 - magnitude);
  return Math.round(value * factor) / factor;
}

export interface FormatOptions {
  /** Significant digits (default 3). */
  digits?: number;
  /** Shows "+" for positive values (useful for signed readings). */
  signed?: boolean;
  /** Keeps trailing zeros ("2,50 V"), like an instrument display. */
  fixed?: boolean;
}

/**
 * `formatSI(0.00255, 'A')` → "2,55 mA"; `formatSI(4700, 'Ω')` → "4,7 kΩ";
 * `formatSI(1750, 'rpm')` → "1.750 rpm". Uses a non-breaking space before the unit.
 */
export function formatSI(value: number, unit = '', options: FormatOptions = {}): string {
  const { digits = 3, signed = false, fixed = false } = options;
  if (Number.isNaN(value)) return '—';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '−∞';
  const sep = unit ? ' ' : '';

  if (PLAIN_UNITS.has(unit)) {
    const abs = Math.abs(value);
    const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
    const text = numberFormat({
      maximumFractionDigits: decimals,
      minimumFractionDigits: fixed ? decimals : 0,
    }).format(value);
    return withSign(text, value, signed) + sep + unit;
  }

  if (value === 0) return `0${sep}${unit}`;

  const rounded = roundSignificant(value, digits);
  const abs = Math.abs(rounded);
  let [scale, prefix] = PREFIXES[PREFIXES.length - 1]!;
  for (const [s, p] of PREFIXES) {
    if (abs >= s) {
      [scale, prefix] = [s, p];
      break;
    }
  }
  const mantissa = rounded / scale;
  const intDigits = Math.max(1, Math.floor(Math.log10(Math.abs(mantissa))) + 1);
  const decimals = Math.max(0, digits - intDigits);
  const text = numberFormat({
    maximumFractionDigits: decimals,
    minimumFractionDigits: fixed ? decimals : 0,
  }).format(mantissa);
  return withSign(text, value, signed) + sep + prefix + unit;
}

function withSign(text: string, value: number, signed: boolean): string {
  // Intl uses U+2212 for negatives in some engines and "-" in others; normalize to "−".
  const normalized = text.replace('-', '−');
  return signed && value > 0 ? `+${normalized}` : normalized;
}

/** Plain pt-BR number with up to `maxDecimals` decimals: 1234.5 → "1.234,5". */
export function formatNumber(value: number, maxDecimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return withSign(numberFormat({ maximumFractionDigits: maxDecimals }).format(value), value, false);
}

/** Simulated time: "0 s", "12,5 ms", "1,25 s", "2 min 05 s". */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds >= 60) {
    const min = Math.floor(seconds / 60);
    const s = Math.floor(seconds - min * 60);
    return `${min}\u00a0min ${String(s).padStart(2, '0')}\u00a0s`;
  }
  return formatSI(seconds, 's', { digits: 3 });
}

/** Simulation speed factor: 1 → "1×", 0.01 → "0,01×". */
export function formatSpeed(factor: number): string {
  return `${formatNumber(factor, 3)}×`;
}

const SI_SUFFIX: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  µ: 1e-6,
  μ: 1e-6,
  m: 1e-3,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
};

/**
 * Parses what a student types in a value field: "4,7k", "4.7 kΩ", "100u",
 * "1.000", "0,5". Returns NaN when it is not a number.
 * A single dot followed by exactly three digits is read as a thousands separator
 * ("1.000" = 1000), as Brazilians write it; otherwise the dot is a decimal point.
 */
export function parseSI(input: string, unit = ''): number {
  let text = input.trim().replace(/\s+/g, '').replace('−', '-');
  if (unit && text.endsWith(unit)) text = text.slice(0, -unit.length);
  text = text.replace(/(Ω|ohm|ohms|V|A|W|F|H|Hz|s)$/i, '');
  let multiplier = 1;
  const last = text.at(-1);
  if (last && last in SI_SUFFIX && !/^[-+]?\d*[.,]?\d*e$/i.test(text)) {
    multiplier = SI_SUFFIX[last]!;
    text = text.slice(0, -1);
  }
  if (text.includes(',')) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (/^[-+]?\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '');
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(text)) return Number.NaN;
  return Number(text) * multiplier;
}
