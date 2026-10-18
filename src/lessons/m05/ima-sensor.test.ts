import { describe, expect, it } from 'vitest';
import {
  distanceFor,
  fieldAt,
  hallLinear,
  hallSwitchNext,
  HALL_SWITCH,
  reedNext,
  REED,
} from './ima-sensor';

describe('campo do ímã no sensor', () => {
  it('falls with distance, roughly as 1/d³ far away', () => {
    let last = Infinity;
    for (let d = 0; d <= 50; d += 5) {
      const b = fieldAt(d, 'ferrite');
      expect(b).toBeLessThan(last);
      last = b;
    }
    // Doubling a large distance divides the field by about 8.
    const ratio = fieldAt(30, 'neodimio') / fieldAt(60, 'neodimio');
    expect(ratio).toBeGreaterThan(6.5);
    expect(ratio).toBeLessThan(8.5);
  });

  it('is about 3 times stronger for neodymium, and changes sign with the pole', () => {
    expect(fieldAt(15, 'neodimio') / fieldAt(15, 'ferrite')).toBeCloseTo(1.2 / 0.38, 6);
    expect(fieldAt(15, 'ferrite', 'norte')).toBeCloseTo(-fieldAt(15, 'ferrite', 'sul'), 9);
  });

  it('gives the field quoted in the lesson at the face of each magnet', () => {
    expect(fieldAt(0, 'ferrite')).toBeCloseTo(134, 0);
    expect(fieldAt(0, 'neodimio')).toBeCloseTo(424, 0);
  });
});

describe('reed switch', () => {
  it('closes and opens at the distances quoted in the lesson', () => {
    expect(distanceFor(REED.closeMt, 'ferrite')).toBeCloseTo(17, 0);
    expect(distanceFor(REED.openMt, 'ferrite')).toBeCloseTo(19.9, 0);
    expect(distanceFor(REED.closeMt, 'neodimio')).toBeCloseTo(26.5, 0);
    expect(distanceFor(REED.openMt, 'neodimio')).toBeCloseTo(30.7, 0);
  });

  it('keeps its state between the two thresholds (hysteresis)', () => {
    const between = fieldAt(18, 'ferrite');
    expect(between).toBeLessThan(REED.closeMt);
    expect(between).toBeGreaterThan(REED.openMt);
    // Coming closer from far away: still open at 18 mm, closed at 15 mm.
    let closed = reedNext(false, fieldAt(30, 'ferrite'));
    expect(closed).toBe(false);
    closed = reedNext(closed, between);
    expect(closed).toBe(false);
    closed = reedNext(closed, fieldAt(15, 'ferrite'));
    expect(closed).toBe(true);
    // Moving away: still closed at 18 mm, open at 22 mm.
    closed = reedNext(closed, between);
    expect(closed).toBe(true);
    closed = reedNext(closed, fieldAt(22, 'ferrite'));
    expect(closed).toBe(false);
  });

  it('answers to either pole', () => {
    expect(reedNext(false, fieldAt(10, 'ferrite', 'norte'))).toBe(true);
  });
});

describe('sensores Hall', () => {
  it('switches only with the south pole, with hysteresis', () => {
    expect(hallSwitchNext(false, fieldAt(5, 'ferrite', 'norte'))).toBe(false);
    expect(hallSwitchNext(false, fieldAt(5, 'ferrite', 'sul'))).toBe(true);
    expect(hallSwitchNext(true, (HALL_SWITCH.operateMt + HALL_SWITCH.releaseMt) / 2)).toBe(true);
    expect(hallSwitchNext(false, (HALL_SWITCH.operateMt + HALL_SWITCH.releaseMt) / 2)).toBe(false);
    expect(distanceFor(HALL_SWITCH.operateMt, 'ferrite')).toBeCloseTo(10.1, 0);
  });

  it('gives a linear output around 2,5 V that saturates near the rails', () => {
    expect(hallLinear(0)).toBe(2.5);
    expect(hallLinear(50)).toBeCloseTo(3.2, 6);
    expect(hallLinear(-50)).toBeCloseTo(1.8, 6);
    expect(hallLinear(1000)).toBe(4.1);
    expect(hallLinear(-1000)).toBe(0.9);
  });
});
