import { getCollection, type CollectionEntry } from 'astro:content';
import { getCourse } from '../lib/content';
import { lessonUrl, moduleUrl, withBase } from '../lib/url';
import {
  buildCatalog,
  buildTrack,
  catalogLessons,
  checkTracks,
  type CatalogLesson,
  type CatalogModule,
  type CatalogTrack,
} from './catalog';
import { checkTerms, sortTerms } from './glossary';

export type Term = CollectionEntry<'glossario'>;

export interface CourseData {
  /** Every module of the plan and of the content, in course order. */
  modules: CatalogModule[];
  /** Every lesson of `modules`, in course order. */
  lessons: CatalogLesson[];
  tracks: CatalogTrack[];
  terms: Term[];
}

async function load(): Promise<CourseData> {
  const { modules, listed } = await getCourse();
  const catalog = buildCatalog(modules, listed, { module: moduleUrl, lesson: lessonUrl });
  const trackEntries = await getCollection('trilhas');
  const errors = checkTracks(trackEntries, catalog);
  if (errors.length > 0) {
    throw new Error(`Trilhas inconsistentes:\n- ${errors.join('\n- ')}`);
  }
  const tracks = trackEntries
    .map((t) => buildTrack(t, catalog))
    .sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
  const terms = sortTerms(await getCollection('glossario'));
  const lessons = catalogLessons(catalog);
  const termErrors = checkTerms(terms, new Set(lessons.map((l) => l.id)));
  if (termErrors.length > 0) {
    throw new Error(`Glossário inconsistente:\n- ${termErrors.join('\n- ')}`);
  }
  return { modules: catalog, lessons, tracks, terms };
}

let cached: Promise<CourseData> | undefined;

/** The catalog, tracks and glossary (once per build; fresh on every dev request). */
export function getCourseData(): Promise<CourseData> {
  if (import.meta.env.DEV) return load();
  cached ??= load();
  return cached;
}

export const trackUrl = (id: string) => withBase(`trilhas/${id}/`);
export const termUrl = (id: string) => withBase(`glossario/${id}/`);
