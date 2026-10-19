import { describe, expect, it } from 'vitest';
import {
  COIL_RADIUS,
  MAGNETS,
  emf,
  fluxPerTurn,
  fluxSlope,
  leftFacePole,
  passTrace,
  peakEmf,
  voltsPerDivision,
} from './inducao';

const NEO = MAGNETS.neodimio.moment;
const FERRITE = MAGNETS.ferrite.moment;

describe('ímã atravessando a bobina', () => {
  it('has the flux slope that matches the flux', () => {
    for (const z of [-0.03, -0.004, 0.002, 0.011]) {
      const h = 1e-7;
      const numeric = (fluxPerTurn(z + h, NEO) - fluxPerTurn(z - h, NEO)) / (2 * h);
      expect(fluxSlope(z, NEO)).toBeCloseTo(numeric, 8);
    }
  });

  it('induces nothing while the magnet stands still, even inside the coil', () => {
    expect(emf(500, 0, 0, NEO)).toBe(0);
    expect(emf(500, 0.004, 0, NEO)).toBe(0);
    expect(leftFacePole(0.004, 0, NEO)).toBeUndefined();
  });

  it('grows in proportion to the turns and to the speed', () => {
    const base = peakEmf(500, 1, NEO);
    expect(peakEmf(1000, 1, NEO)).toBeCloseTo(2 * base, 10);
    expect(peakEmf(100, 1, NEO)).toBeCloseTo(base / 5, 10);
    expect(peakEmf(500, 2, NEO)).toBeCloseTo(2 * base, 10);
    expect(peakEmf(500, 1, FERRITE)).toBeCloseTo(base / 3, 10);
  });

  it('gives the values quoted in lesson 5.3', () => {
    // 500 turns, neodymium, 1 m/s: about 2 V of peak.
    expect(peakEmf(500, 1, NEO)).toBeCloseTo(2.02, 2);
    expect(peakEmf(1000, 1, NEO)).toBeCloseTo(4.05, 2);
    expect(peakEmf(500, 1, FERRITE)).toBeCloseTo(0.67, 2);
    expect(peakEmf(100, 0.2, FERRITE)).toBeCloseTo(0.027, 3);
    // Flux through one turn with the magnet at the centre: about 47 µWb.
    expect(fluxPerTurn(0, NEO)).toBeCloseTo(47.1e-6, 7);
  });

  it('puts the peak a half radius from the centre', () => {
    const at = (z: number) => Math.abs(emf(500, z, 1, NEO));
    const peak = at(COIL_RADIUS / 2);
    expect(peak).toBeGreaterThan(at(COIL_RADIUS * 0.45));
    expect(peak).toBeGreaterThan(at(COIL_RADIUS * 0.55));
  });

  it('makes two lobes of opposite sign as the magnet goes through', () => {
    const trace = passTrace(500, 1, NEO, 0.05);
    const min = trace.reduce((a, p) => (p.v < a.v ? p : a));
    const max = trace.reduce((a, p) => (p.v > a.v ? p : a));
    // North pole first, coming from the left: negative while it arrives, positive as it leaves.
    expect(min.v).toBeLessThan(-1.9);
    expect(min.t).toBeLessThan(0);
    expect(max.v).toBeGreaterThan(1.9);
    expect(max.t).toBeGreaterThan(0);
    // 10 ms between the two peaks at 1 m/s (they are at z = ±a/2).
    expect(max.t - min.t).toBeCloseTo(0.01, 3);
    // Crossing the centre the voltage is zero.
    expect(emf(500, 0, 1, NEO)).toBe(0);
  });

  it('flips the sign with the pole, and with the direction', () => {
    expect(emf(500, -0.005, 1, -NEO)).toBeCloseTo(-emf(500, -0.005, 1, NEO), 12);
    expect(emf(500, 0.005, -1, NEO)).toBeCloseTo(-emf(500, 0.005, 1, NEO), 12);
  });

  it('follows Lenz: the coil pushes back the magnet that arrives and holds the one that leaves', () => {
    // North pole first, from the left. Arriving: the left face becomes north (repels).
    expect(leftFacePole(-0.005, 1, NEO)).toBe('N');
    // Leaving to the right: the right face becomes north, pulling back the trailing south pole.
    expect(leftFacePole(0.005, 1, NEO)).toBe('S');
    // South pole first: everything flips.
    expect(leftFacePole(-0.005, 1, -NEO)).toBe('S');
  });

  it('chooses a scope scale where the peak fits', () => {
    expect(voltsPerDivision(2.02)).toBe(1);
    expect(voltsPerDivision(4.05)).toBe(2);
    expect(voltsPerDivision(0.027)).toBeCloseTo(0.01, 12);
    expect(voltsPerDivision(12.1)).toBe(5);
  });
});
