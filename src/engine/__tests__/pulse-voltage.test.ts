import { describe, expect, it } from 'vitest';
import { Simulator } from '../analysis/simulator';
import { loop, runFor } from './utils';

describe('pulse-voltage', () => {
  const doc = (duty: number) =>
    loop(
      'pwm',
      [
        {
          id: 'V1',
          type: 'pulse-voltage',
          params: { high: 12, low: 0, frequency: 1000, duty },
        },
        { id: 'R1', type: 'resistor', params: { resistance: 100 } },
      ],
      { kind: 'transient', dt: 1e-5 },
    );

  it('stays high for the duty cycle of each period and low for the rest', () => {
    const sim = new Simulator(doc(0.25));
    sim.refresh();
    let high = 0;
    let total = 0;
    let sum = 0;
    while (sim.t < 0.01 - 1e-9) {
      sim.step();
      const v = sim.frame({ samples: false }).readouts['V1.voltage'] as number;
      if (v > 6) high++;
      total++;
      sum += v;
    }
    expect(high / total).toBeCloseTo(0.25, 2);
    expect(sum / total).toBeCloseTo(3, 1);
  });

  it('holds its average in a DC analysis', () => {
    const { frame } = runFor({ ...doc(0.4), analysis: { kind: 'dc' } });
    expect(frame.readouts['V1.voltage'] as number).toBeCloseTo(4.8, 6);
  });

  it('is a constant at 0 % and 100 %', () => {
    for (const [duty, level] of [
      [0, 0],
      [1, 12],
    ] as const) {
      const sim = new Simulator(doc(duty));
      sim.refresh();
      for (let i = 0; i < 300; i++) {
        sim.step();
        expect(sim.frame({ samples: false }).readouts['V1.voltage'] as number).toBeCloseTo(
          level,
          6,
        );
      }
    }
  });
});
