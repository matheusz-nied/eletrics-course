import { describe, expect, it } from 'vitest';
import type { CircuitDoc, SimEvent, SimFrame } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import chave from './transistor-chave.circuit';
import rele from './rele-roda-livre.circuit';

/** Values lesson 9.6 quotes from its two circuits. */

type Readouts = SimFrame['readouts'];

function start(doc: CircuitDoc, params: Record<string, number | boolean> = {}) {
  const sim = new Simulator(doc);
  for (const [key, value] of Object.entries(params)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  return sim;
}

function runTo(sim: Simulator, t: number): Readouts {
  while (sim.t < t) sim.step();
  return sim.frame().readouts;
}

const num = (r: Readouts, key: string) => r[key] as number;

describe('9.6 transistor as a switch (lamp)', () => {
  it('RB = 1 kΩ: 4,2 mA in the base, 0,10 A in the lamp, 0,07 V and about 10 mW: saturated', () => {
    const r = runTo(start(chave), 3);
    expect(num(r, 'IB') * 1e3).toBeCloseTo(4.2, 1);
    expect(num(r, 'IC')).toBeCloseTo(0.1, 2);
    expect(num(r, 'VCE')).toBeCloseTo(0.07, 2);
    expect(num(r, 'PQ') * 1e3).toBeGreaterThan(8);
    expect(num(r, 'PQ') * 1e3).toBeLessThan(12);
    expect(r['Q1.region']).toBe('saturação');
    expect(num(r, 'L1.brightness')).toBeGreaterThan(0.9);
  });

  it('pin at 0 V: no current, 12 V across the transistor: cut off', () => {
    const r = runTo(start(chave, { 'V2.voltage': 0 }), 3);
    expect(num(r, 'IC')).toBeLessThan(1e-6);
    expect(num(r, 'VCE')).toBeCloseTo(12, 1);
    expect(r['Q1.region']).toBe('corte');
  });

  it('still saturated up to RB = 10 kΩ', () => {
    const r = runTo(start(chave, { 'RB.resistance': 10000 }), 3);
    expect(num(r, 'VCE')).toBeLessThan(0.25);
    expect(num(r, 'IC')).toBeGreaterThan(0.098);
  });

  it('RB = 22 kΩ: 0,19 mA, about 52 mA, about 9 V, almost half a watt, lamp almost dark', () => {
    const sim = start(chave, { 'RB.resistance': 22000 });
    const r = runTo(sim, 3);
    expect(num(r, 'IB') * 1e3).toBeCloseTo(0.19, 2);
    expect(num(r, 'IC') * 1e3).toBeGreaterThan(48);
    expect(num(r, 'IC') * 1e3).toBeLessThan(56);
    expect(num(r, 'VCE')).toBeGreaterThan(8);
    expect(num(r, 'VCE')).toBeLessThan(9.5);
    expect(num(r, 'PQ')).toBeGreaterThan(0.4);
    expect(num(r, 'PQ')).toBeLessThan(0.5);
    expect(r['Q1.region']).toBe('ativa');
    expect(num(r, 'L1.brightness')).toBeLessThan(0.05);
  });

  it('RB = 22 kΩ: the junction passes 100 °C within a few seconds', () => {
    const sim = start(chave, { 'RB.resistance': 22000 });
    expect(num(runTo(sim, 10), 'Q1.temperature')).toBeGreaterThan(100);
  });

  it('β = 100 with RB = 10 kΩ: only about 46 mA, the lamp stays dark', () => {
    const r = runTo(start(chave, { 'RB.resistance': 10000, 'Q1.beta': 100 }), 3);
    expect(num(r, 'IC') * 1e3).toBeGreaterThan(40);
    expect(num(r, 'IC') * 1e3).toBeLessThan(48);
    expect(num(r, 'L1.brightness')).toBeLessThan(0.01);
  });
});

/** Switches the pin on, then off, and follows the collector and the coil. */
function relay(diode: boolean) {
  const sim = start(rele, { 'S2.closed': diode, 'S1.closed': true });
  const on = runTo(sim, 0.03);
  sim.setParam('S1', 'closed', false);
  const t0 = sim.t;
  const events: SimEvent[] = [];
  let peak = -Infinity;
  let coilGone = Number.NaN;
  while (sim.t < t0 + 0.01) {
    sim.step();
    const f = sim.frame();
    events.push(...f.events);
    peak = Math.max(peak, num(f.readouts, 'VC'));
    if (Number.isNaN(coilGone) && Math.abs(num(f.readouts, 'IK')) < 1e-4) coilGone = sim.t - t0;
  }
  return { on, peak, coilGone, events };
}

describe('9.6 relay and flyback diode', () => {
  it('pin on: the transistor saturates (0,05 V), the coil takes about 30 mA, the relay closes', () => {
    const { on } = relay(true);
    expect(num(on, 'VC')).toBeGreaterThan(0.03);
    expect(num(on, 'VC')).toBeLessThan(0.08);
    expect(num(on, 'IK') * 1e3).toBeGreaterThan(29);
    expect(num(on, 'IK') * 1e3).toBeLessThan(32);
    expect(on['K1.closed']).toBe(true);
    expect(num(on, 'LED1.brightness')).toBeGreaterThan(0.5);
  });

  it('with the diode: the collector stops at about 12,7 V and the current dies in a little over 1 ms', () => {
    const { peak, coilGone, events } = relay(true);
    expect(peak).toBeGreaterThan(12.5);
    expect(peak).toBeLessThan(13);
    expect(coilGone * 1e3).toBeGreaterThan(1);
    expect(coilGone * 1e3).toBeLessThan(1.3);
    expect(events.some((e) => e.message.includes('avalanche'))).toBe(false);
  });

  it('without the diode: a spike of about 29 V, about 0,2 ms wide, and the avalanche warning', () => {
    const { peak, coilGone, events } = relay(false);
    expect(peak).toBeGreaterThan(28);
    expect(peak).toBeLessThan(31);
    expect(coilGone * 1e3).toBeGreaterThan(0.15);
    expect(coilGone * 1e3).toBeLessThan(0.3);
    expect(events.some((e) => e.message.includes('entrou em avalanche'))).toBe(true);
  });

  it('68 µJ in the coil: ½ · 0,15 H · (30 mA)²', () => {
    expect(0.5 * 0.15 * 0.0302 ** 2 * 1e6).toBeCloseTo(68, 0);
  });
});
