import { describe, expect, it } from 'vitest';
import type { ParamValue } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import motor, { CAPACITORS } from './fator-de-potencia-motor.circuit';
import { LOADS, capacitorFor, capacitorVar, corrected, loadTriangle } from './triangulo-potencias';

/**
 * Values lesson 6.5 quotes: the motor simulation (quasi-static, so every
 * step is the steady state; the goals runner only covers DC and transient
 * circuits) and the power triangle widget.
 */
function measure(settings: Record<string, ParamValue> = {}) {
  const sim = new Simulator(motor);
  for (const [key, value] of Object.entries(settings)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  sim.step();
  const r = sim.frame({ samples: false }).readouts;
  return {
    it: Number(r.IT),
    im: Number(r.IM),
    p: Number(r.P),
    v: Number(r['V.ac']),
    pf: Number(r['R.powerFactor']),
    ic: Number(r['C1.current']),
  };
}

const withCap = (farads: number) => measure({ 'S1.closed': true, 'C1.capacitance': farads });

describe('o motor com fator de potência baixo (aula 6.5)', () => {
  it('offers 40, 60, 80 and 120 µF', () => {
    expect(CAPACITORS.map((c) => Math.round(c * 1e6))).toEqual([40, 60, 80, 120]);
  });

  it('draws 5,6 A for 500 W at power factor 0,71 without the capacitor', () => {
    const m = measure();
    expect(m.it).toBeCloseTo(5.59, 2);
    expect(m.im).toBeCloseTo(m.it, 3);
    expect(m.p).toBeGreaterThan(495);
    expect(m.p).toBeLessThan(505);
    expect(m.pf).toBeCloseTo(0.71, 2);
    // The wiring (0,3 Ω) drops about 1 V: the motor sees 125,8 V.
    expect(m.v).toBeCloseTo(125.8, 1);
    // S = V × I ≈ 703 VA, Q ≈ 494 var.
    const s = m.v * m.it;
    expect(s).toBeCloseTo(703, 0);
    expect(Math.sqrt(s * s - m.p * m.p)).toBeCloseTo(494, -1);
  });

  it('falls to about 4,46 A (0,89) with 40 µF and 4,12 A (0,96) with 60 µF', () => {
    const c40 = withCap(40e-6);
    expect(c40.it).toBeCloseTo(4.46, 2);
    expect(c40.pf).toBeCloseTo(0.89, 2);
    const c60 = withCap(60e-6);
    expect(c60.it).toBeCloseTo(4.12, 2);
    expect(c60.pf).toBeCloseTo(0.96, 2);
  });

  it('reaches power factor 1,00 and 3,97 A with 80 µF, the motor itself unchanged', () => {
    const before = measure();
    const m = withCap(80e-6);
    expect(m.it).toBeCloseTo(3.97, 2);
    expect(m.pf).toBeGreaterThan(0.995);
    expect(m.p).toBeCloseTo(before.p, 0);
    expect(m.im).toBeCloseTo(before.im, 2);
    // The capacitor carries 3,8 A of its own, out of phase with the motor's current.
    expect(m.ic).toBeCloseTo(3.79, 2);
  });

  it('overcorrects with 120 µF: the current climbs back to 4,35 A (0,91)', () => {
    const m = withCap(120e-6);
    expect(m.it).toBeCloseTo(4.35, 2);
    expect(m.pf).toBeCloseTo(0.91, 2);
  });

  it('halves the loss in the wiring with the correction', () => {
    const loss = (i: number) => 0.3 * i * i;
    expect(loss(measure().it)).toBeCloseTo(9.4, 1);
    expect(loss(withCap(80e-6).it)).toBeCloseTo(4.7, 1);
  });
});

describe('o triângulo das potências (aula 6.5)', () => {
  it('starts with the 1/2 cv pump: 500 W, 0,71', () => {
    expect(LOADS[0]).toMatchObject({ p: 500, pf: 0.71 });
    const t = loadTriangle(500, 0.71, 127);
    expect(t.s).toBeCloseTo(704, 0);
    expect(t.q).toBeCloseTo(496, 0);
    expect(t.current).toBeCloseTo(5.55, 2);
    expect(t.phi).toBeCloseTo(44.8, 1);
  });

  it('needs about 47 µF for 0,92 and 82 µF for 1 on the pump', () => {
    expect(capacitorFor(500, 0.71, 0.92, 127) * 1e6).toBeCloseTo(46.5, 1);
    expect(capacitorFor(500, 0.71, 1, 127) * 1e6).toBeCloseTo(81.6, 1);
    const c = corrected(500, 0.71, 127, 47e-6);
    expect(c.pf).toBeCloseTo(0.92, 2);
    expect(c.current).toBeCloseTo(4.27, 2);
    expect(corrected(500, 0.71, 127, 82e-6).current).toBeCloseTo(3.94, 2);
  });

  it('gives 486 var from 80 µF on 127 V', () => {
    expect(capacitorVar(80e-6, 127)).toBeCloseTo(486, 0);
  });

  it('solves the worked example: 1.500 W, 0,75, 220 V', () => {
    const t = loadTriangle(1500, 0.75, 220);
    expect(t.s).toBeCloseTo(2000, 6);
    expect(t.current).toBeCloseTo(9.09, 2);
    expect(t.q).toBeCloseTo(1323, 0);
    expect(capacitorFor(1500, 0.75, 0.92, 220) * 1e6).toBeCloseTo(37.5, 1);
    expect(capacitorFor(1500, 0.75, 1, 220) * 1e6).toBeCloseTo(72.5, 1);
    const fixed = corrected(1500, 0.75, 220, 37.5e-6);
    expect(fixed.pf).toBeCloseTo(0.92, 3);
    expect(fixed.s).toBeCloseTo(1630, 0);
    expect(fixed.current).toBeCloseTo(7.41, 2);
    // The widget's slider moves in whole microfarads: 38 µF gives about 7,4 A.
    const slider = corrected(1500, 0.75, 220, 38e-6);
    expect(slider.current).toBeCloseTo(7.39, 2);
    expect(slider.pf).toBeGreaterThan(0.92);
  });

  it('does not ask for a capacitor on a resistive load', () => {
    expect(capacitorFor(5500, 1, 0.92, 220)).toBe(0);
    expect(loadTriangle(5500, 1, 220).q).toBeCloseTo(0, 6);
  });
});
