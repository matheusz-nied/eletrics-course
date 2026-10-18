import { describe, expect, it } from 'vitest';
import { Simulator } from '../analysis/simulator';
import { loop } from './utils';

/** Steps a DC circuit until `stop` holds or `limit` seconds pass; returns the time. */
function runUntilTrue(sim: Simulator, stop: () => boolean, limit: number): number {
  sim.refresh();
  while (sim.t < limit) {
    sim.step();
    if (stop()) return sim.t;
  }
  return Infinity;
}

function fuseCircuit(multiple: number, kind: 'fast' | 'slow') {
  // 1 A fuse fed by a current that is `multiple` times the rating (12 V across a resistor).
  const r = 12 / multiple;
  return loop('fusivel', [
    { id: 'V1', type: 'dc-voltage', params: { voltage: 12 } },
    { id: 'F1', type: 'fuse', params: { rating: 1, kind, resistance: 1e-3 } },
    { id: 'R1', type: 'resistor', params: { resistance: r, watts: 1000 } },
  ]);
}

describe('fuse', () => {
  const blowTime = (multiple: number, kind: 'fast' | 'slow', limit = 120) => {
    const sim = new Simulator(fuseCircuit(multiple, kind));
    const frame = () => sim.frame({ samples: false }).readouts;
    return runUntilTrue(sim, () => frame()['F1.blown'] === true, limit);
  };

  // Time windows of IEC 60127-2 for 5×20 mm fuses (fast F and time-lag T).
  it('never blows at 1,5× the rating', () => {
    expect(blowTime(1.5, 'fast', 60)).toBe(Infinity);
    expect(blowTime(1.5, 'slow', 60)).toBe(Infinity);
  });

  it('blows a fast fuse within the IEC windows', () => {
    const t275 = blowTime(2.75, 'fast');
    expect(t275).toBeGreaterThan(0.01);
    expect(t275).toBeLessThan(2);
    const t4 = blowTime(4, 'fast');
    expect(t4).toBeGreaterThan(0.003);
    expect(t4).toBeLessThan(0.3);
    expect(blowTime(10, 'fast')).toBeLessThan(0.02);
  });

  it('blows a time-lag fuse within the IEC windows', () => {
    const t275 = blowTime(2.75, 'slow');
    expect(t275).toBeGreaterThan(0.2);
    expect(t275).toBeLessThan(10);
    const t4 = blowTime(4, 'slow');
    expect(t4).toBeGreaterThan(0.04);
    expect(t4).toBeLessThan(3);
    const t10 = blowTime(10, 'slow');
    expect(t10).toBeGreaterThan(0.01);
    expect(t10).toBeLessThan(0.3);
  });

  it('opens the circuit and reports it in pt-BR', () => {
    const sim = new Simulator(fuseCircuit(10, 'fast'));
    runUntilTrue(sim, () => sim.frame({ samples: false }).readouts['F1.blown'] === true, 1);
    sim.step();
    const frame = sim.frame();
    expect(Math.abs(frame.readouts['R1.current'] as number)).toBeLessThan(1e-6);
    const sim2 = new Simulator(fuseCircuit(10, 'fast'));
    sim2.refresh();
    let events: string[] = [];
    for (let i = 0; i < 100 && !events.length; i++) {
      sim2.step();
      events = sim2.frame().events.map((e) => e.message);
    }
    expect(events).toEqual(['O fusível F1 rompeu: corrente de 9,99 A, nominal 1 A.']);
  });

  it('is restored by reset', () => {
    const sim = new Simulator(fuseCircuit(10, 'fast'));
    runUntilTrue(sim, () => sim.frame({ samples: false }).readouts['F1.blown'] === true, 1);
    // Any damaged element also gets the generic flag.
    expect(sim.frame().readouts['F1.damaged']).toBe(true);
    expect(sim.frame().readouts['R1.damaged']).toBeUndefined();
    sim.reset();
    sim.refresh();
    expect(sim.frame().readouts['F1.blown']).toBe(false);
    expect(sim.frame().readouts['F1.damaged']).toBeUndefined();
    expect(sim.frame().readouts['R1.current']).toBeCloseTo(10, 1);
  });
});

