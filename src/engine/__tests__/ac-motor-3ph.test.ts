import { describe, expect, it } from 'vitest';
import type { CircuitDoc, SimEvent, SimFrame } from '../contract';
import { Simulator } from '../analysis/simulator';
import { netlist, runFor, type NetPart } from './utils';

const r = (frame: SimFrame, key: string) => frame.readouts[key] as number;
const qs: CircuitDoc['analysis'] = { kind: 'quasi-static', frequency: 60, dtMech: 0.01 };

/**
 * A 127/220 V three-phase network (three 127 V sources at 120°, star point
 * on ground) feeding a motor. `order` names the network phase on u, v and w;
 * a missing letter leaves that terminal open.
 */
function network(
  motor: Record<string, string | number | boolean> = {},
  order: [string, string, string?] = ['L1', 'L2', 'L3'],
): CircuitDoc {
  const source = (id: string, phase: number): NetPart => ({
    id: `V${id}`,
    type: 'ac-voltage',
    nodes: [id, '0'],
    params: { amplitude: 127 * Math.SQRT2, frequency: 60, phase },
  });
  const [nu, nv, nw] = order;
  return netlist(
    'motor-3f',
    [
      source('L1', 0),
      source('L2', -120),
      source('L3', 120),
      { id: 'M1', type: 'ac-motor-3ph', nodes: { u: nu, v: nv, w: nw ?? 'X' }, params: motor },
    ],
    qs,
  );
}

class Bench {
  readonly sim: Simulator;
  readonly events: SimEvent[] = [];
  constructor(doc: CircuitDoc) {
    this.sim = new Simulator(doc);
    this.sim.refresh();
  }
  run(seconds: number, each?: (frame: SimFrame) => void): SimFrame {
    const steps = Math.round(seconds / this.sim.dt);
    let frame = this.sim.frame({ samples: false });
    for (let i = 0; i < steps; i++) {
      this.sim.step();
      frame = this.sim.frame({ samples: false });
      this.events.push(...frame.events);
      each?.(frame);
    }
    return frame;
  }
}

describe('ac-motor-3ph', () => {
  it('starts in delta on 220 V and runs a few percent below 1.800 rpm', () => {
    const b = new Bench(network({ load: 4.1 }));
    let start = 0;
    b.run(0.01, (f) => (start = r(f, 'M1.current')));
    const frame = b.run(3);
    expect(r(frame, 'M1.rpm')).toBeGreaterThan(1700);
    expect(r(frame, 'M1.rpm')).toBeLessThan(1750);
    expect(r(frame, 'M1.direction')).toBe(1);
    expect(r(frame, 'M1.windingVoltage')).toBeCloseTo(220, 0);
    // Full load: about 2,8 A per line; locked: six to seven times that.
    expect(r(frame, 'M1.current')).toBeGreaterThan(2.6);
    expect(r(frame, 'M1.current')).toBeLessThan(3);
    expect(start / r(frame, 'M1.current')).toBeGreaterThan(6);
    expect(start / r(frame, 'M1.current')).toBeLessThan(7.5);
    // Line current √3 times the winding current in delta.
    expect(r(frame, 'M1.current') / r(frame, 'M1.windingCurrent')).toBeCloseTo(Math.sqrt(3), 2);
    expect(frame.readouts['M1.humming']).toBe(false);
    expect(b.events.filter((e) => e.kind !== 'info')).toEqual([]);
  });

  it('turns the other way when two lines are swapped', () => {
    const frame = new Bench(network({}, ['L1', 'L3', 'L2'])).run(2);
    expect(r(frame, 'M1.rpm')).toBeLessThan(-1750);
    expect(r(frame, 'M1.direction')).toBe(-1);
  });

  it('takes a third of the current and of the torque in star on the same network', () => {
    const locked = (connection: string) => {
      const b = new Bench(network({ connection, inertia: 1e3 }));
      return b.run(0.02);
    };
    const d = locked('triangulo');
    const y = locked('estrela');
    expect(r(y, 'M1.windingVoltage')).toBeCloseTo(127, 0);
    expect(r(y, 'M1.current') / r(d, 'M1.current')).toBeCloseTo(1 / 3, 2);
    expect(r(y, 'M1.torque') / r(d, 'M1.torque')).toBeCloseTo(1 / 3, 2);
  });

  it('hums without starting on two lines, but keeps running hotter if already turning', () => {
    const frame = new Bench(network({}, ['L1', 'L2'])).run(1);
    expect(Math.abs(r(frame, 'M1.rpm'))).toBeLessThan(1);
    expect(frame.readouts['M1.humming']).toBe(true);
    expect(r(frame, 'M1.torque')).toBeCloseTo(0, 6);

    // Half load, then line L3 opens (a blown fuse) while running.
    const doc = network({ load: 2 }, ['L1', 'L2', 'W']);
    // Nodes sit at x = 10·index on the line: L3 at 30, W at 40.
    doc.elements.push({ id: 'S3', type: 'switch', a: [30, 0], b: [40, 0], params: { closed: true } });
    const b = new Bench(doc);
    const both = b.run(3);
    b.sim.setParam('S3', 'closed', false);
    const lost = b.run(1);
    expect(r(lost, 'M1.rpm')).toBeGreaterThan(1600);
    expect(r(lost, 'M1.rpm')).toBeLessThan(r(both, 'M1.rpm'));
    expect(r(lost, 'M1.current')).toBeGreaterThan(1.5 * r(both, 'M1.current'));
  });

  it('heats past its insulation class when locked and finally burns open', () => {
    const b = new Bench(network({}, ['L1', 'L2']));
    let burnedAt = 0;
    b.run(120, (f) => {
      if (!burnedAt && f.readouts['M1.burned'] === true) burnedAt = f.t;
    });
    expect(burnedAt).toBeGreaterThan(5);
    expect(b.events.find((e) => e.kind === 'warning')?.message).toMatch(/superaquecendo/);
    expect(b.events.find((e) => e.kind === 'damaged')?.message).toMatch(/queimou/);
    expect(r(b.run(0.1), 'M1.current')).toBeLessThan(0.01);
  });

  it('reads as its windings to an ohmmeter (DC)', () => {
    const ohm = (connection: string) => {
      const doc = netlist('motor-3f-ohm', [
        { id: 'V1', type: 'dc-voltage', nodes: ['A', '0'], params: { voltage: 1 } },
        { id: 'M1', type: 'ac-motor-3ph', nodes: { u: 'A', v: '0', w: 'X' }, params: { connection } },
      ]);
      return 1 / r(runFor(doc).frame, 'V1.current');
    };
    // Star: two windings in series between u and v; delta: one in parallel with the other two.
    expect(ohm('estrela')).toBeCloseTo(15, 3);
    expect(ohm('triangulo')).toBeCloseTo((7.5 * 15) / 22.5, 3);
  });
});
