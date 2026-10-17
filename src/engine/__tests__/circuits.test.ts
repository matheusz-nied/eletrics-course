import { describe, expect, it } from 'vitest';
import type { CircuitDoc, SimFrame } from '../contract';
import { Simulator } from '../analysis/simulator';
import { netlist } from './utils';

/**
 * Real circuits of the course, run end to end: they exercise positive
 * feedback, switching, inductive loads and large capacitors together, which
 * is where Newton-Raphson has a hard time.
 */

const r = (frame: SimFrame, key: string) => frame.readouts[key] as number;

function run(doc: CircuitDoc, seconds: number, each?: (f: SimFrame) => void): Simulator {
  const sim = new Simulator(doc);
  sim.refresh();
  const steps = Math.round(seconds / sim.dt);
  for (let i = 0; i < steps; i++) {
    sim.step();
    if (each) each(sim.frame({ samples: false }));
  }
  return sim;
}

describe('course circuits', () => {
  it('astable multivibrator with two transistors blinks two LEDs in turn', () => {
    const doc = netlist(
      'pisca-pisca',
      [
        { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 9 } },
        { id: 'RC1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 470 } },
        { id: 'D1', type: 'led', nodes: ['2', '3'], params: { color: 'red' } },
        { id: 'RC2', type: 'resistor', nodes: ['1', '4'], params: { resistance: 470 } },
        { id: 'D2', type: 'led', nodes: ['4', '5'], params: { color: 'green' } },
        { id: 'RB1', type: 'resistor', nodes: ['1', '6'], params: { resistance: 47000 } },
        { id: 'RB2', type: 'resistor', nodes: ['1', '7'], params: { resistance: 47000 } },
        { id: 'C1', type: 'capacitor', nodes: ['3', '7'], params: { capacitance: 1e-5 } },
        { id: 'C2', type: 'capacitor', nodes: ['5', '6'], params: { capacitance: 1e-5 } },
        { id: 'Q1', type: 'npn', nodes: { b: '6', c: '3', e: '0' } },
        { id: 'Q2', type: 'npn', nodes: { b: '7', c: '5', e: '0' } },
      ],
      { kind: 'transient', dt: 1e-4 },
    );
    let toggles = 0;
    let last: boolean | undefined;
    let both = 0;
    let samples = 0;
    run(doc, 4, (f) => {
      if (f.t < 0.5) return;
      const red = r(f, 'D1.brightness') > 0.3;
      const green = r(f, 'D2.brightness') > 0.3;
      if (red && green) both++;
      samples++;
      if (red !== last) toggles++;
      last = red;
    });
    // Half period 0,69·47 kΩ·10 µF ≈ 0,32 s: about 11 changes in 3,5 s.
    expect(toggles).toBeGreaterThan(8);
    expect(toggles).toBeLessThan(15);
    expect(both / samples).toBeLessThan(0.05);
  });

  it('transformer, bridge rectifier and filter capacitor give smooth DC', () => {
    const doc = netlist(
      'fonte',
      [
        {
          id: 'V1',
          type: 'ac-voltage',
          nodes: ['1', '0'],
          params: { amplitude: 127 * Math.SQRT2, frequency: 60 },
        },
        { id: 'T1', type: 'transformer', nodes: { p1: '1', p2: '0', s1: '2', s2: '3' } },
        { id: 'D1', type: 'diode', nodes: ['2', '4'] },
        { id: 'D2', type: 'diode', nodes: ['3', '4'] },
        { id: 'D3', type: 'diode', nodes: ['5', '2'] },
        { id: 'D4', type: 'diode', nodes: ['5', '3'] },
        {
          id: 'C1',
          type: 'capacitor',
          nodes: ['4', '5'],
          params: { capacitance: 2.2e-3, voltage: 25, polarized: true },
        },
        { id: 'RL', type: 'resistor', nodes: ['4', '5'], params: { resistance: 100, watts: 5 } },
        { id: 'RG', type: 'resistor', nodes: ['5', '0'], params: { resistance: 1e6 } },
      ],
      { kind: 'transient', dt: 5e-5 },
    );
    let min = Infinity;
    let max = -Infinity;
    const sim = run(doc, 0.5, (f) => {
      if (f.t < 0.4) return;
      const v = r(f, 'v4') - r(f, 'v5');
      min = Math.min(min, v);
      max = Math.max(max, v);
    });
    // ngspice, same models (and 100 MΩ from the floating secondary to ground):
    // 15,627 V peak and 0,459 V of ripple between 0,4 s and 0,5 s.
    expect(max).toBeCloseTo(15.627, 1);
    expect(max - min).toBeCloseTo(0.459, 1);
    expect(sim.frame().events.filter((e) => e.kind === 'damaged')).toHaveLength(0);
  });

  it('transistor drives a relay with a flyback diode; the contact lights a lamp', () => {
    const doc = netlist(
      'rele-transistor',
      [
        { id: 'VCC', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 12 } },
        { id: 'VIN', type: 'dc-voltage', nodes: ['2', '0'], params: { voltage: 0 } },
        { id: 'RB', type: 'resistor', nodes: ['2', '3'], params: { resistance: 4700 } },
        { id: 'Q1', type: 'npn', nodes: { b: '3', c: '4', e: '0' } },
        { id: 'D1', type: 'diode', nodes: ['4', '1'], params: { model: 'signal' } },
        {
          id: 'K1',
          type: 'relay-spdt',
          nodes: { coil1: '1', coil2: '4', com: '1', nc: '6', no: '5' },
        },
        { id: 'L1', type: 'lamp', nodes: ['5', '0'], params: { voltage: 12, power: 5 } },
      ],
      { kind: 'transient', dt: 1e-5 },
    );
    const sim = new Simulator(doc);
    sim.refresh();
    for (let i = 0; i < 1000; i++) sim.step();
    expect(r(sim.frame(), 'L1.brightness')).toBeLessThan(1e-6);
    sim.setParam('VIN', 'voltage', 5);
    for (let i = 0; i < 30000; i++) sim.step();
    expect(sim.frame().readouts['K1.closed']).toBe(true);
    expect(r(sim.frame(), 'L1.brightness')).toBeGreaterThan(0.9);
    sim.setParam('VIN', 'voltage', 0);
    let peak = 0;
    for (let i = 0; i < 5000; i++) {
      sim.step();
      peak = Math.max(peak, r(sim.frame({ samples: false }), 'v4'));
    }
    // The diode holds the collector about one drop above the supply: no spike.
    expect(peak).toBeLessThan(13.2);
    expect(sim.frame().readouts['K1.closed']).toBe(false);
    expect(sim.frame().events.filter((e) => e.kind !== 'info')).toHaveLength(0);
  });

  it('op-amp relaxation oscillator (Schmitt trigger and RC)', () => {
    // f = 1 / (2·R·C·ln(1 + 2·R2/R1)) with R2 = R1: 1 / (2·10 kΩ·100 nF·ln 3) ≈ 455 Hz.
    const doc = netlist(
      'oscilador',
      [
        { id: 'U1', type: 'opamp', nodes: { inp: '2', inn: '3', out: '1' } },
        { id: 'R1', type: 'resistor', nodes: ['2', '0'], params: { resistance: 10000 } },
        { id: 'R2', type: 'resistor', nodes: ['1', '2'], params: { resistance: 10000 } },
        { id: 'R', type: 'resistor', nodes: ['1', '3'], params: { resistance: 10000 } },
        { id: 'C', type: 'capacitor', nodes: ['3', '0'], params: { capacitance: 1e-7 } },
      ],
      { kind: 'transient', dt: 2e-6 },
    );
    const rises: number[] = [];
    let last = 0;
    run(doc, 0.03, (f) => {
      const v = r(f, 'v1');
      if (v > 0 && last <= 0 && f.t > 0.005) rises.push(f.t);
      last = v;
    });
    const f = (rises.length - 1) / (rises.at(-1)! - rises[0]);
    expect(f).toBeGreaterThan(455 * 0.95);
    expect(f).toBeLessThan(455 * 1.05);
  });

  it('H-bridge of MOSFETs runs a DC motor both ways', () => {
    const bridge = (forward: boolean) =>
      netlist(
        'ponte-h',
        [
          { id: 'VCC', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 12 } },
          // Left leg: P on top, N below; right leg the same.
          {
            id: 'GL',
            type: 'dc-voltage',
            nodes: ['5', '0'],
            params: { voltage: forward ? 0 : 12 },
          },
          {
            id: 'GR',
            type: 'dc-voltage',
            nodes: ['6', '0'],
            params: { voltage: forward ? 12 : 0 },
          },
          { id: 'Q1', type: 'pmos', nodes: { g: '5', s: '1', d: '2' } },
          { id: 'Q2', type: 'nmos', nodes: { g: '5', d: '2', s: '0' } },
          { id: 'Q3', type: 'pmos', nodes: { g: '6', s: '1', d: '3' } },
          { id: 'Q4', type: 'nmos', nodes: { g: '6', d: '3', s: '0' } },
          { id: 'M1', type: 'dc-motor', nodes: ['2', '3'] },
        ],
        { kind: 'transient', dt: 1e-4 },
      );
    const fwd = run(bridge(true), 1).frame();
    const rev = run(bridge(false), 1).frame();
    expect(r(fwd, 'M1.rpm')).toBeGreaterThan(5000);
    expect(r(rev, 'M1.rpm')).toBeCloseTo(-r(fwd, 'M1.rpm'), 0);
  });

  it('series regulator: zener reference and an emitter follower', () => {
    const doc = netlist('regulador', [
      { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 15 } },
      { id: 'RZ', type: 'resistor', nodes: ['1', '2'], params: { resistance: 1000 } },
      { id: 'Z1', type: 'zener', nodes: ['0', '2'], params: { voltage: 5.6 } },
      { id: 'Q1', type: 'npn', nodes: { b: '2', c: '1', e: '3' }, params: { power: 5 } },
      { id: 'RL', type: 'resistor', nodes: ['3', '0'], params: { resistance: 50, watts: 5 } },
    ]);
    const sim = new Simulator(doc);
    sim.refresh();
    const v = r(sim.frame(), 'v3');
    expect(v).toBeGreaterThan(4.8);
    expect(v).toBeLessThan(5.1);
    sim.setParam('V1', 'voltage', 20);
    sim.refresh();
    expect(Math.abs(r(sim.frame(), 'v3') - v)).toBeLessThan(0.05);
  });

  it('555 blinks an LED', () => {
    const doc = netlist(
      'pisca-555',
      [
        { id: 'VCC', type: 'dc-voltage', nodes: ['8', '0'], params: { voltage: 9 } },
        { id: 'R1', type: 'resistor', nodes: ['8', '7'], params: { resistance: 10000 } },
        { id: 'R2', type: 'resistor', nodes: ['7', '6'], params: { resistance: 68000 } },
        { id: 'C1', type: 'capacitor', nodes: ['6', '0'], params: { capacitance: 1e-5 } },
        {
          id: 'U1',
          type: 'timer-555',
          nodes: {
            gnd: '0',
            trig: '6',
            out: '3',
            reset: '8',
            ctrl: '5',
            thres: '6',
            dis: '7',
            vcc: '8',
          },
        },
        { id: 'R3', type: 'resistor', nodes: ['3', '4'], params: { resistance: 330 } },
        { id: 'D1', type: 'led', nodes: ['4', '0'] },
      ],
      { kind: 'transient', dt: 1e-4 },
    );
    let on = 0;
    let off = 0;
    run(doc, 5, (f) => {
      if (f.t < 1.5) return;
      if (r(f, 'D1.brightness') > 0.5) on++;
      else off++;
    });
    // 1,44 / ((10 k + 136 k)·10 µF) ≈ 1 Hz, on 54 % of the time.
    expect(on / (on + off)).toBeGreaterThan(0.45);
    expect(on / (on + off)).toBeLessThan(0.62);
  });
});
