import { describe, expect, it } from 'vitest';
import type { CircuitDoc, SimFrame } from '../contract';
import { Simulator } from '../analysis/simulator';
import { bouncePattern } from '../devices/bouncing-button';
import { netlist } from './utils';

/** Square wave source, bouncing button, D flip-flop and 4-bit counter (module 11). */

const tran = (dt: number): CircuitDoc['analysis'] => ({ kind: 'transient', dt });
const r = (frame: SimFrame, key: string) => frame.readouts[key];

function run(doc: CircuitDoc, seconds: number, each?: (f: SimFrame, sim: Simulator) => void) {
  const sim = new Simulator(doc);
  sim.refresh();
  const steps = Math.round(seconds / sim.dt);
  for (let i = 0; i < steps; i++) {
    sim.step();
    each?.(sim.frame({ samples: false }), sim);
  }
  return sim;
}

describe('square-voltage', () => {
  const doc = (duty: number) =>
    netlist(
      'quadrada',
      [
        {
          id: 'V1',
          type: 'square-voltage',
          nodes: ['1', '0'],
          params: { high: 5, low: 0, frequency: 100, duty },
        },
        { id: 'R1', type: 'resistor', nodes: ['1', '0'], params: { resistance: 1000 } },
      ],
      tran(1e-5),
    );

  it('is high for the duty cycle of each period, with sharp edges', () => {
    let high = 0;
    let total = 0;
    const rises: number[] = [];
    let last = true;
    run(doc(0.25), 0.1, (f) => {
      const v = r(f, 'v1') as number;
      expect(v === 0 || Math.abs(v - 5) < 1e-6).toBe(true);
      const now = r(f, 'V1.high') as boolean;
      if (now && !last) rises.push(f.t);
      if (now) high++;
      total++;
      last = now;
    });
    expect(high / total).toBeCloseTo(0.25, 2);
    expect(rises[1] - rises[0]).toBeCloseTo(0.01, 4);
  });

  it('a duty cycle of 0 or 1 is a constant level', () => {
    const lo = run(doc(0), 0.03).frame();
    expect(r(lo, 'v1')).toBe(0);
    const hi = run(doc(1), 0.03).frame();
    expect(r(hi, 'v1')).toBeCloseTo(5, 6);
  });

  it('feeds an RC filter that settles at the average', () => {
    const filter = netlist(
      'filtro-pwm',
      [
        {
          id: 'V1',
          type: 'square-voltage',
          nodes: ['1', '0'],
          params: { high: 5, frequency: 500, duty: 0.3 },
        },
        { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 10000 } },
        { id: 'C1', type: 'capacitor', nodes: ['2', '0'], params: { capacitance: 1e-5 } },
      ],
      tran(2e-5),
    );
    const sim = run(filter, 0.8);
    expect(r(sim.frame(), 'v2') as number).toBeCloseTo(1.5, 1);
  });
});

describe('bouncing-button', () => {
  it('flips an even number of times, all within the bounce time', () => {
    for (let seed = 1; seed < 40; seed++) {
      const press = bouncePattern(0.004, seed, false);
      expect(press.length % 2).toBe(0);
      expect(press.length).toBeGreaterThanOrEqual(4);
      expect(Math.max(...press)).toBeLessThanOrEqual(0.004 + 1e-12);
      expect([...press].sort((a, b) => a - b)).toEqual(press);
      const release = bouncePattern(0.002, seed, true);
      expect(release.length % 2).toBe(0);
      expect(release.length).toBeGreaterThanOrEqual(2);
    }
    expect(bouncePattern(0, 1, false)).toEqual([]);
  });

  const circuit = (bounce: number) =>
    netlist(
      'botao-trepida',
      [
        { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 5 } },
        { id: 'R1', type: 'resistor', nodes: ['1', '2'], params: { resistance: 10000 } },
        { id: 'S1', type: 'bouncing-button', nodes: ['2', '0'], params: { bounce } },
      ],
      tran(2e-5),
    );

  it('bounces for a few milliseconds when pressed, then stays closed', () => {
    let changes = 0;
    let lastClosed = false;
    let settled = 0;
    run(circuit(0.004), 0.03, (f, sim) => {
      if (Math.abs(f.t - 0.002) < 1e-6) sim.setParam('S1', 'pressed', true);
      const closed = r(f, 'S1.closed') as boolean;
      if (closed !== lastClosed) {
        changes++;
        settled = f.t;
      }
      lastClosed = closed;
    });
    expect(changes).toBeGreaterThanOrEqual(5);
    expect(lastClosed).toBe(true);
    expect(settled).toBeLessThan(0.002 + 0.0041);
  });

  it('pulls the input low only while the contact touches (one step after it moves)', () => {
    let lows = 0;
    let highsAfterLow = 0;
    let wasClosed = false;
    run(circuit(0.004), 0.01, (f, sim) => {
      if (Math.abs(f.t - 0.001) < 1e-6) sim.setParam('S1', 'pressed', true);
      const v = r(f, 'v2') as number;
      if (wasClosed) expect(v).toBeLessThan(0.01);
      else expect(v).toBeCloseTo(5, 2);
      if (v < 1) lows++;
      else if (lows > 0) highsAfterLow++;
      wasClosed = r(f, 'S1.closed') as boolean;
    });
    expect(lows).toBeGreaterThan(0);
    expect(highsAfterLow).toBeGreaterThan(0);
  });

  it('without bounce, it switches once', () => {
    const sim = run(circuit(0), 0.004, (f, s) => {
      if (Math.abs(f.t - 0.001) < 1e-6) s.setParam('S1', 'pressed', true);
    });
    expect(r(sim.frame(), 'S1.changes')).toBe(1);
  });
});

