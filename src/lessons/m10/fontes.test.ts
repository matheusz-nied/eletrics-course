import { describe, expect, it } from 'vitest';
import type { CircuitDoc, ParamValue } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import fonteLinear from './fonte-linear.circuit';
import buck from './buck.circuit';

/**
 * Values lessons 10.1 and 10.2 quote from their transient circuits, measured
 * over a window after the filter capacitors have charged. These circuits
 * have no `goals`: the goal panel checks instantaneous readouts, which ripple.
 */

function record(
  doc: CircuitDoc,
  params: Record<string, ParamValue>,
  channels: string[],
  from: number,
  to: number,
) {
  const sim = new Simulator(doc);
  for (const [key, value] of Object.entries(params)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  const v: Record<string, number[]> = Object.fromEntries(channels.map((c) => [c, []]));
  const early: Record<string, number[]> = Object.fromEntries(channels.map((c) => [c, []]));
  while (sim.t < to) {
    sim.step();
    const frame = sim.frame({ samples: false });
    const into = sim.t < from ? early : v;
    for (const c of channels) into[c]!.push(frame.readouts[c] as number);
  }
  const max = (c: string) => Math.max(...v[c]!);
  const min = (c: string) => Math.min(...v[c]!);
  const mean = (c: string) => v[c]!.reduce((s, x) => s + x, 0) / v[c]!.length;
  const startupMax = (c: string) => Math.max(...early[c]!);
  return { max, min, mean, startupMax };
}

/** Each case simulates up to a second of mains; give it room on a loaded runner. */
const SLOW = { timeout: 30_000 };

const TRAFO_15 = { 'T1.ratio': 127 / 15 };

describe('10.1 linear supply (7812)', SLOW, () => {
  it('12 V transformer, 2.200 µF, 0,5 A: input between 13,2 and 14,5 V, output dips to 11,3 V with 0,7 V of ripple', () => {
    const r = record(fonteLinear, {}, ['VIN', 'VOUT'], 0.8, 0.9);
    expect(r.min('VIN')).toBeCloseTo(13.2, 1);
    expect(r.max('VIN')).toBeCloseTo(14.5, 1);
    expect(r.min('VOUT')).toBeCloseTo(11.3, 1);
    expect(r.max('VOUT') - r.min('VOUT')).toBeCloseTo(0.7, 1);
  });

  it('12 V transformer, 0,25 A: the valley rises to 14,0 V and the output is a flat 12,0 V', () => {
    const r = record(fonteLinear, { 'RL.resistance': 48 }, ['VIN', 'VOUT'], 0.8, 0.9);
    expect(r.min('VIN')).toBeCloseTo(14.0, 1);
    expect(r.min('VOUT')).toBeCloseTo(12.0, 1);
    expect(r.max('VOUT') - r.min('VOUT')).toBeLessThan(0.02);
  });

  it('12 V transformer, 4.700 µF, 0,5 A: the valley stays at 13,5 V', () => {
    const r = record(fonteLinear, { 'C1.capacitance': 4700e-6 }, ['VIN'], 0.8, 0.9);
    expect(r.min('VIN')).toBeCloseTo(13.5, 1);
  });

  it('15 V transformer, 0,5 A: input between 17,1 and 18,5 V (17,8 V mean), a flat 12,0 V out, about 3 W in the regulator', () => {
    const r = record(fonteLinear, TRAFO_15, ['VIN', 'VOUT', 'U1.power'], 0.8, 0.9);
    expect(r.min('VIN')).toBeCloseTo(17.1, 1);
    expect(r.max('VIN')).toBeCloseTo(18.5, 1);
    expect(r.mean('VIN')).toBeCloseTo(17.8, 1);
    expect(r.min('VOUT')).toBeCloseTo(12.0, 1);
    expect(r.max('VOUT') - r.min('VOUT')).toBeLessThan(0.02);
    expect(r.mean('U1.power')).toBeCloseTo(3, 0);
  });

  it('15 V transformer, 1.000 µF, 1 A: the valley drops to 13,5 V and the ripple shows again at the output', () => {
    const r = record(
      fonteLinear,
      { ...TRAFO_15, 'C1.capacitance': 1000e-6, 'RL.resistance': 12 },
      ['VIN', 'VOUT'],
      0.8,
      0.9,
    );
    expect(r.min('VIN')).toBeCloseTo(13.5, 1);
    expect(r.max('VOUT') - r.min('VOUT')).toBeGreaterThan(0.3);
  });
});

describe('10.2 buck converter', SLOW, () => {
  it('44 %, 0,5 A: 5,0 V out with 15 mV of ripple, inductor current between 0,2 and 0,8 A, 0,22 A from the input', () => {
    const r = record(buck, {}, ['VOUT', 'IL', 'IIN', 'VSW'], 0.01, 0.012);
    expect(r.mean('VOUT')).toBeCloseTo(5.0, 1);
    expect(r.max('VOUT') - r.min('VOUT')).toBeLessThan(0.025);
    expect(r.min('IL')).toBeCloseTo(0.2, 1);
    expect(r.max('IL')).toBeCloseTo(0.8, 1);
    expect(r.max('IL') - r.min('IL')).toBeCloseTo(0.6, 1);
    expect(Math.abs(r.mean('IIN'))).toBeCloseTo(0.22, 1);
    expect(r.max('VSW')).toBeCloseTo(12, 0);
    expect(r.min('VSW')).toBeCloseTo(-0.4, 0);
  });

  it('25 % gives 2,7 V and 75 % gives 8,8 V at 0,5 A', () => {
    const low = record(buck, { 'VG.duty': 0.25 }, ['VOUT'], 0.01, 0.012);
    expect(low.mean('VOUT')).toBeCloseTo(2.7, 1);
    const high = record(buck, { 'VG.duty': 0.75 }, ['VOUT'], 0.01, 0.012);
    expect(high.mean('VOUT')).toBeCloseTo(8.8, 0);
  });

  it('a light load (0,1 A) runs discontinuous and the output rises to 7,3 V', () => {
    const r = record(buck, { 'RL.resistance': 50 }, ['VOUT', 'IL'], 0.01, 0.012);
    expect(r.mean('VOUT')).toBeCloseTo(7.3, 1);
    expect(r.min('IL')).toBeCloseTo(0, 2);
  });
});
