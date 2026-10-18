import { describe, expect, it } from 'vitest';
import type { CircuitDoc, SimEvent, SimFrame } from '../contract';
import { Simulator } from '../analysis/simulator';
import { netlist, runFor } from './utils';

const r = (frame: SimFrame, key: string) => frame.readouts[key] as number;

/** Runs for `seconds`, collecting every event. */
function run(doc: CircuitDoc, seconds: number): { sim: Simulator; events: SimEvent[] } {
  const sim = new Simulator(doc);
  sim.refresh();
  const events: SimEvent[] = [...sim.frame().events];
  const steps = Math.round(seconds / sim.dt);
  for (let i = 0; i < steps; i++) {
    sim.step();
    if (i % 50 === 0) events.push(...sim.frame({ samples: false }).events);
  }
  events.push(...sim.frame({ samples: false }).events);
  return { sim, events };
}

describe('diode', () => {
  const forward = (model: string, current: number) =>
    netlist('diodo', [
      { id: 'I1', type: 'dc-current', nodes: ['1', '0'], params: { current } },
      { id: 'D1', type: 'diode', nodes: ['1', '0'], params: { model } },
    ]);

  it('has the forward drop of each model', () => {
    expect(r(runFor(forward('signal', 0.01)).frame, 'v1')).toBeCloseTo(0.694, 2);
    expect(r(runFor(forward('rectifier', 1)).frame, 'v1')).toBeCloseTo(0.91, 2);
    expect(r(runFor(forward('schottky', 1)).frame, 'v1')).toBeCloseTo(0.42, 2);
  });

  it('blocks in reverse', () => {
    const doc = netlist('diodo-reverso', [
      { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 50 } },
      { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 1000 } },
      { id: 'D1', type: 'diode', nodes: ['0', '2'] },
    ]);
    const { frame } = runFor(doc);
    expect(Math.abs(r(frame, 'D1.current'))).toBeLessThan(1e-6);
    expect(r(frame, 'v2')).toBeCloseTo(50, 3);
  });

  it('overheats and fails short with too much current', () => {
    const { sim, events } = run(forward('signal', 2), 5);
    const damaged = events.filter((e) => e.kind === 'damaged');
    expect(events.some((e) => e.kind === 'warning' && e.element === 'D1')).toBe(true);
    expect(damaged).toHaveLength(1);
    expect(damaged[0].message).toMatch(/^O diodo D1 queimou e entrou em curto: dissipava .* W/);
    expect(sim.frame().readouts['D1.burned']).toBe(true);
    // Shorted: the current source sees R_FAILED_SHORT plus the series resistance.
    expect(r(sim.frame(), 'v1')).toBeCloseTo(2 * (0.5 + 0.568), 1);
  });

  it('half-wave rectifier charges the filter capacitor to the peak minus the drop', () => {
    const doc = netlist(
      'retificador',
      [
        {
          id: 'V1',
          type: 'ac-voltage',
          nodes: ['1', '0'],
          params: { amplitude: 17, frequency: 60 },
        },
        { id: 'D1', type: 'diode', nodes: ['1', '2'] },
        { id: 'C1', type: 'capacitor', nodes: ['2', '0'], params: { capacitance: 1e-3 } },
        { id: 'R1', type: 'resistor', nodes: ['2', '0'], params: { resistance: 10e3 } },
      ],
      { kind: 'transient', dt: 2e-5 },
    );
    const { sim } = run(doc, 0.1);
    expect(r(sim.frame(), 'v2')).toBeGreaterThan(16);
    expect(r(sim.frame(), 'v2')).toBeLessThan(16.5);
  });
});

