import { describe, expect, it } from 'vitest';
import type { CircuitDoc, SimEvent, SimFrame } from '../contract';
import { Simulator } from '../analysis/simulator';
import { netlist, runFor, type NetPart } from './utils';

const r = (frame: SimFrame, key: string) => frame.readouts[key] as number;

/** A simulator that collects every event as it steps. */
class Bench {
  readonly sim: Simulator;
  readonly events: SimEvent[] = [];
  constructor(doc: CircuitDoc) {
    this.sim = new Simulator(doc);
    this.sim.refresh();
    this.events.push(...this.sim.frame({ samples: false }).events);
  }
  run(seconds: number, each?: (frame: SimFrame) => void): SimFrame {
    const steps = Math.round(seconds / this.sim.dt);
    for (let i = 0; i < steps; i++) {
      this.sim.step();
      if (each || i % 20 === 0 || i === steps - 1) {
        const frame = this.sim.frame({ samples: false });
        this.events.push(...frame.events);
        each?.(frame);
      }
    }
    return this.sim.frame({ samples: false });
  }
  set(element: string, param: string, value: number | boolean | string): void {
    this.sim.setParam(element, param, value);
  }
  get frame(): SimFrame {
    return this.sim.frame({ samples: false });
  }
}

const tran = (dt: number): CircuitDoc['analysis'] => ({ kind: 'transient', dt });

describe('relay-spdt', () => {
  const relay = (diode: boolean): NetPart[] => [
    { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 12 } },
    { id: 'S1', type: 'switch', nodes: ['1', '2'], params: { closed: false } },
    { id: 'K1', type: 'relay-spdt', nodes: { coil1: '2', coil2: '0', com: '1', nc: '3', no: '4' } },
    { id: 'RNC', type: 'resistor', nodes: ['3', '0'], params: { resistance: 100, watts: 5 } },
    { id: 'RNO', type: 'resistor', nodes: ['4', '0'], params: { resistance: 100, watts: 5 } },
    ...(diode ? [{ id: 'D1', type: 'diode', nodes: ['0', '2'] as [string, string] }] : []),
  ];

  it('pulls in a few milliseconds after the coil is energized and drops out on release', () => {
    const bench = new Bench(netlist('rele', relay(true), tran(1e-5)));
    expect(bench.frame.readouts['K1.closed']).toBe(false);
    expect(r(bench.frame, 'RNC.current')).toBeCloseTo(0.12, 3);
    bench.set('S1', 'closed', true);
    let closedAt = -1;
    bench.run(0.05, (f) => {
      if (closedAt < 0 && f.readouts['K1.closed'] === true) closedAt = f.t;
    });
    // Coil L/R = 0,375 ms to reach 75 % of the current, then 4 ms of travel.
    expect(closedAt).toBeGreaterThan(0.004);
    expect(closedAt).toBeLessThan(0.008);
    expect(r(bench.frame, 'RNO.current')).toBeCloseTo(0.12, 3);
    expect(r(bench.frame, 'RNC.current')).toBeLessThan(1e-6);
    expect(r(bench.frame, 'K1.coilCurrent')).toBeCloseTo(0.03, 3);
    bench.set('S1', 'closed', false);
    bench.run(0.05);
    expect(bench.frame.readouts['K1.closed']).toBe(false);
    expect(r(bench.frame, 'RNC.current')).toBeCloseTo(0.12, 3);
  });

  it('breaks before it makes: both contacts open while the armature travels', () => {
    const bench = new Bench(netlist('rele-curso', relay(true), tran(1e-5)));
    bench.set('S1', 'closed', true);
    let bothOpen = 0;
    bench.run(0.02, (f) => {
      if (r(f, 'RNC.current') < 1e-6 && r(f, 'RNO.current') < 1e-6) bothOpen += 1e-5;
    });
    expect(bothOpen).toBeGreaterThan(0.003);
    expect(bothOpen).toBeLessThan(0.005);
  });

  it('kicks back hundreds of volts when switched off without a diode', () => {
    const peak = (diode: boolean) => {
      const bench = new Bench(netlist('rele-pico', relay(diode), tran(1e-6)));
      bench.set('S1', 'closed', true);
      bench.run(0.01);
      bench.set('S1', 'closed', false);
      let min = 0;
      bench.run(0.002, (f) => (min = Math.min(min, r(f, 'K1.coilVoltage'))));
      return min;
    };
    expect(peak(false)).toBeLessThan(-300);
    expect(peak(true)).toBeGreaterThan(-1.5);
  });

  it('welds its contact with too much current', () => {
    const bench = new Bench(
      netlist(
        'rele-solda',
        [
          { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 12 } },
          { id: 'S1', type: 'switch', nodes: ['1', '2'], params: { closed: true } },
          {
            id: 'K1',
            type: 'relay-spdt',
            nodes: { coil1: '2', coil2: '0', com: '1', nc: '3', no: '4' },
          },
          {
            id: 'R1',
            type: 'resistor',
            nodes: ['4', '0'],
            params: { resistance: 0.2, watts: 1000 },
          },
        ],
        tran(1e-4),
      ),
    );
    bench.run(2);
    expect(bench.events.find((e) => e.kind === 'damaged')?.message).toMatch(/colou \(soldou\)/);
    bench.set('S1', 'closed', false);
    bench.run(0.1);
    expect(bench.frame.readouts['K1.welded']).toBe(true);
    expect(bench.frame.readouts['K1.closed']).toBe(true);
  });
});

