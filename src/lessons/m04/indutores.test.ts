import { describe, expect, it } from 'vitest';
import { Simulator } from '../../engine/analysis/simulator';
import pico from './pico-bobina.circuit';
import rl from './rl-carga.circuit';

/**
 * The RL circuit of lesson 4.5: the switch goes to the battery at t = 0 and,
 * when `fallAt` is given, back to the negative at that time.
 */
function rlRun(params: Record<string, number>, until: number, fallAt?: number) {
  const sim = new Simulator(rl);
  for (const [key, value] of Object.entries(params)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.setParam('S1', 'actuated', true);
  sim.refresh();
  let afterFall: Record<string, number | boolean | string> | undefined;
  while (sim.t < until - 1e-9) {
    if (fallAt !== undefined && afterFall === undefined && sim.t >= fallAt - 1e-9) {
      sim.setParam('S1', 'actuated', false);
      sim.step();
      afterFall = sim.frame({ samples: false }).readouts;
      continue;
    }
    sim.step();
  }
  return { end: sim.frame({ samples: false }).readouts, afterFall };
}

describe('4.5 RL circuit', () => {
  it('falls with the same τ: about 44 mA 10 ms after the battery leaves, starting at -12 V on the coil', () => {
    const r = rlRun({}, 0.11, 0.1);
    expect(r.afterFall?.['VL']).toBeLessThan(-11.3);
    expect(r.end['IL']).toBeGreaterThan(0.043);
    expect(r.end['IL']).toBeLessThan(0.045);
  });

  it('with a 2 H coil, takes 20 ms to reach about 76 mA', () => {
    const r = rlRun({ 'L1.inductance': 2 }, 0.02);
    expect(r.end['IL']).toBeGreaterThan(0.074);
    expect(r.end['IL']).toBeLessThan(0.078);
  });
});

/**
 * Values lesson 4.5 quotes from the interactive coil circuit: the button is
 * held for 3 ms and released, as a student would do it. Goals cannot change a
 * parameter halfway through a run, so the peak is measured here.
 */
function release(diode: boolean) {
  const sim = new Simulator(pico);
  sim.setParam('S2', 'closed', diode);
  sim.setParam('S1', 'pressed', true);
  sim.refresh();
  while (sim.t < 0.003) sim.step();
  const before = sim.frame({ samples: false }).readouts;
  sim.setParam('S1', 'pressed', false);
  let peak = 0;
  while (sim.t < 0.006) {
    sim.step();
    peak = Math.max(peak, sim.frame({ samples: false }).readouts['VS'] as number);
  }
  return { current: before['IL'] as number, peak };
}

describe('4.5 relay coil switched by a button', () => {
  it('carries 30 mA, and its contact jumps to about 350 V when released', () => {
    const r = release(false);
    expect(r.current).toBeCloseTo(0.03, 3);
    expect(r.peak).toBeGreaterThan(340);
    expect(r.peak).toBeLessThan(365);
  });

  it('with the freewheeling diode, the contact sees only about 12,7 V', () => {
    const r = release(true);
    expect(r.peak).toBeGreaterThan(12.4);
    expect(r.peak).toBeLessThan(12.9);
  });
});
