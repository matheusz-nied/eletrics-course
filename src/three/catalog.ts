/**
 * Build-time catalogue of parts: metadata and posters, read by Astro pages
 * (<Model3D>, /dev/pecas). The browser loads parts through `registry.ts`.
 */
import { partIdFromPath, resolveProps } from './registry';
import type { PartMeta, PartProps } from './types';

const metas = import.meta.glob<PartMeta>(
  ['./parts/*.tsx', './instruments/*.tsx', '!./**/_*.tsx', '!./**/*.test.tsx'],
  { eager: true, import: 'meta' },
);

const posters = import.meta.glob<string>('./posters/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byId = new Map(Object.entries(metas).map(([path, meta]) => [partIdFromPath(path), meta]));
const posterById = new Map(
  Object.entries(posters).map(([path, url]) => [
    path
      .split('/')
      .pop()!
      .replace(/\.webp$/, ''),
    url,
  ]),
);

export function getPartMeta(id: string): PartMeta | undefined {
  return byId.get(id);
}

export function listParts(): PartMeta[] {
  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

export function getPoster(id: string): string | undefined {
  return posterById.get(id);
}

/** Accessible description of a part with the given props. */
export function describePart(meta: PartMeta, props: PartProps = {}): string {
  return meta.describe?.(resolveProps(meta, props)) ?? meta.summary;
}