describe('LED', () => {
  const withResistor = (resistance: number, color = 'red', voltage = 5) =>
    netlist(
      'led',
      [
        { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage } },
        { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance } },
        { id: 'D1', type: 'led', nodes: ['2', '0'], params: { color } },
      ],
      { kind: 'transient', dt: 1e-4 },
    );

  it('has the forward voltage of its color at 20 mA', () => {
    const vf = { red: 2.0, green: 2.2, blue: 3.1, infrared: 1.2 };
    for (const [color, v] of Object.entries(vf)) {
      const doc = netlist('led-cor', [
        { id: 'I1', type: 'dc-current', nodes: ['1', '0'], params: { current: 0.02 } },
        { id: 'D1', type: 'led', nodes: ['1', '0'], params: { color } },
      ]);
      const { frame } = runFor(doc);
      expect(r(frame, 'v1'), color).toBeCloseTo(v, 3);
      expect(r(frame, 'D1.brightness')).toBeCloseTo(1, 3);
    }
  });

  it('lights with a series resistor and stays healthy', () => {
    const { sim, events } = run(withResistor(330), 2);
    const frame = sim.frame();
    expect(r(frame, 'D1.current')).toBeGreaterThan(8e-3);
    expect(r(frame, 'D1.current')).toBeLessThan(10e-3);
    expect(r(frame, 'D1.brightness')).toBeGreaterThan(0.4);
    expect(events).toHaveLength(0);
  });

  it('burns at once without a resistor', () => {
    const { sim, events } = run(withResistor(0.01), 0.05);
    const damaged = events.filter((e) => e.kind === 'damaged');
    expect(damaged).toHaveLength(1);
    expect(damaged[0].t).toBeLessThan(0.01);
    expect(damaged[0].message).toMatch(
      /^O LED D1 queimou: corrente de [\d,]+ m?A, máximo 30 mA\.$/,
    );
    const frame = sim.frame();
    expect(frame.readouts['D1.burned']).toBe(true);
    expect(r(frame, 'D1.brightness')).toBe(0);
    expect(Math.abs(r(frame, 'D1.current'))).toBeLessThan(1e-6);
  });

  it('warns above the maximum current before burning', () => {
    // About 40 mA: above the 30 mA maximum, below the burning level.
    const { sim, events } = run(withResistor(75), 1);
    expect(events.map((e) => e.kind)).toEqual(['warning']);
    expect(events[0].message).toMatch(/acima do máximo/);
    expect(sim.frame().readouts['D1.burned']).toBe(false);
  });

  it('does not light in reverse', () => {
    const doc = netlist('led-reverso', [
      { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 3 } },
      { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 220 } },
      { id: 'D1', type: 'led', nodes: ['0', '2'] },
    ]);
    expect(r(runFor(doc).frame, 'D1.brightness')).toBe(0);
  });
});

describe('zener', () => {
  const regulator = (vin: number, rs: number) =>
    netlist(
      'zener',
      [
        { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: vin } },
        { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: rs, watts: 100 } },
        { id: 'Z1', type: 'zener', nodes: ['0', '2'], params: { voltage: 5.1 } },
      ],
      { kind: 'transient', dt: 1e-3 },
    );

  it('holds its voltage over a range of inputs', () => {
    expect(r(runFor(regulator(9, 470)).frame, 'v2')).toBeCloseTo(5.1, 1);
    expect(r(runFor(regulator(15, 470)).frame, 'v2')).toBeCloseTo(5.15, 1);
  });

  it('burns short when it dissipates too much', () => {
    const { sim, events } = run(regulator(24, 20), 10);
    const damaged = events.find((e) => e.kind === 'damaged');
    expect(damaged?.message).toMatch(/^O zener Z1 queimou e entrou em curto/);
    // Shorted junction plus the 2 Ω series resistance of the model.
    expect(r(sim.frame(), 'v2')).toBeLessThan(3);
  });
});

