import { describe, expect, it } from 'vitest';
import { Simulator } from '../../engine/analysis/simulator';
import circuit from './extensao.circuit';
import { cord, cordResistance } from './extensao';

describe('extensão que esquenta', () => {
  it('computes the resistance of both conductors', () => {
    expect(cordResistance(0.75, 20)).toBeCloseTo(0.917, 3);
    expect(cordResistance(2.5, 20)).toBeCloseTo(0.275, 3);
  });

  it('matches the lesson circuit for both cords', () => {
    const sim = new Simulator(circuit);
    sim.refresh();
    while (sim.t < 1) sim.step();
    const thin = cord(0.75, 20, 1270);
    expect(sim.frame().readouts['RF.power']).toBeCloseTo(thin.heat, 2);
    expect(sim.frame().readouts['RA.voltage']).toBeCloseTo(thin.appliance, 2);

    sim.setParam('S1', 'actuated', true);
    sim.refresh();
    while (sim.t < 2) sim.step();
    const thick = cord(2.5, 20, 1270);
    expect(sim.frame().readouts['RG.power']).toBeCloseTo(thick.heat, 2);
  });

  it('gives the numbers quoted in the lesson', () => {
    const thin = cord(0.75, 20, 1270);
    expect(thin.current).toBeCloseTo(9.33, 2);
    expect(thin.drop).toBeCloseTo(8.56, 2);
    expect(thin.heat).toBeCloseTo(79.8, 1);
    expect(cord(2.5, 20, 1270).heat).toBeCloseTo(26.4, 1);
  });
});