describe('lamp', () => {
  const lamp = (volts: number) =>
    loop('lampada', [
      { id: 'V1', type: 'dc-voltage', params: { voltage: volts } },
      { id: 'L1', type: 'lamp', params: { voltage: 12, power: 5 } },
    ]);

  it('reaches rated power and brightness at rated voltage', () => {
    const sim = new Simulator(lamp(12));
    runUntilTrue(sim, () => false, 1);
    const r = sim.frame().readouts;
    expect(r['L1.power'] as number).toBeCloseTo(5, 1);
    expect(r['L1.brightness'] as number).toBeCloseTo(1, 1);
    expect(r['L1.temperature'] as number).toBeGreaterThan(2300);
  });

  it('takes a cold-filament surge of about 14× when switched on', () => {
    const sim = new Simulator(lamp(12));
    sim.refresh();
    const cold = sim.frame().readouts['L1.current'] as number;
    expect(cold / (5 / 12)).toBeGreaterThan(12);
    expect(cold / (5 / 12)).toBeLessThan(16);
  });

  it('glows dimly at half voltage, like a real lamp (≈ V^3,4)', () => {
    const sim = new Simulator(lamp(6));
    runUntilTrue(sim, () => false, 1);
    const b = sim.frame().readouts['L1.brightness'] as number;
    expect(b).toBeGreaterThan(0.07);
    expect(b).toBeLessThan(0.13);
  });

  it('burns out at twice the rated voltage', () => {
    const sim = new Simulator(lamp(24));
    const events: string[] = [];
    const t = runUntilTrue(
      sim,
      () => {
        const f = sim.frame({ samples: false });
        events.push(...f.events.map((e) => e.message));
        return f.readouts['L1.burned'] === true;
      },
      5,
    );
    expect(t).toBeLessThan(1);
    expect(events).toEqual(['A lâmpada L1 queimou: tensão de 24 V, nominal 12 V.']);
    sim.step();
    expect(sim.frame().readouts['L1.brightness']).toBe(0);
  });

  it('survives 1,5× the rated voltage', () => {
    const sim = new Simulator(lamp(18));
    const t = runUntilTrue(
      sim,
      () => sim.frame({ samples: false }).readouts['L1.burned'] === true,
      3,
    );
    expect(t).toBe(Infinity);
  });
});

describe('resistor', () => {
  const overload = (multiple: number) =>
    // 100 Ω, 1/4 W resistor on the voltage that gives `multiple` × 0,25 W.
    loop('resistor', [
      { id: 'V1', type: 'dc-voltage', params: { voltage: Math.sqrt(multiple * 0.25 * 100) } },
      { id: 'R1', type: 'resistor', params: { resistance: 100, watts: 0.25 } },
    ]);

  it('runs warm but safe at its rating', () => {
    const sim = new Simulator(overload(1));
    runUntilTrue(sim, () => false, 60);
    const r = sim.frame().readouts;
    expect(r['R1.burned']).toBe(false);
    expect(r['R1.temperature'] as number).toBeGreaterThan(90);
    expect(r['R1.temperature'] as number).toBeLessThan(110);
  });

  it('warns, then burns open after seconds at 10× its rating', () => {
    const sim = new Simulator(overload(10));
    const events: { kind: string; message: string }[] = [];
    const t = runUntilTrue(
      sim,
      () => {
        const f = sim.frame({ samples: false });
        events.push(...f.events);
        return f.readouts['R1.burned'] === true;
      },
      60,
    );
    expect(t).toBeGreaterThan(2);
    expect(t).toBeLessThan(10);
    expect(events.map((e) => e.kind)).toEqual(['warning', 'damaged']);
    expect(events[1].message).toBe('O resistor R1 queimou: dissipava 2,5 W, máximo 250 mW.');
    sim.step();
    expect(Math.abs(sim.frame().readouts['R1.current'] as number)).toBeLessThan(1e-7);
  });

  it('pops quickly at 100× its rating', () => {
    const sim = new Simulator(overload(100));
    const t = runUntilTrue(
      sim,
      () => sim.frame({ samples: false }).readouts['R1.burned'] === true,
      10,
    );
    expect(t).toBeLessThan(0.5);
  });
});
