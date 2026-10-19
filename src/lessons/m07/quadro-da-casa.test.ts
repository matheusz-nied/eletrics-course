import { describe, expect, it } from 'vitest';
import type { ParamValue, SimFrame } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import { checkGoal } from '../../engine/analysis/goals';
import { validateCircuit } from '../../engine/format/validate';
import quadro, { LOADS } from './quadro-da-casa.circuit';

/**
 * The house panel of lesson 7.1. The circuit is quasi-static, so the generic
 * lessons.test.ts does not run its goals: they are run here, together with the
 * currents and the trip time the lesson quotes.
 */
function bench(settings: Record<string, ParamValue> = {}) {
  const sim = new Simulator(quadro);
  for (const [key, value] of Object.entries(settings)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  return {
    sim,
    runTo(t: number): SimFrame {
      while (sim.t < t - sim.dt * 1e-6) sim.step();
      return sim.frame({ samples: false });
    },
  };
}

const amps = (frame: SimFrame, probe: string) => Math.abs(Number(frame.readouts[probe]));
const ALL_ON = { 'S1.closed': true, 'S2.closed': true, 'S3.closed': true };

// Each test simulates up to a few minutes of the house: room for slow CI machines.
describe('o quadro da casa (aula 7.1)', { timeout: 30_000 }, () => {
  it('validates', () => {
    expect(validateCircuit(quadro).errors).toEqual([]);
  });

  for (const goal of quadro.goals ?? []) {
    it(`meets goal "${goal.id}"`, () => {
      const frame = bench(goal.solution).runTo(goal.at ?? 1);
      expect(
        checkGoal(goal, frame),
        `${goal.check.readout} = ${String(frame.readouts[goal.check.readout])}`,
      ).toBe(true);
    });
  }

  it('draws nothing with every load switched off', () => {
    const frame = bench().runTo(1);
    expect(amps(frame, 'IG')).toBeLessThan(1e-3);
  });

  it('adds the three circuits in the main breaker: 0,91 + 2 + 24,9 = 27,8 A', () => {
    const frame = bench(ALL_ON).runTo(2);
    const [ig, i1, i2, i3] = ['IG', 'I1', 'I2', 'I3'].map((p) => amps(frame, p)) as [
      number,
      number,
      number,
      number,
    ];
    expect(i1).toBeCloseTo(0.91, 2);
    expect(i2).toBeCloseTo(2, 1);
    expect(i3).toBeCloseTo(24.9, 1);
    expect(ig).toBeCloseTo(27.8, 1);
    // Kirchhoff: the main breaker carries exactly the sum.
    expect(ig).toBeCloseTo(i1 + i2 + i3, 6);
    expect(frame.readouts['L1.brightness']).toBeGreaterThan(0.95);
  });

  it('carries 12 A on the outlets with the iron and the microwave (37,8 A in the main breaker)', () => {
    const frame = bench({ ...ALL_ON, 'R2.resistance': LOADS.ferroMicro }).runTo(30);
    expect(amps(frame, 'I2')).toBeCloseTo(12, 1);
    expect(amps(frame, 'IG')).toBeCloseTo(37.8, 1);
    expect(frame.readouts['DJ2.tripped']).toBe(false);
  });

  it('trips only the 20 A outlets breaker with 30 A, after a little more than a minute', () => {
    const b = bench({ ...ALL_ON, 'R2.resistance': LOADS.tudoJunto });
    const before = b.runTo(2);
    expect(amps(before, 'I2')).toBeCloseTo(30, 0);
    expect(amps(before, 'IG')).toBeCloseTo(55.7, 1);
    let tripAt = Number.NaN;
    while (b.sim.t < 200) {
      b.sim.step();
      if (b.sim.frame({ samples: false }).readouts['DJ2.tripped'] === true) {
        tripAt = b.sim.t;
        break;
      }
    }
    // From cold: about 83 s (simulation time; the simulation runs 10× faster).
    expect(tripAt).toBeGreaterThan(70);
    expect(tripAt).toBeLessThan(90);
    const after = b.runTo(tripAt + 5);
    expect(amps(after, 'I2')).toBeLessThan(1e-3);
    expect(amps(after, 'IG')).toBeGreaterThan(25.8);
    expect(amps(after, 'IG')).toBeLessThan(25.9);
    expect(after.readouts['DJG.tripped']).toBe(false);
    expect(after.readouts['DJ1.tripped']).toBe(false);
    expect(after.readouts['DJ3.tripped']).toBe(false);
  });

  it('trips sooner when the outlets breaker was already warm (12 A for a long time)', () => {
    const b = bench({ ...ALL_ON, 'R2.resistance': LOADS.ferroMicro });
    b.runTo(300);
    b.sim.setParam('R2', 'resistance', LOADS.tudoJunto);
    const start = b.sim.t;
    while (b.sim.t < start + 200) {
      b.sim.step();
      if (b.sim.frame({ samples: false }).readouts['DJ2.tripped'] === true) break;
    }
    const elapsed = b.sim.t - start;
    expect(elapsed).toBeGreaterThan(65);
    expect(elapsed).toBeLessThan(80);
  });

  it('turns everything off with the main breaker', () => {
    const frame = bench({ ...ALL_ON, 'DJG.closed': false }).runTo(2);
    for (const p of ['IG', 'I1', 'I2', 'I3']) expect(amps(frame, p)).toBeLessThan(1e-3);
    expect(Number(frame.readouts['L1.brightness'])).toBeLessThan(0.01);
  });
});