describe('transformer', () => {
  const circuit = (source: NetPart, load = 100) =>
    netlist(
      'trafo',
      [
        source,
        { id: 'T1', type: 'transformer', nodes: { p1: '1', p2: '0', s1: '2', s2: '0' } },
        { id: 'RL', type: 'resistor', nodes: ['2', '0'], params: { resistance: load, watts: 50 } },
      ],
      tran(2e-5),
    );

  it('steps 127 V down by the turns ratio', () => {
    const bench = new Bench(
      circuit({
        id: 'V1',
        type: 'ac-voltage',
        nodes: ['1', '0'],
        params: { amplitude: 127 * Math.SQRT2, frequency: 60 },
      }),
    );
    let peak = 0;
    bench.run(0.2);
    bench.run(1 / 60, (f) => (peak = Math.max(peak, r(f, 'v2'))));
    // 12,7 V eficaz minus the winding drops at 127 mA.
    expect(peak / Math.SQRT2).toBeGreaterThan(12.2);
    expect(peak / Math.SQRT2).toBeLessThan(12.7);
    expect(bench.events).toHaveLength(0);
  });

  it('burns when connected to DC', () => {
    const bench = new Bench(
      circuit({ id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 127 } }),
    );
    bench.run(5);
    const damaged = bench.events.find((e) => e.kind === 'damaged');
    expect(damaged?.message).toMatch(/^O transformador T1 queimou e o enrolamento abriu/);
    expect(bench.frame.readouts['T1.burned']).toBe(true);
    // DC does not pass to the secondary.
    expect(Math.abs(r(bench.frame, 'v2'))).toBeLessThan(1e-3);
  });
});

describe('dc-motor', () => {
  const motor = (voltage: number, params: Record<string, number> = {}) =>
    netlist(
      'motor',
      [
        { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage } },
        { id: 'M1', type: 'dc-motor', nodes: ['1', '0'], params },
      ],
      tran(1e-4),
    );

  it('runs up to V/Ke without load and reverses with the polarity', () => {
    const forward = new Bench(motor(12)).run(1);
    // ω = V/(Ke + R·b/Kt) with friction: 12 / (0.02 + 2·1e-5/0.02) ≈ 571 rad/s.
    expect(r(forward, 'M1.speed')).toBeCloseTo(12 / (0.02 + (2 * 1e-5) / 0.02), 0);
    expect(r(forward, 'M1.rpm')).toBeGreaterThan(5000);
    const reverse = new Bench(motor(-12)).run(1);
    expect(r(reverse, 'M1.speed')).toBeCloseTo(-r(forward, 'M1.speed'), 3);
  });

  it('takes the stall current at start and slows down under load', () => {
    const bench = new Bench(motor(12));
    let peak = 0;
    bench.run(0.05, (f) => (peak = Math.max(peak, r(f, 'M1.current'))));
    expect(peak).toBeGreaterThan(5);
    expect(peak).toBeLessThan(6);
    const loaded = new Bench(motor(12, { load: 0.05 })).run(1);
    // Kt·i = load at steady state: i = 2,5 A, ω = (12 − 2·2,5)/Ke − friction.
    expect(r(loaded, 'M1.current')).toBeCloseTo(2.5 + (1e-5 * r(loaded, 'M1.speed')) / 0.02, 2);
    expect(r(loaded, 'M1.torque')).toBeCloseTo(0.05 + 1e-5 * r(loaded, 'M1.speed'), 3);
  });

  it('stalled by a load it cannot move, it heats and burns', () => {
    const bench = new Bench(motor(12, { load: 1 }));
    bench.run(60);
    expect(Math.abs(r(bench.frame, 'M1.rpm'))).toBeLessThan(1);
    expect(bench.events.some((e) => e.kind === 'warning' && e.element === 'M1')).toBe(true);
    expect(bench.events.find((e) => e.kind === 'damaged')?.message).toMatch(
      /^O motor M1 queimou e o enrolamento abriu/,
    );
  });
});

