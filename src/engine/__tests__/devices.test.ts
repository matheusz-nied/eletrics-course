import { describe, expect, it } from 'vitest';
import type { CircuitDoc, GoalDoc, SimFrame } from '../contract';
import { Simulator } from '../analysis/simulator';
import { checkGoal } from '../analysis/goals';
import { loop, netlist, runFor } from './utils';

const r = (frame: SimFrame, key: string) => frame.readouts[key] as number;

describe('switches', () => {
  const circuit = (type: string, params: Record<string, boolean>) =>
    loop('chave', [
      { id: 'V1', type: 'dc-voltage', params: { voltage: 10 } },
      { id: 'S1', type, params },
      { id: 'R1', type: 'resistor', params: { resistance: 100 } },
    ]);

  it('switch conducts only when closed', () => {
    expect(r(runFor(circuit('switch', { closed: false })).frame, 'R1.current')).toBeLessThan(1e-7);
    expect(r(runFor(circuit('switch', { closed: true })).frame, 'R1.current')).toBeCloseTo(0.1, 5);
  });

  it('push button NA closes while pressed; NF opens while pressed', () => {
    const na = (pressed: boolean) => runFor(circuit('push-button', { pressed })).frame;
    expect(r(na(false), 'R1.current')).toBeLessThan(1e-7);
    expect(r(na(true), 'R1.current')).toBeCloseTo(0.1, 5);
    const nf = (pressed: boolean) =>
      runFor(circuit('push-button', { pressed, normallyClosed: true })).frame;
    expect(r(nf(false), 'R1.current')).toBeCloseTo(0.1, 5);
    expect(nf(true).readouts['S1.closed']).toBe(false);
  });

  it('SPDT moves the common between NF and NA', () => {
    const doc = netlist('spdt', [
      { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 5 } },
      { id: 'S1', type: 'switch-spdt', nodes: { com: '1', nc: '2', no: '3' } },
      { id: 'R1', type: 'resistor', nodes: ['2', '0'], params: { resistance: 50 } },
      { id: 'R2', type: 'resistor', nodes: ['3', '0'], params: { resistance: 50 } },
    ]);
    const sim = new Simulator(doc);
    sim.refresh();
    expect(r(sim.frame(), 'R1.current')).toBeCloseTo(0.1, 5);
    expect(r(sim.frame(), 'R2.current')).toBeLessThan(1e-7);
    expect(r(sim.frame(), 'S1.pin.com')).toBeCloseTo(0.1, 5);
    sim.setParam('S1', 'actuated', true);
    sim.refresh();
    expect(r(sim.frame(), 'R1.current')).toBeLessThan(1e-7);
    expect(r(sim.frame(), 'R2.current')).toBeCloseTo(0.1, 5);
  });
});

describe('potentiometer', () => {
  const divider = (params: Record<string, number | string>) =>
    netlist('pot', [
      { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 10 } },
      { id: 'P1', type: 'potentiometer', nodes: { a: '0', w: '2', b: '1' }, params },
    ]);

  it('divides the voltage by the wiper position (linear and log)', () => {
    expect(r(runFor(divider({ position: 0.25 })).frame, 'v2')).toBeCloseTo(2.5, 6);
    // Log taper: 50 % of rotation gives about 10 % of the resistance.
    expect(r(runFor(divider({ position: 0.5, taper: 'log' })).frame, 'v2')).toBeCloseTo(
      10 * (9 / 99),
      4,
    );
  });

  it('burns when the wiper near one end shorts a source', () => {
    // Wiper at 1 % from the supply end, wired straight to ground.
    const doc = netlist('pot-curto', [
      { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 12 } },
      {
        id: 'P1',
        type: 'potentiometer',
        nodes: { a: '0', w: '0', b: '1' },
        params: { position: 0.99 },
      },
    ]);
    const sim = new Simulator(doc);
    sim.refresh();
    const events: string[] = [];
    for (let i = 0; i < 20000 && !events.length; i++) {
      sim.step();
      events.push(
        ...sim
          .frame({ samples: false })
          .events.filter((e) => e.kind === 'damaged')
          .map((e) => e.message),
      );
    }
    expect(events[0]).toMatch(/^O potenciômetro P1 queimou/);
  });
});

describe('reactive elements', () => {
  it('inductor is its winding resistance in DC', () => {
    const doc = loop('indutor-cc', [
      { id: 'V1', type: 'dc-voltage', params: { voltage: 6 } },
      { id: 'L1', type: 'inductor', params: { inductance: 0.5, resistance: 3 } },
    ]);
    expect(r(runFor(doc).frame, 'L1.current')).toBeCloseTo(2, 4);
  });

  it('a paused transient shows a switch change at once, with capacitors holding their charge', () => {
    const doc = loop(
      'rc-chave',
      [
        { id: 'V1', type: 'dc-voltage', params: { voltage: 10 } },
        { id: 'S1', type: 'switch' },
        { id: 'R1', type: 'resistor', params: { resistance: 1000 } },
        { id: 'C1', type: 'capacitor', params: { capacitance: 1e-6, ic: 4 } },
      ],
      { kind: 'transient', dt: 1e-5 },
    );
    const sim = new Simulator(doc);
    sim.refresh();
    expect(r(sim.frame(), 'C1.voltage')).toBeCloseTo(4, 6);
    sim.setParam('S1', 'closed', true);
    sim.refresh();
    // (10 − 4) V / 1 kΩ, flowing the instant the switch closes.
    expect(r(sim.frame(), 'R1.current')).toBeCloseTo(0.006, 6);
    expect(r(sim.frame(), 'C1.voltage')).toBeCloseTo(4, 4);
  });

  it('AC source holds its offset in a DC analysis', () => {
    const doc = loop('ca-cc', [
      { id: 'V1', type: 'ac-voltage', params: { amplitude: 10, offset: 2 } },
      { id: 'R1', type: 'resistor', params: { resistance: 100 } },
    ]);
    expect(r(runFor(doc).frame, 'R1.current')).toBeCloseTo(0.02, 6);
  });
});

