import { describe, expect, it } from 'vitest';
import { degreesToMs, instant, shiftWords, sum, tip, wrapDegrees } from './fasores';

const A = { amplitude: 100, phase: 0 };

describe('fasores (aula 6.3)', () => {
  it('reads the wave as the height of the arrow tip', () => {
    for (const theta of [0, 30, 90, 200, 333]) {
      const p = { amplitude: 80, phase: 45 };
      expect(tip(p, theta).y).toBeCloseTo(instant(p, theta), 10);
    }
    expect(instant(A, 90)).toBeCloseTo(100, 10);
  });

  it('a leading wave peaks earlier', () => {
    // At θ = 0 the wave 90° ahead is already at its peak.
    expect(instant({ amplitude: 100, phase: 90 }, 0)).toBeCloseTo(100, 10);
    expect(instant({ amplitude: 100, phase: -90 }, 0)).toBeCloseTo(-100, 10);
  });

  it('adds two equal waves as the lesson says: 200, 141, 100 and 0 %', () => {
    expect(sum(A, { amplitude: 100, phase: 0 }).amplitude).toBeCloseTo(200, 6);
    const q = sum(A, { amplitude: 100, phase: 90 });
    expect(q.amplitude).toBeCloseTo(141.4, 1);
    expect(q.phase).toBeCloseTo(45, 6);
    expect(sum(A, { amplitude: 100, phase: 120 }).amplitude).toBeCloseTo(100, 6);
    expect(sum(A, { amplitude: 100, phase: 180 }).amplitude).toBeCloseTo(0, 6);
  });

  it('gives the 61 mA of the transformer in lesson 5.4 (54 mA and 29 mA, 90° apart)', () => {
    const total = sum({ amplitude: 54, phase: 0 }, { amplitude: 29, phase: -90 });
    expect(total.amplitude).toBeCloseTo(61.3, 1);
  });

  it('turns degrees into milliseconds at 60 Hz', () => {
    expect(degreesToMs(360)).toBeCloseTo(16.67, 2);
    expect(degreesToMs(90)).toBeCloseTo(4.17, 2);
    expect(degreesToMs(94)).toBeCloseTo(4.35, 2);
  });

  it('names the shift', () => {
    expect(shiftWords(0)).toBe('em fase');
    expect(shiftWords(90)).toBe('adiantada');
    expect(shiftWords(-30)).toBe('atrasada');
    expect(shiftWords(180)).toBe('em oposição');
    expect(shiftWords(-180)).toBe('em oposição');
    expect(wrapDegrees(270)).toBe(-90);
  });
});
