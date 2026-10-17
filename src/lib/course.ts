/**
 * Course structure helpers: ordering, visibility and neighbours of modules and
 * lessons. Pure functions over collection entries, so they are unit-tested
 * without Astro (src/lib/course.test.ts). src/lib/content.ts feeds them.
 */

export interface ModuleEntry {
  id: string;
  data: { id: string; numero: number; parte: number; titulo: string };
}

export interface LessonEntry {
  id: string;
  data: { modulo: string; ordem: number; titulo: string; rascunho: boolean; duracaoMin: number };
}

/** `m08-motores/04-motor-monofasico-capacitor` → module and lesson URL segments. */
export function splitLessonId(id: string): { modulo: string; aula: string } {
  const slash = id.indexOf('/');
  if (slash < 1 || slash === id.length - 1 || id.indexOf('/', slash + 1) !== -1) {
    throw new Error(`Id de aula inválido: "${id}". O formato é "mNN-modulo/NN-aula".`);
  }
  return { modulo: id.slice(0, slash), aula: id.slice(slash + 1) };
}

export function sortModules<M extends ModuleEntry>(modules: readonly M[]): M[] {
  return [...modules].sort((a, b) => a.data.numero - b.data.numero || a.id.localeCompare(b.id));
}

/** Course order: module number, then lesson `ordem`. */
export function sortLessons<L extends LessonEntry>(
  lessons: readonly L[],
  modules: readonly ModuleEntry[],
): L[] {
  const numero = new Map(modules.map((m) => [m.id, m.data.numero]));
  const moduleNumber = (l: L) => numero.get(l.data.modulo) ?? Number.MAX_SAFE_INTEGER;
  return [...lessons].sort(
    (a, b) =>
      moduleNumber(a) - moduleNumber(b) || a.data.ordem - b.data.ordem || a.id.localeCompare(b.id),
  );
}

/** Drafts are listed only when `includeDrafts` (the dev server). */
export function listedLessons<L extends LessonEntry>(
  lessons: readonly L[],
  includeDrafts: boolean,
): L[] {
  return includeDrafts ? [...lessons] : lessons.filter((l) => !l.data.rascunho);
}

/** Previous and next items of an ordered list. A missing id has no neighbours. */
export function neighbors<T extends { id: string }>(
  ordered: readonly T[],
  id: string,
): { prev: T | undefined; next: T | undefined } {
  const i = ordered.findIndex((item) => item.id === id);
  if (i === -1) return { prev: undefined, next: undefined };
  return { prev: ordered[i - 1], next: ordered[i + 1] };
}

export function totalMinutes(lessons: readonly LessonEntry[]): number {
  return lessons.reduce((sum, l) => sum + l.data.duracaoMin, 0);
}

/**
 * Consistency rules the schemas cannot express alone. Returns pt-BR messages
 * for the author; the build fails when the list is not empty.
 */
export function checkCourse(
  modules: readonly ModuleEntry[],
  lessons: readonly LessonEntry[],
): string[] {
  const errors: string[] = [];
  const moduleIds = new Set(modules.map((m) => m.id));
  const numbers = new Map<number, string>();

  for (const m of modules) {
    if (m.data.id !== m.id) {
      errors.push(
        `Módulo "${m.id}": o campo id ("${m.data.id}") deve ser igual ao nome do arquivo (${m.id}.yaml).`,
      );
    }
    const other = numbers.get(m.data.numero);
    if (other) {
      errors.push(`Módulos "${other}" e "${m.id}" usam o mesmo número (${m.data.numero}).`);
    }
    numbers.set(m.data.numero, m.id);
    if (!m.id.startsWith(`m${String(m.data.numero).padStart(2, '0')}-`)) {
      errors.push(
        `Módulo "${m.id}": o número ${m.data.numero} não bate com o prefixo do id (mNN-).`,
      );
    }
  }

  const orders = new Map<string, string>();
  for (const l of lessons) {
    let folder: string;
    try {
      folder = splitLessonId(l.id).modulo;
    } catch (e) {
      errors.push((e as Error).message);
      continue;
    }
    if (folder !== l.data.modulo) {
      errors.push(
        `Aula "${l.id}": está na pasta "${folder}" mas declara modulo: ${l.data.modulo}.`,
      );
    }
    if (!moduleIds.has(l.data.modulo)) {
      errors.push(
        `Aula "${l.id}": o módulo "${l.data.modulo}" não existe em src/content/modulos/.`,
      );
    }
    const key = `${l.data.modulo}#${l.data.ordem}`;
    const other = orders.get(key);
    if (other) {
      errors.push(`Aulas "${other}" e "${l.id}" usam a mesma ordem (${l.data.ordem}).`);
    }
    orders.set(key, l.id);
  }
  return errors;
}
