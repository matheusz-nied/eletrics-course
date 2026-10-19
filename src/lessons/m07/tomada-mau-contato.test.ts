import { describe, expect, it } from 'vitest';
import type { CircuitDoc, ParamValue, SimFrame } from '../../engine/contract';
import { checkGoal } from '../../engine/analysis/goals';
import { Simulator } from '../../engine/analysis/simulator';
import { validateCircuit } from '../../engine/format/validate';
import contato, { CONTACT } from './tomada-mau-contato.circuit';

/** Runs the quasi-static circuit with some parameters changed for `seconds`. */
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

/** The generic lesson test skips the goals of quasi-static circuits: they run here. */
function checkGoals(doc: CircuitDoc) {
  expect(validateCircuit(doc).errors).toEqual([]);
  for (const goal of doc.goals ?? []) {
    const frame = settle(doc, goal.solution ?? {}, goal.at ?? 1);
    expect(
      checkGoal(goal, frame),
      `${goal.id}: ${goal.check.readout} = ${String(frame.readouts[goal.check.readout])}`,
    ).toBe(true);
  }
}

const num = (f: SimFrame, key: string) => Number(f.readouts[key]);

describe('o mau contato na tomada do micro-ondas (aula 7.5)', () => {
  it('meets its goals', () => checkGoals(contato));

  it('keeps about 11 A whatever the contact, so the breaker never sees it', () => {
    for (const r of Object.values(CONTACT)) {
      const f = settle(contato, { 'RC.resistance': r }, 3);
      expect(num(f, 'I')).toBeGreaterThan(10.7);
      expect(num(f, 'I')).toBeLessThan(11.3);
      expect(f.readouts['DJ.closed']).toBe(true);
      expect(f.readouts['DJ.tripped']).toBe(false);
    }
  });

  it('turns 0,6 W, 12 W and almost 60 W into heat in the contact', () => {
    const heat = (r: number) => num(settle(contato, { 'RC.resistance': r }), 'PC');
    expect(heat(CONTACT.bom)).toBeCloseTo(0.63, 1);
    expect(heat(CONTACT.frouxo)).toBeCloseTo(12.4, 0);
    expect(heat(CONTACT.carbonizado)).toBeCloseTo(57.9, 0);
    // The microwave gets close to 1.400 W (the installation drops a few volts).
    expect(num(settle(contato), 'PM')).toBeGreaterThan(1370);
    expect(num(settle(contato), 'PM')).toBeLessThan(1400);
    expect(num(settle(contato), 'I')).toBeCloseTo(11.2, 1);
  });
});
