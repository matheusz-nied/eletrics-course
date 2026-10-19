import { describe, expect, it } from 'vitest';
import type { CircuitDoc, ParamValue, SimFrame } from '../../engine/contract';
import { checkGoal } from '../../engine/analysis/goals';
import { Simulator } from '../../engine/analysis/simulator';
import { validateCircuit } from '../../engine/format/validate';
import escada from './escada-paralelo.circuit';
import tresPontos from './tres-pontos.circuit';

/**
 * The circuits of lesson 7.6 run in the quasi-static analysis (real time at
 * 60 Hz), whose goals the generic lesson test does not run: they are run
 * here, with the values the lesson quotes.
 */
function settle(doc: CircuitDoc, settings: Record<string, ParamValue> = {}, seconds = 1): SimFrame {
  const sim = new Simulator(doc);
  for (const [key, value] of Object.entries(settings)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  while (sim.t < seconds) sim.step();
  return sim.frame({ samples: false });
}

function checkGoals(doc: CircuitDoc) {
  // The earth pin of the mains stays free (nothing here has a metal case to bond).
  expect(validateCircuit(doc).errors).toEqual([]);
  for (const goal of doc.goals ?? []) {
    const frame = settle(doc, goal.solution ?? {}, goal.at ?? 1);
    expect(
      checkGoal(goal, frame),
      `${doc.id} ${goal.id}: ${goal.check.readout} = ${String(frame.readouts[goal.check.readout])}`,
    ).toBe(true);
  }
}

const num = (f: SimFrame, key: string) => Number(f.readouts[key]);

describe('luz da escada com dois paralelos (aula 7.6)', () => {
  it('meets its goals', () => checkGoals(escada));

  it('changes the lamp from either switch, in the four positions', () => {
    const lit = (s1: boolean, s2: boolean) =>
      num(settle(escada, { 'S1.actuated': s1, 'S2.actuated': s2 }), 'L1.brightness') > 0.9;
    expect(lit(false, false)).toBe(true);
    expect(lit(true, false)).toBe(false);
    expect(lit(false, true)).toBe(false);
    expect(lit(true, true)).toBe(true);
  });

  it('draws 0,47 A with 127 V on the lamp, and nothing when it is off', () => {
    const on = settle(escada);
    expect(num(on, 'IL')).toBeCloseTo(0.47, 2);
    expect(num(on, 'VL')).toBeGreaterThan(126.5);
    const off = settle(escada, { 'S1.actuated': true });
    expect(num(off, 'IL')).toBeLessThan(1e-3);
    expect(num(off, 'VL')).toBeLessThan(1);
  });
});

describe('três pontos com um intermediário (aula 7.6)', () => {
  it('meets its goals', () => checkGoals(tresPontos));

  it('changes the lamp from any of the three switches', () => {
    for (const s1 of [false, true]) {
      for (const x of [false, true]) {
        for (const s2 of [false, true]) {
          const f = settle(tresPontos, { 'S1.actuated': s1, 'X1.actuated': x, 'S2.actuated': s2 });
          // Straight: lit when both three-ways agree; crossed: lit when they differ.
          const expected = (s1 === s2) !== x;
          expect(num(f, 'L1.brightness') > 0.9, `S1=${s1} X1=${x} S2=${s2}`).toBe(expected);
        }
      }
    }
  });
});
