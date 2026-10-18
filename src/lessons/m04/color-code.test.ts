import { describe, expect, it } from 'vitest';
import {
  bandLayout,
  bandMeaning,
  decode,
  E12,
  E24,
  encode,
  formatMultiplier,
  formatOhms,
  inSeries,
  isRightAnswer,
  randomRound,
  toleranceRange,
} from './color-code';

/** Seeded generator (mulberry32), so the random rounds are reproducible. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('4.1 colour code', () => {
  it('encodes the examples of the lesson', () => {
    expect(encode(4700)).toEqual(['amarelo', 'violeta', 'vermelho', 'dourado']);
    expect(encode(4.7)).toEqual(['amarelo', 'violeta', 'dourado', 'dourado']);
    expect(encode(0.47)).toEqual(['amarelo', 'violeta', 'prateado', 'dourado']);
    expect(encode(1500)).toEqual(['marrom', 'verde', 'vermelho', 'dourado']);
    expect(encode(100)).toEqual(['marrom', 'preto', 'marrom', 'dourado']);
    expect(encode(10, 5)).toEqual(['marrom', 'preto', 'preto', 'dourado']);
    expect(encode(220, 10)).toEqual(['vermelho', 'vermelho', 'marrom', 'prateado']);
    expect(encode(10000, 1, 5)).toEqual(['marrom', 'preto', 'preto', 'vermelho', 'marrom']);
    expect(encode(4700, 1, 5)).toEqual(['amarelo', 'violeta', 'preto', 'marrom', 'marrom']);
    expect(encode(1e6)).toEqual(['marrom', 'preto', 'verde', 'dourado']);
  });

  it('decodes what it encodes', () => {
    for (const ohms of [0.1, 1, 4.7, 33, 220, 1500, 4700, 68000, 470000, 1e6, 2.2e6]) {
      for (const count of [4, 5] as const) {
        const d = decode(encode(ohms, count === 5 ? 1 : 5, count));
        expect(d?.ohms).toBe(ohms);
      }
    }
    expect(decode(['amarelo', 'violeta', 'vermelho', 'dourado'])).toMatchObject({
      ohms: 4700,
      tolerance: 5,
      digits: '47',
      exponent: 2,
    });
  });

  it('rejects bands in the wrong place', () => {
    expect(decode(['dourado', 'violeta', 'vermelho', 'dourado'])).toBeUndefined();
    expect(decode(['amarelo', 'violeta', 'vermelho', 'laranja'])).toBeUndefined();
    expect(decode(['amarelo', 'violeta', 'vermelho'])).toBeUndefined();
  });

  it('formats values, multipliers and band meanings in pt-BR', () => {
    expect(formatOhms(4700)).toBe('4,7\u00a0kΩ');
    expect(formatOhms(0.47)).toBe('0,47\u00a0Ω');
    expect(formatOhms(4.7)).toBe('4,7\u00a0Ω');
    expect(formatOhms(1e6)).toBe('1\u00a0MΩ');
    expect(formatOhms(4465, 4)).toBe('4,465\u00a0kΩ');
    expect(formatMultiplier(2)).toBe('×100');
    expect(formatMultiplier(3)).toBe('×1.000');
    expect(formatMultiplier(-1)).toBe('×0,1');
    expect(formatMultiplier(6)).toBe('×1 M');
    expect(formatMultiplier(9)).toBe('×1 G');
    const bands = encode(4700);
    expect(bands.map((_, i) => bandMeaning(bands, i))).toEqual(['4', '7', '×100', '±5\u00a0%']);
  });

  it('gives the tolerance range', () => {
    expect(toleranceRange(4700, 5)).toEqual([4465, 4935]);
    expect(toleranceRange(1000, 10)).toEqual([900, 1100]);
  });

  it('knows the E12 and E24 values', () => {
    expect(inSeries(4700, E12)).toBe(true);
    expect(inSeries(5000, E12)).toBe(false);
    expect(inSeries(5100, E24)).toBe(true);
    expect(inSeries(5100, E12)).toBe(false);
    expect(inSeries(1.5, E12)).toBe(true);
    // Every E12 value is in E24.
    expect(E12.every((v) => (E24 as readonly number[]).includes(v))).toBe(true);
  });

  it('draws random rounds that the code can express', () => {
    const random = seeded(42);
    for (let i = 0; i < 500; i++) {
      const round = randomRound(random);
      expect(round.ohms).toBeGreaterThanOrEqual(1);
      expect(round.ohms).toBeLessThan(1e6);
      expect(decode(round.bands)?.ohms).toBe(round.ohms);
      if (round.bands.length === 5) expect(round.tolerance).toBe(1);
      else expect([5, 10]).toContain(round.tolerance);
    }
  });

  it('accepts answers within 0,5 %', () => {
    expect(isRightAnswer(4700, 4700)).toBe(true);
    expect(isRightAnswer(4720, 4700)).toBe(true);
    expect(isRightAnswer(470, 4700)).toBe(false);
  });

  it('places the tolerance band apart from the others', () => {
    for (const count of [4, 5] as const) {
      const shapes = bandLayout(encode(4700, count === 5 ? 1 : 5, count), 100);
      const gaps = shapes.slice(1).map((s, i) => s.x - (shapes[i]!.x + shapes[i]!.width));
      const last = gaps.pop()!;
      for (const g of gaps) expect(last).toBeGreaterThan(g * 1.5);
      expect(shapes[0]!.x).toBeGreaterThan(5);
      expect(shapes[count - 1]!.x + shapes[count - 1]!.width).toBeLessThan(95);
    }
  });
});