describe('sensors and buzzer', () => {
  it('buzzer sounds only with the right polarity and enough voltage', () => {
    const buzz = (voltage: number) =>
      runFor(
        netlist('buzzer', [
          { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage } },
          { id: 'BZ1', type: 'buzzer', nodes: ['1', '0'] },
        ]),
      ).frame;
    expect(buzz(5).readouts['BZ1.sounding']).toBe(true);
    expect(r(buzz(5), 'BZ1.current')).toBeCloseTo(0.025, 2);
    expect(buzz(1.5).readouts['BZ1.sounding']).toBe(false);
    expect(buzz(-5).readouts['BZ1.sounding']).toBe(false);
    expect(Math.abs(r(buzz(-5), 'BZ1.current'))).toBeLessThan(1e-9);
  });

  it('LDR resistance falls with light', () => {
    const ldr = (lux: number) =>
      runFor(
        netlist('ldr', [
          { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 5 } },
          { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 10000 } },
          { id: 'LDR1', type: 'ldr', nodes: ['2', '0'], params: { lux } },
        ]),
      ).frame;
    expect(r(ldr(10), 'LDR1.resistance')).toBeCloseTo(20000, 6);
    expect(r(ldr(1000), 'LDR1.resistance')).toBeCloseTo(20000 * 100 ** -0.7, 3);
    expect(r(ldr(0), 'LDR1.resistance')).toBe(1e6);
    expect(r(ldr(1000), 'v2')).toBeLessThan(r(ldr(10), 'v2'));
  });

  it('NTC follows the Beta equation and heats itself', () => {
    const ntc = (temperature: number, voltage = 0.1) =>
      netlist(
        'ntc',
        [
          { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage } },
          { id: 'TH1', type: 'ntc', nodes: ['1', '0'], params: { temperature } },
        ],
        tran(0.01),
      );
    expect(r(runFor(ntc(25)).frame, 'TH1.resistance')).toBeCloseTo(10000, 6);
    const hot = r(runFor(ntc(50)).frame, 'TH1.resistance');
    expect(hot).toBeCloseTo(10000 * Math.exp(3950 * (1 / 323.15 - 1 / 298.15)), 3);
    // 10 V on 10 kΩ: 10 mW over 2 mW/K heats it about 5 K after a few time constants.
    const bench = new Bench(ntc(25, 10));
    bench.run(60);
    expect(r(bench.frame, 'TH1.temperature')).toBeGreaterThan(29);
    expect(r(bench.frame, 'TH1.temperature')).toBeLessThan(32);
  });
});

