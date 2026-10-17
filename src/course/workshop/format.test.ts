import { describe, expect, it } from 'vitest';
import { inlineMarkup, normalizeWorkshop, slugify } from './format';
import exemplo from '../../lessons/m00/oficinas/exemplo';

const doc = (sections: unknown) => ({ id: 'teste', title: 'Teste', summary: 'Resumo', sections });

describe('normalizeWorkshop', () => {
  it('numbers the steps across sections and gives them ids', () => {
    const w = normalizeWorkshop(
      doc([
        { title: 'A', steps: [{ title: 'Desligue o disjuntor!' }, { id: 'x', title: 'Teste' }] },
        { title: 'B', steps: [{ title: 'Ligue', text: 'Um' }] },
      ]),
      'teste',
    );
    expect(w.steps.map((s) => [s.number, s.id, s.section])).toEqual([
      [1, 'desligue-o-disjuntor', 'A'],
      [2, 'x', 'A'],
      [3, 'ligue', 'B'],
    ]);
    expect(w.steps[2]!.paragraphs).toEqual(['Um']);
  });

  it('rejects a wrong id, repeated steps and missing fields', () => {
    expect(() =>
      normalizeWorkshop(doc([{ title: 'A', steps: [{ title: 'X' }] }]), 'outro'),
    ).toThrow(/nome do arquivo/);
    expect(() =>
      normalizeWorkshop(doc([{ title: 'A', steps: [{ title: 'X' }, { title: 'X' }] }]), 'teste'),
    ).toThrow(/dois passos/);
    expect(() => normalizeWorkshop(doc([]), 'teste')).toThrow(/formato inválido/);
  });

  it('accepts the demo workshop', () => {
    expect(normalizeWorkshop(exemplo, 'exemplo').steps).toHaveLength(5);
  });
});

describe('helpers', () => {
  it('slugifies titles in Portuguese', () => {
    expect(slugify('Teste a ausência de tensão (F, N e ⏚)')).toBe(
      'teste-a-ausencia-de-tensao-f-n-e',
    );
  });

  it('escapes HTML and keeps bold', () => {
    expect(inlineMarkup('Use **COM** & <b>x</b>')).toBe(
      'Use <strong>COM</strong> &amp; &lt;b&gt;x&lt;/b&gt;',
    );
  });
});
