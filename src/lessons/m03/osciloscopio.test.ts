import { describe, expect, it } from 'vitest';
import type { CircuitDoc } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import {
  AMPLITUDE_DIVS,
  TIME_DIVS,
  autoTime,
  autoVertical,
  measure,
} from '../../circuit/instruments/scope';
import senoide from './osc-senoide.circuit';
import ondulacao from './osc-ondulacao.circuit';
import rcFase from './osc-rc-fase.circuit';

/**
 * Values lesson 3.5 quotes from its AC circuits, measured the way the
 * oscilloscope measures them. These circuits have no `goals`: the goal panel
 * checks instantaneous readouts, which swing with the sine.
 */

function record(
  doc: CircuitDoc,
  params: Record<string, number>,
  from: number,
  to: number,
  probes: string[],
) {
  const sim = new Simulator(doc);
  for (const [key, value] of Object.entries(params)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  const t: number[] = [];
  const v: Record<string, number[]> = Object.fromEntries(probes.map((p) => [p, []]));
  while (sim.t < to) {
    sim.step();
    if (sim.t < from) continue;
    const r = sim.frame().readouts;
    t.push(sim.t);
    for (const p of probes) v[p]!.push(r[p] as number);
  }
  return { t, v };
}

/** Times where the signal crosses zero going up. */
function risingZeros(t: number[], v: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < v.length; i++) {
    if (v[i - 1]! < 0 && v[i]! >= 0) {
      out.push(t[i - 1]! + ((0 - v[i - 1]!) / (v[i]! - v[i - 1]!)) * (t[i]! - t[i - 1]!));
    }
  }
  return out;
}

const div = (i: number) => AMPLITUDE_DIVS[i]!;

describe('3.5 signal generator', () => {
  it('2 V peak at 1 kHz: 4 V peak to peak, 1,41 V rms', () => {
    const { t, v } = record(senoide, {}, 0.02, 0.025, ['VE']);
    const m = measure(t, v.VE!);
    expect(m.pp).toBeCloseTo(4, 2);
    expect(m.rms).toBeCloseTo(1.414, 2);
    expect(m.freq).toBeCloseTo(1000, -1);
  });

  it('5 V at 60 Hz: 10 V peak to peak, 3,54 V rms; autoset picks 2 V/div and 5 ms/div', () => {
    const { t, v } = record(senoide, { 'V1.amplitude': 5, 'V1.frequency': 60 }, 0.05, 0.1, ['VE']);
    const m = measure(t, v.VE!);
    expect(m.pp).toBeCloseTo(10, 1);
    expect(m.rms).toBeCloseTo(3.54, 2);
    expect(m.freq).toBeCloseTo(60, 0);
    expect(div(autoVertical(m).div)).toBe(2);
    expect(TIME_DIVS[autoTime(m.freq, 0.05)]).toBeCloseTo(0.005, 6);
  });
});

describe('3.5 ripple with DC and AC coupling', () => {
  it('good capacitor: 12 V with 0,2 V of ripple; AC coupling keeps only the ripple', () => {
    const { t, v } = record(ondulacao, {}, 0.05, 0.1, ['VDC', 'VAC']);
    const dc = measure(t, v.VDC!);
    const ac = measure(t, v.VAC!);
    expect(dc.mean).toBeCloseTo(12, 2);
    expect(dc.pp).toBeCloseTo(0.2, 2);
    expect(ac.pp).toBeGreaterThan(0.19);
    expect(ac.pp).toBeLessThan(0.201);
    expect(Math.abs(ac.mean)).toBeLessThan(0.005);
    expect(ac.freq).toBeCloseTo(120, 0);
    // the multimeter in CA: rms of the ripple
    expect(Math.sqrt(ac.rms ** 2 - ac.mean ** 2)).toBeCloseTo(0.0707, 3);
    // autoset: 5 V/div for the 12 V line, 50 mV/div for the ripple
    expect(div(autoVertical(dc).div)).toBe(5);
    expect(div(autoVertical(ac).div)).toBeCloseTo(0.05, 6);
  });

  it('dried capacitor: 2 V of ripple, 0,71 V rms, autoset 500 mV/div', () => {
    const { t, v } = record(ondulacao, { 'V1.amplitude': 1 }, 0.05, 0.1, ['VDC', 'VAC']);
    const ac = measure(t, v.VAC!);
    expect(ac.pp).toBeGreaterThan(1.95);
    expect(ac.pp).toBeLessThan(2.01);
    expect(ac.rms).toBeCloseTo(0.707, 2);
    expect(measure(t, v.VDC!).mean).toBeCloseTo(12, 2);
    expect(div(autoVertical(ac).div)).toBeCloseTo(0.5, 6);
  });
});

describe('3.5 two channels on an RC circuit', () => {
  it('at 60 Hz the capacitor has about 3,5 V of peak and lags about 2,1 ms (45°)', () => {
    const { t, v } = record(rcFase, {}, 0.1, 0.15, ['VE', 'VC']);
    const vc = measure(t, v.VC!);
    expect(vc.pp / 2).toBeCloseTo(3.5, 1);
    const ze = risingZeros(t, v.VE!);
    const zc = risingZeros(t, v.VC!);
    const lag = zc.find((z) => z > ze[0]!)! - ze[0]!;
    expect(lag).toBeGreaterThan(0.002);
    expect(lag).toBeLessThan(0.0022);
    expect((lag / (1 / 60)) * 360).toBeCloseTo(45.5, 0);
  });

  it('at 600 Hz the capacitor peak stays under 0,6 V', () => {
    const { t, v } = record(rcFase, { 'V1.frequency': 600 }, 0.05, 0.06, ['VC']);
    expect(measure(t, v.VC!).max).toBeLessThan(0.6);
  });
});
