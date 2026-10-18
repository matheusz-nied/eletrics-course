/**
 * Lesson 1.6 (units and orders of magnitude): SI prefixes, scientific and
 * engineering notation, and the value codes printed on resistors and
 * ceramic capacitors. Used by ConversorUnidades.tsx; pure, unit-tested in
 * unidades.test.ts.
 */

export interface Prefix {
  symbol: string;
  name: string;
  exponent: number;
}

/** From the largest to the smallest, one step = 1.000 times. */
export const PREFIXES: Prefix[] = [
  { symbol: 'G', name: 'giga', exponent: 9 },
  { symbol: 'M', name: 'mega', exponent: 6 },
  { symbol: 'k', name: 'quilo', exponent: 3 },
  { symbol: '', name: 'sem prefixo', exponent: 0 },
  { symbol: 'm', name: 'mili', exponent: -3 },
  { symbol: 'µ', name: 'micro', exponent: -6 },
  { symbol: 'n', name: 'nano', exponent: -9 },
  { symbol: 'p', name: 'pico', exponent: -12 },
];

const SIGNIFICANT = 6;

/** Removes floating-point noise: 4.7 × 1000 is 4700, not 4700.000000000001. */
export function clean(value: number, digits = 12): number {
  return value === 0 ? 0 : Number(value.toPrecision(digits));
}

/** The value in base units from a number and a prefix symbol. */
export function toBase(value: number, prefix: string): number {
  const p = PREFIXES.find((x) => x.symbol === prefix);
  return clean(value * 10 ** (p?.exponent ?? 0));
}

/** The base value written with another prefix: `inPrefix(4700, 'k')` → 4.7. */
export function inPrefix(base: number, prefix: string): number {
  const p = PREFIXES.find((x) => x.symbol === prefix);
  return clean(base / 10 ** (p?.exponent ?? 0));
}

/** Mantissa between 1 and 10 and the power of ten: 4700 → { 4.7, 3 }. */
export function scientific(value: number, digits = 4): { mantissa: number; exponent: number } {
  if (value === 0 || !Number.isFinite(value)) return { mantissa: value, exponent: 0 };
  let exponent = Math.floor(Math.log10(Math.abs(value)));
  let mantissa = Number((value / 10 ** exponent).toPrecision(digits));
  // Rounding can give 10: 9,9999 × 10² reads as 1 × 10³.
  if (Math.abs(mantissa) >= 10) {
    mantissa = Number((mantissa / 10).toPrecision(digits));
    exponent += 1;
  }
  return { mantissa, exponent };
}

/** Like `scientific`, with the exponent a multiple of 3, the one the prefixes use. */
export function engineering(value: number, digits = 4): { mantissa: number; exponent: number } {
  const { mantissa, exponent } = scientific(value, digits);
  const eng = Math.floor(exponent / 3) * 3;
  return { mantissa: clean(mantissa * 10 ** (exponent - eng), digits), exponent: eng };
}

/** The prefix whose number falls between 1 and 999: 0.0255 A → "m" (25,5 mA). */
export function bestPrefix(value: number): Prefix {
  const { exponent } = engineering(value);
  const p = PREFIXES.find((x) => x.exponent === exponent);
  if (p) return p;
  return exponent > 9 ? PREFIXES[0]! : PREFIXES[PREFIXES.length - 1]!;
}

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

export function superscript(n: number): string {
  return String(n)
    .split('')
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join('');
}

const plainFormat = new Intl.NumberFormat('pt-BR', {
  maximumSignificantDigits: SIGNIFICANT,
  maximumFractionDigits: 20,
});

/** Every digit, the Brazilian way: 0.0000047 → "0,0000047", 4.7e9 → "4.700.000.000". */
export function formatPlain(value: number): string {
  return plainFormat.format(value).replace('-', '−');
}

const mantissaFormat = new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 4 });

/** "4,7 × 10³"; between 1 and 10 just the number. */
export function formatScientific(value: number): string {
  const { mantissa, exponent } = scientific(value);
  const m = mantissaFormat.format(mantissa).replace('-', '−');
  return exponent === 0 ? m : `${m} × 10${superscript(exponent)}`;
}

