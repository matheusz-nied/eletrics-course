import { z } from 'astro/zod';
import { ICON_NAMES } from '../components/icons';

/**
 * Frontmatter and data schemas of the content collections
 * (docs/plano/02-arquitetura.md, section 4.1).
 *
 * They live here, apart from src/content.config.ts, so unit tests can import
 * them without the `astro:content` virtual module.
 */

/** `m08-motores` */
export const MODULE_ID = /^m\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** `m08-motores/04-motor-monofasico-capacitor` */
export const LESSON_ID = /^m\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\/\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** `borne`, `corrente-alternada` */
export const TERM_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const moduleId = z.string().regex(MODULE_ID, 'Use o id do módulo, por exemplo "m08-motores".');
const lessonId = z
  .string()
  .regex(LESSON_ID, 'Use o id da aula, por exemplo "m08-motores/04-motor-monofasico-capacitor".');
const text = z.string().trim().min(1);

export const iconSchema = z.enum(ICON_NAMES);

export const LEVELS = ['B', 'I', 'A'] as const;
export const SAFETY_LEVELS = ['nenhum', 'baixa-tensao', 'rede'] as const;

/** src/content/modulos/mNN-*.yaml */
export const moduleSchema = z.object({
  id: moduleId,
  numero: z.number().int().min(0).max(99),
  parte: z.number().int().min(1).max(4),
  titulo: text,
  resumo: text,
  icone: iconSchema,
});

/** Frontmatter of src/content/aulas/mNN-*\/NN-*.mdx */
export const lessonSchema = z.object({
  titulo: text,
  modulo: moduleId,
  ordem: z.number().int().min(0).max(99),
  nivel: z.enum(LEVELS),
  duracaoMin: z.number().int().positive(),
  objetivos: z.array(text).min(1),
  prerequisitos: z.array(lessonId).default([]),
  tags: z.array(text).default([]),
  /** `rede` shows the mains-safety notice at the top of the lesson. */
  seguranca: z.enum(SAFETY_LEVELS).default('nenhum'),
  /** Drafts are built but never listed, indexed or linked in production. */
  rascunho: z.boolean().default(false),
});

/** src/content/glossario/<termo>.md; the body holds the long explanation. */
export const termSchema = z.object({
  termo: text,
  /** One or two sentences shown in the `<Term>` popover. */
  resumo: text,
  sinonimos: z.array(text).default([]),
  /** Ids of related terms (file names without extension). */
  relacionados: z.array(z.string().regex(TERM_ID)).default([]),
  /** Lesson that explains the term in depth. */
  aula: lessonId.optional(),
});

/** src/content/trilhas/*.yaml */
export const trackSchema = z.object({
  titulo: text,
  paraQuem: text,
  resumo: text,
  ordem: z.number().int().min(0),
  icone: iconSchema.optional(),
  /** In study order: a module id (whole module) or a lesson id. */
  itens: z.array(z.union([lessonId, moduleId])).min(1),
});

export type ModuleData = z.infer<typeof moduleSchema>;
export type LessonData = z.infer<typeof lessonSchema>;
export type TermData = z.infer<typeof termSchema>;
export type TrackData = z.infer<typeof trackSchema>;