describe('bipolar transistors', () => {
  const switchCircuit = (type: 'npn' | 'pnp', vin: number, rc = 100, vcc = 12) =>
    type === 'npn'
      ? netlist(
          'npn',
          [
            { id: 'VIN', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: vin } },
            { id: 'RB', type: 'resistor', nodes: ['1', '2'], params: { resistance: 1000 } },
            { id: 'VCC', type: 'dc-voltage', nodes: ['4', '0'], params: { voltage: vcc } },
            { id: 'RC', type: 'resistor', nodes: ['4', '3'], params: { resistance: rc, watts: 5 } },
            { id: 'Q1', type: 'npn', nodes: { b: '2', c: '3', e: '0' } },
          ],
          { kind: 'transient', dt: 1e-3 },
        )
      : netlist('pnp', [
          { id: 'VCC', type: 'dc-voltage', nodes: ['4', '0'], params: { voltage: vcc } },
          { id: 'VIN', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: vin } },
          { id: 'RB', type: 'resistor', nodes: ['1', '2'], params: { resistance: 1000 } },
          { id: 'Q1', type: 'pnp', nodes: { b: '2', c: '3', e: '4' } },
          { id: 'RC', type: 'resistor', nodes: ['3', '0'], params: { resistance: rc, watts: 5 } },
        ]);

  it('NPN switch: cut off at 0 V, saturated with base current', () => {
    const off = runFor(switchCircuit('npn', 0)).frame;
    expect(off.readouts['Q1.region']).toBe('corte');
    expect(r(off, 'Q1.ic')).toBeLessThan(1e-9);
    const on = runFor(switchCircuit('npn', 5)).frame;
    expect(on.readouts['Q1.region']).toBe('saturação');
    expect(r(on, 'Q1.vce')).toBeLessThan(0.2);
    expect(r(on, 'Q1.ic')).toBeCloseTo(0.118, 2);
    expect(r(on, 'Q1.pin.c') + r(on, 'Q1.pin.b') + r(on, 'Q1.pin.e')).toBeCloseTo(0, 12);
  });

  it('NPN in the active region amplifies the base current by β', () => {
    const frame = runFor(switchCircuit('npn', 0.75, 100, 12)).frame;
    expect(frame.readouts['Q1.region']).toBe('ativa');
    const beta = r(frame, 'Q1.ic') / r(frame, 'Q1.ib');
    // β = 200 with the Early effect (VAF = 100 V) at Vce ≈ 12 V.
    expect(beta).toBeGreaterThan(200);
    expect(beta).toBeLessThan(230);
  });

  it('PNP switch turns on when the base is pulled low', () => {
    const off = runFor(switchCircuit('pnp', 12)).frame;
    expect(off.readouts['Q1.region']).toBe('corte');
    const on = runFor(switchCircuit('pnp', 0)).frame;
    expect(on.readouts['Q1.region']).toBe('saturação');
    expect(r(on, 'Q1.ic')).toBeGreaterThan(0.11);
    // Current enters the PNP at the emitter and leaves at the collector.
    expect(r(on, 'Q1.pin.e')).toBeGreaterThan(0.11);
    expect(r(on, 'Q1.pin.c')).toBeLessThan(-0.11);
  });

  it('burns with the collector shorted to the emitter when overloaded', () => {
    const { sim, events } = run(switchCircuit('npn', 5, 1), 10);
    const damaged = events.filter((e) => e.kind === 'damaged' && e.element === 'Q1');
    expect(damaged).toHaveLength(1);
    expect(damaged[0].message).toMatch(/entrou em curto entre coletor e emissor/);
    const frame = sim.frame();
    expect(frame.readouts['Q1.burned']).toBe(true);
    // Even with the base at 0 V the load stays on.
    sim.setParam('VIN', 'voltage', 0);
    sim.refresh();
    expect(r(sim.frame(), 'Q1.vce')).toBeLessThan(5);
  });

  it('a coil switched off without a diode drives it into avalanche', () => {
    const doc = netlist(
      'avalanche',
      [
        { id: 'VIN', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 5 } },
        { id: 'RB', type: 'resistor', nodes: ['1', '2'], params: { resistance: 1000 } },
        { id: 'VCC', type: 'dc-voltage', nodes: ['4', '0'], params: { voltage: 12 } },
        {
          id: 'L1',
          type: 'inductor',
          nodes: ['4', '3'],
          params: { inductance: 0.1, resistance: 200 },
        },
        { id: 'Q1', type: 'npn', nodes: { b: '2', c: '3', e: '0' } },
      ],
      { kind: 'transient', dt: 1e-6 },
    );
    const sim = new Simulator(doc);
    sim.refresh();
    for (let i = 0; i < 5000; i++) sim.step();
    sim.setParam('VIN', 'voltage', 0);
    let peak = 0;
    const events: SimEvent[] = [];
    for (let i = 0; i < 2000; i++) {
      sim.step();
      const frame = sim.frame({ samples: false });
      peak = Math.max(peak, r(frame, 'v3'));
      events.push(...frame.events);
    }
    // Clamped at Vceo = 40 V instead of the hundreds of volts of an open coil.
    expect(peak).toBeGreaterThan(38);
    expect(peak).toBeLessThan(45);
    expect(events.find((e) => e.kind === 'warning')?.message).toMatch(/avalanche/);
  });
});

