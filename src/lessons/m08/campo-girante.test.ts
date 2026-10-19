import { describe, expect, it } from 'vitest';
import { coilCurrents, direction, fieldLocus, magnitude, rotation, statorField } from './campo-girante';

describe('campo girante', () => {
  it('has three balanced currents that add up to zero', () => {
    for (const t of [0, 37, 90, 200]) {
      const [a, b, c] = coilCurrents(t, 'normal');
      expect(a + b + c).toBeCloseTo(0, 12);
    }
  });

  it('turns with a constant size of 1,5 coils, one turn per cycle', () => {
    for (const t of [0, 45, 130, 300]) {
      const f = statorField(t, 'normal');
      expect(magnitude(f)).toBeCloseTo(1.5, 12);
      expect(direction(f)).toBeCloseTo((90 + t) % 360, 9);
    }
  });

  it('turns the other way with two phases swapped', () => {
    for (const t of [10, 100, 250]) {
      const f = statorField(t, 'invertida');
      expect(magnitude(f)).toBeCloseTo(1.5, 12);
      expect(direction(f)).toBeCloseTo((((90 - t) % 360) + 360) % 360, 9);
    }
    expect(rotation('normal')).toBe(1);
    expect(rotation('invertida')).toBe(-1);
  });

  it('only pulses along a fixed line with one phase missing', () => {
    expect(rotation('falta-fase')).toBe(0);
    const locus = fieldLocus('falta-fase');
    const peak = Math.max(...locus.map(magnitude));
    expect(peak).toBeCloseTo(1.5, 2);
    // Every point lies on the same line through the centre (axis at 60°/240°, between coils 1 and 2).
    for (const p of locus) {
      if (magnitude(p) < 1e-6) continue;
      const d = direction(p) % 180;
      expect(d).toBeCloseTo(60, 6);
    }
    expect(coilCurrents(77, 'falta-fase')[2]).toBe(0);
  });
});
