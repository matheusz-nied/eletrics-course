import { describe, expect, it } from 'vitest';
import astable from './ci555-astavel.circuit';
import monostable from './ci555-monoestavel.circuit';
import { num, runTo, set, start } from './sim';

/** Values lesson 11.5 quotes from its circuits. */

/** Times of the rising and falling edges of the 555 output, after the first cycle. */
function astableEdges(r2: number, until: number) {
  const sim = start(astable, { 'R2.resistance': r2 });
  const rises: number[] = [];
  const falls: number[] = [];
  let lo = Infinity;
  let hi = -Infinity;
  let was = true;
  runTo(sim, until, (r, t) => {
    const high = r['U1.high'] as boolean;
    if (high && !was) rises.push(t);
    if (!high && was) falls.push(t);
    was = high;
    if (t > 2) {
      lo = Math.min(lo, num(r, 'VC'));
      hi = Math.max(hi, num(r, 'VC'));
    }
  });
  return { rises, falls, lo, hi, sim };
}

describe('11.5 astable', () => {
  it('with 68 kΩ: about 0,99 Hz, high 0,54 s and low 0,47 s', () => {
    const { rises, falls } = astableEdges(68000, 6);
    const period = rises[3] - rises[2];
    expect(1 / period).toBeCloseTo(0.99, 1);
    const fallAfter = falls.find((f) => f > rises[2])!;
    expect(fallAfter - rises[2]).toBeCloseTo(0.54, 1);
    expect(rises[3] - fallAfter).toBeCloseTo(0.47, 1);
  });

  it('the capacitor swings between 3 V and 6 V (1/3 and 2/3 of 9 V)', () => {
    const { lo, hi } = astableEdges(68000, 5);
    expect(lo).toBeCloseTo(3, 1);
    expect(hi).toBeCloseTo(6, 1);
  });

  it('a smaller R2 blinks faster: 1,9 Hz with 33 kΩ, 3,6 Hz with 15 kΩ', () => {
    for (const [r2, f] of [
      [33000, 1.89],
      [15000, 3.6],
    ]) {
      const { rises } = astableEdges(r2, 4);
      expect(1 / (rises[4] - rises[3])).toBeGreaterThan(f * 0.93);
      expect(1 / (rises[4] - rises[3])).toBeLessThan(f * 1.07);
    }
  });

  it('LED 1 lights while the output is high, LED 2 while it is low', () => {
    const sim = start(astable);
    let was: boolean | undefined;
    runTo(sim, 1.5, (r) => {
      const high = r['U1.high'] as boolean;
      // The output stage follows the internal flip-flop one step later.
      const settled = high === was;
      was = high;
      if (!settled) return;
      if (high) {
        expect(num(r, 'D1.brightness')).toBeGreaterThan(0.4);
        expect(num(r, 'D2.brightness')).toBeLessThan(0.1);
      } else {
        expect(num(r, 'D1.brightness')).toBeLessThan(0.05);
        expect(num(r, 'D2.brightness')).toBeGreaterThan(0.5);
      }
    });
  });
});

/** Presses the trigger for `press` s and returns how long the output stays high. */
function pulse(r1: number, press = 0.1) {
  const sim = start(monostable, { 'R1.resistance': r1 });
  runTo(sim, 0.5);
  expect(sim.frame().readouts['U1.high']).toBe(false);
  set(sim, 'B1.pressed', true);
  const t0 = sim.t;
  let rise = -1;
  let fall = -1;
  let released = false;
  runTo(sim, t0 + 8, (r, t) => {
    if (!released && t - t0 >= press) {
      set(sim, 'B1.pressed', false);
      released = true;
    }
    if (rise < 0 && r['U1.high']) rise = t;
    if (rise >= 0 && fall < 0 && !r['U1.high']) fall = t;
  });
  return fall - rise;
}

describe('11.5 monostable', () => {
  it('stays off until the button is pressed', () => {
    const r = runTo(start(monostable), 3);
    expect(r['U1.high']).toBe(false);
    expect(num(r, 'D1.brightness')).toBeLessThan(0.01);
  });

  it('t = 1,1·R·C: 1,1 s, 2,4 s and 5,2 s', () => {
    expect(pulse(100000)).toBeCloseTo(1.1, 1);
    expect(pulse(220000)).toBeCloseTo(2.42, 1);
    expect(pulse(470000)).toBeCloseTo(5.17, 1);
  });

  it('pressing again during the pulse does not restart it', () => {
    const sim = start(monostable);
    runTo(sim, 0.5);
    set(sim, 'B1.pressed', true);
    runTo(sim, 0.6);
    set(sim, 'B1.pressed', false);
    runTo(sim, 1.2);
    set(sim, 'B1.pressed', true);
    runTo(sim, 1.3);
    set(sim, 'B1.pressed', false);
    // The pulse from 0,5 s ends at about 1,6 s, not 1,2 + 1,1 = 2,3 s.
    const r = runTo(sim, 1.8);
    expect(r['U1.high']).toBe(false);
  });
});
