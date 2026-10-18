import { describe, expect, it } from 'vitest';
import { resumeTarget, type IndexLesson } from './course-index';

const lesson = (i: string, n: string): IndexLesson => ({
  i,
  n,
  t: i,
  m: 'Módulo',
  mi: 'm',
  h: `/${i}/`,
});
const index = [lesson('a', '1.1'), lesson('b', '1.2'), lesson('c', '1.3')];

describe('resumeTarget', () => {
  it('continues the last lesson opened while it is not concluded', () => {
    expect(resumeTarget(index, 'b', () => false)).toEqual({ lesson: index[1], kind: 'continuar' });
  });

  it('suggests the next lesson not concluded after it', () => {
    const read = new Set(['b', 'c']);
    expect(resumeTarget(index, 'a', (id) => id === 'a' || read.has(id))).toBeUndefined();
    expect(resumeTarget(index, 'a', (id) => id === 'a' || id === 'b')).toEqual({
      lesson: index[2],
      kind: 'proxima',
    });
  });

  it('has nothing to suggest without history or for unknown lessons', () => {
    expect(resumeTarget(index, undefined, () => false)).toBeUndefined();
    expect(resumeTarget(index, 'rascunho', () => false)).toBeUndefined();
  });
});
