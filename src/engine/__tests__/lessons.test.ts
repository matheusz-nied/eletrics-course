import { describe, expect, it } from 'vitest';
import type { CircuitDoc } from '../contract';
import { Simulator } from '../analysis/simulator';
import { checkGoal } from '../analysis/goals';
import { validateCircuit } from '../format/validate';

/**
 * Every lesson circuit (src/lessons/<módulo>/<slug>.circuit.ts, default
 * export) must validate, run without stopping, and meet its goals: as is, or
 * after applying the goal's `solution` (docs/plano/03-guia-de-conteudo.md, section 5).
 */
const circuits = import.meta.glob<CircuitDoc>('/src/lessons/**/*.circuit.ts', {
  eager: true,
  import: 'default',
});

const entries = Object.entries(circuits).map(([path, doc]) => ({
  path,
  expectedId: path.replace(/^\/src\/lessons\//, '').replace(/\.circuit\.ts$/, ''),
  doc,
}));

function runTo(sim: Simulator, t: number): void {
  sim.refresh();
  while (sim.t < t - sim.dt * 1e-6) sim.step();
}

describe('lesson circuits', () => {
  it('are found by the same glob the lessons use', () => {
    expect(Array.isArray(entries)).toBe(true);
  });

  for (const { path, expectedId, doc } of entries) {
    describe(expectedId, () => {
      it('has an id matching its path and validates', () => {
        expect(doc?.id, `${path} must default-export defineCircuit({...})`).toBe(expectedId);
        expect(validateCircuit(doc).errors).toEqual([]);
      });

      if (doc?.analysis?.kind === 'dc' || doc?.analysis?.kind === 'transient') {
        const tEnd = (doc.analysis.kind === 'transient' && doc.analysis.tStop) || 1;
        it('runs without stopping', () => {
          const sim = new Simulator(doc);
          runTo(sim, Math.min(tEnd, 5));
          const frame = sim.frame();
          for (const [key, value] of Object.entries(frame.readouts)) {
            if (typeof value === 'number') expect(Number.isNaN(value), key).toBe(false);
          }
        });

        for (const goal of doc.goals ?? []) {
          it(`meets goal "${goal.id}"${goal.solution ? ' with its solution' : ''}`, () => {
            const sim = new Simulator(doc);
            for (const [key, value] of Object.entries(goal.solution ?? {})) {
              const dot = key.indexOf('.');
              sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
            }
            runTo(sim, goal.at ?? tEnd);
            const frame = sim.frame();
            expect(
              checkGoal(goal, frame),
              `${goal.check.readout} = ${String(frame.readouts[goal.check.readout])}, esperado ${goal.check.op} ${JSON.stringify(goal.check.value)}`,
            ).toBe(true);
          });
        }
      }
    });
  }
});