describe('opamp', () => {
  const inverting = (vin: number, rf = 10000) =>
    netlist('inversor', [
      { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: vin } },
      { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 1000 } },
      { id: 'RF', type: 'resistor', nodes: ['2', '3'], params: { resistance: rf } },
      { id: 'U1', type: 'opamp', nodes: { plus: '0', minus: '2', out: '3' } },
    ]);

  it('inverting amplifier: gain −Rf/R1 with a virtual ground', () => {
    const { frame } = runFor(inverting(0.5));
    // Finite open-loop gain: −10 / (1 + 11 / 100.000).
    expect(r(frame, 'v3')).toBeCloseTo(-5 / (1 + 11 / 1e5), 5);
    expect(Math.abs(r(frame, 'v2'))).toBeLessThan(1e-3);
    expect(frame.readouts['U1.saturated']).toBe(false);
  });

  it('saturates 1,5 V inside the rails', () => {
    const { frame } = runFor(inverting(2));
    // −10,5 V behind the 75 Ω output resistance, loaded by RF + R1.
    expect(r(frame, 'v3')).toBeCloseTo((-10.5 * 11000) / 11075, 1);
    expect(frame.readouts['U1.saturated']).toBe(true);
  });

  it('as a comparator it switches between the saturation levels', () => {
    const doc = netlist(
      'comparador',
      [
        {
          id: 'V1',
          type: 'ac-voltage',
          nodes: ['1', '0'],
          params: { amplitude: 1, frequency: 100 },
        },
        { id: 'U1', type: 'opamp', nodes: { plus: '1', minus: '0', out: '2' } },
        { id: 'RL', type: 'resistor', nodes: ['2', '0'], params: { resistance: 10000 } },
      ],
      tran(1e-5),
    );
    const bench = new Bench(doc);
    let max = -Infinity;
    let min = Infinity;
    bench.run(0.02, (f) => {
      max = Math.max(max, r(f, 'v2'));
      min = Math.min(min, r(f, 'v2'));
    });
    expect(max).toBeCloseTo((10.5 * 10000) / 10075, 1);
    expect(min).toBeCloseTo((-10.5 * 10000) / 10075, 1);
  });

  it('closed-loop bandwidth is GBW over the noise gain', () => {
    const doc: CircuitDoc = {
      ...netlist('banda', [
        { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 0 } },
        { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 1000 } },
        { id: 'RF', type: 'resistor', nodes: ['2', '3'], params: { resistance: 9000 } },
        { id: 'U1', type: 'opamp', nodes: { plus: '0', minus: '2', out: '3' } },
      ]),
      analysis: { kind: 'ac-sweep', source: 'V1', fStart: 100, fStop: 1e6, points: 81 },
    };
    const { frame } = runFor(doc);
    const { f, magnitude } = frame.sweep!;
    expect(magnitude.v3[0]).toBeCloseTo(9, 2);
    // −3 dB at about 1 MHz / 10.
    const k = magnitude.v3.findIndex((m) => m < 9 / Math.SQRT2);
    expect(f[k]).toBeGreaterThan(8e4);
    expect(f[k]).toBeLessThan(1.3e5);
  });
});

describe('timer-555', () => {
  it('astable: f = 1,44 / ((R1 + 2·R2)·C)', () => {
    // R1 = 1 kΩ, R2 = 10 kΩ, C = 100 nF: about 686 Hz, duty cycle 52 %.
    const doc = netlist(
      'astavel',
      [
        { id: 'VCC', type: 'dc-voltage', nodes: ['8', '0'], params: { voltage: 9 } },
        { id: 'R1', type: 'resistor', nodes: ['8', '7'], params: { resistance: 1000 } },
        { id: 'R2', type: 'resistor', nodes: ['7', '6'], params: { resistance: 10000 } },
        { id: 'C1', type: 'capacitor', nodes: ['6', '0'], params: { capacitance: 1e-7 } },
        { id: 'C2', type: 'capacitor', nodes: ['5', '0'], params: { capacitance: 1e-8 } },
        { id: 'RL', type: 'resistor', nodes: ['3', '0'], params: { resistance: 1000 } },
        {
          id: 'U1',
          type: 'timer-555',
          nodes: {
            gnd: '0',
            trig: '6',
            out: '3',
            reset: '8',
            ctrl: '5',
            thr: '6',
            dis: '7',
            vcc: '8',
          },
        },
      ],
      tran(2e-6),
    );
    const bench = new Bench(doc);
    bench.run(0.01);
    const rises: number[] = [];
    let high = 0;
    let total = 0;
    let last = bench.frame.readouts['U1.high'];
    bench.run(0.02, (f) => {
      const now = f.readouts['U1.high'];
      if (now && !last) rises.push(f.t);
      if (now) high++;
      total++;
      last = now;
    });
    const period = (rises.at(-1)! - rises[0]) / (rises.length - 1);
    expect(1 / period).toBeGreaterThan(686 * 0.97);
    expect(1 / period).toBeLessThan(686 * 1.03);
    expect(high / total).toBeCloseTo(11 / 21, 1);
    expect(r(bench.frame, 'v6')).toBeGreaterThan(2.9);
    expect(r(bench.frame, 'v6')).toBeLessThan(6.1);
  });
});

