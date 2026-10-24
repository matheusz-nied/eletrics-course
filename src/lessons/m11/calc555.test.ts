import { describe, expect, it } from 'vitest';
import { astable, monostable } from './calc555';

describe('555 timing', () => {
  it('astable: f = 1,44 / ((R1 + 2·R2)·C), high 0,693·(R1 + R2)·C, low 0,693·R2·C', () => {
    const a = astable(10e3, 68e3, 10e-6);
    expect(a.frequency).toBeCloseTo(1.44 / (146e3 * 10e-6), 2);
    expect(a.frequency).toBeCloseTo(0.99, 2);
    expect(a.high).toBeCloseTo(0.54, 2);
    expect(a.low).toBeCloseTo(0.47, 2);
    expect(a.duty).toBeCloseTo(0.53, 2);
  });

  it('monostable: t = 1,1·R·C', () => {
    expect(monostable(100e3, 10e-6)).toBeCloseTo(1.1, 2);
    expect(monostable(470e3, 10e-6)).toBeCloseTo(5.16, 2);
    expect(monostable(1e6, 100e-6)).toBeCloseTo(110, 0);
    // Worked example: a 60 s stair light with 100 µF needs 545 kΩ; 560 kΩ gives 61,5 s.
    expect(60 / (Math.log(3) * 100e-6)).toBeCloseTo(546e3, -3);
    expect(monostable(560e3, 100e-6)).toBeCloseTo(61.5, 1);
  });
});
