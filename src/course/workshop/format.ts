/**
 * Workshop mode ("modo oficina") documents: a step-by-step procedure shown in
 * large type, one step at a time, to follow next to the equipment.
 *
 * A workshop is a data file written by the module's front:
 * `src/lessons/mNN/oficinas/<id>.ts`, with `export default defineWorkshop({…})`,
 * used in a lesson as `<Workshop id="<id>" />`. The file name is the id.
 */
import type { ImageMetadata } from 'astro';
import { z } from 'zod';

export interface WorkshopStepDoc {
  /** Stable id, kept in the student's progress. Defaults to the title as a slug. */
  id?: string;
  /** Imperative, short: "Desligue o disjuntor do portão". */
  title: string;
  /** Paragraphs. `**bold**` is supported. */
  text?: string | string[];
  /** Checklist or list of items inside the step. */
  items?: string[];
  /** What to measure, and what is expected. */
  measure?: { what: string; expected: string; how?: string };
  /** Danger or attention note, shown before the text. */
  warning?: string;
  tip?: string;
  /** Reference photo or drawing: a path under public/ or an imported image. */
  image?: { src: string | ImageMetadata; alt: string; caption?: string };
  /** 3D scene of src/scenes (same props as <Scene3D>). */
  scene?: { scene: string; props?: Record<string, unknown>; camera?: string; hotspots?: boolean };
  /** 3D part of src/three (same props as <Model3D>). */
  model?: { part: string; props?: Record<string, unknown>; explode?: boolean; cutaway?: boolean };
}

export interface WorkshopSectionDoc {
  /** "Desmontar" */
  title: string;
  steps: WorkshopStepDoc[];
}

export interface WorkshopDoc {
  /** Must match the file name. */
  id: string;
  title: string;
  /** One or two sentences: what the student will do. */
  summary: string;
  /** `rede` shows the mains-safety rules at the start. */
  safety?: 'nenhum' | 'baixa-tensao' | 'rede';
  /** "1 a 3 horas" */
  duration?: string;
  tools?: string[];
  materials?: string[];
  sections: WorkshopSectionDoc[];
}

const text = z.string().trim().min(1);
const stepSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use letras minúsculas, números e hífens no id do passo.')
    .optional(),
  title: text,
  text: z.union([text, z.array(text)]).optional(),
  items: z.array(text).optional(),
  measure: z.object({ what: text, expected: text, how: text.optional() }).optional(),
  warning: text.optional(),
  tip: text.optional(),
  image: z.object({ src: z.any(), alt: text, caption: text.optional() }).optional(),
  scene: z
    .object({
      scene: text,
      props: z.record(z.string(), z.unknown()).optional(),
      camera: z.string().optional(),
      hotspots: z.boolean().optional(),
    })
    .optional(),
  model: z
    .object({
      part: text,
      props: z.record(z.string(), z.unknown()).optional(),
      explode: z.boolean().optional(),
      cutaway: z.boolean().optional(),
    })
    .optional(),
});

const workshopSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: text,
  summary: text,
  safety: z.enum(['nenhum', 'baixa-tensao', 'rede']).optional(),
  duration: text.optional(),
  tools: z.array(text).optional(),
  materials: z.array(text).optional(),
  sections: z.array(z.object({ title: text, steps: z.array(stepSchema).min(1) })).min(1),
});

/** Typed identity for workshop files; the build validates them. */
export function defineWorkshop(doc: WorkshopDoc): WorkshopDoc {
  return doc;
}

/** "Desligue o disjuntor!" → "desligue-o-disjuntor" */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

export interface WorkshopStep extends Omit<WorkshopStepDoc, 'id' | 'text'> {
  id: string;
  /** 1-based, across sections. */
  number: number;
  section: string;
  paragraphs: string[];
}

export interface Workshop extends Omit<WorkshopDoc, 'sections'> {
  sections: { title: string; steps: WorkshopStep[] }[];
  steps: WorkshopStep[];
}

/** Validates a workshop and numbers its steps. Throws pt-BR messages. */
export function normalizeWorkshop(doc: unknown, fileId: string): Workshop {
  const where = `Oficina "${fileId}"`;
  const result = workshopSchema.safeParse(doc);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`)
      .join('; ');
    throw new Error(`${where}: formato inválido (${issues}).`);
  }
  const data = result.data as WorkshopDoc;
  if (data.id !== fileId) {
    throw new Error(`${where}: o campo id ("${data.id}") deve ser igual ao nome do arquivo.`);
  }
  const seen = new Set<string>();
  let number = 0;
  const sections = data.sections.map((section) => ({
    title: section.title,
    steps: section.steps.map((step): WorkshopStep => {
      const { id: rawId, text: rawText, ...rest } = step;
      const id = rawId ?? slugify(step.title);
      if (seen.has(id)) {
        throw new Error(`${where}: dois passos com o id "${id}". Dê um id diferente a um deles.`);
      }
      seen.add(id);
      const paragraphs = rawText === undefined ? [] : Array.isArray(rawText) ? rawText : [rawText];
      return { ...rest, id, number: ++number, section: section.title, paragraphs };
    }),
  }));
  return { ...data, sections, steps: sections.flatMap((s) => s.steps) };
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes HTML and turns `**bold**` into <strong>. */
export function inlineMarkup(text: string): string {
  return text
    .replace(/[&<>"']/g, (c) => ESCAPES[c]!)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
