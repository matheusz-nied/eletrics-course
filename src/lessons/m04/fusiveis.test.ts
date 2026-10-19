import { describe, expect, it } from 'vitest';
import type { CircuitDoc, ParamValue } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import sobrecarga, { LOADS } from './fusivel-sobrecarga.circuit';
import motor, { LOCKED } from './fusivel-motor.circuit';

/**
 * Values lesson 4.6 quotes: how long the 2 A fuse of the simulation takes to
 * blow with each load, and the motor's starting surge. Goals can only check
 * one instant; these runs measure the time of the blow itself.
 */

interface Run {
  /** Time the fuse blew (s), or undefined if it held until `until`. */
  blewAt?: number;
  peakCurrent: number;
  peakHeat: number;
  last: Record<string, number | boolean | string>;
}

function run(
  doc: CircuitDoc,
  params: Record<string, ParamValue>,
  until: number,
  current: string,
): Run {
  const sim = new Simulator(doc);
  for (const [key, value] of Object.entries(params)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  let blewAt: number | undefined;
  let peakCurrent = 0;
  let peakHeat = 0;
  let last: Run['last'] = {};
  while (sim.t < until - 1e-9 && blewAt === undefined) {
    sim.step();
    last = sim.frame({ samples: false }).readouts;
    peakCurrent = Math.max(peakCurrent, Math.abs(last[current] as number));
    peakHeat = Math.max(peakHeat, last['F1.heat'] as number);
    if (last['F1.blown'] === true) blewAt = sim.t;
  }
  return { blewAt, peakCurrent, peakHeat, last };
}

describe('4.6 fuse of 2 A with a chosen load', () => {
  const blow = (load: number, kind: string, until = 60) =>
    run(sobrecarga, { 'R1.resistance': load, 'F1.kind': kind }, until, 'IF');

  for (const kind of ['fast', 'slow']) {
    it(`holds 1,5 A and 3 A (1,5 × the rating) when ${kind}, the element heat settling at 0,2 and 0,88`, () => {
      const normal = blow(LOADS.normal, kind, 30);
      expect(normal.blewAt).toBeUndefined();
      expect(normal.last['F1.heat']).toBeGreaterThan(0.2);
      expect(normal.last['F1.heat']).toBeLessThan(0.23);
      const leve = blow(LOADS.leve, kind, 30);
      expect(leve.blewAt).toBeUndefined();
      expect(leve.last['F1.heat']).toBeGreaterThan(0.86);
      expect(leve.last['F1.heat']).toBeLessThan(0.9);
    });
  }

  it('the fast one blows in about 0,3 s at 4 A and 0,06 s at 8 A', () => {
    expect(blow(LOADS.sobrecarga, 'fast').blewAt).toBeGreaterThan(0.28);
    expect(blow(LOADS.sobrecarga, 'fast').blewAt).toBeLessThan(0.36);
    expect(blow(LOADS.forte, 'fast').blewAt).toBeGreaterThan(0.05);
    expect(blow(LOADS.forte, 'fast').blewAt).toBeLessThan(0.07);
  });

  it('the time-lag one takes about 6 s at 4 A and 1 s at 8 A', () => {
    expect(blow(LOADS.sobrecarga, 'slow').blewAt).toBeGreaterThan(5.5);
    expect(blow(LOADS.sobrecarga, 'slow').blewAt).toBeLessThan(6.5);
    expect(blow(LOADS.forte, 'slow').blewAt).toBeGreaterThan(1);
    expect(blow(LOADS.forte, 'slow').blewAt).toBeLessThan(1.2);
  });

  it('a short blows the fast one within 1 ms and the time-lag one within a few ms', () => {
    const fast = blow(LOADS.curto, 'fast', 1);
    expect(fast.blewAt).toBeLessThanOrEqual(0.001);
    const slow = blow(LOADS.curto, 'slow', 1);
    expect(slow.blewAt).toBeLessThanOrEqual(0.005);
    expect(slow.peakCurrent).toBeGreaterThan(150);
  });
});

describe('4.6 motor start behind a 2 A fuse', () => {
  const start = (kind: string, load?: number) =>
    run(
      motor,
      { 'S1.closed': true, 'F1.kind': kind, ...(load === undefined ? {} : { 'M1.load': load }) },
      3,
      'IM',
    );

  it('blows the fast fuse during the start, in under 0,1 s', () => {
    const r = start('fast');
    expect(r.blewAt).toBeLessThan(0.1);
  });

  it('the time-lag fuse holds a surge of about 7,5 A and the motor settles at about 1 A', () => {
    const r = start('slow');
    expect(r.blewAt).toBeUndefined();
    expect(r.peakCurrent).toBeGreaterThan(7.3);
    expect(r.peakCurrent).toBeLessThan(7.7);
    expect(r.peakHeat).toBeLessThan(0.2);
    expect(r.last['IM']).toBeGreaterThan(1);
    expect(r.last['IM']).toBeLessThan(1.1);
  });

  it('the surge falls below 2 A about 0,6 s after switching on', () => {
    const sim = new Simulator(motor);
    sim.setParam('S1', 'closed', true);
    sim.setParam('F1', 'kind', 'slow');
    sim.refresh();
    let below: number | undefined;
    let wasAbove = false;
    while (sim.t < 1.5 && below === undefined) {
      sim.step();
      const current = Math.abs(sim.frame({ samples: false }).readouts['IM'] as number);
      if (current > 2) wasAbove = true;
      else if (wasAbove) below = sim.t;
    }
    expect(below).toBeGreaterThan(0.55);
    expect(below).toBeLessThan(0.65);
  });

  it('with the shaft locked, the time-lag fuse blows after a little over 1 s, at about 7,6 A', () => {
    const r = start('slow', LOCKED);
    expect(r.peakCurrent).toBeGreaterThan(7.5);
    expect(r.peakCurrent).toBeLessThan(7.8);
    expect(r.blewAt).toBeGreaterThan(1);
    expect(r.blewAt).toBeLessThan(1.3);
  });
});
