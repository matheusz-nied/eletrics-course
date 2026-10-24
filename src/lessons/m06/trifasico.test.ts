import { describe, expect, it } from 'vitest';
import { Simulator } from '../../engine/analysis/simulator';
import neutro from './neutro-rompido.circuit';
import tri from './trifasico.circuit';
import {
  lineRms,
  lineVoltage,
  phasorTip,
  phaseVoltage,
  rmsOf,
  sumOfPhases,
  SYSTEMS,
} from './trifasico';
import { measureRms } from './trifasico-rms';

describe('three phases as phasors and waves (aula 6.7)', () => {
  it('puts √3 times the phase voltage between two phases', () => {
    expect(lineRms(127)).toBeCloseTo(219.97, 2);
    expect(lineRms(220)).toBeCloseTo(381.05, 2);
    expect(Math.round(lineRms(SYSTEMS['127/220'].phase) / 10) * 10).toBe(220);
    expect(rmsOf((t) => phaseVoltage('L1', t, 127))).toBeCloseTo(127, 6);
    for (const pair of ['L1-L2', 'L2-L3', 'L3-L1'] as const)
      expect(rmsOf((t) => lineVoltage(pair, t, 127))).toBeCloseTo(lineRms(127), 6);
  });

  it('has 179,6 V and 311 V peaks in a 127/220 V supply', () => {
    expect(127 * Math.SQRT2).toBeCloseTo(179.6, 1);
    expect(lineRms(127) * Math.SQRT2).toBeCloseTo(311.1, 1);
  });

  it('lags each phase by 120° and the three always add up to zero', () => {
    // L2 peaks a third of a turn after L1.
    expect(phaseVoltage('L1', Math.PI / 2, 127)).toBeCloseTo(179.6, 1);
    expect(phaseVoltage('L2', Math.PI / 2 + (2 * Math.PI) / 3, 127)).toBeCloseTo(179.6, 1);
    for (let t = 0; t < 2 * Math.PI; t += 0.1) expect(sumOfPhases(t, 127)).toBeCloseTo(0, 9);
  });

  it('draws each phasor so that its height is the instantaneous value', () => {
    for (const t of [0.3, 1.7, 4]) {
      const [, y] = phasorTip('L3', t, 127 * Math.SQRT2);
      expect(y).toBeCloseTo(phaseVoltage('L3', t, 127), 9);
    }
  });
});

describe('a 127/220 V three-phase supply with three lamps (aula 6.7)', () => {
  it('reads 127 V between a phase and the neutral and 220 V between two phases', () => {
    const m = measureRms(tri);
    for (const id of ['V1N', 'V2N', 'V3N']) expect(m.rms[id]).toBeCloseTo(127, 0);
    expect(m.rms.V12).toBeCloseTo(220, 0);
  });

  it('carries almost nothing on the neutral with the three lamps on', () => {
    const m = measureRms(tri);
    expect(m.rms.I1).toBeCloseTo(0.79, 2);
    expect(m.rms.IN).toBeLessThan(0.02);
    for (const l of ['L1', 'L2', 'L3']) expect(m.readouts[`${l}.burned`]).toBe(false);
  });

  it('carries one lamp current on the neutral with one or two lamps off', () => {
    const one = measureRms(tri, { 'S3.closed': false });
    expect(one.rms.IN).toBeCloseTo(0.79, 2);
    const two = measureRms(tri, { 'S3.closed': false, 'S2.closed': false });
    expect(two.rms.IN).toBeCloseTo(0.79, 2);
    expect(two.rms.IN).toBeCloseTo(two.rms.I1!, 3);
  });
});

describe('a broken neutral in a two-phase house (aula 6.7)', () => {
  it('gives 127 V to each load with the neutral in place', () => {
    const m = measureRms(neutro);
    expect(m.rms.VL).toBeCloseTo(127, 0);
    expect(m.rms.VH).toBeCloseTo(127, 0);
    expect(m.rms.V12).toBeCloseTo(220, 0);
    expect(m.rms.IN).toBeGreaterThan(11);
    expect(m.readouts['LP.burned']).toBe(false);
  });

  it('puts about 218 V on the 15 W lamp, which burns in a fraction of a second', () => {
    const sim = new Simulator(neutro);
    sim.refresh();
    while (sim.t < 0.5) sim.step();
    sim.setParam('SN', 'closed', false);
    sim.refresh();
    const t0 = sim.t;
    let sum = 0;
    let n = 0;
    let heater = 0;
    let heaterSq = 0;
    // The first three cycles, before the filament breaks.
    while (sim.t < t0 + 3 / 60) {
      sim.step();
      const r = sim.frame({ samples: false }).readouts;
      expect(r['LP.burned']).toBe(false);
      sum += Number(r.VL) ** 2;
      heater = Math.max(heater, Math.abs(Number(r.VH)));
      heaterSq += Number(r.VH) ** 2;
      n++;
    }
    const vl = Math.sqrt(sum / n);
    expect(vl).toBeGreaterThan(216);
    expect(vl).toBeLessThan(219.5);
    expect(heater).toBeLessThan(5);
    // About 2 V RMS on the heater.
    expect(Math.sqrt(heaterSq / n)).toBeGreaterThan(1.2);
    expect(Math.sqrt(heaterSq / n)).toBeLessThan(2.5);
    while (sim.t < t0 + 0.1) sim.step();
    expect(sim.frame({ samples: false }).readouts['LP.burned']).toBe(true);
  });

  it('reads the whole 220 V across the burned lamp, and nothing works', () => {
    const m = measureRms(neutro, { 'SN.closed': false });
    expect(m.readouts['LP.burned']).toBe(true);
    expect(m.rms.VL).toBeCloseTo(220, 0);
    expect(m.rms.VH).toBeLessThan(0.5);
    expect(m.rms.IN).toBeLessThan(1e-3);
  });

  it('lights nothing with the neutral broken and the heater off', () => {
    const m = measureRms(neutro, { 'SN.closed': false, 'SH.closed': false });
    expect(m.readouts['LP.burned']).toBe(false);
    expect(Number(m.readouts['LP.brightness'])).toBeLessThan(0.01);
  });
});
