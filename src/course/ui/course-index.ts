/** A lesson with a page, as CourseIndex.astro writes it (short keys keep the JSON small). */
export interface IndexLesson {
  /** id */
  i: string;
  /** "4.2" */
  n: string;
  /** title */
  t: string;
  /** module title */
  m: string;
  /** module id */
  mi: string;
  /** href */
  h: string;
}

/** Reads the JSON written by CourseIndex.astro. */
export function readCourseIndex(): IndexLesson[] {
  const el = document.getElementById('curso-indice');
  if (!el?.textContent) return [];
  try {
    return JSON.parse(el.textContent) as IndexLesson[];
  } catch {
    return [];
  }
}

/**
 * Where to continue: the last lesson opened if it is not done yet, otherwise
 * the next lesson after it that is not done.
 */
export function resumeTarget(
  index: readonly IndexLesson[],
  lastId: string | undefined,
  isRead: (id: string) => boolean,
): { lesson: IndexLesson; kind: 'continuar' | 'proxima' } | undefined {
  if (!lastId) return undefined;
  const at = index.findIndex((l) => l.i === lastId);
  if (at === -1) return undefined;
  const last = index[at]!;
  if (!isRead(last.i)) return { lesson: last, kind: 'continuar' };
  const next = index.slice(at + 1).find((l) => !isRead(l.i));
  return next ? { lesson: next, kind: 'proxima' } : undefined;
}