describe('MOSFETs', () => {
  const lowSide = (vg: number, rd = 1) =>
    netlist(
      'nmos',
      [
        { id: 'VG', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: vg } },
        { id: 'VDD', type: 'dc-voltage', nodes: ['3', '0'], params: { voltage: 12 } },
        { id: 'RD', type: 'resistor', nodes: ['3', '2'], params: { resistance: rd, watts: 200 } },
        { id: 'M1', type: 'nmos', nodes: { g: '1', d: '2', s: '0' } },
      ],
      { kind: 'transient', dt: 1e-3 },
    );

  it('N channel: off below the threshold, a small resistance when driven', () => {
    const off = runFor(lowSide(2)).frame;
    expect(off.readouts['M1.region']).toBe('corte');
    expect(r(off, 'M1.id')).toBeLessThan(1e-9);
    const on = runFor(lowSide(10)).frame;
    expect(on.readouts['M1.region']).toBe('triodo');
    // Rds(on) ≈ 1 / (kp·(Vgs − Vth)) = 1 / (5 · 7,5) ≈ 27 mΩ.
    expect(r(on, 'M1.vds') / r(on, 'M1.id')).toBeCloseTo(1 / 37.5, 3);
    expect(r(on, 'M1.pin.g')).toBe(0);
  });

  it('N channel in saturation follows kp/2·(Vgs − Vth)²', () => {
    const frame = runFor(lowSide(2.7, 50)).frame;
    expect(frame.readouts['M1.region']).toBe('saturação');
    expect(r(frame, 'M1.id')).toBeCloseTo(0.1 * (1 + 0.01 * r(frame, 'M1.vds')), 6);
  });

  it('the body diode conducts from source to drain', () => {
    const doc = netlist('diodo-corpo', [
      { id: 'I1', type: 'dc-current', nodes: ['1', '0'], params: { current: 1 } },
      { id: 'M1', type: 'nmos', nodes: { g: '0', d: '0', s: '1' } },
    ]);
    const v = r(runFor(doc).frame, 'v1');
    expect(v).toBeGreaterThan(0.6);
    expect(v).toBeLessThan(0.8);
  });

  it('P channel high-side switch turns on with the gate low', () => {
    const doc = (vg: number) =>
      netlist('pmos', [
        { id: 'VDD', type: 'dc-voltage', nodes: ['3', '0'], params: { voltage: 12 } },
        { id: 'VG', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: vg } },
        { id: 'M1', type: 'pmos', nodes: { g: '1', d: '2', s: '3' } },
        { id: 'RL', type: 'resistor', nodes: ['2', '0'], params: { resistance: 10, watts: 50 } },
      ]);
    expect(r(runFor(doc(12)).frame, 'v2')).toBeLessThan(1e-6);
    const on = runFor(doc(0)).frame;
    expect(r(on, 'v2')).toBeGreaterThan(11.9);
    expect(r(on, 'M1.id')).toBeGreaterThan(1.19);
  });

  it('the gate breaks above 20 V and the drain shorts to the source', () => {
    const { sim, events } = run(lowSide(24, 100), 0.01);
    const damaged = events.filter((e) => e.kind === 'damaged');
    expect(damaged).toHaveLength(1);
    expect(damaged[0].message).toMatch(/tensão gate-source de 24 V, máximo 20 V/);
    sim.setParam('VG', 'voltage', 0);
    sim.step();
    expect(r(sim.frame(), 'v2')).toBeLessThan(0.1);
  });

  it('overheats without a heatsink', () => {
    // 6 V across the channel at about 3 A: 18 W on a 2 W part.
    const { events } = run(lowSide(3.6, 2), 5);
    expect(events.some((e) => e.kind === 'damaged' && /MOSFET M1 queimou/.test(e.message))).toBe(
      true,
    );
  });
});
