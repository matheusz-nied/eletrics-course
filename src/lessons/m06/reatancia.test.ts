import { describe, expect, it } from 'vitest';
import {
  capacitiveReactance,
  equalReactanceFrequency,
  inductiveReactance,
  reactanceCurves,
  seriesImpedance,
} from './reatancia';

describe('reatância e impedância (aula 6.4)', () => {
  it('gives the reactances the lesson quotes', () => {
    expect(capacitiveReactance(60, 10e-6)).toBeCloseTo(265.3, 1);
    expect(capacitiveReactance(1000, 10e-6)).toBeCloseTo(15.9, 1);
    expect(inductiveReactance(60, 0.1)).toBeCloseTo(37.7, 1);
    expect(inductiveReactance(1000, 0.1)).toBeCloseTo(628.3, 1);
    expect(equalReactanceFrequency(0.1, 10e-6)).toBeCloseTo(159.2, 1);
  });

  it('solves the coil of the simulation: 37,75 Ω and 187 mA at 60 Hz', () => {
    const { z, phase } = seriesImpedance(2, inductiveReactance(60, 0.1));
    expect(z).toBeCloseTo(37.75, 2);
    expect((10 / Math.SQRT2 / z) * 1000).toBeCloseTo(187.3, 1);
    expect(phase).toBeCloseTo(87, 0);
  });

  it('solves the gate motor winding of lesson 16.2, alone and with the capacitor', () => {
    const xl = inductiveReactance(60, 0.066);
    const xc = capacitiveReactance(60, 40e-6);
    expect(xl).toBeCloseTo(24.9, 1);
    expect(xc).toBeCloseTo(66.3, 1);
    const alone = seriesImpedance(30, xl);
    expect(alone.z).toBeCloseTo(39.0, 1);
    expect(127 / alone.z).toBeCloseTo(3.26, 2);
    expect(alone.phase).toBeCloseTo(39.7, 1);
    const withCap = seriesImpedance(30, xl - xc);
    expect(xl - xc).toBeCloseTo(-41.4, 1);
    expect(withCap.z).toBeCloseTo(51.2, 1);
    expect(127 / withCap.z).toBeCloseTo(2.48, 2);
    expect(withCap.phase).toBeCloseTo(-54.1, 1);
  });

  it('limits the LED bulb dropper: 0,33 µF lets about 15,8 mA through on 127 V', () => {
    const xc = capacitiveReactance(60, 0.33e-6);
    expect(xc).toBeGreaterThan(8030);
    expect(xc).toBeLessThan(8045);
    expect((127 / xc) * 1000).toBeCloseTo(15.8, 1);
    // A resistor limiting the same current would dissipate about 2 W.
    expect(127 ** 2 / xc).toBeCloseTo(2.0, 1);
    // On a 220 V outlet the current grows 1,73 times.
    expect((220 / xc) * 1000).toBeCloseTo(27.4, 1);
  });

  it('draws both curves crossing near 160 Hz', () => {
    const [c, l] = reactanceCurves();
    const at160 = (s: typeof c) => s!.points.find((p) => p[0] === 160)![1];
    expect(at160(c)).toBeCloseTo(99.5, 1);
    expect(at160(l)).toBeCloseTo(100.5, 1);
  });
});
