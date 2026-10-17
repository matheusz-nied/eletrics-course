import { getCollection, type CollectionEntry } from 'astro:content';
import { checkCourse, listedLessons, sortLessons, sortModules } from './course';

export type Module = CollectionEntry<'modulos'>;
export type Lesson = CollectionEntry<'aulas'>;

/** Drafts show up in navigation only on the dev server. */
export const SHOW_DRAFTS = import.meta.env.DEV;

export interface Course {
  /** All modules, in course order. */
  modules: Module[];
  /** All lessons (drafts included), in course order. Use for routes. */
  lessons: Lesson[];
  /** Lessons that appear in navigation and listings, in course order. */
  listed: Lesson[];
}

async function loadCourse(): Promise<Course> {
  const modules = sortModules(await getCollection('modulos'));
  const lessons = sortLessons(await getCollection('aulas'), modules);
  const errors = checkCourse(modules, lessons);
  if (errors.length > 0) {
    throw new Error(`Conteúdo do curso inconsistente:\n- ${errors.join('\n- ')}`);
  }
  return { modules, lessons, listed: listedLessons(lessons, SHOW_DRAFTS) };
}

let cached: Promise<Course> | undefined;

/** Loads, checks and orders the course (once per build; fresh on every dev request). */
export function getCourse(): Promise<Course> {
  if (import.meta.env.DEV) return loadCourse();
  cached ??= loadCourse();
  return cached;
}

export function lessonsOf(lessons: readonly Lesson[], moduleId: string): Lesson[] {
  return lessons.filter((l) => l.data.modulo === moduleId);
}

/** "4.2": module number and lesson order, as the curriculum numbers lessons. */
export function lessonNumber(lesson: Lesson, modules: readonly Module[]): string {
  const m = modules.find((mod) => mod.id === lesson.data.modulo);
  return `${m?.data.numero ?? '?'}.${lesson.data.ordem}`;
}
