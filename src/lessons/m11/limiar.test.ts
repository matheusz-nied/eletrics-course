import { describe, expect, it } from 'vitest';
import { bitsToNumber, countChanges, readInput, sampleSignal, signalAt } from './limiar';

/** Values lesson 11.1 quotes from its two widgets. */

describe('11.1 threshold and noise', () => {
  it('without noise, both inputs change twice: once going up, once going down', () => {
    const s = sampleSignal(0);
    expect(countChanges(readInput(s, 'simples'))).toBe(2);
    expect(countChanges(readInput(s, 'histerese'))).toBe(2);
  });

  it('the signal goes from 0,5 V to 4,5 V and back', () => {
    expect(signalAt(0, 0)).toBeCloseTo(0.5, 6);
    expect(signalAt(0.5, 0)).toBeCloseTo(4.5, 6);
    expect(signalAt(1, 0)).toBeCloseTo(0.5, 6);
  });

  it('with 0,3 V of noise the single threshold changes 6 times, and hysteresis 2', () => {
    const s = sampleSignal(0.3);
    expect(countChanges(readInput(s, 'simples'))).toBe(6);
    expect(countChanges(readInput(s, 'histerese'))).toBe(2);
  });

  it('noise of 0,5 V or less never beats the 1 V hysteresis band', () => {
    for (const noise of [0.1, 0.2, 0.4, 0.5])
      expect(countChanges(readInput(sampleSignal(noise), 'histerese'))).toBe(2);
  });

  it('with 0,8 V of noise even hysteresis chatters', () => {
    expect(countChanges(readInput(sampleSignal(0.8), 'histerese'))).toBeGreaterThan(2);
  });

  it('reads bits as a binary number', () => {
    expect(bitsToNumber([true, false, true, true])).toBe(11);
    expect(bitsToNumber([true, true, true, true, true, true, true, true])).toBe(255);
    expect(bitsToNumber([false, true, true, false, false, true, false, false])).toBe(100);
  });
});
