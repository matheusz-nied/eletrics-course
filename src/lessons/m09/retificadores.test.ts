import { describe, expect, it } from 'vitest';
import type { CircuitDoc, ParamValue, SimEvent } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import { measure } from '../../circuit/instruments/scope';
import { dcAndRms } from '../../circuit/instruments/dmm';
import meiaOnda from './retificador-meia-onda.circuit';
import ponte from './retificador-ponte.circuit';

/**
 * Values lesson 9.3 quotes from its rectifier circuits, measured the way the
 * oscilloscope and the multimeter measure them, over six cycles of the mains
 * after a few seconds of play (0,8 to 0,9 s of simulated time), when the
 * filter capacitor has charged. These circuits have no `goals`: the
 * goal panel checks instantaneous readouts, which ripple.
 */

function record(
  doc: CircuitDoc,
  params: Record<string, ParamValue>,
  channels: string[],
  from = 0.8,
  to = 0.9,
) {
  const sim = new Simulator(doc);
  for (const [key, value] of Object.entries(params)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  const t: number[] = [];
  const v: Record<string, number[]> = Object.fromEntries(channels.map((c) => [c, []]));
  const events: SimEvent[] = [];
  while (sim.t < to) {
    sim.step();
    const frame = sim.frame({ samples: false });
    events.push(...frame.events);
    if (sim.t < from) continue;
    t.push(sim.t);
    for (const c of channels) v[c]!.push(frame.readouts[c] as number);
  }
  const scope = (c: string) => measure(t, v[c]!);
  const max = (c: string) => Math.max(...v[c]!);
  const min = (c: string) => Math.min(...v[c]!);
  return { scope, max, min, v, events };
}

const FILTER = { 'SW1.closed': true };

describe('9.3 half-wave rectifier', () => {
  it('no filter: secondary 12,6 V rms, 35,7 V peak to peak; output peaks of about 16,9 V at 60 Hz, 5,2 V mean', () => {
    const r = record(meiaOnda, {}, ['VSEC', 'VOUT', 'D1.current']);
    expect(dcAndRms(r.v.VSEC!).rms).toBeCloseTo(12.6, 1);
    expect(r.max('VSEC')).toBeCloseTo(17.7, 1);
    expect(r.scope('VSEC').pp).toBeCloseTo(35.7, 1);
    expect(r.max('VOUT')).toBeGreaterThan(16.8);
    expect(r.max('VOUT')).toBeLessThan(16.95);
    expect(r.scope('VOUT').pp).toBeCloseTo(r.max('VOUT'), 2);
    expect(r.max('VSEC') - r.max('VOUT')).toBeCloseTo(0.9, 1);
    expect(r.max('D1.current')).toBeCloseTo(0.56, 2);
    const out = r.scope('VOUT');
    expect(out.freq).toBeCloseTo(60, 0);
    expect(out.mean).toBeCloseTo(5.2, 1);
    expect(out.mean / r.max('VOUT')).toBeCloseTo(1 / 3, 1);
    expect(r.events).toEqual([]);
  });

  it('3.300 µF filter: about 15 V mean, 2,1 V of ripple at 60 Hz; the diode blocks about 33 V', () => {
    const r = record(meiaOnda, FILTER, ['VOUT', 'D1.voltage']);
    const out = r.scope('VOUT');
    expect(out.mean).toBeGreaterThan(14.9);
    expect(out.mean).toBeLessThan(15.1);
    expect(out.pp).toBeCloseTo(2.1, 1);
    expect(out.freq).toBeCloseTo(60, 0);
    expect(-r.min('D1.voltage')).toBeGreaterThan(32);
    expect(-r.min('D1.voltage')).toBeLessThan(34);
    expect(r.events).toEqual([]);
  });
});

describe('9.3 bridge rectifier', () => {
  it('no filter: 120 Hz, peaks of 16,0 V (1,7 V below the secondary), 9,7 V mean', () => {
    const r = record(ponte, {}, ['VSEC', 'VOUT']);
    const out = r.scope('VOUT');
    expect(out.freq).toBeCloseTo(120, 0);
    expect(r.max('VOUT')).toBeCloseTo(16.0, 1);
    expect(r.max('VSEC')).toBeCloseTo(17.7, 1);
    expect(r.max('VSEC') - r.max('VOUT')).toBeCloseTo(1.7, 1);
    expect(out.mean).toBeCloseTo(9.7, 1);
    expect(r.events).toEqual([]);
  });

  it('3.300 µF and 0,5 A: 14,8 V mean, about 0,9 V of ripple at 120 Hz, valley 14,3 V', () => {
    const r = record(ponte, FILTER, ['VOUT']);
    const out = r.scope('VOUT');
    expect(out.mean).toBeCloseTo(14.8, 1);
    expect(out.pp).toBeCloseTo(0.9, 1);
    expect(out.freq).toBeCloseTo(120, 0);
    expect(r.min('VOUT')).toBeCloseTo(14.3, 1);
    expect(r.events).toEqual([]);
  });

  it('less than half the ripple of the half-wave with the same capacitor', () => {
    const half = record(meiaOnda, FILTER, ['VOUT']).scope('VOUT').pp;
    const full = record(ponte, FILTER, ['VOUT']).scope('VOUT').pp;
    expect(full / half).toBeLessThan(0.5);
  });

  it('1.000 µF: 3,0 V of ripple, about three times more', () => {
    const big = record(ponte, FILTER, ['VOUT']).scope('VOUT').pp;
    const small = record(ponte, { ...FILTER, 'C1.capacitance': 1000e-6 }, ['VOUT']).scope('VOUT');
    expect(small.pp).toBeCloseTo(3.0, 1);
    expect(small.pp / big).toBeCloseTo(3, 0);
  });

  it('0,15 A load: about 0,3 V of ripple, 15,6 V mean', () => {
    const out = record(ponte, { ...FILTER, 'RL.resistance': 100 }, ['VOUT']).scope('VOUT');
    expect(out.pp).toBeCloseTo(0.3, 1);
    expect(out.mean).toBeCloseTo(15.6, 1);
  });

  it('no load: 16,6 V; with the mains 10 % high (139,7 V), 18,4 V', () => {
    const idle = record(ponte, { ...FILTER, 'RL.resistance': 1e5 }, ['VOUT']).scope('VOUT');
    expect(idle.mean).toBeCloseTo(16.6, 1);
    const high = record(ponte, { ...FILTER, 'RL.resistance': 1e5, 'M.voltage': 127 * 1.1 }, [
      'VOUT',
    ]).scope('VOUT');
    expect(high.mean).toBeCloseTo(18.4, 1);
    expect(high.mean).toBeGreaterThan(16);
    expect(high.mean).toBeLessThan(25);
  });

  it('the diodes conduct in pulses of about 2,7 A for a 0,5 A load; the first one, at power-on, passes 10 A', () => {
    const r = record(ponte, FILTER, ['D1.current', 'D4.current', 'RL.current']);
    expect(r.max('D1.current')).toBeCloseTo(2.7, 1);
    expect(r.max('D4.current')).toBeCloseTo(2.7, 1);
    expect(r.scope('RL.current').mean).toBeCloseTo(0.49, 2);
    const start = record(ponte, FILTER, ['D1.current'], 0, 0.02);
    expect(start.max('D1.current')).toBeGreaterThan(10);
    expect(start.max('D1.current')).toBeLessThan(30);
  });
});

describe('9.3 ripple formula against the simulation', () => {
  const formula = (current: number, f: number, c: number) => current / (f * c);

  it('conservative: 1,2 V vs 0,9 V; 4,0 V vs 3,0 V; 2,5 V vs 2,1 V', () => {
    const cases = [
      { doc: ponte, params: FILTER, f: 120, c: 3300e-6, expected: 1.2 },
      {
        doc: ponte,
        params: { ...FILTER, 'C1.capacitance': 1000e-6 },
        f: 120,
        c: 1000e-6,
        expected: 4.0,
      },
      { doc: meiaOnda, params: FILTER, f: 60, c: 3300e-6, expected: 2.5 },
    ];
    for (const k of cases) {
      const out = record(k.doc, k.params, ['VOUT']).scope('VOUT');
      const estimate = formula(out.mean / 30, k.f, k.c);
      expect(estimate).toBeCloseTo(k.expected, 1);
      expect(estimate).toBeGreaterThan(out.pp);
    }
    // Three full simulations: about 4 s alone, more under CI load.
  }, 30_000);

  it('worked example: 2.778 µF for 0,5 A and 1,5 V; 1,26 V with 3.300 µF; peak 15,4 V', () => {
    expect((0.5 / (120 * 1.5)) * 1e6).toBeCloseTo(2778, 0);
    expect(formula(0.5, 120, 3300e-6)).toBeCloseTo(1.26, 2);
    expect(12 * Math.SQRT2).toBeCloseTo(17, 0);
    expect(12 * Math.SQRT2 - 2 * 0.8).toBeCloseTo(15.4, 1);
  });

  it('quiz and safety arithmetic', () => {
    expect(9 * Math.SQRT2).toBeCloseTo(12.7, 1);
    expect(formula(1, 120, 4700e-6)).toBeCloseTo(1.77, 2);
    expect(127 * Math.SQRT2).toBeCloseTo(180, 0);
    expect(220 * Math.SQRT2).toBeCloseTo(311, 0);
    // Five time constants of 2,2 kΩ on 3.300 µF: about half a minute.
    expect(5 * 2200 * 3300e-6).toBeCloseTo(36, 0);
  });
});