describe('logic gates', () => {
  const table: Record<string, boolean[]> = {
    and: [false, false, false, true],
    or: [false, true, true, true],
    nand: [true, true, true, false],
    nor: [true, false, false, false],
    xor: [false, true, true, false],
  };
  for (const [type, expected] of Object.entries(table)) {
    it(`${type} truth table`, () => {
      [
        [0, 0],
        [0, 5],
        [5, 0],
        [5, 5],
      ].forEach(([va, vb], k) => {
        const bench = new Bench(
          netlist(
            type,
            [
              { id: 'VA', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: va } },
              { id: 'VB', type: 'dc-voltage', nodes: ['2', '0'], params: { voltage: vb } },
              { id: 'U1', type, nodes: { a: '1', b: '2', y: '3' } },
              { id: 'RL', type: 'resistor', nodes: ['3', '0'], params: { resistance: 10000 } },
            ],
            tran(1e-6),
          ),
        );
        const frame = bench.run(5e-6);
        expect(frame.readouts['U1.y'], `${type}(${va}, ${vb})`).toBe(expected[k]);
        expect(r(frame, 'v3')).toBeCloseTo(expected[k] ? 5 * (10000 / 10050) : 0, 3);
      });
    });
  }

  it('not inverts', () => {
    const out = (v: number) =>
      new Bench(
        netlist(
          'not',
          [
            { id: 'VA', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: v } },
            { id: 'U1', type: 'not', nodes: { a: '1', y: '2' } },
          ],
          tran(1e-6),
        ),
      ).run(5e-6).readouts['U1.y'];
    expect(out(0)).toBe(true);
    expect(out(5)).toBe(false);
  });
});

describe('thyristors and optocoupler', () => {
  it('SCR latches on with a gate pulse and stays on until the current stops', () => {
    const bench = new Bench(
      netlist(
        'scr',
        [
          { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 12 } },
          { id: 'S1', type: 'switch', nodes: ['1', '2'], params: { closed: true } },
          { id: 'RL', type: 'resistor', nodes: ['2', '3'], params: { resistance: 100, watts: 5 } },
          { id: 'X1', type: 'scr', nodes: { a: '3', k: '0', g: '5' } },
          { id: 'VG', type: 'dc-voltage', nodes: ['4', '0'], params: { voltage: 0 } },
          { id: 'RG', type: 'resistor', nodes: ['4', '5'], params: { resistance: 470 } },
        ],
        tran(1e-4),
      ),
    );
    bench.run(0.01);
    expect(bench.frame.readouts['X1.on']).toBe(false);
    bench.set('VG', 'voltage', 5);
    bench.run(0.01);
    expect(bench.frame.readouts['X1.on']).toBe(true);
    bench.set('VG', 'voltage', 0);
    bench.run(0.01);
    expect(bench.frame.readouts['X1.on']).toBe(true);
    expect(r(bench.frame, 'X1.ia')).toBeGreaterThan(0.1);
    expect(r(bench.frame, 'X1.vak')).toBeGreaterThan(0.8);
    expect(r(bench.frame, 'X1.vak')).toBeLessThan(1.3);
    bench.set('S1', 'closed', false);
    bench.run(0.01);
    bench.set('S1', 'closed', true);
    bench.run(0.01);
    expect(bench.frame.readouts['X1.on']).toBe(false);
  });

  it('TRIAC conducts both half cycles while triggered and turns off at the zero crossing', () => {
    const bench = new Bench(
      netlist(
        'triac',
        [
          {
            id: 'V1',
            type: 'ac-voltage',
            nodes: ['1', '0'],
            params: { amplitude: 180, frequency: 60 },
          },
          {
            id: 'RL',
            type: 'resistor',
            nodes: ['1', '2'],
            params: { resistance: 100, watts: 500 },
          },
          { id: 'X1', type: 'triac', nodes: { mt2: '2', mt1: '0', g: '4' } },
          { id: 'VG', type: 'dc-voltage', nodes: ['3', '0'], params: { voltage: 5 } },
          { id: 'RG', type: 'resistor', nodes: ['3', '4'], params: { resistance: 220 } },
        ],
        tran(2e-5),
      ),
    );
    let max = 0;
    let min = 0;
    bench.run(0.05, (f) => {
      max = Math.max(max, r(f, 'X1.i'));
      min = Math.min(min, r(f, 'X1.i'));
    });
    expect(max).toBeGreaterThan(1.7);
    expect(min).toBeLessThan(-1.7);
    bench.set('VG', 'voltage', 0);
    bench.run(0.02);
    max = 0;
    bench.run(0.02, (f) => (max = Math.max(max, Math.abs(r(f, 'X1.i')))));
    expect(max).toBeLessThan(1e-3);
  });

  it('optocoupler: collector current is CTR times the LED current until saturation', () => {
    const opto = (iLedV: number, rc: number) =>
      runFor(
        netlist('opto', [
          { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: iLedV } },
          { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 1000 } },
          { id: 'U1', type: 'optocoupler', nodes: { a: '2', k: '0', c: '4', e: '5' } },
          { id: 'V2', type: 'dc-voltage', nodes: ['3', '5'], params: { voltage: 5 } },
          { id: 'RC', type: 'resistor', nodes: ['3', '4'], params: { resistance: rc } },
          { id: 'RE', type: 'resistor', nodes: ['5', '0'], params: { resistance: 1e-3 } },
        ]),
      ).frame;
    const linear = opto(6, 100);
    expect(r(linear, 'U1.ic') / r(linear, 'U1.ledCurrent')).toBeCloseTo(1, 2);
    const saturated = opto(6, 10000);
    expect(r(saturated, 'U1.vce')).toBeLessThan(0.3);
    expect(r(opto(0, 100), 'U1.ic')).toBeLessThan(1e-6);
  });
});

