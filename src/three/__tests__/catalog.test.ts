/**
 * Every part in the kit: metadata that the gallery, <Model3D> and the
 * lessons rely on (unique ids equal to the file name, defaults for every
 * control, pt-BR descriptions without holes).
 */
import { describe, expect, it } from 'vitest';
import { describePart, listParts } from '../catalog';
import { annotationsFor, cutFor, partIdFromPath, resolveProps } from '../registry';
import { CATEGORY_LABELS, type PartMeta, type PartProps } from '../types';

const files = Object.keys(
  import.meta.glob([
    '../parts/*.tsx',
    '../instruments/*.tsx',
    '!../**/_*.tsx',
    '!../**/*.test.tsx',
  ]),
).map(partIdFromPath);
const parts = listParts();

/** Props that exercise every option of every select control, one at a time. */
function variants(meta: PartMeta): PartProps[] {
  const out: PartProps[] = [{}];
  for (const [key, control] of Object.entries(meta.controls ?? {})) {
    if (control.kind === 'select') for (const o of control.options) out.push({ [key]: o.value });
    if (control.kind === 'toggle') out.push({ [key]: !meta.defaults[key] });
    if (control.kind === 'number') out.push({ [key]: control.min }, { [key]: control.max });
  }
  return out;
}

describe('3D kit catalogue', () => {
  it('has one part per file, with the file name as id', () => {
    expect(parts.length).toBe(files.length);
    expect(new Set(parts.map((p) => p.id)).size).toBe(parts.length);
    expect(parts.map((p) => p.id).sort()).toEqual([...files].sort());
  });

  it.each(parts.map((p) => [p.id, p] as const))('%s: metadata is complete', (_, meta) => {
    expect(meta.label.length).toBeGreaterThan(1);
    expect(meta.summary.length).toBeGreaterThan(10);
    expect(Object.keys(CATEGORY_LABELS)).toContain(meta.category);
    for (const [key, control] of Object.entries(meta.controls ?? {})) {
      expect(meta.defaults, `default for "${key}"`).toHaveProperty(key);
      const value = meta.defaults[key];
      if (control.kind === 'select')
        expect(
          control.options.map((o) => o.value),
          `default of "${key}"`,
        ).toContain(value);
      if (control.kind === 'number') {
        expect(typeof value).toBe('number');
        expect(value as number).toBeGreaterThanOrEqual(control.min);
        expect(value as number).toBeLessThanOrEqual(control.max);
      }
      if (control.kind === 'toggle') expect(typeof value).toBe('boolean');
    }
  });

  it.each(parts.map((p) => [p.id, p] as const))(
    '%s: descriptions and annotations work for every option',
    (_, meta) => {
      for (const props of variants(meta)) {
        const text = describePart(meta, props);
        expect(text, JSON.stringify(props)).not.toMatch(/undefined|NaN|\[object/);
        expect(text.length).toBeGreaterThan(5);
        for (const note of annotationsFor(meta, resolveProps(meta, props))) {
          expect(note.at, note.text).toHaveLength(3);
          expect(note.at.every(Number.isFinite), note.text).toBe(true);
          expect(note.text).not.toMatch(/undefined|NaN/);
        }
        const cut = cutFor(meta, resolveProps(meta, props));
        for (const v of [cut.normal, cut.through])
          if (v) expect(v.every(Number.isFinite)).toBe(true);
        if (cut.normal) expect(Math.hypot(...cut.normal)).toBeGreaterThan(0);
      }
    },
  );
});
