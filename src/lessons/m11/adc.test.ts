import { describe, expect, it } from 'vitest';
import { fromCode, nyquistOk, sample, signalAt, stepOf, toCode } from './adc';

describe('ADC', () => {
  it('step sizes quoted in lesson 11.6', () => {
    expect(stepOf(5, 10) * 1e3).toBeCloseTo(4.88, 2);
    expect(stepOf(3.3, 12) * 1e3).toBeCloseTo(0.806, 3);
    expect(stepOf(5, 4)).toBeCloseTo(0.3125, 6);
    expect(stepOf(5, 8) * 1e3).toBeCloseTo(19.5, 1);
  });

  it('codes are rounded down and clamped', () => {
    expect(toCode(0, 5, 10)).toBe(0);
    expect(toCode(5, 5, 10)).toBe(1023);
    expect(toCode(-1, 5, 10)).toBe(0);
    expect(toCode(2.5, 5, 10)).toBe(512);
    expect(fromCode(512, 5, 10)).toBeCloseTo(2.5, 6);
  });

  it('worked example: LM35 at 30 °C (300 mV) reads 61, and 62 means 30,3 °C', () => {
    expect(toCode(0.3, 5, 10)).toBe(61);
    expect(fromCode(62, 5, 10) * 100).toBeCloseTo(30.3, 1);
    // One step is about half a degree.
    expect(stepOf(5, 10) * 100).toBeCloseTo(0.49, 2);
  });

  it('samples the widget signal, and knows when the rate is too low', () => {
    const s = sample(signalAt, 4, 2, 5, 3);
    expect(s).toHaveLength(9);
    expect(s[1].code).toBe(7);
    expect(nyquistOk(1.5, 1)).toBe(false);
    expect(nyquistOk(10, 1)).toBe(true);
  });
});
