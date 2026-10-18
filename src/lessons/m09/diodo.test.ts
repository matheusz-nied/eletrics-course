import { describe, expect, it } from 'vitest';
import { Simulator } from '../../engine/analysis/simulator';
import { DIODES, diodeVoltage } from './diodo-modelo';
import { constantDropCurrent, curvePart, niceCeil, solve } from './curva-diodo';
import protecao from './diodo-protecao.circuit';

/** Values lesson 9.2 quotes from the live curve (CurvaDiodo) and the protection circuit. */

const at = (source: number, ohms: number, id: Parameters<typeof curvePart>[0]) =>
  solve(source, ohms, curvePart(id));

describe('9.2 forward voltage of the 1N4007 per decade of current', () => {
  it('0,55 V at 1 mA, 0,66 V at 10 mA, 0,77 V at 100 mA, 0,91 V at 1 A', () => {
    const d = DIODES.rectifier;
    expect(diodeVoltage(1e-3, d)).toBeCloseTo(0.55, 2);
    expect(diodeVoltage(1e-2, d)).toBeCloseTo(0.66, 2);
    expect(diodeVoltage(0.1, d)).toBeCloseTo(0.77, 2);
    expect(diodeVoltage(1, d)).toBeCloseTo(0.91, 2);
  });
});

describe('9.2 live curve', () => {
  it('1N4007 with 5 V: 4,38 mA and 0,624 V with 1 kΩ; 42,7 mA and 0,732 V with 100 Ω', () => {
    const a = at(5, 1000, '1n4007');
    expect(a.current * 1e3).toBeCloseTo(4.38, 2);
    expect(a.voltage).toBeCloseTo(0.624, 3);
    const b = at(5, 100, '1n4007');
    expect(b.current * 1e3).toBeCloseTo(42.7, 1);
    expect(b.voltage).toBeCloseTo(0.732, 3);
  });

  it('5 V and 100 Ω: 1N4148 0,778 V, 1N5819 0,262 V', () => {
    expect(at(5, 100, '1n4148').voltage).toBeCloseTo(0.778, 3);
    expect(at(5, 100, '1n5819').voltage).toBeCloseTo(0.262, 3);
  });

  it('reverse at −5 V: −7,03 nA in the 1N4007, −31,7 µA in the Schottky (about 4.500 times more)', () => {
    const si = at(-5, 1000, '1n4007').current;
    const sch = at(-5, 1000, '1n5819').current;
    expect(si * 1e9).toBeCloseTo(-7.03, 2);
    expect(sch * 1e6).toBeCloseTo(-31.7, 1);
    expect(sch / si).toBeGreaterThan(4400);
    expect(sch / si).toBeLessThan(4600);
  });

  it('red LED with 5 V and 330 Ω: 9,52 mA at 1,86 V; the 2,0 V model gives 9,09 mA', () => {
    const led = at(5, 330, 'led-vermelho');
    expect(led.current * 1e3).toBeCloseTo(9.52, 2);
    expect(led.voltage).toBeCloseTo(1.86, 2);
    expect(constantDropCurrent(5, 330, curvePart('led-vermelho').drop) * 1e3).toBeCloseTo(9.09, 2);
  });

  it('1 V and 100 Ω: the constant-drop model says 3,0 mA, the curve 3,82 mA at 0,618 V', () => {
    const p = at(1, 100, '1n4007');
    expect(constantDropCurrent(1, 100, 0.7) * 1e3).toBeCloseTo(3, 6);
    expect(p.current * 1e3).toBeCloseTo(3.82, 2);
    expect(p.voltage).toBeCloseTo(0.618, 3);
    expect((p.current - 0.003) / p.current).toBeGreaterThan(0.2);
  });

  it('12 V and 100 Ω: the constant-drop model errs by less than 1 %', () => {
    const p = at(12, 100, '1n4007');
    const model = constantDropCurrent(12, 100, 0.7);
    expect(Math.abs(model - p.current) / p.current).toBeLessThan(0.01);
  });

  it('quiz: 9 V and 1 kΩ, about 8,35 mA at 0,65 V', () => {
    const p = at(9, 1000, '1n4007');
    expect(p.current * 1e3).toBeCloseTo(8.35, 2);
    expect(p.voltage).toBeCloseTo(0.65, 2);
  });

  it('rounds the current axis up to 1, 2 or 5 × 10ⁿ', () => {
    expect(niceCeil(5.26)).toBe(10);
    expect(niceCeil(1.2)).toBe(2);
    expect(niceCeil(51.2)).toBe(100);
    expect(niceCeil(0.0012)).toBeCloseTo(0.002, 12);
    expect(niceCeil(5)).toBe(5);
  });
});

function protection(params: Record<string, number | string> = {}) {
  const sim = new Simulator(protecao);
  for (const [key, value] of Object.entries(params)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  return sim.frame().readouts as Record<string, number>;
}

describe('9.2 reverse-polarity protection', () => {
  it('1N4007: the device gets 11,13 V and 0,464 A; the diode drops 0,858 V and dissipates 0,40 W', () => {
    const r = protection();
    expect(r.VAP).toBeCloseTo(11.13, 2);
    expect(r.IAP).toBeCloseTo(0.464, 3);
    expect(r.VD1).toBeCloseTo(0.858, 3);
    expect(r.PD1).toBeCloseTo(0.4, 2);
  });

  it('battery reversed: −12 V on the diode, about −7 nA in the device', () => {
    const r = protection({ 'B1.voltage': -12 });
    expect(r.VD1).toBeCloseTo(-12, 2);
    expect(r.IAP * 1e9).toBeCloseTo(-7, 0);
  });

  it('Schottky: 11,62 V on the device, 0,367 V and 0,18 W on the diode', () => {
    const r = protection({ 'D1.model': 'schottky' });
    expect(r.VAP).toBeCloseTo(11.62, 2);
    expect(r.VD1).toBeCloseTo(0.367, 3);
    expect(r.PD1).toBeCloseTo(0.18, 2);
  });
});
