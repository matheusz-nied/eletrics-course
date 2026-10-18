import { describe, expect, it } from 'vitest';
import { decadesSpanned, isSorted, move, ROUNDS, solution } from './grandezas';

describe('jogo das grandezas', () => {
  for (const round of ROUNDS) {
    describe(round.id, () => {
      it('has distinct ids and values', () => {
        expect(new Set(round.items.map((i) => i.id)).size).toBe(round.items.length);
        expect(new Set(round.items.map((i) => i.value)).size).toBe(round.items.length);
      });

      it('does not start in the right order', () => {
        expect(
          isSorted(
            round,
            round.items.map((i) => i.id),
          ),
        ).toBe(false);
      });

      it('accepts its solution', () => {
        expect(isSorted(round, solution(round))).toBe(true);
      });
    });
  }

  it('counts the orders of magnitude of each round', () => {
    const spans = Object.fromEntries(ROUNDS.map((r) => [r.id, decadesSpanned(r)]));
    expect(spans).toEqual({ correntes: 10, tensoes: 6, potencias: 16, resistencias: 11 });
  });

  it('moves an item up and down, and stops at the ends', () => {
    expect(move(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(move(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(move(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });
});
