import { describe, expect, it } from 'vitest';
import { EXAMPLE_TARIFF, monthlyUse } from '../m01/energia';

/**
 * Lesson 7.7: the numbers of the text about lamps, with the same energy
 * functions as lesson 1.5 (and its example tariff of R$ 0,90 per kWh).
 */
const LAMPS = 10;
const HOURS = 4;
const DAYS = 30;

describe('trocar as lâmpadas da casa por LED (aula 7.7)', () => {
  const incandescent = monthlyUse(LAMPS * 60, HOURS, 'h', DAYS, EXAMPLE_TARIFF);
  const led = monthlyUse(LAMPS * 9, HOURS, 'h', DAYS, EXAMPLE_TARIFF);

  it('ten 60 W incandescent lamps, 4 h a day: 72 kWh and R$ 64,80 a month', () => {
    expect(incandescent.kWhPerMonth).toBeCloseTo(72, 9);
    expect(incandescent.cost).toBeCloseTo(64.8, 9);
  });

  it('ten 9 W LED lamps, the same light: 10,8 kWh and R$ 9,72 a month', () => {
    expect(led.kWhPerMonth).toBeCloseTo(10.8, 9);
    expect(led.cost).toBeCloseTo(9.72, 9);
  });

  it('saves 61,2 kWh and R$ 55,08 a month, about R$ 661 a year; R$ 5,51 per lamp a month', () => {
    expect(incandescent.kWhPerMonth - led.kWhPerMonth).toBeCloseTo(61.2, 9);
    expect(incandescent.cost - led.cost).toBeCloseTo(55.08, 9);
    expect(12 * (incandescent.cost - led.cost)).toBeCloseTo(660.96, 6);
    expect((incandescent.cost - led.cost) / LAMPS).toBeCloseTo(5.51, 2);
  });

  it('gives about the same light: 9 W × 90 lm/W = 810 lm, and 800 lm ÷ 60 W ≈ 13 lm/W', () => {
    expect(9 * 90).toBe(810);
    expect(800 / 60).toBeCloseTo(13.3, 1);
    // A 9 W LED lamp at 127 V draws about 71 mA (counting it as a resistive load).
    expect(9 / 127).toBeCloseTo(0.071, 3);
  });

  it('a phantom of 1 nF between the wires lets about 48 µA reach a switched-off lamp at 127 V', () => {
    const xc = 1 / (2 * Math.PI * 60 * 1e-9);
    expect(xc / 1e6).toBeCloseTo(2.65, 2);
    expect((127 / xc) * 1e6).toBeCloseTo(47.9, 1);
    // Compared with the 71 mA of the lamp lit: well under 0,1 %.
    expect(127 / xc / (9 / 127)).toBeLessThan(0.001);
  });
});
