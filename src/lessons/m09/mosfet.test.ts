import { describe, expect, it } from 'vitest';
import { Simulator } from '../../engine/analysis/simulator';
import type { CircuitDoc, ParamValue, SimEvent } from '../../engine/contract';
import firmware, { PWM_FREQUENCY } from './firmware/pwm';
import gate from './mosfet-gate.circuit';
import pwm from './pwm-fita.circuit';

/**
 * Runs a lesson circuit with some parameters changed until `until` seconds.
 * Returns the last readouts, the events, and the samples of `track` from
 * `from` on (for averages and waveforms).
 */
function simulate(
  doc: CircuitDoc,
  set: Record<string, ParamValue>,
  until: number,
  { track = [] as string[], from = 0 } = {},
) {
  const sim = new Simulator(doc);
  for (const [key, value] of Object.entries(set)) {
    const [el, param] = key.split('.') as [string, string];
    sim.setParam(el, param, value);
  }
  sim.refresh();
  const events: SimEvent[] = [];
  const samples: Record<string, number[]> = Object.fromEntries(track.map((k) => [k, []]));
  const times: number[] = [];
  while (sim.t < until - sim.dt * 1e-6) {
    sim.step();
    const frame = sim.frame({ samples: false });
    events.push(...frame.events);
    if (track.length && sim.t >= from) {
      times.push(sim.t);
      for (const k of track) samples[k]!.push(frame.readouts[k] as number);
    }
  }
  return { readouts: sim.frame().readouts, events, samples, times };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('lesson 9.8: gate voltage on a standard and a logic-level MOSFET', () => {
  it('with 3,3 V only the logic-level MOSFET conducts, and it barely warms', () => {
    const { readouts: r } = simulate(gate, { 'V2.voltage': 3.3 }, 1);
    expect(r['Q1.id']).toBeLessThan(1e-3);
    expect(r['Q1.vds']).toBeCloseTo(12, 0);
    expect(r['L2.brightness']).toBeGreaterThan(0.9);
    expect(r['Q2.power']).toBeGreaterThan(0.13);
    expect(r['Q2.power']).toBeLessThan(0.17);
  });

  it('with 5 V the standard MOSFET conducts only in part, overheats and burns shorted', () => {
    const half = simulate(gate, { 'V2.voltage': 5 }, 0.5);
    const r = half.readouts;
    expect(r['Q1.id']).toBeGreaterThan(0.68);
    expect(r['Q1.id']).toBeLessThan(0.76);
    expect(r['Q1.vds']).toBeGreaterThan(11.4);
    expect(r['Q1.vds']).toBeLessThan(11.8);
    expect(r['Q1.power']).toBeGreaterThan(7.8);
    expect(r['Q1.power']).toBeLessThan(8.8);
    expect(r['Q2.power']).toBeGreaterThan(0.06);
    expect(r['Q2.power']).toBeLessThan(0.1);
    // "Em menos de um décimo de segundo aparece o aviso"
    const warning = half.events.find((e) => e.kind === 'warning' && e.element === 'Q1');
    expect(warning?.t).toBeLessThan(0.1);

    // "em uns 2 segundos, o Q1 queima", and then L1 stays on
    const later = simulate(gate, { 'V2.voltage': 5 }, 3);
    const burn = later.events.find((e) => e.kind === 'damaged' && e.element === 'Q1');
    expect(burn?.t).toBeGreaterThan(1.5);
    expect(burn?.t).toBeLessThan(2.6);
    expect(later.readouts['Q1.burned']).toBe(true);
    expect(later.readouts['L1.current']).toBeGreaterThan(1.5);
  });

  it('with 10 V the standard MOSFET conducts fully and settles near 76 °C', () => {
    const { readouts: r } = simulate(gate, { 'V2.voltage': 10 }, 1);
    expect(r['Q1.id']).toBeCloseTo(1.71, 1);
    expect(r['Q1.vds']).toBeGreaterThan(0.45);
    expect(r['Q1.vds']).toBeLessThan(0.51);
    expect(r['Q1.power']).toBeGreaterThan(0.78);
    expect(r['Q1.power']).toBeLessThan(0.86);
    const steady = simulate(gate, { 'V2.voltage': 10 }, 40).readouts;
    expect(steady['Q1.temperature']).toBeGreaterThan(73);
    expect(steady['Q1.temperature']).toBeLessThan(79);
    expect(steady['Q1.burned']).toBe(false);
  });

  it('nothing conducts with the gate at 0 V, and no goal starts met', () => {
    const { readouts: r } = simulate(gate, {}, 1);
    expect(r['L1.current']).toBeLessThan(1e-3);
    expect(r['L2.current']).toBeLessThan(1e-3);
    expect(r['Q1.power']).toBeLessThan(1e-3);
    expect(r['Q1.region']).toBe('corte');
  });
});

describe('lesson 9.8: LED strip dimmed with PWM', () => {
  const track = ['R1.current', 'Q1.vgs'];

  it('switches at 500 Hz: a 2 ms period, on for 1 ms at 50 %', () => {
    expect(PWM_FREQUENCY).toBe(500);
    const { samples, times } = simulate(pwm, { 'P1.position': 0.5 }, 0.02, { track, from: 0.005 });
    const gateV = samples['Q1.vgs']!;
    const rises: number[] = [];
    const falls: number[] = [];
    for (let i = 1; i < gateV.length; i++) {
      if (gateV[i - 1]! < 2.5 && gateV[i]! >= 2.5) rises.push(times[i]!);
      if (gateV[i - 1]! >= 2.5 && gateV[i]! < 2.5) falls.push(times[i]!);
    }
    expect(rises.length).toBeGreaterThan(3);
    const period = rises[2]! - rises[1]!;
    expect(period).toBeCloseTo(0.002, 4);
    const fall = falls.find((t) => t > rises[1]!)!;
    expect(fall - rises[1]!).toBeCloseTo(0.001, 4);
    // "O gate sobe a cerca de 4,9 V"
    expect(Math.max(...gateV)).toBeGreaterThan(4.8);
    expect(Math.max(...gateV)).toBeLessThan(4.95);
  });

  it('the average segment current follows the duty cycle', () => {
    const at = (position: number) =>
      simulate(pwm, { 'P1.position': position }, 0.05, { track, from: 0.01 });
    const half = at(0.5);
    // on: 18,4 mA; average 9,2 mA at 50 %
    expect(Math.max(...half.samples['R1.current']!)).toBeGreaterThan(0.0182);
    expect(Math.max(...half.samples['R1.current']!)).toBeLessThan(0.0187);
    expect(mean(half.samples['R1.current']!)).toBeGreaterThan(0.009);
    expect(mean(half.samples['R1.current']!)).toBeLessThan(0.0094);
    expect(half.readouts['U1.ciclo']).toBeCloseTo(0.5, 2);
    // 4,6 mA at 25 %
    const quarter = at(0.25);
    expect(mean(quarter.samples['R1.current']!)).toBeGreaterThan(0.0045);
    expect(mean(quarter.samples['R1.current']!)).toBeLessThan(0.0047);
    expect(quarter.readouts['U1.ciclo']).toBeCloseTo(0.25, 2);
    // Off at 0 %
    expect(Math.max(...at(0).samples['R1.current']!)).toBeLessThan(1e-6);
  });

  it('the pin stays high exactly as many steps as the duty cycle shows', () => {
    // 7, 14, 28, 55 and 56 % are a hair above the whole number in floating point.
    for (const percent of [7, 14, 28, 55, 56]) {
      const pins = { A0: (percent / 100) * 5 };
      let state = firmware.init();
      let high = 0;
      let shown = 0;
      for (let i = 0; i < 200; i++) {
        const out = firmware.step(state, { t: 0, dt: 0, pins });
        state = out.state;
        if (i >= 100 && out.pins.D9) high++;
        shown = out.readouts!['ciclo'] as number;
      }
      expect(high).toBe(percent);
      expect(shown * 100).toBeCloseTo(percent, 9);
    }
  });

  it('fully on, the MOSFET dissipates only tens of microwatts', () => {
    const { readouts: r } = simulate(pwm, { 'P1.position': 1 }, 0.02);
    expect(r['U1.ciclo']).toBe(1);
    expect(r['R1.current']).toBeGreaterThan(0.0182);
    expect(r['R1.current']).toBeLessThan(0.0187);
    // "dissipa só uns 35 µW"
    expect(r['Q1.power']).toBeGreaterThan(30e-6);
    expect(r['Q1.power']).toBeLessThan(40e-6);
  });
});
