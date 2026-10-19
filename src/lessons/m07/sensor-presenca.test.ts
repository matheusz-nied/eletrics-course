import { describe, expect, it } from 'vitest';
import {
  isOn,
  lightIntervals,
  OFF,
  onMotion,
  remaining,
  tick,
  walkMotions,
  WALK_S,
  type Settings,
} from './sensor-presenca';

const NIGHT = 1;
const DAY = 300;
const s = (time: number, luxLimit = 50): Settings => ({ time, luxLimit });

describe('sensor de presença (aula 7.7)', () => {
  it('turns on with movement in the dark and goes off TIME seconds later', () => {
    const { lamp, outcome } = onMotion(OFF, 0, NIGHT, s(30));
    expect(outcome).toBe('acendeu');
    expect(isOn(lamp, 29.9)).toBe(true);
    expect(remaining(lamp, 10)).toBeCloseTo(20, 9);
    expect(isOn(lamp, 30)).toBe(false);
    expect(tick(lamp, 31)).toEqual(OFF);
  });

  it('counts the time from the last movement: a walk of 6 s with TIME 30 s keeps it on 36 s', () => {
    const intervals = lightIntervals(walkMotions(0), NIGHT, s(30));
    expect(intervals).toHaveLength(1);
    expect(intervals[0]![0]).toBe(0);
    expect(intervals[0]![1]).toBeCloseTo(WALK_S + 30, 6);
  });

  it('renews the timer with each movement: passes at 0 s and 40 s with TIME 60 s, off at 100 s', () => {
    const intervals = lightIntervals([0, 40], NIGHT, s(60));
    expect(intervals).toEqual([[0, 100]]);
    expect(onMotion(onMotion(OFF, 0, NIGHT, s(60)).lamp, 40, NIGHT, s(60)).outcome).toBe('renovou');
  });

  it('lets a still person sit in the dark: a single movement, off after TIME', () => {
    // Walks in for 3 s and sits down: nothing moves after that.
    const intervals = lightIntervals(walkMotions(0, 0.1, 3), NIGHT, s(60));
    expect(intervals[0]![1]).toBeCloseTo(63, 6);
  });

  it('ignores movement in daylight above the LUX setting', () => {
    expect(onMotion(OFF, 0, DAY, s(30, 50)).outcome).toBe('claro-demais');
    expect(lightIntervals([0, 5], DAY, s(30, 50))).toEqual([]);
    // Late afternoon (30 lx) is below 50 lx: it turns on; below 5 lx it does not.
    expect(onMotion(OFF, 0, 30, s(30, 50)).outcome).toBe('acendeu');
    expect(onMotion(OFF, 0, 30, s(30, 5)).outcome).toBe('claro-demais');
    // With the knob in the sun it always turns on.
    expect(onMotion(OFF, 0, DAY, s(30, Infinity)).outcome).toBe('acendeu');
  });

  it('keeps the light on with movement even if the room is bright, once it is on', () => {
    const on = onMotion(OFF, 0, 30, s(30, 50)).lamp;
    const r = onMotion(on, 10, DAY, s(30, 50));
    expect(r.outcome).toBe('renovou');
    expect(r.lamp.offAt).toBe(40);
  });

  it('starts a new interval after the light went off', () => {
    expect(lightIntervals([0, 50], NIGHT, s(30))).toEqual([
      [0, 30],
      [50, 80],
    ]);
  });
});
