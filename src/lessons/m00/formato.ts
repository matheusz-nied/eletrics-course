/**
 * pt-BR number formatting for the interactive figures of the lessons
 * ("85 mA", "4,7 kΩ", "1.000 W"). Pure, unit-tested in formato.test.ts.
 */

const PREFIXES: [number, string][] = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
];

const formatters = new Map<string, Intl.NumberFormat>();
function formatter(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(options);
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', options);
    formatters.set(key, f);
  }
  return f;
}

/** Non-breaking space between a number and its unit. */
export const NBSP = ' ';

/** `formatSI(0.085, 'A')` → "85 mA"; `formatSI(4700, 'Ω')` → "4,7 kΩ". */
export function formatSI(value: number, unit: string, digits = 3): string {
  if (!Number.isFinite(value)) return `${value > 0 ? '∞' : '−∞'}${NBSP}${unit}`;
  const abs = Math.abs(value);
  if (abs === 0) return `0${NBSP}${unit}`;
  let [scale, prefix] = PREFIXES[PREFIXES.length - 1]!;
  for (const [s, p] of PREFIXES) {
    // Round first, so 999,96 mA reads as "1 A" and not "1.000 mA".
    if (Number((abs / s).toPrecision(digits)) >= 1) {
      scale = s;
      prefix = p;
      break;
    }
  }
  const text = formatter({ maximumSignificantDigits: digits }).format(value / scale);
  return `${text.replace('-', '−')}${NBSP}${prefix}${unit}`;
}

/** `formatNumber(1500.5, 1)` → "1.500,5" (at most `decimals` decimal places). */
export function formatNumber(value: number, decimals = 2): string {
  return formatter({ maximumFractionDigits: decimals }).format(value).replace('-', '−');
}

/** `formatMoney(66.0)` → "R$ 66,00". */
export function formatMoney(value: number): string {
  return formatter({ style: 'currency', currency: 'BRL' }).format(value).replace(/\s/, NBSP);
}
