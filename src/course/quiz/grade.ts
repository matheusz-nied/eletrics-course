/**
 * Quiz rules without UI, unit-tested in grade.test.ts: the question types,
 * the checks run at build time, the order shown to the student (shuffled
 * the same way on the server and in the browser) and the grading, including
 * numbers typed the Brazilian way ("0,5", "1.000", "4k7", "470 mA").
 */

interface Base {
  prompt: string;
  /** Shown after answering, right or wrong. */
  explanation?: string;
}

export type QuizQuestion =
  | (Base & {
      type: 'multipla';
      /** With more than one `correct`, the student marks all of them. */
      options: { text: string; correct?: boolean; feedback?: string }[];
      /** Shuffle the options (default true). Use false for "todas as anteriores". */
      shuffle?: boolean;
    })
  | (Base & {
      type: 'numerica';
      /** In `unit`: `answer: 20, unit: 'mA'` is 20 mA. */
      answer: number;
      /**
       * Relative margin accepted: 0.02 is ±2 % of the answer (default 0.01).
       * When the answer is 0 it is an absolute margin, in `unit`.
       */
      tolerance?: number;
      /** "A", "mA", "kΩ", "V", "W"… The student may type another prefix ("0,02 A"). */
      unit?: string;
    })
  | (Base & { type: 'vf'; answer: boolean })
  | (Base & {
      type: 'ordenar';
      /** In the right order; the student sees them shuffled. */
      items: string[];
    })
  | (Base & {
      type: 'associar';
      /** [left, right] pairs; the right column is shuffled. */
      pairs: [string, string][];
    });

export const DEFAULT_TOLERANCE = 0.01;

// Build-time checks

/** Problems in the questions, in pt-BR, for the build error. */
export function checkQuestions(questions: readonly QuizQuestion[]): string[] {
  const errors: string[] = [];
  if (questions.length === 0) errors.push('o quiz não tem questões.');
  questions.forEach((q, i) => {
    const at = `questão ${i + 1} (${q.type})`;
    if (!q.prompt?.trim()) errors.push(`${at}: falta o enunciado (prompt).`);
    switch (q.type) {
      case 'multipla':
        if (q.options.length < 2) errors.push(`${at}: precisa de pelo menos 2 alternativas.`);
        if (!q.options.some((o) => o.correct))
          errors.push(`${at}: nenhuma alternativa tem correct: true.`);
        break;
      case 'numerica':
        if (!Number.isFinite(q.answer)) errors.push(`${at}: answer precisa ser um número.`);
        if (q.tolerance !== undefined && !(q.tolerance >= 0)) {
          errors.push(`${at}: tolerance precisa ser zero ou positiva (0.02 = ±2 %).`);
        }
        break;
      case 'vf':
        if (typeof q.answer !== 'boolean') errors.push(`${at}: answer precisa ser true ou false.`);
        break;
      case 'ordenar':
        if (q.items.length < 2) errors.push(`${at}: precisa de pelo menos 2 itens.`);
        if (new Set(q.items).size !== q.items.length) errors.push(`${at}: há itens repetidos.`);
        break;
      case 'associar':
        if (q.pairs.length < 2) errors.push(`${at}: precisa de pelo menos 2 pares.`);
        if (new Set(q.pairs.map((p) => p[0])).size !== q.pairs.length) {
          errors.push(`${at}: há itens repetidos na coluna da esquerda.`);
        }
        break;
      default:
        errors.push(`questão ${i + 1}: tipo desconhecido "${(q as { type: string }).type}".`);
    }
  });
  return errors;
}

// Deterministic order

/** FNV-1a, 32 bits. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Identifies a quiz in the saved progress: the same questions give the same key. */
export function quizKey(questions: readonly QuizQuestion[]): string {
  return `q${hash(questions.map((q) => `${q.type}:${q.prompt}`).join('|')).toString(36)}`;
}

function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The indexes 0…n-1 shuffled by `seed`. With `notIdentity`, never the
 * original order (for "put in order" questions).
 */
export function shuffledOrder(n: number, seed: number, notIdentity = false): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  const next = random(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  if (notIdentity && n > 1 && order.every((v, i) => v === i)) order.push(order.shift()!);
  return order;
}

// Numbers

const PREFIXES: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  m: 1e-3,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
};

/** Unit symbols that take SI prefixes, longest first. */
const SYMBOLS = ['VAr', 'Wh', 'Ah', 'VA', 'Hz', 'Ω', 'A', 'V', 'W', 'F', 'H', 'J', 'C', 's'];

function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[µμ]/g, 'u')
    .replace(/[−–]/g, '-')
    .replace(/ohms?/gi, 'Ω')
    .replace(/\s+/g, '');
}

/** "kΩ" → { symbol: "Ω", factor: 1000 }; undefined for units without prefixes ("%", "°C"). */
export function splitUnit(unit: string): { symbol: string; factor: number } | undefined {
  const u = normalize(unit);
  for (const symbol of SYMBOLS) {
    if (!u.endsWith(symbol)) continue;
    const prefix = u.slice(0, -symbol.length);
    if (prefix === '') return { symbol, factor: 1 };
    const factor = PREFIXES[prefix];
    if (factor !== undefined) return { symbol, factor };
  }
  return undefined;
}