describe('protection', () => {
  const load = (rating: number, resistance: number, curve = 'C') =>
    netlist(
      'disjuntor',
      [
        { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 127 } },
        { id: 'DJ1', type: 'breaker', nodes: ['1', '2'], params: { rating, curve } },
        { id: 'R1', type: 'resistor', nodes: ['2', '0'], params: { resistance, watts: 1e5 } },
      ],
      tran(1e-3),
    );

  it('breaker holds at 1,13 × In, trips thermally at 2,55 × In within seconds', () => {
    const holding = new Bench(load(10, 127 / 11.3));
    holding.run(120);
    expect(holding.events).toHaveLength(0);
    const overload = new Bench(load(10, 127 / 25.5));
    overload.run(60);
    const trip = overload.events.find((e) => e.kind === 'tripped');
    expect(trip?.message).toMatch(/desarmou por sobrecarga/);
    expect(trip!.t).toBeGreaterThan(1);
    expect(trip!.t).toBeLessThan(60);
    expect(overload.frame.readouts['DJ1.closed']).toBe(false);
  });

  it('breaker trips at once on a short circuit and re-arms with the lever', () => {
    const bench = new Bench(load(10, 0.5, 'B'));
    bench.run(0.05);
    const trip = bench.events.find((e) => e.kind === 'tripped');
    expect(trip?.message).toMatch(/curto-circuito \(disparo magnético, curva B\)/);
    expect(trip!.t).toBeLessThan(0.01);
    expect(Math.abs(r(bench.frame, 'R1.current'))).toBeLessThan(1e-3);
    bench.set('R1', 'resistance', 127);
    bench.set('DJ1', 'closed', true);
    bench.run(0.05);
    expect(r(bench.frame, 'R1.current')).toBeCloseTo(1, 3);
  });

  const installation = (leak: boolean) =>
    netlist(
      'dr',
      [
        {
          id: 'V1',
          type: 'ac-voltage',
          nodes: ['1', '0'],
          params: { amplitude: 127 * Math.SQRT2, frequency: 60 },
        },
        { id: 'DR1', type: 'rcd', nodes: { l1: '1', n1: '0', l2: '2', n2: '3' } },
        { id: 'R1', type: 'resistor', nodes: ['2', '3'], params: { resistance: 50, watts: 1000 } },
        // The person touches the protected phase and the floor (earth = source neutral).
        ...(leak ? [{ id: 'P1', type: 'human-body', nodes: ['2', '0'] as [string, string] }] : []),
      ],
      tran(1e-4),
    );

  it('RCD ignores a normal load and trips on current leaking through a person', () => {
    const normal = new Bench(installation(false));
    normal.run(0.5);
    expect(normal.events).toHaveLength(0);
    expect(r(normal.frame, 'DR1.residual')).toBeLessThan(1e-4);
    const shock = new Bench(installation(true));
    shock.run(0.5);
    const trip = shock.events.find((e) => e.kind === 'tripped');
    expect(trip?.message).toMatch(/^O DR DR1 desarmou: corrente de fuga de/);
    expect(trip!.t).toBeLessThan(0.05);
    // Cut before the shock reaches the fibrillation zone.
    expect(shock.events.some((e) => e.kind === 'damaged')).toBe(false);
    expect(shock.frame.readouts['P1.worst']).not.toBe('AC-4');
  });

  it('RCD test button trips it', () => {
    const bench = new Bench(installation(false));
    bench.set('DR1', 'test', true);
    bench.run(0.2);
    expect(bench.events.some((e) => e.kind === 'tripped')).toBe(true);
    expect(bench.frame.readouts['DR1.closed']).toBe(false);
  });

  it('human body: impedance falls with voltage; 127 V without protection reaches AC-4', () => {
    const touch = (voltage: number, skin = 'dry') =>
      netlist(
        'choque',
        [
          {
            id: 'V1',
            type: 'ac-voltage',
            nodes: ['1', '0'],
            params: { amplitude: voltage * Math.SQRT2, frequency: 60 },
          },
          { id: 'P1', type: 'human-body', nodes: ['1', '0'], params: { skin } },
        ],
        tran(1e-4),
      );
    const low = new Bench(touch(12));
    low.run(1);
    expect(low.frame.readouts['P1.zone']).toBe('AC-2');
    expect(r(low.frame, 'P1.impedance')).toBe(3250);
    const mains = new Bench(touch(127));
    mains.run(2);
    expect(r(mains.frame, 'P1.impedance')).toBeCloseTo(1550 + (1400 - 1550) * (2 / 25), -1);
    expect(mains.frame.readouts['P1.worst']).toBe('AC-4');
    expect(mains.events.map((e) => e.kind)).toEqual(['warning', 'damaged']);
    expect(mains.events[1].message).toMatch(/zona AC-4\): risco de parada cardíaca/);
    const wet = new Bench(touch(127, 'wet'));
    wet.run(0.1);
    expect(r(wet.frame, 'P1.impedance')).toBeLessThan(r(mains.frame, 'P1.impedance'));
  });
});

