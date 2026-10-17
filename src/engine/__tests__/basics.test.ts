import { describe, expect, it } from 'vitest';
import { loop, runFor } from './utils';

describe('linear DC', () => {
  it('solves a voltage divider', () => {
    const doc = loop('divisor', [
      { id: 'V1', type: 'dc-voltage', params: { voltage: 12 } },
      { id: 'R1', type: 'resistor', params: { resistance: 1000 } },
      { id: 'R2', type: 'resistor', params: { resistance: 2000 } },
    ]);
    const { frame } = runFor(doc);
    expect(frame.readouts['R1.current']).toBeCloseTo(0.004, 8);
    expect(frame.readouts['R2.voltage']).toBeCloseTo(8, 5);
    expect(frame.readouts['V1.current']).toBeCloseTo(0.004, 8);
    expect(frame.readouts['V1.power']).toBeCloseTo(0.048, 7);
    expect(frame.readouts['Wret.current.0']).toBeCloseTo(0.004, 8);
  });
});

describe('transient', () => {
  it('charges a capacitor with τ = RC', () => {
    const doc = loop(
      'rc',
      [
        { id: 'V1', type: 'dc-voltage', params: { voltage: 10 } },
        { id: 'R1', type: 'resistor', params: { resistance: 1000 } },
        { id: 'C1', type: 'capacitor', params: { capacitance: 1e-6 } },
      ],
      { kind: 'transient', dt: 1e-5 },
    );
    const { frame } = runFor(doc, 1e-3);
    expect(frame.readouts['C1.voltage']).toBeCloseTo(10 * (1 - Math.exp(-1)), 3);
  });
});
