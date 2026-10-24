import { describe, expect, it } from 'vitest';
import circuit from './fase-ramos.circuit';
import { measureAc } from './fase-reatancia-medidas';

const PROBES = ['IT', 'IR', 'IL', 'IC'];

/** Readings of lesson 6.3 (mA, A~, and degrees relative to the generator) with the given branches on. */
function branches(r: boolean, l: boolean, c: boolean) {
  const m = measureAc(circuit, PROBES, {
    settings: { 'SR.closed': r, 'SL.closed': l, 'SC.closed': c },
  });
  return {
    total: m.IT!.rms * 1000,
    phase: m.IT!.phase,
    ir: m.IR!.rms * 1000,
    il: m.IL!.rms * 1000,
    ic: m.IC!.rms * 1000,
  };
}

describe('três ramos em paralelo (aula 6.3)', () => {
  it('opposes 100 Ω in each branch at 60 Hz', () => {
    const l = circuit.elements.find((e) => e.id === 'L1')!.params!;
    const c = circuit.elements.find((e) => e.id === 'C1')!.params!;
    const w = 2 * Math.PI * 60;
    expect(w * Number(l.inductance)).toBeCloseTo(100, 6);
    expect(1 / (w * Number(c.capacitance))).toBeCloseTo(100, 6);
    expect(Number(l.inductance) * 1000).toBeCloseTo(265, 0);
    expect(Number(c.capacitance) * 1e6).toBeCloseTo(26.5, 1);
  });

  it('the resistor current goes with the voltage', () => {
    const m = branches(true, false, false);
    expect(m.total).toBeCloseTo(70.7, 1);
    expect(Math.abs(m.phase)).toBeLessThan(0.5);
  });

  it('the coil current lags almost a quarter cycle (87°)', () => {
    const m = branches(false, true, false);
    expect(m.total).toBeCloseTo(70.6, 1);
    expect(m.phase).toBeGreaterThan(-88);
    expect(m.phase).toBeLessThan(-86);
  });

  it('the capacitor current leads a quarter cycle', () => {
    const m = branches(false, false, true);
    expect(m.total).toBeCloseTo(70.7, 1);
    expect(m.phase).toBeCloseTo(90, 0);
  });

  it('R and L together draw 102 mA, not 141 mA, lagging about 44°', () => {
    const m = branches(true, true, false);
    expect(m.ir).toBeCloseTo(70.7, 1);
    expect(m.il).toBeCloseTo(70.6, 1);
    expect(m.total).toBeGreaterThan(101.5);
    expect(m.total).toBeLessThan(103);
    expect(m.phase).toBeGreaterThan(-45);
    expect(m.phase).toBeLessThan(-42);
  });

  it('R and C together draw 100 mA, leading 45°', () => {
    const m = branches(true, false, true);
    expect(m.total).toBeCloseTo(100, 0);
    expect(m.phase).toBeCloseTo(45, 0);
  });

  it('L and C almost cancel: about 4 mA from the generator', () => {
    const m = branches(false, true, true);
    expect(m.il).toBeGreaterThan(70);
    expect(m.ic).toBeGreaterThan(70);
    expect(m.total).toBeGreaterThan(3.5);
    expect(m.total).toBeLessThan(4.3);
  });

  it('with the three on, the generator sees almost only the resistor: 75 mA', () => {
    const m = branches(true, true, true);
    expect(m.total).toBeGreaterThan(74);
    expect(m.total).toBeLessThan(75.5);
    expect(Math.abs(m.phase)).toBeLessThan(3);
  });
});
