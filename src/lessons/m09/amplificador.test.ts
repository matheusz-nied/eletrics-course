import { describe, expect, it } from 'vitest';
import type { CircuitDoc } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import { measure } from '../../circuit/instruments/scope';
import emissorComum from './amplificador-emissor-comum.circuit';
import pushPull from './amplificador-push-pull.circuit';

/**
 * Values lesson 9.7 quotes from its two amplifiers, measured the way the
 * oscilloscope and the multimeter (CC) measure them, over ten cycles of the
 * 1 kHz generator once the circuit has settled.
 */

function record(doc: CircuitDoc, params: Record<string, number | boolean>, probes: string[]) {
  const sim = new Simulator(doc);
  for (const [key, value] of Object.entries(params)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  const t: number[] = [];
  const v: Record<string, number[]> = Object.fromEntries(probes.map((p) => [p, []]));
  while (sim.t < 0.08) {
    sim.step();
    if (sim.t < 0.07) continue;
    const r = sim.frame().readouts;
    t.push(sim.t);
    for (const p of probes) v[p]!.push(r[p] as number);
  }
  const m = (p: string) => measure(t, v[p]!);
  const min = (p: string) => Math.min(...v[p]!);
  const max = (p: string) => Math.max(...v[p]!);
  return { t, v, m, min, max };
}

describe('9.7 common emitter: operating point', () => {
  it('base 1,77 V, emitter 1,12 V, collector 6,78 V; about 1,3 mA from the 12 V supply', () => {
    const r = record(emissorComum, { 'V2.amplitude': 0 }, ['VB', 'VEM', 'VC', 'V1.current']);
    expect(r.m('VB').mean).toBeCloseTo(1.77, 1);
    expect(r.m('VEM').mean).toBeCloseTo(1.12, 2);
    expect(r.m('VC').mean).toBeCloseTo(6.78, 1);
    expect(Math.abs(r.m('V1.current').mean) * 1e3).toBeCloseTo(1.3, 1);
  });

  it('the worked example: 1,82 V, 1,12 mA, 6,74 V and 5,6 V across the transistor', () => {
    const vb = (12 * 10) / 66;
    const ic = (vb - 0.7) / 1000;
    expect(vb).toBeCloseTo(1.82, 2);
    expect(ic * 1e3).toBeCloseTo(1.12, 2);
    expect(12 - 4700 * ic).toBeCloseTo(6.74, 1);
    expect(12 - 4700 * ic - (vb - 0.7)).toBeCloseTo(5.6, 1);
  });
});

describe('9.7 common emitter: gain', () => {
  it('with CE and 5 mV: 10 mV and about 1,3 V peak to peak, a gain of about 130, inverted', () => {
    const r = record(emissorComum, {}, ['VIN', 'VOUT']);
    const vin = r.m('VIN').pp;
    const vout = r.m('VOUT').pp;
    expect(vin * 1e3).toBeCloseTo(10, 0);
    expect(vout).toBeCloseTo(1.3, 1);
    expect(vout / vin).toBeGreaterThan(125);
    expect(vout / vin).toBeLessThan(140);
    // Where the input peaks, the output is at its valley.
    const top = r.v.VIN!.indexOf(r.max('VIN'));
    expect(r.v.VOUT![top]!).toBeLessThan(-0.6);
  });

  it('the estimate with re = 26 mV / 1,11 mA: about 23 Ω and a gain of about 137', () => {
    const re = 0.026 / 1.11e-3;
    const rcRl = (4700 * 10000) / 14700;
    expect(re).toBeCloseTo(23, 0);
    expect(rcRl / 1000).toBeCloseTo(3.2, 1);
    expect(rcRl / re).toBeGreaterThan(135);
    expect(rcRl / re).toBeLessThan(139);
    expect(20 * Math.log10(130)).toBeCloseTo(42, 0);
    expect(20 * Math.log10(3.1)).toBeCloseTo(10, 0);
  });

  it('20 mV: about 5 V peak to peak, down to −3,0 V but only up to +2,1 V', () => {
    const r = record(emissorComum, { 'V2.amplitude': 0.02 }, ['VOUT']);
    expect(r.m('VOUT').pp).toBeCloseTo(5, 0);
    expect(r.min('VOUT')).toBeCloseTo(-3.0, 1);
    expect(r.max('VOUT')).toBeCloseTo(2.1, 1);
  });

  it('50 mV: clipped near −6 V (saturated, collector a little over 1,1 V) and +3 V (nearly cut off, collector near 10 V)', () => {
    const r = record(emissorComum, { 'V2.amplitude': 0.05 }, ['VOUT', 'VC', 'Q1.ic']);
    expect(r.min('VOUT')).toBeGreaterThan(-6.1);
    expect(r.min('VOUT')).toBeLessThan(-5.5);
    expect(r.max('VOUT')).toBeGreaterThan(3);
    expect(r.max('VOUT')).toBeLessThan(3.4);
    expect(r.min('VC')).toBeGreaterThan(1.1);
    expect(r.min('VC')).toBeLessThan(1.2);
    expect(r.max('VC')).toBeCloseTo(10, 0);
    expect(r.min('Q1.ic')).toBeLessThan(0.1e-3);
  });

  it('without CE and 5 mV: about 31 mV peak to peak, a gain of about 3', () => {
    const r = record(emissorComum, { 'S1.closed': false }, ['VIN', 'VOUT']);
    const gain = r.m('VOUT').pp / r.m('VIN').pp;
    expect(r.m('VOUT').pp * 1e3).toBeCloseTo(31, 0);
    expect(gain).toBeCloseTo(3.1, 1);
  });

  it('without CE and 1 V: about 6,1 V peak to peak, still a clean inverted sine', () => {
    const r = record(emissorComum, { 'S1.closed': false, 'V2.amplitude': 1 }, ['VIN', 'VOUT']);
    expect(r.m('VOUT').pp).toBeCloseTo(6.1, 1);
    // Both halves the same size within 5 %.
    expect(Math.abs(r.max('VOUT') + r.min('VOUT'))).toBeLessThan(0.05 * r.m('VOUT').pp);
    const top = r.v.VIN!.indexOf(r.max('VIN'));
    expect(r.v.VOUT![top]!).toBeLessThan(-2.9);
  });

  it('input impedance: 3,1 kΩ with CE and 8,1 kΩ without', () => {
    const z = (params: Record<string, number | boolean>) => {
      const r = record(emissorComum, params, ['VIN', 'V2.current']);
      return r.m('VIN').pp / r.m('V2.current').pp;
    };
    expect(z({}) / 1000).toBeCloseTo(3.1, 1);
    expect(z({ 'S1.closed': false }) / 1000).toBeCloseTo(8.1, 1);
  });

  it('class A: about 16 mW from the supply at rest, about 20 µW in the load with 5 mV', () => {
    const rest = record(emissorComum, { 'V2.amplitude': 0 }, ['V1.current']);
    expect(Math.abs(rest.m('V1.current').mean) * 12 * 1e3).toBeCloseTo(16, 0);
    const r = record(emissorComum, {}, ['VOUT']);
    expect((r.m('VOUT').rms ** 2 / 10000) * 1e6).toBeCloseTo(20, -1);
  });
});

describe('9.7 push-pull', () => {
  /** Largest input that still leaves the output under 10 mV. */
  const gap = (r: ReturnType<typeof record>) =>
    Math.max(...r.v.VIN!.filter((_, i) => Math.abs(r.v.VOUT![i]!) < 0.01).map(Math.abs));

  it('class B with 2 V: about 1,3 V peak out, with a dead zone of about ±0,6 V', () => {
    const r = record(pushPull, {}, ['VIN', 'VOUT']);
    expect(r.max('VOUT')).toBeCloseTo(1.3, 1);
    expect(-r.min('VOUT')).toBeCloseTo(1.3, 1);
    const fine = record(pushPull, { 'V2.amplitude': 0.8 }, ['VIN', 'VOUT']);
    expect(gap(fine)).toBeGreaterThan(0.5);
    expect(gap(fine)).toBeLessThan(0.65);
  });

  it('class B with 0,5 V: the output stays under 1 mV', () => {
    const r = record(pushPull, { 'V2.amplitude': 0.5 }, ['VOUT']);
    expect(Math.max(r.max('VOUT'), -r.min('VOUT'))).toBeLessThan(1e-3);
  });

  it('class AB: 1,4 mA at rest in each transistor; 1,9 V to 2,0 V out for 2 V in; 0,46 V for 0,5 V', () => {
    const rest = record(pushPull, { 'S1.closed': false, 'V2.amplitude': 0 }, ['Q1.ic', 'Q2.ic']);
    expect(rest.m('Q1.ic').mean * 1e3).toBeCloseTo(1.4, 1);
    expect(rest.m('Q2.ic').mean * 1e3).toBeCloseTo(1.4, 1);
    const r = record(pushPull, { 'S1.closed': false }, ['VIN', 'VOUT']);
    expect(r.max('VOUT')).toBeGreaterThan(1.85);
    expect(-r.min('VOUT')).toBeLessThan(2.02);
    expect(gap(r)).toBeLessThan(0.05);
    const small = record(pushPull, { 'S1.closed': false, 'V2.amplitude': 0.5 }, ['VOUT']);
    expect(small.max('VOUT')).toBeCloseTo(0.46, 1);
  });
});
