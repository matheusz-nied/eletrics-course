import { describe, expect, it } from 'vitest';
import type { ParamValue } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import trafo from './trafo-central.circuit';

/**
 * What the multimeter of lesson 5.4 shows in V~ and A~: the true RMS of the
 * last 100 ms (AC coupled, like the simulation's multimeter), after the
 * circuit settles. The goals of the circuit only check readouts that stay
 * still over a cycle, so the RMS values quoted in the lesson are checked here.
 */
function measure(settings: Record<string, ParamValue> = {}, settle = 1) {
  const sim = new Simulator(trafo);
  for (const [key, value] of Object.entries(settings)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  while (sim.t < settle) sim.step();
  const samples = {
    VP: [] as number[],
    IP: [] as number[],
    VS: [] as number[],
    IS: [] as number[],
  };
  const end = sim.t + 0.1;
  while (sim.t < end) {
    sim.step();
    const r = sim.frame({ samples: false }).readouts;
    for (const [k, list] of Object.entries(samples)) list.push(Number(r[k]));
  }
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const rms = (a: number[]) => {
    const m = mean(a);
    return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
  };
  const r = sim.frame({ samples: false }).readouts;
  return {
    vp: rms(samples.VP),
    ip: rms(samples.IP),
    vs: rms(samples.VS),
    is: rms(samples.IS),
    /** Real power the transformer takes from the mains minus what it gives the load (W). */
    loss:
      mean(samples.VP.map((v, i) => v * samples.IP[i]!)) -
      mean(samples.VS.map((v, i) => v * samples.IS[i]!)),
    burned: r['L1.burned'],
    brightness: Number(r['L1.brightness']),
  };
}

const selector = trafo.elements.find((e) => e.id === 'T1')!.control;
const options = (Array.isArray(selector) ? selector[0] : selector)!.options!;
const TAP_220 = options[0]!.value as number;
const TAP_127 = options[1]!.value as number;

describe('o trafo da central (aula 5.4)', () => {
  it('has the two taps of a 127/220 V primary', () => {
    expect(TAP_220).toBe(17);
    expect(TAP_220 / TAP_127).toBeCloseTo(220 / 127, 10);
  });

  it('gives 12,1 V with the load, with the primary current about 1/17 of the secondary', () => {
    const m = measure();
    expect(m.vp).toBeCloseTo(220, 0);
    expect(m.vs).toBeCloseTo(12.1, 1);
    expect(m.is).toBeCloseTo(0.92, 2);
    // 0,92 A ÷ 17 = 54 mA, plus the magnetizing current (29 mA, out of phase): 61 mA.
    expect(m.ip).toBeGreaterThan(0.0605);
    expect(m.ip).toBeLessThan(0.0615);
    expect(Math.hypot(m.is / 17, 0.0292)).toBeCloseTo(m.ip, 3);
    // The copper of the two windings warms up with about 0,8 W.
    expect(m.loss).toBeGreaterThan(0.75);
    expect(m.loss).toBeLessThan(0.85);
    expect(m.burned).toBe(false);
    expect(m.brightness).toBeGreaterThan(0.95);
  });

  it('reads 12,9 V without load, and the primary still draws the magnetizing current', () => {
    const m = measure({ 'S1.closed': false });
    expect(m.vs).toBeCloseTo(12.9, 1);
    expect(m.vs).toBeCloseTo(220 / TAP_220, 1);
    expect(m.is).toBeLessThan(1e-3);
    expect(m.ip).toBeGreaterThan(0.0285);
    expect(m.ip).toBeLessThan(0.0295);
  });

  it('puts more than 20 V on the secondary with the selector at 127 V on a 220 V outlet', () => {
    const m = measure({ 'T1.ratio': TAP_127 });
    expect(m.vs).toBeCloseTo(21.1, 1);
    expect(m.burned).toBe(true);
  });

  it('gives only about 7 V with the selector at 220 V on a 127 V outlet', () => {
    const m = measure({ 'R.voltage': 127 });
    expect(m.vs).toBeCloseTo(6.9, 1);
    expect(m.burned).toBe(false);
    expect(m.brightness).toBeLessThan(0.3);
  });

  it('works again with the selector at 127 V on a 127 V outlet', () => {
    const m = measure({ 'R.voltage': 127, 'T1.ratio': TAP_127 });
    expect(m.vs).toBeCloseTo(11.6, 1);
    expect(m.burned).toBe(false);
  });
});