describe('electrolytic capacitor', () => {
  const cap = (voltage: number, polarized = true) =>
    netlist(
      'eletrolitico',
      [
        { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage } },
        { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 10, watts: 100 } },
        {
          id: 'C1',
          type: 'capacitor',
          nodes: ['2', '0'],
          params: { capacitance: 1e-4, voltage: 25, polarized },
        },
      ],
      tran(1e-3),
    );

  it('reversed, it warns and then bulges into a short', () => {
    const bench = new Bench(cap(-9));
    bench.run(2);
    expect(bench.events.map((e) => e.kind)).toEqual(['warning', 'damaged']);
    expect(bench.events[0].message).toMatch(/polaridade invertida/);
    expect(bench.events[1].message).toMatch(/^O capacitor C1 estufou e entrou em curto/);
    expect(bench.frame.readouts['C1.bulged']).toBe(true);
    expect(r(bench.frame, 'v2')).toBeCloseTo(-9 * (0.5 / 10.5), 2);
  });

  it('a non-polarized capacitor takes the reverse voltage', () => {
    const bench = new Bench(cap(-9, false));
    bench.run(2);
    expect(bench.events).toHaveLength(0);
  });

  it('fails above 1,2 × its rated voltage', () => {
    const bench = new Bench(cap(40));
    bench.run(2);
    expect(bench.events[0].message).toMatch(/acima da tensão nominal: [\d,]+ V, nominal 25 V/);
    expect(bench.frame.readouts['C1.bulged']).toBe(true);
  });
});