describe('sources', () => {
  it('battery sags by its internal resistance and reports delivered current', () => {
    const doc = loop('bateria', [
      { id: 'B1', type: 'battery', params: { voltage: 9, resistance: 1 } },
      { id: 'R1', type: 'resistor', params: { resistance: 8 } },
    ]);
    const { frame } = runFor(doc);
    expect(r(frame, 'B1.current')).toBeCloseTo(1, 6);
    expect(r(frame, 'B1.voltage')).toBeCloseTo(8, 6);
    expect(r(frame, 'B1.power')).toBeCloseTo(8, 6);
    expect(r(frame, 'B1.pin.a')).toBeCloseTo(-1, 6);
  });

  it('current source pushes its current out of pin a', () => {
    const doc = loop('fonte-corrente', [
      { id: 'I1', type: 'dc-current', params: { current: 0.002 } },
      { id: 'R1', type: 'resistor', params: { resistance: 1500 } },
    ]);
    const { frame } = runFor(doc);
    expect(r(frame, 'R1.voltage')).toBeCloseTo(3, 6);
    expect(r(frame, 'I1.current')).toBeCloseTo(0.002, 9);
    expect(r(frame, 'I1.power')).toBeCloseTo(0.006, 9);
  });
});

describe('wires', () => {
  it('splits current at a junction and follows each segment direction', () => {
    // Battery on the left, two resistors in parallel fed by a T of wires.
    const doc: CircuitDoc = {
      id: 'teste/fios',
      title: 'Fios',
      description: 'Junção em T',
      analysis: { kind: 'dc' },
      elements: [
        { id: 'B1', type: 'dc-voltage', a: [0, 0], b: [0, 20], params: { voltage: 10 } },
        {
          id: 'W1',
          type: 'wire',
          points: [
            [0, 0],
            [10, 0],
            [20, 0],
          ],
        },
        {
          id: 'W2',
          type: 'wire',
          points: [
            [10, 10],
            [10, 0],
          ],
        },
        { id: 'R1', type: 'resistor', a: [20, 0], b: [20, 20], params: { resistance: 100 } },
        { id: 'R2', type: 'resistor', a: [10, 10], b: [10, 20], params: { resistance: 50 } },
        {
          id: 'W3',
          type: 'wire',
          points: [
            [20, 20],
            [10, 20],
            [0, 20],
          ],
        },
        { id: 'G', type: 'ground', at: [0, 20] },
      ],
    };
    const { frame } = runFor(doc);
    expect(r(frame, 'W1.current.0')).toBeCloseTo(0.3, 6);
    expect(r(frame, 'W1.current.1')).toBeCloseTo(0.1, 6);
    // W2 is drawn from the resistor up to the junction: its current runs against the drawing.
    expect(r(frame, 'W2.current')).toBeCloseTo(-0.2, 6);
    expect(r(frame, 'W3.current.0')).toBeCloseTo(0.1, 6);
    expect(r(frame, 'W3.current.1')).toBeCloseTo(0.3, 6);
  });
});

describe('probes and goals', () => {
  const doc = loop(
    'medidores',
    [
      { id: 'V1', type: 'dc-voltage', params: { voltage: 12 } },
      { id: 'R1', type: 'resistor', params: { resistance: 100 } },
      { id: 'R2', type: 'resistor', params: { resistance: 200 } },
    ],
    { kind: 'dc' },
    {
      probes: [
        { id: 'Vr2', kind: 'voltage', plus: 'R2.a', minus: 'GND' },
        { id: 'Ir1', kind: 'current', element: 'R1' },
        { id: 'Pr1', kind: 'power', element: 'R1' },
      ],
    },
  );

  it('expose probe readings by id', () => {
    const { frame } = runFor(doc);
    expect(r(frame, 'Vr2')).toBeCloseTo(8, 6);
    expect(r(frame, 'Ir1')).toBeCloseTo(0.04, 6);
    expect(r(frame, 'Pr1')).toBeCloseTo(0.16, 6);
  });

  it('checkGoal compares readouts', () => {
    const { frame } = runFor(doc);
    const goal = (check: GoalDoc['check']): GoalDoc => ({ id: 'g', description: 'g', check });
    expect(checkGoal(goal({ readout: 'Ir1', op: 'between', value: [0.039, 0.041] }), frame)).toBe(
      true,
    );
    expect(checkGoal(goal({ readout: 'Vr2', op: '>', value: 8.1 }), frame)).toBe(false);
    expect(checkGoal(goal({ readout: 'R1.burned', op: '==', value: false }), frame)).toBe(true);
    expect(checkGoal(goal({ readout: 'R2.voltage', op: '==', value: 8 }), frame)).toBe(true);
    expect(checkGoal(goal({ readout: 'X.y', op: '<', value: 1 }), frame)).toBe(false);
  });
});
