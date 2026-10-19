import { describe, expect, it } from 'vitest';
import type { GoalDoc, ParamValue, SimFrame } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import { checkGoal } from '../../engine/analysis/goals';
import chuveiro, { BROKEN_OHMS, IN_AIR_W, STRETCH_OHMS, WINTER_W } from './chuveiro.circuit';

/**
 * Lesson 7.8: the numbers the text quotes for the 7.500 W shower, from the
 * simulation itself. The automatic goal check of the lessons does not run
 * the quasi-static analysis, so the goals of the circuit run here.
 */
function bench(settings: Record<string, ParamValue> = {}) {
  const sim = new Simulator(chuveiro);
  for (const [key, value] of Object.entries(settings)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  return sim;
}

function run(sim: Simulator, seconds: number): SimFrame {
  const end = sim.t + seconds;
  while (sim.t < end - 1e-9) sim.step();
  return sim.frame({ samples: false });
}

const num = (frame: SimFrame, key: string) => Number(frame.readouts[key]);

describe('o chuveiro de 7.500 W (aula 7.8)', () => {
  it('has two stretches of 220²/7.500 = 6,45 Ω', () => {
    expect(STRETCH_OHMS).toBeCloseTo(6.4533, 4);
    // P = V²/R: the whole wire (summer) gives half the power.
    expect(220 ** 2 / (2 * STRETCH_OHMS)).toBeCloseTo(WINTER_W / 2, 6);
    // I = P/V in winter: 34,1 A.
    expect(WINTER_W / 220).toBeCloseTo(34.09, 2);
  });

  it('does not heat with the water closed', () => {
    const f = run(bench({ 'S2.actuated': true }), 1);
    expect(num(f, 'REDE.power')).toBeLessThan(0.01);
  });

  it('gives about 17 A and 3.750 W in summer', () => {
    const f = run(bench({ 'S1.closed': true }), 1);
    expect(num(f, 'REDE.power')).toBeGreaterThan(3730);
    expect(num(f, 'REDE.power')).toBeLessThan(3760);
    expect(num(f, 'I.ac')).toBeCloseTo(17.0, 1);
    expect(num(f, 'V.ac')).toBeCloseTo(220, 0);
  });

  it('gives about 34 A and 7.500 W in winter, and the 40 A breaker holds', () => {
    const sim = bench({ 'S1.closed': true, 'S2.actuated': true });
    let f = run(sim, 1);
    expect(num(f, 'REDE.power')).toBeGreaterThan(7450);
    expect(num(f, 'REDE.power')).toBeLessThan(7510);
    expect(num(f, 'I.ac')).toBeCloseTo(34.06, 1);
    // A 20-minute bath: the bimetal warms up and settles well below the trip point.
    f = run(sim, 1200);
    expect(f.readouts['Q1.tripped']).toBe(false);
    expect(num(f, 'Q1.heat')).toBeCloseTo((34.06 / 40) ** 2 / 1.3 ** 2, 2);
    expect(num(f, 'Q1.heat')).toBeLessThan(0.45);
  });

  it('trips the old 25 A breaker after about two and a half minutes of a winter bath', () => {
    const sim = bench({ 'Q1.rating': 25, 'S1.closed': true, 'S2.actuated': true });
    let t = 0;
    while (sim.t < 600) {
      sim.step();
      if (sim.frame({ samples: false }).readouts['Q1.tripped'] === true) {
        t = sim.t;
        break;
      }
    }
    expect(t).toBeGreaterThan(135);
    expect(t).toBeLessThan(155);
    const f = run(sim, 1);
    expect(num(f, 'REDE.power')).toBeLessThan(0.01);
  });

  it('never trips the 25 A breaker in summer (17 A)', () => {
    const f = run(bench({ 'Q1.rating': 25, 'S1.closed': true }), 1200);
    expect(f.readouts['Q1.tripped']).toBe(false);
  });

  it('only heats in winter with the second stretch broken', () => {
    const summer = run(bench({ 'R2.resistance': BROKEN_OHMS, 'S1.closed': true }), 1);
    expect(num(summer, 'REDE.power')).toBeLessThan(1);
    const winter = run(
      bench({ 'R2.resistance': BROKEN_OHMS, 'S1.closed': true, 'S2.actuated': true }),
      1,
    );
    expect(num(winter, 'REDE.power')).toBeGreaterThan(7450);
  });

  it('burns the stretch left in air within a few seconds', () => {
    const sim = bench({ 'R1.watts': IN_AIR_W, 'S1.closed': true, 'S2.actuated': true });
    let t = 0;
    while (sim.t < 20) {
      sim.step();
      if (sim.frame({ samples: false }).readouts['R1.burned'] === true) {
        t = sim.t;
        break;
      }
    }
    expect(t).toBeGreaterThan(0.5);
    expect(t).toBeLessThan(5);
    // Broken in the first stretch: no position heats any more.
    sim.setParam('S2', 'actuated', false);
    expect(num(run(sim, 1), 'REDE.power')).toBeLessThan(1);
  });

  it('meets no goal as the circuit starts, nor with the wire intact', () => {
    const start = run(bench(), 1);
    const intact = [
      run(bench({ 'S1.closed': true }), 1),
      run(bench({ 'S1.closed': true, 'S2.actuated': true }), 1),
      run(bench({ 'R2.resistance': BROKEN_OHMS }), 1),
    ];
    for (const goal of (chuveiro.goals ?? []) as GoalDoc[]) {
      expect(checkGoal(goal, start), goal.id).toBe(false);
    }
    const soInverno = (chuveiro.goals as GoalDoc[]).find((g) => g.id === 'so-inverno')!;
    for (const f of intact) expect(checkGoal(soInverno, f)).toBe(false);
  });

  for (const goal of (chuveiro.goals ?? []) as GoalDoc[]) {
    it(`meets goal "${goal.id}" with its solution`, () => {
      const f = run(bench(goal.solution), goal.at ?? 1);
      expect(
        checkGoal(goal, f),
        `${goal.check.readout} = ${String(f.readouts[goal.check.readout])}`,
      ).toBe(true);
    });
  }
});
