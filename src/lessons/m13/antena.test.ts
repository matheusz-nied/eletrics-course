import { describe, expect, it } from 'vitest';
import { antennaGain, LOSS_1M, QUARTER, RESONANT, roundRange, solveLink } from './antena';

const range = (length: number, extra: Partial<Parameters<typeof solveLink>[0]> = {}) =>
  roundRange(
    solveLink({ length, environment: 'rua', obstacles: [], weakBattery: false, ...extra }).range,
  );

describe('antena e alcance', () => {
  it('uses a quarter wave of 17,3 cm that resonates near 16,4 cm', () => {
    expect(QUARTER * 100).toBeCloseTo(17.27, 2);
    expect(RESONANT * 100).toBeCloseTo(16.41, 2);
    expect(antennaGain(RESONANT)).toBeCloseTo(0, 6);
    expect(LOSS_1M).toBeCloseTo(25.2, 1);
  });

  it('loses little with the 17 cm wire and a lot with a cut one', () => {
    expect(antennaGain(0.17)).toBeGreaterThan(-0.5);
    expect(antennaGain(0.08)).toBeLessThan(-12);
    expect(antennaGain(0)).toBe(-30);
    // Too long also detunes it.
    expect(antennaGain(0.3)).toBeLessThan(-10);
  });

  it('gives the ranges the lesson quotes', () => {
    // "Explore" of lesson 13.2.
    expect(range(0.17)).toBe(64);
    expect(range(0.17, { environment: 'aberto' })).toBe(160);
    expect(range(0.08)).toBe(25);
    expect(range(0)).toBe(8);
    expect(range(0.17, { obstacles: ['chapa'] })).toBe(18);
    expect(range(0.17, { obstacles: ['caixa'] })).toBe(11);
    expect(range(0.17, { weakBattery: true })).toBe(42);
  });
});
