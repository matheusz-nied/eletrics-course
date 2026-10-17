import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { lessonSchema, moduleSchema, termSchema, trackSchema } from './lib/schemas';

const modulos = defineCollection({
  loader: glob({ base: './src/content/modulos', pattern: '*.yaml' }),
  schema: moduleSchema,
});

const aulas = defineCollection({
  loader: glob({ base: './src/content/aulas', pattern: '*/*.mdx' }),
  schema: lessonSchema,
});

const glossario = defineCollection({
  loader: glob({ base: './src/content/glossario', pattern: '*.md' }),
  schema: termSchema,
});

const trilhas = defineCollection({
  loader: glob({ base: './src/content/trilhas', pattern: '*.yaml' }),
  schema: trackSchema,
});

export const collections = { modulos, aulas, glossario, trilhas };
