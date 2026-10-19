/** Runs module 12 circuits in tests: set parameters, run, collect readouts and events. */
import { Simulator } from '../../../engine/analysis/simulator';
import type { CircuitDoc, ParamValue, SimEvent } from '../../../engine/contract';

export interface Run {
  sim: Simulator;
  events: SimEvent[];
  /** Runs until `t`, calling `each` after every step. */
  to(t: number, each?: (r: Record<string, number | boolean | string>, t: number) => void): Run;
  set(key: string, value: ParamValue): Run;
  readouts(): Record<string, number | boolean | string>;
}

export function run(doc: CircuitDoc, set: Record<string, ParamValue> = {}): Run {
  const sim = new Simulator(doc);
  const events: SimEvent[] = [];
  const self: Run = {
    sim,
    events,
    set(key, value) {
      const dot = key.indexOf('.');
      sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
      sim.refresh();
      return self;
    },
    to(t, each) {
      while (sim.t < t - sim.dt * 1e-6) {
        sim.step();
        const frame = sim.frame({ samples: false });
        events.push(...frame.events);
        each?.(frame.readouts, sim.t);
      }
      return self;
    },
    readouts: () => sim.frame().readouts,
  };
  for (const [k, v] of Object.entries(set)) self.set(k, v);
  sim.refresh();
  return self;
}
