/**
 * The course catalog: the planned curriculum (src/course/curriculum.ts) merged
 * with the published content. Pure functions over plain data, so they are
 * unit-tested without Astro (catalog.test.ts); src/course/data.ts feeds them.
 *
 * Rules:
 * - A module with at least one published (non-draft) lesson shows its own
 *   lessons. Otherwise it shows the planned lessons as "em breve" (plus its
 *   drafts on the dev server).
 * - Track items point to modules or lessons. A lesson of a published module
 *   must exist; a lesson of a module not published yet must be in the plan.
 */
import { CURRICULUM, type PlannedModule } from './curriculum';
import type { IconName } from '../components/icons';

export interface ContentModule {
  id: string;
  data: {
    numero: number;
    parte: number;
    titulo: string;
    resumo: string;
    icone: IconName;
  };
}

export interface ContentLesson {
  id: string;
  data: {
    modulo: string;
    ordem: number;
    titulo: string;
    nivel: 'B' | 'I' | 'A';
    duracaoMin: number;
    seguranca: 'nenhum' | 'baixa-tensao' | 'rede';
    rascunho: boolean;
  };
}

export interface ContentTrack {
  id: string;
  data: {
    titulo: string;
    paraQuem: string;
    resumo: string;
    ordem: number;
    icone?: IconName | undefined;
    itens: string[];
  };
}

export type LessonStatus = 'publicada' | 'rascunho' | 'em-breve';

export interface CatalogLesson {
  id: string;
  moduleId: string;
  /** "4.2" */
  number: string;
  titulo: string;
  status: LessonStatus;
  /** Only for lessons with a page (published, or drafts on the dev server). */
  href?: string | undefined;
  duracaoMin?: number | undefined;
  nivel?: 'B' | 'I' | 'A' | undefined;
  seguranca?: ContentLesson['data']['seguranca'] | undefined;
}

export interface CatalogModule {
  id: string;
  numero: number;
  parte: number;
  titulo: string;
  resumo: string;
  icone: IconName;
  /** The module page exists (it has a YAML file). */
  href?: string | undefined;
  /** It has at least one published lesson. */
  published: boolean;
  lessons: CatalogLesson[];
}

export interface CatalogTrackStep {
  module: CatalogModule;
  lessons: CatalogLesson[];
}

export interface CatalogTrack {
  id: string;
  titulo: string;
  paraQuem: string;
  resumo: string;
  ordem: number;
  icone: IconName;
  /** Track lessons in study order, without repetition. */
  lessons: CatalogLesson[];
  /** The same lessons, grouped by consecutive module. */
  steps: CatalogTrackStep[];
}

export interface Links {
  module: (moduleId: string) => string;
  lesson: (lessonId: string) => string;
}

/** `07-chaves-botoes-e-reles` → 7 */
function orderFromId(id: string): number {
  return Number(id.split('/')[1]?.slice(0, 2) ?? Number.NaN);
}

/**
 * Merges the plan with the content. `listed` are the lessons shown in
 * navigation (drafts only on the dev server), in course order.
 */
export function buildCatalog(
  modules: readonly ContentModule[],
  listed: readonly ContentLesson[],
  links: Links,
  plan: readonly PlannedModule[] = CURRICULUM,
): CatalogModule[] {
  const ids = new Set([...plan.map((m) => m.id), ...modules.map((m) => m.id)]);
  const result: CatalogModule[] = [];

  for (const id of ids) {
    const content = modules.find((m) => m.id === id);
    const planned = plan.find((m) => m.id === id);
    const meta = content?.data ?? planned!;
    const own = listed.filter((l) => l.data.modulo === id);
    const published = own.some((l) => !l.data.rascunho);

    const fromContent = (l: ContentLesson): CatalogLesson => ({
      id: l.id,
      moduleId: id,
      number: `${meta.numero}.${l.data.ordem}`,
      titulo: l.data.titulo,
      status: l.data.rascunho ? 'rascunho' : 'publicada',
      href: links.lesson(l.id),
      duracaoMin: l.data.duracaoMin,
      nivel: l.data.nivel,
      seguranca: l.data.seguranca,
    });

    let lessons: CatalogLesson[];
    if (published || !planned) {
      lessons = own.map(fromContent);
    } else {
      const drafts = own.map(fromContent);
      const upcoming = planned.aulas
        .filter((a) => !drafts.some((d) => d.id === a.id))
        .map((a): CatalogLesson => ({
          id: a.id,
          moduleId: id,
          number: `${meta.numero}.${orderFromId(a.id)}`,
          titulo: a.titulo,
          status: 'em-breve',
          nivel: a.avancada ? 'A' : undefined,
        }));
      lessons = [...drafts, ...upcoming].sort(
        (a, b) => orderFromId(a.id) - orderFromId(b.id) || a.id.localeCompare(b.id),
      );
    }

    result.push({
      id,
      numero: meta.numero,
      parte: meta.parte,
      titulo: meta.titulo,
      resumo: meta.resumo,
      icone: meta.icone,
      href: content ? links.module(id) : undefined,
      published,
      lessons,
    });
  }

  return result.sort((a, b) => a.numero - b.numero || a.id.localeCompare(b.id));
}

