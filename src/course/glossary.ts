/** Glossary helpers: pt-BR ordering and alphabetical groups. Pure, unit-tested. */

export interface TermLike {
  id: string;
  data: { termo: string; sinonimos: string[] };
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

export function sortTerms<T extends TermLike>(terms: readonly T[]): T[] {
  return [...terms].sort((a, b) => collator.compare(a.data.termo, b.data.termo));
}

/** "Átomo" → "A", "ímã" → "I", "5×20" → "#" */
export function initial(text: string): string {
  const letter = text.trim().normalize('NFD').replace(/\p{M}/gu, '').charAt(0).toUpperCase();
  return /[A-Z]/.test(letter) ? letter : '#';
}

/** Terms grouped by initial letter, in alphabetical order. */
export function groupByInitial<T extends TermLike>(
  terms: readonly T[],
): { letter: string; terms: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const term of sortTerms(terms)) {
    const letter = initial(term.data.termo);
    groups.set(letter, [...(groups.get(letter) ?? []), term]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
    .map(([letter, list]) => ({ letter, terms: list }));
}

/** Lowercase, accent-free text for client-side filtering. */
export function searchable(...texts: string[]): string {
  return texts.join(' ').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export interface TermRefs {
  id: string;
  data: { relacionados: string[]; aula?: string | undefined };
}

/**
 * Broken references between glossary terms and lessons, as pt-BR messages.
 * `lessonIds` are the lessons of the catalog (published or planned).
 */
export function checkTerms(terms: readonly TermRefs[], lessonIds: ReadonlySet<string>): string[] {
  const ids = new Set(terms.map((t) => t.id));
  const errors: string[] = [];
  for (const term of terms) {
    for (const rel of term.data.relacionados) {
      if (!ids.has(rel)) {
        errors.push(`Termo "${term.id}": o termo relacionado "${rel}" não existe no glossário.`);
      }
    }
    if (term.data.aula && !lessonIds.has(term.data.aula)) {
      errors.push(
        `Termo "${term.id}": a aula "${term.data.aula}" não existe (nem publicada nem no plano).`,
      );
    }
  }
  return errors;
}
