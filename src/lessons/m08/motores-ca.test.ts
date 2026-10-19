import { describe, expect, it } from 'vitest';
import type { CircuitDoc } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import { checkGoal } from '../../engine/analysis/goals';
import estrelaTriangulo from './estrela-triangulo.circuit';

/**
 * The shared lesson test only runs the goals of DC and transient circuits;
 * the AC motor circuits of module 8 are quasi-static, so their goals (the
 * numbers the lessons quote) are checked here the same way.
 */
const circuits: CircuitDoc[] = [estrelaTriangulo];

for (const doc of circuits) {
  describe(doc.id, () => {
    for (const goal of doc.goals ?? []) {
      it(`meets goal "${goal.id}"`, () => {
        const sim = new Simulator(doc);
        for (const [key, value] of Object.entries(goal.solution ?? {})) {
          const dot = key.indexOf('.');
          sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
        }
        sim.refresh();
        const at = goal.at ?? 1;
        while (sim.t < at - sim.dt * 1e-6) sim.step();
        const frame = sim.frame({ samples: false });
        expect(
          checkGoal(goal, frame),
          `${goal.check.readout} = ${String(frame.readouts[goal.check.readout])}`,
        ).toBe(true);
        const damaged = frame.events.filter((e) => e.kind === 'damaged');
        expect(damaged).toEqual([]);
      });
    }
  });
}
