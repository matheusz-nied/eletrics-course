import { describe, expect, it } from 'vitest';
import type { SimFrame } from '../contract';
import { getDeviceInfo } from '../index';
import { Simulator } from '../analysis/simulator';
import { netlist } from './utils';

const r = (frame: SimFrame, key: string) => frame.readouts[key] as number;

/** 5 V on a1, 0 V on a2, and a 50 Ω load from each b pin to ground. */
const bench = () =>
  netlist('intermediario', [
    { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 5 } },
    { id: 'X1', type: 'switch-intermediate', nodes: { a1: '1', a2: '0', b1: '3', b2: '4' } },
    { id: 'R1', type: 'resistor', nodes: ['3', '0'], params: { resistance: 50 } },
    { id: 'R2', type: 'resistor', nodes: ['4', '0'], params: { resistance: 50 } },
  ]);

describe('switch-intermediate', () => {
  it('has four pins, a pt-BR label and the actuated readout', () => {
    const info = getDeviceInfo('switch-intermediate');
    expect(info.terminals).toBe('fixed');
    expect(info.pins.map((p) => p.name)).toEqual(['a1', 'a2', 'b1', 'b2']);
    expect(info.params.actuated?.default).toBe(false);
    expect(info.readouts).toEqual(['actuated']);
  });

  it('connects straight at rest and crossed when actuated', () => {
    const sim = new Simulator(bench());
    sim.refresh();
    expect(r(sim.frame(), 'R1.current')).toBeCloseTo(0.1, 5);
    expect(r(sim.frame(), 'R2.current')).toBeLessThan(1e-7);
    expect(r(sim.frame(), 'X1.pin.a1')).toBeCloseTo(0.1, 5);
    expect(sim.frame().readouts['X1.actuated']).toBe(false);

    sim.setParam('X1', 'actuated', true);
    sim.refresh();
    expect(r(sim.frame(), 'R1.current')).toBeLessThan(1e-7);
    expect(r(sim.frame(), 'R2.current')).toBeCloseTo(0.1, 5);
    expect(r(sim.frame(), 'X1.pin.a1')).toBeCloseTo(0.1, 5);
    expect(r(sim.frame(), 'X1.pin.b2')).toBeCloseTo(-0.1, 5);
    expect(sim.frame().readouts['X1.actuated']).toBe(true);
  });

  it('works in the quasi-static analysis at 60 Hz', () => {
    const doc = netlist(
      'intermediario-ca',
      [
        { id: 'VA', type: 'ac-voltage', nodes: ['1', '0'], params: { amplitude: 10 } },
        { id: 'X1', type: 'switch-intermediate', nodes: { a1: '1', a2: '0', b1: '3', b2: '4' } },
        { id: 'R1', type: 'resistor', nodes: ['3', '0'], params: { resistance: 100 } },
        { id: 'R2', type: 'resistor', nodes: ['4', '0'], params: { resistance: 100 } },
      ],
      { kind: 'quasi-static', frequency: 60, dtMech: 0.01 },
    );
    const sim = new Simulator(doc);
    sim.refresh();
    sim.step();
    expect(r(sim.frame(), 'R1.current')).toBeCloseTo(10 / Math.SQRT2 / 100, 5);
    sim.setParam('X1', 'actuated', true);
    sim.step();
    expect(r(sim.frame(), 'R1.current')).toBeLessThan(1e-6);
    expect(r(sim.frame(), 'R2.current')).toBeCloseTo(10 / Math.SQRT2 / 100, 5);
  });
});