/** What a calculator shows: a dot for the decimals and E for "times ten to the": "4.7E3". */
export function formatCalculator(value: number): string {
  const { mantissa, exponent } = scientific(value);
  return exponent === 0 ? String(mantissa) : `${mantissa}E${exponent}`;
}

export type MarkingKind = 'resistor' | 'capacitor';

export interface Decoded {
  /** In ohms or farads. */
  value: number;
  unit: 'Ω' | 'F';
  /** How the code was read, in pt-BR. */
  steps: string;
  /** Tolerance letter of a capacitor code (J, K, M), if any. */
  tolerance?: string;
}

const TOLERANCES: Record<string, string> = { J: '±5 %', K: '±10 %', M: '±20 %' };

const LETTER_FACTOR: Record<string, number> = {
  R: 1,
  K: 1e3,
  M: 1e6,
  G: 1e9,
  P: 1e-12,
  N: 1e-9,
  U: 1e-6,
  µ: 1e-6,
};

/**
 * Reads the value printed on a resistor or a ceramic capacitor.
 * Resistors: "4K7" (the letter is the comma and the prefix), "2R2", "R47",
 * or the SMD digits "472" (47 × 10²) and "4702" (470 × 10²).
 * Capacitors: "104" (10 × 10⁴ pF), "22" (22 pF), "4n7", with an optional
 * tolerance letter at the end ("104K").
 */
export function decodeMarking(text: string, kind: MarkingKind): Decoded | undefined {
  const s = text.trim().toUpperCase().replace(/\s+/g, '').replace('Μ', 'µ');
  if (!s) return undefined;
  const unit = kind === 'resistor' ? 'Ω' : 'F';
  const base = kind === 'resistor' ? 1 : 1e-12;
  const baseName = kind === 'resistor' ? 'Ω' : 'pF';

  // Letter in place of the comma: 4K7, 2R2, R47, 4N7, 2U2.
  const letters = kind === 'resistor' ? 'RKMG' : 'PNUµ';
  const infix = new RegExp(`^(\\d*)([${letters}])(\\d*)$`).exec(s);
  if (infix && (infix[1] || infix[3])) {
    const [, int = '', letter = 'R', frac = ''] = infix;
    const number = Number(`${int || '0'}.${frac || '0'}`);
    const factor = LETTER_FACTOR[letter] ?? 1;
    const value = clean(number * factor);
    const readable = formatPlain(number);
    return {
      value,
      unit,
      steps: `A letra ${letter === 'µ' ? 'µ' : letter} faz o papel da vírgula e do prefixo: ${int || '0'}${letter}${frac} = ${readable} ${prefixOfLetter(letter, unit)}.`,
    };
  }

  // Digits with an optional tolerance letter (capacitors only).
  const digits = /^(\d{2,4})([JKM])?$/.exec(s);
  if (!digits) return undefined;
  const [, code = '', tol] = digits;
  if (tol && kind === 'resistor') return undefined;
  const tolerance = tol ? TOLERANCES[tol] : undefined;

  if (code.length === 2) {
    if (kind === 'resistor') return undefined;
    const value = clean(Number(code) * base);
    return {
      value,
      unit,
      steps: `Dois algarismos: o valor já está em picofarads, ${code} pF.`,
      tolerance,
    };
  }

  const significant = code.slice(0, -1);
  const zeros = Number(code.slice(-1));
  if (kind === 'capacitor' && code.length !== 3) return undefined;
  const number = Number(significant) * 10 ** zeros;
  const value = clean(number * base);
  return {
    value,
    unit,
    steps: `Os primeiros algarismos são o número (${significant}) e o último diz quantos zeros acrescentar (${zeros}): ${significant} × 10${superscript(zeros)} = ${formatPlain(number)} ${baseName}.`,
    tolerance,
  };
}

function prefixOfLetter(letter: string, unit: 'Ω' | 'F'): string {
  const prefix: Record<string, string> = {
    R: '',
    K: 'k',
    M: 'M',
    G: 'G',
    P: 'p',
    N: 'n',
    U: 'µ',
    µ: 'µ',
  };
  return `${prefix[letter] ?? ''}${unit}`;
}
