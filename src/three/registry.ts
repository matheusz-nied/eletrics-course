/**
 * Part registry for the browser: every file in `parts/` and `instruments/`
 * is a part, loaded only when a view needs it (docs/plano/02-arquitetura.md,
 * section 7.3). Files starting with `_` are shared helpers, not parts.
 */
import type { ComponentType } from 'react';
import type { PartAnnotation, PartMeta, PartModule, PartProps } from './types';

const loaders = import.meta.glob<{ meta: PartMeta; default: ComponentType<never> }>([
  './parts/*.tsx',
  './instruments/*.tsx',
  '!./**/_*.tsx',
  '!./**/*.test.tsx',
]);

/** `./parts/resistor.tsx` → `resistor`. */
export function partIdFromPath(path: string): string {
  return path
    .split('/')
    .pop()!
    .replace(/\.tsx$/, '');
}

const byId = new Map(Object.entries(loaders).map(([path, load]) => [partIdFromPath(path), load]));

export function hasPart(id: string): boolean {
  return byId.has(id);
}

export async function loadPart(id: string): Promise<PartModule> {
  const load = byId.get(id);
  if (!load) throw new Error(`Peça 3D desconhecida: "${id}".`);
  const module = await load();
  return { meta: module.meta, default: module.default as ComponentType<PartProps> };
}

/** Defaults merged with the given props (undefined values keep the default). */
export function resolveProps(meta: PartMeta, props: PartProps = {}): PartProps {
  const merged: PartProps = { ...meta.defaults };
  for (const [key, value] of Object.entries(props)) if (value !== undefined) merged[key] = value;
  return merged;
}

export function annotationsFor(meta: PartMeta, props: PartProps): PartAnnotation[] {
  const list = typeof meta.annotations === 'function' ? meta.annotations(props) : meta.annotations;
  return list ?? [];
}

export function isAnimated(meta: PartMeta, props: PartProps): boolean {
  return typeof meta.animated === 'function' ? meta.animated(props) : !!meta.animated;
}
