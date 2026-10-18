/**
 * Brazilian number formatting for labels and descriptions of 3D parts:
 * `4,7 kΩ`, `100 µF`, `1/4 W`. Pure functions, unit-tested.
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

/** Number with a decimal comma and up to `digits` significant digits: `4,7`, `1.000`. */
export function formatNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const rounded = Number(value.toPrecision(digits));
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 }).format(rounded);
}

/** Value with an SI prefix: `formatSI(4700, 'Ω')` → `4,7 kΩ`; `formatSI(1e-4, 'F')` → `100 µF`. */
export function formatSI(value: number, unit: string, digits = 3): string {
  if (!Number.isFinite(value)) return `— ${unit}`;
  if (value === 0) return `0 ${unit}`;
  const abs = Math.abs(value);
  const [factor, prefix] =
    PREFIXES.find(([f]) => abs >= f * 0.9995) ?? PREFIXES[PREFIXES.length - 1]!;
  return `${formatNumber(value / factor, digits)} ${prefix}${unit}`;
}

export const formatOhms = (ohms: number) => formatSI(ohms, 'Ω');
export const formatFarads = (farads: number) => formatSI(farads, 'F');

/** Power ratings as printed in catalogues: `1/4 W`, `1/2 W`, `1 W`, `5 W`. */
export function formatWatts(watts: number): string {
  const fractions: [number, string][] = [
    [0.125, '1/8'],
    [0.25, '1/4'],
    [0.5, '1/2'],
  ];
  const fraction = fractions.find(([v]) => Math.abs(v - watts) < 1e-6);
  return fraction ? `${fraction[1]} W` : `${formatNumber(watts)} W`;
}

/**
 * Resistance code printed on SMD resistors: 3 digits (5 %) or 4 digits (1 %),
 * with `R` as the decimal point below 10 Ω. `4700` → `472` / `4701`.
 */
export function smdResistorCode(ohms: number, precise = false): string {
  const significant = precise ? 3 : 2;
  if (ohms < 10) {
    const text = ohms.toFixed(significant - 1).replace('.', 'R');
    return text.replace(/^0R/, 'R');
  }
  const exponent = Math.floor(Math.log10(ohms)) - (significant - 1);
  const digits = Math.round(ohms / 10 ** exponent);
  return `${digits}${Math.max(exponent, 0)}`;
}

/**
 * Capacitance code printed on ceramic and film capacitors, in pF:
 * `100 nF` → `104`, `4,7 nF` → `472`, `22 pF` → `22`.
 */
export function capacitorCode(farads: number): string {
  const pf = Math.round(farads * 1e12 * 1000) / 1000;
  if (pf < 100) return formatNumber(pf, 2).replace(',', 'R');
  const exponent = Math.floor(Math.log10(pf)) - 1;
  const digits = Math.round(pf / 10 ** exponent);
  return `${digits}${exponent}`;
}

/** `100 µF` with a µ prefix as on electrolytic sleeves: `100µF`. */
export function compactFarads(farads: number): string {
  return formatFarads(farads).replace(' ', '');
}
