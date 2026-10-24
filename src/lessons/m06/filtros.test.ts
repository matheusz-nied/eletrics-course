import { describe, expect, it } from 'vitest';
import { bodeCurve, cutoff } from '../../circuit/instruments/Bode';
import type { Sweep } from '../../circuit/runtime/sweep';
import type { CircuitDoc, ParamValue } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import crossover from './divisor-frequencias.circuit';
import rc from './filtro-rc-bode.circuit';
import rlc from './rlc-ressonancia.circuit';
import {
  REACTANCE_CURVES,
  RLC,
  capacitiveReactance,
  cutoffRC,
  cutoffRL,
  inductiveReactance,
  lowPassGain,
  qualityFactor,
  resonance,
  toDb,
} from './ressonancia-curvas';

/**
 * Values lesson 6.6 quotes: the three AC sweeps (what the Bode plot of the
 * simulation shows, including its −3 dB mark) and the formulas.
 */
function sweep(doc: CircuitDoc, settings: Record<string, ParamValue> = {}): Sweep {
  const sim = new Simulator(doc);
  for (const [key, value] of Object.entries(settings)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  return sim.frame({ samples: false }).sweep!;
}

/** Gain (dB) of `probe` at the swept frequency closest to `f`. */
function dbAt(s: Sweep, probe: string, f: number): number {
  let best = 0;
  s.f.forEach((x, i) => {
    if (Math.abs(Math.log(x / f)) < Math.abs(Math.log(s.f[best]! / f))) best = i;
  });
  return toDb(s.magnitude[probe]![best]!);
}

const peak = (s: Sweep, probe: string) => {
  const m = s.magnitude[probe]!;
  const i = m.indexOf(Math.max(...m));
  return { f: s.f[i]!, gain: m[i]! };
};

describe('as fórmulas da aula 6.6', () => {
  it('puts the RLC resonance at 503 Hz, where the reactances are 31,6 Ω', () => {
    expect(resonance(RLC.l, RLC.c)).toBeCloseTo(503.3, 1);
    const f0 = resonance(RLC.l, RLC.c);
    expect(inductiveReactance(f0, RLC.l)).toBeCloseTo(31.6, 1);
    expect(capacitiveReactance(f0, RLC.c)).toBeCloseTo(31.6, 1);
    expect(qualityFactor(10, RLC.l, RLC.c)).toBeCloseTo(3.16, 2);
  });

  it('gives the cut-off frequencies of the RC filter and of the crossover', () => {
    expect(cutoffRC(1000, 2.7e-6)).toBeCloseTo(58.9, 1);
    expect(cutoffRC(100, 2.7e-6)).toBeCloseTo(589, 0);
    expect(cutoffRL(0.47e-3, 8)).toBeCloseTo(2709, 0);
    expect(cutoffRC(8, 6.8e-6)).toBeCloseTo(2926, 0);
  });

  it('turns gains into decibels', () => {
    expect(toDb(1 / Math.SQRT2)).toBeCloseTo(-3.01, 2);
    expect(toDb(0.1)).toBeCloseTo(-20, 6);
    expect(toDb(0.01)).toBeCloseTo(-40, 6);
    expect(toDb(2)).toBeCloseTo(6.02, 2);
    // Worked example: 600 Hz on the 59 Hz low-pass.
    expect(lowPassGain(600, cutoffRC(1000, 2.7e-6))).toBeCloseTo(0.098, 3);
    expect(toDb(lowPassGain(600, cutoffRC(1000, 2.7e-6)))).toBeCloseTo(-20.2, 1);
  });

  it('plots the reactance curves of the RLC', () => {
    const [xl, xc, z] = REACTANCE_CURVES;
    expect(xl!.points[0]).toEqual([100, expect.closeTo(6.28, 2)]);
    expect(xc!.points[0]).toEqual([100, expect.closeTo(159.2, 1)]);
    const zMin = z!.points.reduce((a, b) => (b[1] < a[1] ? b : a));
    expect(zMin[0]).toBe(500);
    expect(zMin[1]).toBeCloseTo(10.0, 1);
  });
});

describe('o filtro RC na varredura (aula 6.6)', () => {
  it('marks the cut-off near 59 Hz, where both outputs are at −3 dB', () => {
    const s = sweep(rc);
    const fc = cutoff(bodeCurve(s, 'VC'))!;
    expect(fc).toBeGreaterThan(58);
    expect(fc).toBeLessThan(60);
    expect(cutoff(bodeCurve(s, 'VR'))).toBeCloseTo(fc, -1);
    expect(dbAt(s, 'VC', 1)).toBeCloseTo(0, 2);
    expect(dbAt(s, 'VR', 100_000)).toBeCloseTo(0, 2);
  });

  it('is about −20 dB at 600 Hz and −40 dB at 6 kHz on the capacitor', () => {
    const s = sweep(rc);
    expect(dbAt(s, 'VC', 600)).toBeGreaterThan(-21);
    expect(dbAt(s, 'VC', 600)).toBeLessThan(-19.5);
    expect(dbAt(s, 'VC', 6000)).toBeGreaterThan(-41);
    expect(dbAt(s, 'VC', 6000)).toBeLessThan(-39.5);
  });

  it('moves the cut-off ten times higher with R = 100 Ω', () => {
    const fc = cutoff(bodeCurve(sweep(rc, { 'R1.resistance': 100 }), 'VC'))!;
    expect(fc).toBeGreaterThan(580);
    expect(fc).toBeLessThan(600);
  });
});

describe('a ressonância RLC na varredura (aula 6.6)', () => {
  it('peaks the current near 503 Hz, with the resistor taking the whole 1 V', () => {
    for (const r of [10, 30, 100]) {
      const p = peak(sweep(rlc, { 'R1.resistance': r }), 'VR');
      expect(p.f).toBeGreaterThan(490);
      expect(p.f).toBeLessThan(515);
      expect(p.gain).toBeCloseTo(1, 2);
    }
  });

  it('puts 3,2 times the source on the capacitor with 10 Ω (+10 dB)', () => {
    const s = sweep(rlc);
    expect(dbAt(s, 'VC', 503)).toBeCloseTo(10, 0);
    expect(peak(s, 'VC').gain).toBeCloseTo(3.2, 1);
  });

  it('flattens the peak with more resistance: about 1,2 with 30 Ω, none with 100 Ω', () => {
    expect(peak(sweep(rlc, { 'R1.resistance': 30 }), 'VC').gain).toBeCloseTo(1.2, 1);
    expect(peak(sweep(rlc, { 'R1.resistance': 100 }), 'VC').gain).toBeLessThan(1);
    // Two octaves away (about 125 Hz and 2 kHz) the current is far smaller with 10 Ω.
    const s = sweep(rlc);
    expect(dbAt(s, 'VR', 100)).toBeLessThan(-23);
    expect(dbAt(s, 'VR', 2500)).toBeLessThan(-23);
  });

  it('marks no misleading cut-off on the band-pass curve', () => {
    for (const r of [10, 30, 100])
      expect(cutoff(bodeCurve(sweep(rlc, { 'R1.resistance': r }), 'VR'))).toBeNull();
  });
});

describe('o divisor de frequências (aula 6.6)', () => {
  it('sends the bass to the woofer and the treble to the tweeter', () => {
    const s = sweep(crossover);
    expect(cutoff(bodeCurve(s, 'VW'))).toBeCloseTo(2700, -2);
    expect(cutoff(bodeCurve(s, 'VT'))).toBeCloseTo(2870, -2);
    expect(dbAt(s, 'VW', 100)).toBeCloseTo(0, 1);
    expect(dbAt(s, 'VT', 100)).toBeCloseTo(-29.3, 0);
    expect(dbAt(s, 'VW', 10_000)).toBeCloseTo(-11.7, 0);
    expect(dbAt(s, 'VT', 10_000)).toBeCloseTo(-0.4, 0);
  });

  it('gives the tweeter the full bass when the capacitor is jumped', () => {
    const s = sweep(crossover, { 'S1.closed': true });
    expect(dbAt(s, 'VT', 100)).toBeCloseTo(0, 1);
    expect(dbAt(s, 'VT', 20)).toBeCloseTo(0, 1);
  });
});
