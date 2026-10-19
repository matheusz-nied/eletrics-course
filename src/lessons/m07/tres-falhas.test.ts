import { describe, expect, it } from 'vitest';
import type { CircuitDoc, ParamValue, SimEvent, SimFrame } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import { checkGoal } from '../../engine/analysis/goals';
import { thermalTripTime, tripsInstantly, type Curve } from './disjuntor-curva';
import doc, { RATING } from './tres-falhas.circuit';

/**
 * What lesson 7.3 says about the three faults and the curves B and C: every
 * trip time and current in the text, in the circuit's description and in the
 * time–current chart comes from here.
 */
interface Run {
  first: SimFrame['readouts'];
  last: SimFrame['readouts'];
  events: SimEvent[];
}

function run(circuit: CircuitDoc, settings: Record<string, ParamValue>, seconds: number): Run {
  const sim = new Simulator(circuit);
  for (const [key, value] of Object.entries(settings)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  const events: SimEvent[] = [];
  let first: SimFrame['readouts'] | undefined;
  const steps = Math.round(seconds / sim.dt);
  for (let i = 0; i < steps; i++) {
    sim.step();
    const frame = sim.frame({ samples: false });
    first ??= frame.readouts;
    events.push(...frame.events);
  }
  return { first: first!, last: sim.frame({ samples: false }).readouts, events };
}

const n = (r: SimFrame['readouts'], key: string) => r[key] as number;
const tripped = (r: Run, element: string) =>
  r.events.find((e) => e.kind === 'tripped' && e.element === element);
const lesson = (settings: Record<string, ParamValue>, seconds: number) =>
  run(doc, settings, seconds);

describe('os três tipos de falha (aula 7.3)', { timeout: 60_000 }, () => {
  it('with the fridge and the lamps only, 2,4 A and nothing trips', () => {
    const r = lesson({}, 10);
    expect(n(r.last, 'IDJ')).toBeCloseTo(2.35, 2);
    expect(r.events).toHaveLength(0);
  });

  it('with the heater too, the breaker carries its rated 10 A and holds', () => {
    const r = lesson({ 'SAQ.closed': true }, 180);
    expect(n(r.last, 'IDJ')).toBeCloseTo(10, 1);
    expect(r.events).toHaveLength(0);
    // The bimetal settles at (10/10)² / 1,3² ≈ 0,6 of the way to tripping.
    expect(n(r.last, 'DJ.heat')).toBeGreaterThan(0.54);
    expect(n(r.last, 'DJ.heat')).toBeLessThan(0.65);
  });

  it('the oven alone (17 A) trips the bimetal in about 50 s', () => {
    const r = lesson({ 'SFO.closed': true }, 60);
    expect(n(r.first, 'IDJ')).toBeCloseTo(17.3, 1);
    const trip = tripped(r, 'DJ');
    expect(trip?.message).toMatch(/sobrecarga \(disparo térmico\)/);
    expect(trip!.t).toBeGreaterThan(48);
    expect(trip!.t).toBeLessThan(51);
  });

  it('heater and oven together, about 24 A (2,4 × In), trip the bimetal in about 20 s', () => {
    for (const curve of ['B', 'C']) {
      const r = lesson({ 'SAQ.closed': true, 'SFO.closed': true, 'DJ.curve': curve }, 30);
      expect(n(r.first, 'IDJ')).toBeCloseTo(24.4, 1);
      const trip = tripped(r, 'DJ');
      expect(trip?.message).toMatch(/sobrecarga \(disparo térmico\)/);
      expect(trip!.t).toBeGreaterThan(19);
      expect(trip!.t).toBeLessThan(21);
      expect(tripped(r, 'DR')).toBeUndefined();
      // Matches the chart: 2,44 × In from cold.
      expect(thermalTripTime(24.4 / RATING)).toBeCloseTo(trip!.t, 0);
    }
  });

  it('a short circuit (about 380 A) trips the magnetic release in the first 5 ms, B or C', () => {
    for (const curve of ['B', 'C']) {
      const r = lesson({ 'SCC.closed': true, 'DJ.curve': curve }, 0.5);
      expect(n(r.first, 'IDJ')).toBeGreaterThan(370);
      expect(n(r.first, 'IDJ')).toBeLessThan(390);
      const trip = tripped(r, 'DJ');
      expect(trip?.message).toMatch(/curto-circuito \(disparo magnético/);
      expect(trip!.t).toBeLessThanOrEqual(0.0051);
      expect(tripped(r, 'DR')).toBeUndefined();
    }
  });

  it('a person touching the phase: about 0,1 A, the breaker never notices and the DR trips', () => {
    // With a DR that cannot trip (sensitivity of 1.000 A), the shock goes on: 107 mA, AC-4.
    const noDr = lesson({ 'SP.closed': true, 'DR.sensitivity': 1000 }, 3);
    expect(n(noDr.last, 'IP')).toBeGreaterThan(0.104);
    expect(n(noDr.last, 'IP')).toBeLessThan(0.109);
    expect(noDr.last['P.worst']).toBe('AC-4');
    expect(tripped(noDr, 'DJ')).toBeUndefined();
    expect(n(noDr.last, 'IDJ')).toBeCloseTo(2.45, 1);
    // The real circuit: the DR trips in the first step and the shock stays in AC-2.
    const r = lesson({ 'SP.closed': true }, 0.5);
    const trip = tripped(r, 'DR');
    expect(trip).toBeDefined();
    expect(trip!.t).toBeLessThanOrEqual(0.0051);
    expect(tripped(r, 'DJ')).toBeUndefined();
    expect(r.last['P.worst']).toBe('AC-2');
  });

  it('the motor starting draws about 61 A (6 × In): curve B trips at once', () => {
    const r = lesson({ 'BM.pressed': true, 'DJ.curve': 'B' }, 0.5);
    expect(n(r.first, 'IDJ')).toBeGreaterThan(60);
    expect(n(r.first, 'IDJ')).toBeLessThan(62);
    const trip = tripped(r, 'DJ');
    expect(trip?.message).toMatch(/disparo magnético, curva B/);
    expect(trip!.t).toBeLessThanOrEqual(0.0051);
  });

  it('curve C holds the start for 1 s, and trips by heat only if held about 2,8 s', () => {
    const short = lesson({ 'BM.pressed': true }, 1);
    expect(short.events).toHaveLength(0);
    const held = lesson({ 'BM.pressed': true }, 4);
    const trip = tripped(held, 'DJ');
    expect(trip?.message).toMatch(/sobrecarga \(disparo térmico\)/);
    expect(trip!.t).toBeGreaterThan(2.6);
    expect(trip!.t).toBeLessThan(2.9);
    // The chart's point: 6,1 × In on curve C, 2,8 s.
    expect(thermalTripTime(6.1)).toBeCloseTo(2.8, 1);
    expect(thermalTripTime(n(held.first, 'IDJ') / RATING)).toBeCloseTo(trip!.t, 1);
  });

  for (const goal of doc.goals ?? []) {
    it(`meets goal "${goal.id}" with its solution`, () => {
      const r = lesson(goal.solution ?? {}, goal.at ?? 1);
      expect(checkGoal(goal, { t: 0, nodeVoltages: {}, readouts: r.last, events: [] })).toBe(true);
    });
  }
});

describe('a curva tempo × corrente do gráfico (aula 7.3)', { timeout: 60_000 }, () => {
  /** A 10 A breaker of `curve` with a resistive load drawing `multiple` × In. */
  const bench = (multiple: number, curve: Curve): CircuitDoc => ({
    id: 'teste/curva',
    title: 'curva',
    description: 'curva',
    analysis: { kind: 'quasi-static', frequency: 60, dtMech: 0.005 },
    elements: [
      { id: 'REDE', type: 'mains', at: [0, 2], params: { voltage: 127, impedance: 0.001 } },
      {
        id: 'W1',
        type: 'wire',
        points: [
          [2, 0],
          [4, 0],
        ],
      },
      { id: 'DJ', type: 'breaker', a: [4, 0], b: [10, 0], params: { rating: 10, curve } },
      {
        id: 'R',
        type: 'resistor',
        a: [10, 0],
        b: [10, 2],
        params: { resistance: 127 / (10 * multiple) - 0.006, watts: 1e9 },
      },
      {
        id: 'W2',
        type: 'wire',
        points: [
          [10, 2],
          [2, 2],
        ],
      },
    ],
  });

  const tripTime = (multiple: number, curve: Curve, max: number) => {
    const r = run(bench(multiple, curve), {}, max);
    return tripped(r, 'DJ')?.t;
  };

  it('never trips at 1,13 × In (the bimetal stops short of 1,3 × In)', () => {
    expect(thermalTripTime(1.13)).toBe(Infinity);
    expect(tripTime(1.13, 'C', 600)).toBeUndefined();
  });

  it('follows the thermal formula at 2, 3 and 5 × In (curve C)', () => {
    for (const k of [2, 3, 5]) {
      const formula = thermalTripTime(k);
      expect(tripTime(k, 'C', formula + 5)).toBeCloseTo(formula, 1);
    }
    // The values the chart labels: about 33 s at 2 × In, 12 s at 3 × In.
    expect(thermalTripTime(2)).toBeCloseTo(32.9, 1);
    expect(thermalTripTime(3)).toBeCloseTo(12.5, 1);
    expect(thermalTripTime(2.44)).toBeCloseTo(20, 0);
  });

  it('trips at once above 4, 7,5 and 15 × In for B, C and D, and not below', () => {
    const cases: [number, Curve, boolean][] = [
      [4.2, 'B', true],
      [3.8, 'B', false],
      [7.8, 'C', true],
      [7.2, 'C', false],
      [15.5, 'D', true],
      [14.5, 'D', false],
    ];
    for (const [k, curve, instant] of cases) {
      expect(tripsInstantly(k, curve)).toBe(instant);
      const t = tripTime(k, curve, 0.05);
      if (instant) expect(t, `${k} × In, ${curve}`).toBeLessThan(0.02);
      else expect(t, `${k} × In, ${curve}`).toBeUndefined();
    }
  });
});
