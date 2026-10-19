import { describe, expect, it } from 'vitest';
import type { CircuitDoc, ParamValue } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import { measure } from '../../circuit/instruments/scope';
import { dcAndRms } from '../../circuit/instruments/dmm';
import lampada from './cc-ca-lampada.circuit';
import eficaz from './eficaz-lampadas.circuit';

/**
 * Values lessons 6.1 and 6.2 quote from their lamp circuits, measured the way
 * the multimeter (mean or AC-coupled true RMS of the last 100 ms) and the
 * oscilloscope measure them, after the filaments have warmed up.
 */
function record(
  doc: CircuitDoc,
  settings: Record<string, ParamValue>,
  keys: string[],
  from = 1,
  to = 1.1,
) {
  const sim = new Simulator(doc);
  for (const [key, value] of Object.entries(settings)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  const t: number[] = [];
  const v: Record<string, number[]> = Object.fromEntries(keys.map((k) => [k, []]));
  while (sim.t < to) {
    sim.step();
    if (sim.t < from) continue;
    const r = sim.frame({ samples: false }).readouts;
    t.push(sim.t);
    for (const k of keys) v[k]!.push(Number(r[k]));
  }
  return {
    dmm: (k: string) => dcAndRms(v[k]!),
    scope: (k: string) => measure(t, v[k]!),
    min: (k: string) => Math.min(...v[k]!),
    max: (k: string) => Math.max(...v[k]!),
    mean: (k: string) => v[k]!.reduce((s, x) => s + x, 0) / v[k]!.length,
  };
}

describe('6.1: a mesma lâmpada em CC e em CA', () => {
  it('on the battery: a flat 12 V and 0,42 A', () => {
    const r = record(lampada, { 'S1.actuated': false }, ['VL', 'IL', 'L1.brightness']);
    expect(r.dmm('VL').mean).toBeCloseTo(12, 2);
    expect(r.scope('VL').pp).toBeLessThan(0.01);
    expect(r.dmm('IL').mean).toBeCloseTo(0.417, 3);
    expect(r.mean('L1.brightness')).toBeCloseTo(1, 2);
  });

  it('on the 60 Hz generator: 12 V RMS, 17 V peak, the same 0,42 A RMS, and a steady glow', () => {
    const r = record(lampada, {}, ['VL', 'IL', 'L1.brightness']);
    expect(r.dmm('VL').rms).toBeCloseTo(12, 1);
    expect(r.dmm('VL').mean).toBeCloseTo(0, 1);
    expect(r.max('VL')).toBeCloseTo(17, 1);
    expect(r.scope('VL').pp).toBeCloseTo(33.9, 1);
    expect(r.scope('VL').freq).toBeCloseTo(60, 0);
    expect(r.dmm('IL').rms).toBeCloseTo(0.417, 2);
    // The light ripples by less than 5 %: the eye sees it steady.
    expect(r.min('L1.brightness')).toBeGreaterThan(0.95);
    expect(r.max('L1.brightness')).toBeLessThan(1.05);
    expect(r.mean('L1.brightness')).toBeCloseTo(1, 2);
  });

  it('at 1 Hz the filament cools at every zero crossing: the lamp flickers', () => {
    const r = record(lampada, { 'G1.frequency': 1 }, ['L1.brightness'], 2, 4);
    expect(r.min('L1.brightness')).toBeLessThan(0.2);
    expect(r.max('L1.brightness')).toBeGreaterThan(2.5);
  });

  it('at 10 Hz it still flickers visibly (about ±20 %)', () => {
    const r = record(lampada, { 'G1.frequency': 10 }, ['L1.brightness'], 2, 3);
    expect(r.min('L1.brightness')).toBeLessThan(0.85);
    expect(r.max('L1.brightness')).toBeGreaterThan(1.15);
  });
});

describe('6.2: o que quer dizer 127 V eficazes', () => {
  const keys = [
    'V1',
    'V2',
    'V3',
    'L1.current',
    'L2.current',
    'L3.current',
    'L1.power',
    'L2.power',
    'L3.power',
    'L1.brightness',
    'L2.brightness',
    'L3.brightness',
  ];
  const r = record(eficaz, {}, keys);

  it('L1 (DC) and L2 (AC, 127 V RMS) read 127 V on the meter, in V⎓ and V~', () => {
    expect(r.dmm('V1').mean).toBeCloseTo(127, 1);
    expect(r.dmm('V2').rms).toBeCloseTo(127, 0);
    expect(r.dmm('V2').mean).toBeCloseTo(0, 0);
  });

  it('the scope shows 179,6 V peaks (359,2 V peak to peak) on L2 and 127 V peaks on L3', () => {
    expect(r.max('V2')).toBeCloseTo(179.6, 1);
    expect(r.scope('V2').pp).toBeCloseTo(359.2, 0);
    expect(r.max('V3')).toBeCloseTo(127, 1);
    expect(r.dmm('V3').rms).toBeCloseTo(89.8, 0);
  });

  it('L1 and L2 take the same 0,79 A and 100 W and glow alike', () => {
    expect(r.dmm('L1.current').mean).toBeCloseTo(0.787, 3);
    expect(r.dmm('L2.current').rms).toBeCloseTo(0.787, 2);
    expect(r.mean('L1.power')).toBeCloseTo(100, 0);
    expect(r.mean('L2.power')).toBeCloseTo(100, -1);
    expect(r.mean('L1.brightness')).toBeCloseTo(1, 2);
    expect(r.mean('L2.brightness')).toBeCloseTo(1, 2);
  });

  it('L3, with 127 V of peak, takes about 59 W and glows at about 30 % of the others', () => {
    expect(r.mean('L3.power')).toBeGreaterThan(57);
    expect(r.mean('L3.power')).toBeLessThan(60);
    expect(r.dmm('L3.current').rms).toBeCloseTo(0.65, 2);
    expect(r.mean('L3.brightness')).toBeGreaterThan(0.28);
    expect(r.mean('L3.brightness')).toBeLessThan(0.34);
  });
});
