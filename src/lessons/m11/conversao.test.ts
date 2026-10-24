import { describe, expect, it } from 'vitest';
import dac from './dac-r2r.circuit';
import pwm from './pwm-filtro.circuit';
import { num, runTo, start } from './sim';

/** Values lesson 11.6 quotes from its circuits. */

describe('11.6 R-2R DAC', () => {
  const out = (code: number) => {
    const params: Record<string, number> = {};
    for (let bit = 0; bit < 4; bit++) params[`V${bit}.voltage`] = code & (1 << bit) ? 5 : 0;
    return num(runTo(start(dac, params), 0.01), 'VOUT');
  };

  it('the output is 5 V · code / 16', () => {
    for (let code = 0; code < 16; code++) expect(out(code)).toBeCloseTo((5 * code) / 16, 6);
  });

  it('quoted values: 0,3125 V per step, 2,5 V for 1000, 4,6875 V for 1111, 3,4375 V for 1011', () => {
    expect(out(1)).toBeCloseTo(0.3125, 6);
    expect(out(8)).toBeCloseTo(2.5, 6);
    expect(out(15)).toBeCloseTo(4.6875, 6);
    expect(out(11)).toBeCloseTo(3.4375, 6);
  });
});

describe('11.6 PWM and the RC filter', () => {
  /** Average, minimum and maximum of the filter output over the last 0,2 s of 1 s. */
  const filtered = (duty: number, c: number) => {
    const sim = start(pwm, { 'VP.duty': duty, 'C1.capacitance': c });
    runTo(sim, 0.8);
    let sum = 0;
    let n = 0;
    let lo = Infinity;
    let hi = -Infinity;
    runTo(sim, 1, (r) => {
      const v = num(r, 'VMED');
      sum += v;
      n++;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    });
    return { mean: sum / n, ripple: hi - lo };
  };

  it('the output settles at duty × 5 V', () => {
    for (const duty of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(filtered(duty, 10e-6).mean).toBeCloseTo(duty * 5, 1);
    }
  });

  it('ripple: about 0,1 V with 10 µF and 1 V with 1 µF at 25 %', () => {
    const big = filtered(0.25, 10e-6).ripple;
    const small = filtered(0.25, 1e-6).ripple;
    expect(big).toBeGreaterThan(0.07);
    expect(big).toBeLessThan(0.13);
    expect(small).toBeGreaterThan(0.8);
    expect(small).toBeLessThan(1.2);
  });

  it('settles in about half a second with 10 µF (5 τ = 0,5 s)', () => {
    const sim = start(pwm, { 'VP.duty': 0.5 });
    expect(num(runTo(sim, 0.1), 'VMED')).toBeLessThan(1.8);
    expect(num(runTo(sim, 0.5), 'VMED')).toBeGreaterThan(2.3);
  });
});