describe('d-flip-flop', () => {
  it('Q copies D on the rising edge of the clock and holds it', () => {
    const doc = netlist(
      'flip-flop-d',
      [
        { id: 'VD', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 5 } },
        { id: 'VC', type: 'dc-voltage', nodes: ['2', '0'], params: { voltage: 0 } },
        { id: 'U1', type: 'd-flip-flop', nodes: { d: '1', clk: '2', q: '3', nq: '4' } },
      ],
      tran(1e-5),
    );
    const sim = new Simulator(doc);
    sim.refresh();
    const steps = (n: number) => {
      for (let i = 0; i < n; i++) sim.step();
      return sim.frame({ samples: false });
    };
    let f = steps(5);
    expect(r(f, 'U1.q')).toBe(false);
    expect(r(f, 'v4') as number).toBeCloseTo(5, 6);
    // D high alone does nothing: the clock has to rise.
    sim.setParam('VC', 'voltage', 5);
    f = steps(5);
    expect(r(f, 'U1.q')).toBe(true);
    expect(r(f, 'v3') as number).toBeCloseTo(5, 6);
    expect(r(f, 'v4') as number).toBeCloseTo(0, 6);
    // D changes while the clock stays high: Q holds.
    sim.setParam('VD', 'voltage', 0);
    f = steps(5);
    expect(r(f, 'U1.q')).toBe(true);
    // Clock falls: still holds. Rises again: Q takes the new D.
    sim.setParam('VC', 'voltage', 0);
    f = steps(5);
    expect(r(f, 'U1.q')).toBe(true);
    sim.setParam('VC', 'voltage', 5);
    f = steps(5);
    expect(r(f, 'U1.q')).toBe(false);
  });

  it('with Q̄ back to D it toggles: the output has half the clock frequency', () => {
    const doc = netlist(
      'divisor-por-2',
      [
        {
          id: 'CK',
          type: 'square-voltage',
          nodes: ['1', '0'],
          params: { frequency: 1000, duty: 0.5 },
        },
        { id: 'U1', type: 'd-flip-flop', nodes: { d: '2', clk: '1', q: '3', nq: '2' } },
      ],
      tran(1e-5),
    );
    const rises: number[] = [];
    let last = false;
    run(doc, 0.02, (f) => {
      const q = r(f, 'U1.q') as boolean;
      if (q && !last) rises.push(f.t);
      last = q;
    });
    expect(rises.length).toBeGreaterThan(5);
    expect(rises[2] - rises[1]).toBeCloseTo(0.002, 4);
  });
});

describe('counter-4bit', () => {
  const doc = (rst: number) =>
    netlist(
      'contador',
      [
        {
          id: 'CK',
          type: 'square-voltage',
          nodes: ['1', '0'],
          params: { frequency: 100, duty: 0.5 },
        },
        { id: 'VR', type: 'dc-voltage', nodes: ['2', '0'], params: { voltage: rst } },
        {
          id: 'U1',
          type: 'counter-4bit',
          nodes: { clk: '1', rst: '2', q0: '3', q1: '4', q2: '5', q3: '6' },
        },
      ],
      tran(1e-4),
    );

  it('counts the rising edges in binary and wraps from 15 to 0', () => {
    // The clock starts high (no edge at t = 0): rising edges at 10 ms, 20 ms…
    let f = run(doc(0), 0.055).frame();
    expect(r(f, 'U1.count')).toBe(5);
    expect([r(f, 'U1.q0'), r(f, 'U1.q1'), r(f, 'U1.q2'), r(f, 'U1.q3')]).toEqual([
      true,
      false,
      true,
      false,
    ]);
    expect(r(f, 'v3') as number).toBeCloseTo(5, 6);
    expect(r(f, 'v4') as number).toBeCloseTo(0, 6);
    f = run(doc(0), 0.165).frame();
    expect(r(f, 'U1.count')).toBe(0);
  });

  it('reset high holds the count at zero', () => {
    const f = run(doc(5), 0.055).frame();
    expect(r(f, 'U1.count')).toBe(0);
  });
});
