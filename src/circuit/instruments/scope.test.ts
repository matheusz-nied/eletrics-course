import { describe, expect, it } from 'vitest';
import { History } from '../runtime/history';
import { AMPLITUDE_DIVS, TIME_DIVS, autoTime, autoVertical, findTrigger, measure } from './scope';

function sine(f: number, amp: number, offset = 0, dt = 1e-4, n = 2000) {
  const t: number[] = [];
  const v: number[] = [];
  for (let i = 0; i < n; i++) {
    t.push(i * dt);
    v.push(offset + amp * Math.sin(2 * Math.PI * f * i * dt));
  }
  return { t, v };
}

describe('measure', () => {
  it('gives peak to peak, RMS and frequency of a sine', () => {
    const { t, v } = sine(60, 10);
    const m = measure(t, v);
    expect(m.pp).toBeCloseTo(20, 1);
    expect(m.rms).toBeCloseTo(10 / Math.SQRT2, 1);
    expect(m.mean).toBeCloseTo(0, 1);
    expect(m.freq).toBeCloseTo(60, 0);
  });

  it('has no frequency for a constant', () => {
    const m = measure([0, 1, 2], [5, 5, 5]);
    expect(m.pp).toBe(0);
    expect(m.mean).toBe(5);
    expect(Number.isNaN(m.freq)).toBe(true);
  });
});

describe('findTrigger', () => {
  it('finds the latest rising crossing of the level', () => {
    const h = new History(4096);
    h.track('v');
    const { t, v } = sine(50, 1);
    t.forEach((x, i) => h.push(x, () => v[i]!));
    const tc = findTrigger(h, 'v', 0, 'rise', 0, 0.15)!;
    // rising zero crossings of a 50 Hz sine are at multiples of 20 ms
    expect(tc / 0.02 - Math.round(tc / 0.02)).toBeCloseTo(0, 3);
    expect(tc).toBeLessThanOrEqual(0.15);
    expect(findTrigger(h, 'v', 2, 'rise', 0, 0.15)).toBeNull();
  });
});

describe('automatic setup', () => {
  it('shows about three periods and fits the amplitude', () => {
    expect(TIME_DIVS[autoTime(60, 0)]).toBe(0.005);
    const setup = autoVertical(measure(...(Object.values(sine(60, 10)) as [number[], number[]])));
    expect(AMPLITUDE_DIVS[setup.div]).toBe(5);
    expect(setup.offset).toBe(0);
  });

  it('centres a signal that rides on a DC level', () => {
    const { t, v } = sine(60, 0.5, 6);
    const setup = autoVertical(measure(t, v));
    const size = AMPLITUDE_DIVS[setup.div]!;
    // the whole signal (5,5 V to 6,5 V) is on the 8-division screen
    expect(5.5 / size + setup.offset).toBeGreaterThanOrEqual(-4);
    expect(6.5 / size + setup.offset).toBeLessThanOrEqual(4);
    expect(size).toBeLessThanOrEqual(2);
  });
});
