import { describe, expect, it } from 'vitest';
import { checkTerms, groupByInitial, initial, searchable, sortTerms } from './glossary';

const term = (id: string, termo: string) => ({ id, data: { termo, sinonimos: [] } });

describe('glossary helpers', () => {
  it('sorts in pt-BR order, ignoring accents and case', () => {
    const sorted = sortTerms([term('b', 'bitola'), term('a', 'Átomo'), term('c', 'aterramento')]);
    expect(sorted.map((t) => t.id)).toEqual(['c', 'a', 'b']);
  });

  it('groups by initial letter without accents', () => {
    expect(initial('Ímã')).toBe('I');
    expect(initial('5×20')).toBe('#');
    const groups = groupByInitial([term('1', 'Ímã'), term('2', 'indutor'), term('3', 'DR')]);
    expect(groups.map((g) => [g.letter, g.terms.length])).toEqual([
      ['D', 1],
      ['I', 2],
    ]);
  });

  it('builds accent-free search text', () => {
    expect(searchable('Tensão', 'DDP')).toBe('tensao ddp');
  });
});

describe('checkTerms', () => {
  it('reports related terms and lessons that do not exist', () => {
    const terms = [
      { id: 'a', data: { relacionados: ['b'], aula: 'm01-x/01-y' } },
      { id: 'b', data: { relacionados: ['zz'], aula: 'm01-x/09-nada' } },
    ];
    const errors = checkTerms(terms, new Set(['m01-x/01-y']));
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/"zz"/);
    expect(errors[1]).toMatch(/09-nada/);
  });
});
