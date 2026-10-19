import { describe, expect, it } from 'vitest';
import limiar from './limiar-entrada.circuit';
import { countEdges, num, runTo, set, start } from './sim';

/** Values lesson 11.1 quotes from its circuit. */

describe('11.1 input threshold', () => {
  it('goes high only above 3 V going up, and low only below 2 V going down', () => {
    const sim = start(limiar);
    let up = Number.NaN;
    for (let v = 1; v <= 4; v += 0.05) {
      set(sim, 'V1.voltage', v);
      const r = runTo(sim, sim.t + 0.005);
      if (Number.isNaN(up) && r['U2.y'] === true) up = v;
    }
    let down = Number.NaN;
    for (let v = 4; v >= 1; v -= 0.05) {
      set(sim, 'V1.voltage', v);
      const r = runTo(sim, sim.t + 0.005);
      if (Number.isNaN(down) && r['U2.y'] === false) down = v;
    }
    expect(up).toBeCloseTo(3, 1);
    expect(down).toBeCloseTo(2, 1);
  });

  it('lit LED: about 11 mA', () => {
    const r = runTo(start(limiar, { 'V1.voltage': 3.5 }), 0.05);
    expect(num(r, 'D1.current') * 1e3).toBeGreaterThan(10);
    expect(num(r, 'D1.current') * 1e3).toBeLessThan(12);
  });

  it('at 2,5 V, noise of 0,4 V is ignored and 0,8 V flips the reading 120 times a second', () => {
    const quiet = start(limiar, { 'V1.voltage': 2.5, 'VN.amplitude': 0.4 });
    expect(countEdges(quiet, 'U2.y', 0.5)).toBe(0);
    const noisy = start(limiar, { 'V1.voltage': 2.5, 'VN.amplitude': 0.8 });
    runTo(noisy, 0.1);
    expect(countEdges(noisy, 'U2.y', 1.1)).toBe(120);
  });
});
