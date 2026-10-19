import { describe, expect, it } from 'vitest';
import {
  CASES,
  contactHeat,
  getCase,
  pattern,
  reading,
  readingText,
  type CaseId,
} from './testador-tomada';

/** Lamps lit, in the order F–N, F–T, N–T. */
const lamps = (id: CaseId) => pattern(getCase(id));
const text = (id: CaseId, pair: 'F-N' | 'F-T' | 'N-T') => readingText(reading(getCase(id), pair));

describe('o testador de tomada e o multímetro (aula 7.5)', () => {
  it('reads 127 V, 127 V and almost zero on a correct 127 V outlet', () => {
    expect(lamps('correta')).toEqual([true, true, false]);
    expect(text('correta', 'F-N')).toBe('127 V');
    expect(text('correta', 'F-T')).toBe('127 V');
    expect(text('correta', 'N-T')).toBe('perto de 0 V (até alguns volts)');
  });

  it('gives a different lamp pattern for each wiring the tester can see', () => {
    expect(lamps('fn-trocados')).toEqual([true, false, true]);
    expect(lamps('sem-terra')).toEqual([true, false, false]);
    expect(lamps('fase-no-terra')).toEqual([false, true, true]);
    expect(lamps('sem-neutro')).toEqual([false, true, false]);
    expect(lamps('duas-fases')).toEqual([true, true, true]);
    const seen = CASES.filter((c) => c.id !== 'neutro-no-terra').map((c) => pattern(c).join(','));
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('cannot tell a neutral bridged to the earth pin from a correct outlet', () => {
    expect(lamps('neutro-no-terra')).toEqual(lamps('correta'));
    expect(text('neutro-no-terra', 'N-T')).toBe('0 V');
    expect(getCase('neutro-no-terra').danger).toBe(true);
  });

  it('shows 220 V between the two phases and 127 V from each to earth', () => {
    expect(text('duas-fases', 'F-N')).toBe('220 V');
    expect(text('duas-fases', 'F-T')).toBe('127 V');
    expect(text('duas-fases', 'N-T')).toBe('127 V');
  });

  it('marks a floating hole as a phantom reading', () => {
    expect(text('sem-terra', 'F-T')).toBe('instável (tensão fantasma)');
    expect(text('sem-neutro', 'F-N')).toBe('instável (tensão fantasma)');
    expect(text('fase-no-terra', 'F-T')).toBe('127 V');
  });

  it('flags the wirings that put a person at risk', () => {
    const danger = CASES.filter((c) => c.danger).map((c) => c.id);
    expect(danger).toEqual(['sem-terra', 'fase-no-terra', 'sem-neutro', 'neutro-no-terra']);
  });

  it('heats a loose contact of 0,1 Ω with about 12 W under a 1.400 W microwave', () => {
    // 1.400 W ÷ 127 V ≈ 11 A; 11² × 0,1 ≈ 12 W.
    expect(1400 / 127).toBeCloseTo(11.02, 2);
    expect(contactHeat(1400, 127, 0.1)).toBeCloseTo(12.15, 2);
    expect(contactHeat(1400, 127, 0.005)).toBeCloseTo(0.61, 2);
  });
});
