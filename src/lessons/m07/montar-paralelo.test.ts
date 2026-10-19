import { describe, expect, it } from 'vitest';
import { CLASSIC, diagnose, EMPTY, emptyTerminals, evaluate, type Wiring } from './montar-paralelo';

const wiring = (changes: Partial<Wiring>): Wiring => ({ ...CLASSIC, ...changes });

describe('montar a ligação do interruptor paralelo (aula 7.6)', () => {
  it('lights the lamp in the classic wiring when both switches point the same way', () => {
    expect(evaluate(CLASSIC, 1, 1).lit).toBe(true);
    expect(evaluate(CLASSIC, 1, 2).lit).toBe(false);
    expect(evaluate(CLASSIC, 2, 1).lit).toBe(false);
    expect(evaluate(CLASSIC, 2, 2).lit).toBe(true);
  });

  it('accepts the classic wiring: works from both points and is dead when off', () => {
    const d = diagnose(CLASSIC);
    expect(d.verdict).toBe('correta');
    expect(d.danger).toBe(false);
    const off = evaluate(CLASSIC, 1, 2);
    // The lamp side on the return is loose; through the filament it sits at neutral.
    expect(off.lamp).toEqual({ a: 'neutro', b: 'neutro' });
  });

  it('also accepts crossed travelers (the lamp logic is just inverted)', () => {
    const crossed = wiring({ s21: 'viajante2', s22: 'viajante1' });
    expect(diagnose(crossed).verdict).toBe('correta');
    expect(evaluate(crossed, 1, 1).lit).toBe(false);
    expect(evaluate(crossed, 1, 2).lit).toBe(true);
  });

  it('flags switches that cut the neutral: it works, but the lamp keeps the phase', () => {
    const d = diagnose(wiring({ s1c: 'neutro', lb: 'fase' }));
    expect(d.verdict).toBe('neutro-cortado');
    expect(d.danger).toBe(true);
    const off = evaluate(wiring({ s1c: 'neutro', lb: 'fase' }), 1, 2);
    expect(off.lit).toBe(false);
    expect(off.lamp).toEqual({ a: 'fase', b: 'fase' });
  });

  it('finds the short between phase and neutral in the positions where it happens', () => {
    // Phase on one common and neutral on the other: the travelers join them.
    const w = wiring({ s2c: 'neutro', la: 'retorno', lb: 'neutro' });
    const d = diagnose(w);
    expect(d.verdict).toBe('curto');
    expect(d.danger).toBe(true);
    expect(d.states.filter((s) => s.state.short).map((s) => `${s.p1}-${s.p2}`)).toEqual([
      '1-1',
      '2-2',
    ]);
    expect(d.message).toContain('1-1, 2-2');
  });

  it('says when one switch is left out of the path', () => {
    // Both travelers of switch 2 on the same conductor: switch 2 changes nothing.
    expect(diagnose(wiring({ s22: 'viajante1', s12: 'viajante1' })).verdict).toBe('sempre-acesa');
    expect(diagnose(wiring({ s22: 'viajante1' })).verdict).toBe('um-ponto');
  });

  it('says when the lamp is wired straight to phase and neutral', () => {
    expect(diagnose(wiring({ la: 'fase' })).verdict).toBe('sempre-acesa');
  });

  it('says when the lamp never lights and when the supply is missing', () => {
    expect(diagnose(wiring({ s2c: 'viajante1' })).verdict).toBe('nunca-acende');
    expect(diagnose(EMPTY).verdict).toBe('incompleta');
    expect(diagnose(wiring({ lb: 'nenhum' })).verdict).toBe('incompleta');
    expect(emptyTerminals(EMPTY)).toBe(8);
    expect(emptyTerminals(CLASSIC)).toBe(0);
  });
});
