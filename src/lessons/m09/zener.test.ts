import { describe, expect, it } from 'vitest';
import { Simulator } from '../../engine/analysis/simulator';
import type { ParamValue } from '../../engine/contract';
import regulador from './zener-regulador.circuit';

/** Readouts of the regulator after one second, with some parameters changed. */
function run(set: Record<string, ParamValue> = {}) {
  const sim = new Simulator(regulador);
  for (const [key, value] of Object.entries(set)) {
    const [el, param] = key.split('.') as [string, string];
    sim.setParam(el, param, value);
  }
  sim.refresh();
  while (sim.t < 1 - sim.dt * 1e-6) sim.step();
  return sim.frame().readouts as Record<string, number>;
}

/** The car example: a 20 mA load on 5,1 V. */
const LOAD_20MA = 255;

describe('zener regulator of lesson 9.5', () => {
  it('12 V and 1 kΩ: the values in the text', () => {
    const r = run();
    expect(r['VOUT']).toBeCloseTo(5.19, 2);
    expect(r['IS']).toBeCloseTo(0.0309, 4);
    expect(r['IL']).toBeCloseTo(0.0052, 4);
    expect(r['IS']! - r['IL']!).toBeCloseTo(0.0257, 4);
    expect(r['PZ']).toBeCloseTo(0.13, 2);
  });

  it('the output barely moves from 9 V to 15 V', () => {
    expect(run({ 'V1.voltage': 9 })['VOUT']).toBeCloseTo(5.15, 2);
    expect(run({ 'V1.voltage': 15 })['VOUT']).toBeCloseTo(5.23, 2);
  });

  it('a heavy load takes it out of regulation', () => {
    expect(run({ 'RL.resistance': 200 })['VOUT']).toBeCloseTo(5.11, 2);
    expect(run({ 'RL.resistance': 160 })['VOUT']).toBeCloseTo(5.03, 2);
    // With 100 Ω the zener is off and the circuit is a plain divider.
    expect(run({ 'RL.resistance': 100 })['VOUT']).toBeCloseTo((12 * 100) / 320, 3);
    // The smallest load resistance it still regulates: Vz / Is.
    expect((5.1 * 220) / 6.9).toBeCloseTo(163, 0);
  });

  it('no load at 15 V: the worst case for the zener', () => {
    const r = run({ 'V1.voltage': 15, 'S1.closed': false });
    expect(r['IS']).toBeCloseTo(0.044, 3);
    expect(r['PZ']).toBeCloseTo(0.23, 2);
    expect(r['RS.power']).toBeCloseTo(0.43, 2);
    expect(r['DZ.burned']).toBe(false);
  });

  it('the car example', () => {
    // Rs for 25 mA at 11 V: 236 Ω, 220 Ω in the series.
    expect((11 - 5.1) / 0.025).toBeCloseTo(236, 0);
    const low = run({ 'V1.voltage': 11, 'RL.resistance': LOAD_20MA });
    expect(low['IL']).toBeCloseTo(0.02, 3);
    expect(low['IS']).toBeCloseTo(0.0267, 4);
    expect(low['IS']! - low['IL']!).toBeCloseTo(0.0066, 4);
    expect(low['VOUT']).toBeCloseTo(5.12, 2);
    const high = run({ 'V1.voltage': 14.4, 'S1.closed': false });
    expect(high['IS']).toBeCloseTo(0.042, 3);
    expect(high['PZ']).toBeCloseTo(0.22, 2);
    expect(high['RS.power']).toBeCloseTo(0.38, 2);
    // Efficiency with the module on at 14,4 V: about one sixth reaches the load.
    const on = run({ 'V1.voltage': 14.4, 'RL.resistance': LOAD_20MA });
    expect((on['VOUT']! * on['IL']!) / (14.4 * on['IS']!)).toBeCloseTo(1 / 6, 1);
  });
});
