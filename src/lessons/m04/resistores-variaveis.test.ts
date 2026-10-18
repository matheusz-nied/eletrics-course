import { describe, expect, it } from 'vitest';
import { defineCircuit } from '../../engine';
import type { CircuitDoc, ParamValue, SimEvent } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import { dividerOutput, ntcResistance, NTC_CURVE, TAPER_CURVES, taperFraction } from './curves';
import potLed from './potenciometro-led.circuit';
import sensores from './sensores.circuit';

/**
 * Values lesson 4.2 quotes besides the circuits' goals: LED currents along
 * the potentiometer, the NTC and LDR readings, and the plotted curves, which
 * must follow the engine's own models.
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
  return { readouts: sim.frame({ samples: false }).readouts, events };
}

const mA = (r: { readouts: Record<string, unknown> }) => 1000 * Number(r.readouts.ID);

describe('4.2 potentiometer as a rheostat', () => {
  it('LED current: 15 mA at A, 2,5 mA at a quarter, 1,3 mA in the middle, 0,7 mA at B', () => {
    const atA = run(potLed, { 'P1.position': 0 }, 1);
    expect(mA(atA)).toBeCloseTo(15, 0);
    // The text's (9 V − 1,9 V) / 470 Ω.
    expect(Number(atA.readouts['D1.voltage'])).toBeCloseTo(1.9, 1);
    expect(mA(run(potLed, { 'P1.position': 0.25 }, 1))).toBeCloseTo(2.45, 1);
    expect(mA(run(potLed, { 'P1.position': 0.5 }, 1))).toBeCloseTo(1.34, 1);
    expect(mA(run(potLed, { 'P1.position': 1 }, 1))).toBeCloseTo(0.7, 1);
  });

  it('without the 470 Ω resistor, 5 % of the track overheats and the end burns the LED', () => {
    const near = run(potLed, { 'S1.closed': true, 'P1.position': 0.05 }, 5);
    expect(mA(near)).toBeGreaterThan(13);
    expect(mA(near)).toBeLessThan(15);
    expect(near.events.some((e) => e.element === 'P1' && e.kind === 'warning')).toBe(true);
    const end = run(potLed, { 'S1.closed': true, 'P1.position': 0 }, 1);
    expect(end.readouts['D1.burned']).toBe(true);
  });
});

describe('4.2 taper curves', () => {
  /** A 10 kΩ pot between 0 V (A) and 10 V (B): the wiper reads 10 V × fraction. */
  const divider = (taper: 'linear' | 'log') =>
    defineCircuit({
      id: 'test/taper',
      title: 'Curva do potenciômetro',
      description: 'Potenciômetro ligado como divisor entre 0 V e 10 V.',
      analysis: { kind: 'dc' },
      elements: [
        { id: 'V1', type: 'dc-voltage', a: [0, 0], b: [0, 10], params: { voltage: 10 } },
        {
          id: 'W1',
          type: 'wire',
          points: [
            [0, 10],
            [6, 10],
          ],
        },
        { id: 'P1', type: 'potentiometer', at: [10, 10], params: { resistance: 10000, taper } },
        {
          id: 'W2',
          type: 'wire',
          points: [
            [14, 10],
            [20, 10],
            [20, 0],
            [0, 0],
          ],
        },
        { id: 'G', type: 'ground', at: [0, 10] },
      ],
      probes: [{ id: 'VW', kind: 'voltage', plus: 'P1.w', minus: 'GND' }],
    });

  it('follows the engine: about 9 % of the track at mid travel on a log (A) pot', () => {
    for (const taper of ['linear', 'log'] as const) {
      for (const p of [0.1, 0.5, 0.8]) {
        const r = run(divider(taper), { 'P1.position': p }, 0.01);
        expect(Number(r.readouts.VW)).toBeCloseTo(10 * taperFraction(p, taper), 2);
      }
    }
    expect(taperFraction(0.5, 'log')).toBeCloseTo(0.091, 3);
    expect(TAPER_CURVES[1]!.points.find(([x]) => x === 50)![1]).toBeCloseTo(9.1, 1);
  });
});

describe('4.2 NTC and LDR', () => {
  it('the plotted NTC is the engine model: 33,6 kΩ at 0 °C, 3,59 kΩ at 50 °C, 0,70 kΩ at 100 °C', () => {
    expect(ntcResistance(10000, 3950, 0)).toBeCloseTo(33620, -2);
    expect(ntcResistance(10000, 3950, 50)).toBeCloseTo(3588, -1);
    expect(ntcResistance(10000, 3950, 100)).toBeCloseTo(697.5, 0);
    expect(NTC_CURVE[0]!.points[0]).toEqual([0, ntcResistance(10000, 3950, 0)]);
    // About 4 % per degree near 25 °C.
    const slope = (ntcResistance(10000, 3950, 24) - ntcResistance(10000, 3950, 26)) / 2 / 10000;
    expect(slope).toBeCloseTo(0.044, 3);
    const r = run(sensores, { 'NTC.temperature': 50 }, 60);
    const t = Number(r.readouts['NTC.temperature']);
    expect(Number(r.readouts['NTC.resistance'])).toBeCloseTo(ntcResistance(10000, 3950, t), 0);
  });

  it('worked example: 3,68 V by the formula, 3,69 V in the simulator (0,2 °C of self-heating)', () => {
    expect(dividerOutput(5, ntcResistance(10000, 3950, 50), 10000)).toBeCloseTo(3.68, 2);
    const r = run(sensores, { 'NTC.temperature': 50 }, 60);
    expect(Number(r.readouts.VT)).toBeCloseTo(3.69, 2);
    const rise = Number(r.readouts['NTC.temperature']) - 50;
    expect(rise).toBeGreaterThan(0.1);
    expect(rise).toBeLessThan(0.4);
  });

  it('NTC output: 1,16 V at 0 °C, 2,5 V at 25 °C, 4,7 V at 100 °C', () => {
    expect(Number(run(sensores, { 'NTC.temperature': 0 }, 60).readouts.VT)).toBeCloseTo(1.16, 1);
    expect(Number(run(sensores, {}, 60).readouts.VT)).toBeCloseTo(2.5, 1);
    expect(Number(run(sensores, { 'NTC.temperature': 100 }, 60).readouts.VT)).toBeCloseTo(4.68, 1);
  });

  it('LDR: about 800 Ω at 1.000 lx, 20 kΩ at 10 lx and 100 kΩ at 1 lx', () => {
    const at = (lux: number) => run(sensores, { 'LDR.lux': lux }, 0.01).readouts;
    expect(Number(at(1000)['LDR.resistance'])).toBeGreaterThan(750);
    expect(Number(at(1000)['LDR.resistance'])).toBeLessThan(850);
    expect(Number(at(10)['LDR.resistance'])).toBeCloseTo(20000, -3);
    expect(Number(at(10).VL)).toBeCloseTo(3.33, 1);
    expect(Number(at(1)['LDR.resistance'])).toBeCloseTo(100000, -4);
    expect(Number(at(1).VL)).toBeCloseTo(4.55, 1);
  });
});
