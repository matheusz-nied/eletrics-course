import { describe, expect, it } from 'vitest';
import type { CircuitDoc, ParamValue, SimEvent } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import potencia from './resistor-potencia.circuit';

/**
 * Values lesson 4.1 quotes from m04/resistor-potencia that change with time:
 * the body temperatures and when the 1/4 W resistor burns. The goal panel
 * checks readouts only, and a temperature passes through every value on its
 * way up, so these stay out of `goals`.
 */

function run(doc: CircuitDoc, params: Record<string, ParamValue>, seconds: number) {
  const sim = new Simulator(doc);
  for (const [key, value] of Object.entries(params)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  const events: SimEvent[] = [];
  // Events wait in the simulator until the next frame, with their own time.
  for (let n = 1; sim.t < seconds; n++) {
    sim.step();
    if (n % 1000 === 0) events.push(...sim.frame({ maxSamples: 1 }).events);
  }
  events.push(...sim.frame({ maxSamples: 1 }).events);
  const readouts = sim.frame({ samples: false }).readouts;
  const first = (kind: SimEvent['kind']) => events.find((e) => e.kind === kind)?.t;
  return { readouts, warnedAt: first('warning'), burnedAt: first('damaged') };
}

const on = { 'S1.closed': true };

describe('4.1 power rating: 100 Ω on 12 V', () => {
  it('dissipates 1,44 W (120 mA)', () => {
    const { readouts } = run(potencia, on, 1);
    expect(readouts.PR).toBeCloseTo(1.44, 3);
    expect(readouts.IR).toBeCloseTo(0.12, 4);
  });

  it('a 1/4 W resistor warns within 2 s and burns in about 16 s', () => {
    const r = run(potencia, on, 25);
    expect(r.warnedAt).toBeLessThan(2);
    expect(r.burnedAt).toBeGreaterThan(14);
    expect(r.burnedAt).toBeLessThan(18);
    expect(r.readouts['R1.burned']).toBe(true);
  });

  it('settles at about 255 °C (1/2 W), 140 °C (1 W), 83 °C (2 W) and 63 °C (3 W)', () => {
    const cases: [number, number, boolean][] = [
      [0.5, 255, true],
      [1, 140, true],
      [2, 83, false],
      [3, 63, false],
    ];
    for (const [watts, celsius, warns] of cases) {
      const r = run(potencia, { ...on, 'R1.watts': watts }, 150);
      expect(r.readouts['R1.temperature']).toBeGreaterThan(celsius - 2);
      expect(r.readouts['R1.temperature']).toBeLessThan(celsius + 2);
      expect(r.readouts['R1.burned']).toBe(false);
      expect(r.warnedAt !== undefined).toBe(warns);
    }
  }, 60_000);
});

describe('4.1 worked example: 220 Ω on 12 V', () => {
  it('dissipates 0,65 W (54,5 mA): about 77 °C at 1 W and 51 °C at 2 W', () => {
    const one = run(potencia, { ...on, 'R1.resistance': 220, 'R1.watts': 1 }, 100);
    expect(one.readouts.PR).toBeCloseTo(0.6545, 3);
    expect(one.readouts.IR).toBeCloseTo(0.0545, 4);
    expect(one.readouts['R1.temperature']).toBeGreaterThan(75);
    expect(one.readouts['R1.temperature']).toBeLessThan(79);
    expect(one.warnedAt).toBeUndefined();
    const two = run(potencia, { ...on, 'R1.resistance': 220, 'R1.watts': 2 }, 150);
    expect(two.readouts['R1.temperature']).toBeGreaterThan(49);
    expect(two.readouts['R1.temperature']).toBeLessThan(53);
    const quarter = run(potencia, { ...on, 'R1.resistance': 220 }, 60);
    expect(quarter.readouts['R1.burned']).toBe(false);
    expect(quarter.warnedAt).toBeLessThan(10);
  }, 60_000);
});

describe('4.1 with 1 kΩ', () => {
  it('a 1/4 W resistor dissipates 0,144 W (12 mA) and settles near 71 °C', () => {
    const r = run(potencia, { ...on, 'R1.resistance': 1000 }, 60);
    expect(r.readouts.PR).toBeCloseTo(0.144, 3);
    expect(r.readouts.IR).toBeCloseTo(0.012, 4);
    expect(r.readouts['R1.temperature']).toBeGreaterThan(69);
    expect(r.readouts['R1.temperature']).toBeLessThan(73);
    expect(r.warnedAt).toBeUndefined();
  }, 30_000);
});
