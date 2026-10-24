/**
 * Test helpers for the module 11 circuits: start a circuit with some
 * parameters changed, run it, and follow readouts step by step.
 */
import type { CircuitDoc, SimFrame } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';

export type Readouts = SimFrame['readouts'];

export function start(doc: CircuitDoc, params: Record<string, number | boolean | string> = {}) {
  const sim = new Simulator(doc);
  for (const [key, value] of Object.entries(params)) set(sim, key, value);
  sim.refresh();
  return sim;
}

/** `set(sim, 'R1.resistance', 1000)`. */
export function set(sim: Simulator, key: string, value: number | boolean | string) {
  const dot = key.indexOf('.');
  sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
}

/** Runs until `t` (s), calling `each` with the readouts after every step. */
export function runTo(
  sim: Simulator,
  t: number,
  each?: (r: Readouts, t: number) => void,
): Readouts {
  while (sim.t < t - 1e-12) {
    sim.step();
    if (each) each(sim.frame({ samples: false }).readouts, sim.t);
  }
  return sim.frame({ samples: false }).readouts;
}

export const num = (r: Readouts, key: string) => r[key] as number;

/** Counts the changes of a boolean readout while running until `t`. */
export function countEdges(sim: Simulator, key: string, t: number): number {
  let last: unknown;
  let n = 0;
  runTo(sim, t, (r) => {
    if (last !== undefined && r[key] !== last) n++;
    last = r[key];
  });
  return n;
}