/** A plain number with comma or dot decimals and dot thousands: "1.234,5", "0.5", "2,2e3". */
export function parsePlain(text: string): number | undefined {
  const s = text.replace(/[x×*·]10\^?([+-]?\d+)$/i, 'e$1');
  const m = /^([+-]?)([\d.,]+)(?:e([+-]?\d+))?$/i.exec(s);
  if (!m) return undefined;
  const [, sign = '', raw = '', exp = '0'] = m;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  let digits: string;
  if (comma >= 0 && dot >= 0) {
    const [dec, thousands] = comma > dot ? [',', '.'] : ['.', ','];
    const [int = '', frac, extra] = raw.split(dec);
    if (extra !== undefined) return undefined;
    const groups = new RegExp(`^\\d{1,3}(\\${thousands}\\d{3})*$`);
    if (!groups.test(int)) return undefined;
    digits = `${int.split(thousands).join('')}.${frac}`;
  } else if (comma >= 0 || dot >= 0) {
    const sep = comma >= 0 ? ',' : '.';
    const parts = raw.split(sep);
    // Several separators, or "1.000" with a dot: thousands groups.
    const grouped = parts.length > 2 || (sep === '.' && /^\d{1,3}(\.\d{3})+$/.test(raw));
    if (grouped) {
      if (!new RegExp(`^\\d{1,3}(\\${sep}\\d{3})+$`).test(raw)) return undefined;
      digits = parts.join('');
    } else {
      digits = parts.join('.');
    }
  } else {
    digits = raw;
  }
  if (!/\d/.test(digits)) return undefined;
  const value = Number(`${sign}${digits.startsWith('.') ? `0${digits}` : digits}e${exp}`);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * What the student typed, in the question's unit. Without a prefix or symbol
 * the number is taken as already in that unit ("20" with unit mA is 20 mA);
 * "0,02 A", "20m" or "20 mA" are converted. Undefined when it isn't a number.
 */
export function parseAnswer(input: string, unit?: string): number | undefined {
  let s = normalize(input);
  if (!s) return undefined;
  const target = unit ? splitUnit(unit) : undefined;

  if (unit && !target) {
    const u = normalize(unit);
    if (u && s.toLowerCase().endsWith(u.toLowerCase())) s = s.slice(0, -u.length);
    return parsePlain(s);
  }

  let explicit = false;
  if (target) {
    if (s.toLowerCase().endsWith(target.symbol.toLowerCase())) {
      s = s.slice(0, -target.symbol.length);
      explicit = true;
    } else if (target.symbol === 'Ω' && /\dR$/.test(s)) {
      s = s.slice(0, -1);
      explicit = true;
    }
  }

  let value: number | undefined;
  // "4k7", "2M2", "4R7": the letter is the decimal point and the prefix.
  const infix = /^([+-]?\d+)([pnumkKMGR])(\d+)$/.exec(s);
  if (infix) {
    const [, int, letter = 'R', frac] = infix;
    value = Number(`${int}.${frac}`) * (letter === 'R' ? 1 : (PREFIXES[letter] ?? 1));
    explicit = true;
  } else {
    const prefixed = /^(.*\d)([pnumkKMG])$/.exec(s);
    const factor = prefixed ? (PREFIXES[prefixed[2] ?? ''] ?? 1) : 1;
    const plain = parsePlain(prefixed ? (prefixed[1] ?? '') : s);
    if (plain === undefined) return undefined;
    value = plain * factor;
    if (prefixed) explicit = true;
  }

  if (!target || !explicit) return value;
  return value / target.factor;
}

export function isClose(value: number, answer: number, tolerance = DEFAULT_TOLERANCE): boolean {
  const margin = answer === 0 ? tolerance : Math.abs(answer) * tolerance;
  return Math.abs(value - answer) <= margin + Math.abs(answer) * 1e-12;
}

const numberFormat = new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 6 });

/** "0,5 A", "1.000 W" */
export function formatQuantity(value: number, unit?: string): string {
  const n = numberFormat.format(value);
  return unit ? `${n} ${unit}` : n;
}

// Grading

/** Multiple choice: right when exactly the correct options are marked. */
export function gradeChoice(
  options: readonly { correct?: boolean | undefined }[],
  selected: readonly number[],
): boolean {
  const chosen = new Set(selected);
  return options.every((o, i) => Boolean(o.correct) === chosen.has(i));
}

/** Put in order: `order` lists the original indexes in the order the student left them. */
export function gradeOrder(order: readonly number[]): boolean {
  return order.length > 0 && order.every((v, i) => v === i);
}

/** Matching: `choices[i]` is the pair index whose right side the student gave to left `i`. */
export function gradeMatch(
  pairs: readonly (readonly [string, string])[],
  choices: readonly (number | undefined)[],
): boolean[] {
  return pairs.map((pair, i) => {
    const choice = choices[i];
    return choice !== undefined && pairs[choice]?.[1] === pair[1];
  });
}
