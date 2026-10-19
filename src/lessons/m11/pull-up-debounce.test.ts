import { describe, expect, it } from 'vitest';
import debounce from './debounce.circuit';
import flutuante from './entrada-flutuante.circuit';
import { countEdges, num, runTo, set, start } from './sim';

/** Values lesson 11.3 quotes from its circuits. */

describe('11.3 floating input', () => {
  it('without the pull-up, the mains swings the input and the LED flickers 60 times a second', () => {
    const sim = start(flutuante);
    runTo(sim, 0.1);
    let lo = Infinity;
    let hi = -Infinity;
    runTo(sim, 0.6, (r) => {
      lo = Math.min(lo, num(r, 'VIN'));
      hi = Math.max(hi, num(r, 'VIN'));
    });
    expect(lo).toBeLessThan(0);
    expect(lo).toBeGreaterThan(-0.8);
    expect(hi).toBeGreaterThan(5);
    expect(hi).toBeLessThan(5.8);
    // Half a second, from 0,6 s to 1,1 s: 30 cycles, each turns the LED on and off.
    expect(countEdges(sim, 'U1.y', 1.1)).toBe(60);
  });

  it('with the pull-up, the input stays near 5 V (a few tens of millivolts of ripple)', () => {
    const sim = start(flutuante, { 'S1.closed': true });
    runTo(sim, 0.1);
    let lo = Infinity;
    let hi = -Infinity;
    runTo(sim, 0.5, (r) => {
      lo = Math.min(lo, num(r, 'VIN'));
      hi = Math.max(hi, num(r, 'VIN'));
    });
    expect(hi - lo).toBeLessThan(0.08);
    expect(lo).toBeGreaterThan(4.9);
    expect(countEdges(sim, 'U1.y', 1)).toBe(0);
  });

  it('with the pull-up, the button pulls the input to 0 V and lights the LED; 0,5 mA in the resistor', () => {
    const r = runTo(start(flutuante, { 'S1.closed': true, 'B1.pressed': true }), 0.2);
    expect(Math.abs(num(r, 'VIN'))).toBeLessThan(0.01);
    expect(num(r, 'D3.brightness')).toBeGreaterThan(0.3);
    expect(num(r, 'R1.current') * 1e3).toBeCloseTo(0.5, 2);
  });
});

/** Presses and releases the button `n` times, 50 ms apart, and returns the count. */
function presses(filter: boolean, n: number) {
  const sim = start(debounce, { 'SW.actuated': filter });
  runTo(sim, 0.01);
  const counts: number[] = [];
  for (let k = 0; k < n; k++) {
    set(sim, 'B1.pressed', true);
    runTo(sim, sim.t + 0.05);
    set(sim, 'B1.pressed', false);
    runTo(sim, sim.t + 0.05);
    counts.push(num(sim.frame().readouts, 'U2.count'));
  }
  return { counts, sim };
}

describe('11.3 bounce and the RC filter', () => {
  it('without the filter, each press counts several times', () => {
    const { counts } = presses(false, 3);
    const each = counts.map((c, k) => c - (k ? counts[k - 1] : 0));
    for (const n of each) expect(n).toBeGreaterThanOrEqual(3);
    expect(Math.max(...each)).toBeLessThanOrEqual(7);
  });

  it('with the filter, each press counts once', () => {
    expect(presses(true, 5).counts).toEqual([1, 2, 3, 4, 5]);
  });

  it('the contact bounces between 0 V and 5 V for about 4 ms', () => {
    const sim = start(debounce);
    runTo(sim, 0.01);
    set(sim, 'B1.pressed', true);
    const t0 = sim.t;
    let last = 5;
    let flips = 0;
    let settled = 0;
    runTo(sim, t0 + 0.02, (r, t) => {
      const v = num(r, 'VCONT');
      if ((v < 2.5) !== (last < 2.5)) {
        flips++;
        settled = t - t0;
      }
      last = v;
    });
    expect(flips).toBeGreaterThanOrEqual(5);
    expect(settled * 1e3).toBeLessThan(4.2);
    expect(last).toBeLessThan(0.01);
  });

  it('with the filter, the input falls slowly and crosses 2 V once, a few ms after the press', () => {
    const sim = start(debounce, { 'SW.actuated': true });
    runTo(sim, 0.01);
    set(sim, 'B1.pressed', true);
    const t0 = sim.t;
    let crossed = 0;
    let at = 0;
    let wasHigh = true;
    runTo(sim, t0 + 0.03, (r, t) => {
      const high = r['U1.y'] === false;
      if (high !== wasHigh) {
        crossed++;
        at = t - t0;
      }
      wasHigh = high;
    });
    expect(crossed).toBe(1);
    expect(at * 1e3).toBeGreaterThan(3);
    expect(at * 1e3).toBeLessThan(12);
  });

  it('the reset button clears the count', () => {
    const { sim } = presses(false, 1);
    set(sim, 'B2.pressed', true);
    runTo(sim, sim.t + 0.001);
    set(sim, 'B2.pressed', false);
    expect(num(runTo(sim, sim.t + 0.001), 'U2.count')).toBe(0);
  });
});
