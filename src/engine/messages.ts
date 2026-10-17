/**
 * pt-BR number formatting for the event messages the engine emits
 * ("O fusível F1 rompeu: corrente de 25 A, nominal 10 A"). The interface has
 * its own formatting for readouts; this one only serves messages.
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

const formatters = new Map<number, Intl.NumberFormat>();
function formatter(digits: number): Intl.NumberFormat {
  let f = formatters.get(digits);
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: digits });
    formatters.set(digits, f);
  }
  return f;
}

/** `formatSI(0.085, 'A')` → "85 mA"; `formatSI(4700, 'Ω')` → "4,7 kΩ". */
export function formatSI(value: number, unit: string, digits = 3): string {
  if (!Number.isFinite(value)) return `${value > 0 ? '∞' : '−∞'} ${unit}`;
  const abs = Math.abs(value);
  if (abs === 0) return `0 ${unit}`;
  let [scale, prefix] = PREFIXES[PREFIXES.length - 1];
  for (const [s, p] of PREFIXES) {
    // Round first so 999,96 mA reads as "1 A" and not "1.000 mA".
    if (Number((abs / s).toPrecision(digits)) >= 1) {
      scale = s;
      prefix = p;
      break;
    }
  }
  return `${formatter(digits).format(value / scale)} ${prefix}${unit}`;
}

/** Plain pt-BR number: `formatNumber(1.5)` → "1,5". */
export function formatNumber(value: number, digits = 3): string {
  return formatter(digits).format(value);
}
