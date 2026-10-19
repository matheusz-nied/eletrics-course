import { describe, expect, it } from 'vitest';
import type { CircuitDoc, SimFrame } from '../contract';
import { Simulator } from '../analysis/simulator';
import { netlist } from './utils';

const r = (frame: SimFrame, key: string) => frame.readouts[key] as number;

function run(doc: CircuitDoc, seconds: number, each?: (f: SimFrame) => void): Simulator {
  const sim = new Simulator(doc);
  sim.refresh();
  const steps = Math.round(seconds / sim.dt);
  for (let i = 0; i < steps; i++) {
    sim.step();
    each?.(sim.frame({ samples: false }));
  }
  return sim;
}

/** The phase-control dimmer of lesson 9.9: pot and capacitor set when the DIAC fires the TRIAC. */
function dimmer(pot: number): CircuitDoc {
  return netlist(
    'dimmer',
    [
      {
        id: 'V1',
        type: 'ac-voltage',
        nodes: ['1', '0'],
        params: { amplitude: 127 * Math.SQRT2, frequency: 60 },
      },
      { id: 'L1', type: 'lamp', nodes: ['1', '2'], params: { voltage: 127, power: 60 } },
      { id: 'T1', type: 'triac', nodes: { mt2: '2', mt1: '0', g: '4' } },
      { id: 'R1', type: 'resistor', nodes: ['2', '5'], params: { resistance: 3300 } },
      { id: 'P1', type: 'resistor', nodes: ['5', '3'], params: { resistance: pot } },
      { id: 'C1', type: 'capacitor', nodes: ['3', '0'], params: { capacitance: 1e-7 } },
      { id: 'D1', type: 'diac', nodes: ['3', '4'] },
    ],
    { kind: 'transient', dt: 2e-5 },
  );
}

describe('diac', () => {
  it('blocks both ways below the breakover voltage and conducts above it', () => {
    const below = run(
      netlist(
        'diac-cc',
        [
          { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 30 } },
          { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 1000 } },
          { id: 'D1', type: 'diac', nodes: ['2', '0'] },
        ],
        { kind: 'transient', dt: 1e-5 },
      ),
      0.001,
    ).frame();
    expect(r(below, 'D1.on')).toBe(false);
    expect(Math.abs(r(below, 'D1.current'))).toBeLessThan(1e-6);

    for (const volts of [34, -34]) {
      const above = run(
        netlist(
          'diac-cc',
          [
            { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: volts } },
            { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 1000 } },
            { id: 'D1', type: 'diac', nodes: ['2', '0'] },
          ],
          { kind: 'transient', dt: 1e-5 },
        ),
        0.001,
      ).frame();
      expect(r(above, 'D1.on')).toBe(true);
      // Fired, it holds about a diode drop: nearly all of the supply is on R1.
      expect(Math.abs(r(above, 'D1.voltage'))).toBeLessThan(1.5);
      expect(Math.sign(r(above, 'D1.current'))).toBe(Math.sign(volts));
    }
  });

  it('fires the TRIAC of a dimmer later in each half cycle as the pot grows', () => {
    const power = (pot: number) => {
      let sum = 0;
      let n = 0;
      run(dimmer(pot), 0.3, (f) => {
        if (f.t < 0.2) return;
        sum += r(f, 'L1.power');
        n++;
      });
      return sum / n;
    };
    const full = power(10e3);
    const half = power(150e3);
    const off = power(400e3);
    expect(full).toBeGreaterThan(55);
    expect(half).toBeLessThan(0.8 * full);
    expect(half).toBeGreaterThan(5);
    // The capacitor never reaches the breakover voltage: the lamp stays off.
    expect(off).toBeLessThan(0.5);
  });
});