export function catalogLessons(catalog: readonly CatalogModule[]): CatalogLesson[] {
  return catalog.flatMap((m) => m.lessons);
}

/**
 * Track items that cannot be resolved, as pt-BR messages for the author.
 * The build fails when the list is not empty.
 */
export function checkTracks(
  tracks: readonly ContentTrack[],
  catalog: readonly CatalogModule[],
  plan: readonly PlannedModule[] = CURRICULUM,
): string[] {
  const errors: string[] = [];
  for (const track of tracks) {
    for (const item of track.data.itens) {
      const where = `Trilha "${track.id}"`;
      if (!item.includes('/')) {
        if (!catalog.some((m) => m.id === item)) {
          errors.push(
            `${where}: o módulo "${item}" não existe no plano nem em src/content/modulos/.`,
          );
        }
        continue;
      }
      const moduleId = item.split('/')[0]!;
      const module = catalog.find((m) => m.id === moduleId);
      if (!module) {
        errors.push(`${where}: o módulo de "${item}" não existe.`);
        continue;
      }
      if (module.lessons.some((l) => l.id === item)) continue;
      if (module.published) {
        errors.push(
          `${where}: a aula "${item}" não existe, mas o módulo ${moduleId} já foi publicado. ` +
            `Use o mesmo slug do plano (src/course/curriculum.ts) ou corrija a trilha.`,
        );
      } else if (!plan.some((m) => m.aulas.some((a) => a.id === item))) {
        errors.push(`${where}: a aula "${item}" não está no plano (src/course/curriculum.ts).`);
      }
    }
  }
  return errors;
}

/** Resolves the items of a track into lessons, in order, without repetition. */
export function buildTrack(track: ContentTrack, catalog: readonly CatalogModule[]): CatalogTrack {
  const lessons: CatalogLesson[] = [];
  const seen = new Set<string>();
  const add = (l: CatalogLesson) => {
    if (seen.has(l.id)) return;
    seen.add(l.id);
    lessons.push(l);
  };

  for (const item of track.data.itens) {
    const moduleId = item.split('/')[0]!;
    const module = catalog.find((m) => m.id === moduleId);
    if (!module) continue;
    if (item === moduleId) module.lessons.forEach(add);
    else {
      const lesson = module.lessons.find((l) => l.id === item);
      if (lesson) add(lesson);
    }
  }

  const steps: CatalogTrackStep[] = [];
  for (const lesson of lessons) {
    const last = steps.at(-1);
    if (last && last.module.id === lesson.moduleId) last.lessons.push(lesson);
    else {
      const module = catalog.find((m) => m.id === lesson.moduleId)!;
      steps.push({ module, lessons: [lesson] });
    }
  }

  return {
    id: track.id,
    titulo: track.data.titulo,
    paraQuem: track.data.paraQuem,
    resumo: track.data.resumo,
    ordem: track.data.ordem,
    icone: track.data.icone ?? 'trilha',
    lessons,
    steps,
  };
}

/** Lessons that have a page, i.e. the ones that count for progress. */
export function available(lessons: readonly CatalogLesson[]): CatalogLesson[] {
  return lessons.filter((l) => l.href !== undefined);
}

export function minutesOf(lessons: readonly CatalogLesson[]): number {
  return lessons.reduce((sum, l) => sum + (l.duracaoMin ?? 0), 0);
}

/** "1 h 25 min", "40 min" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "1 aula", "3 aulas" */
export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;
}
