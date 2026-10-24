/**
 * Errors and warnings of the microcontroller simulator, with the student's
 * line and column (1-based). Messages are pt-BR and written for beginners:
 * what is wrong, then how to fix it.
 */

export type Severity = 'erro' | 'aviso';

export interface Diagnostic {
  severity: Severity;
  message: string;
  line: number;
  col: number;
}

/**
 * A run-time warning: `key` identifies it (the controller shows each key
 * once), `line` is the program line (0 when it has none).
 */
export type WarnFn = (key: string, line: number, message: string) => void;

/** A compile or run-time error that stops the program. */
export class ProgramError extends Error {
  constructor(
    message: string,
    readonly line: number,
    readonly col: number,
  ) {
    super(message);
    this.name = 'ProgramError';
  }

  toDiagnostic(): Diagnostic {
    return { severity: 'erro', message: this.message, line: this.line, col: this.col };
  }
}

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]!;
      prev[j] = Math.min(up + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length]!;
}

/**
 * The known name the student probably meant: same letters in another case
 * ("digitalwrite"), or a typo of one or two letters in a longer name.
 */
export function suggest(name: string, candidates: Iterable<string>): string | undefined {
  const lower = name.toLowerCase();
  let best: string | undefined;
  let bestScore = Infinity;
  for (const c of candidates) {
    if (c === name) continue;
    if (c.toLowerCase() === lower) return c;
    if (name.length < 4) continue;
    const d = distance(lower, c.toLowerCase());
    const limit = name.length >= 8 ? 2 : 1;
    if (d <= limit && d < bestScore) {
      best = c;
      bestScore = d;
    }
  }
  return best;
}

/** " Você quis dizer 'x'?" or "". */
export function didYouMean(name: string, candidates: Iterable<string>): string {
  const s = suggest(name, candidates);
  return s ? ` Você quis dizer '${s}'?` : '';
}
