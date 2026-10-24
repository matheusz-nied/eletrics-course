import { describe, expect, it } from 'vitest';
import counter from './contador.circuit';
import flipFlop from './flip-flop-d.circuit';
import latch from './latch-sr.circuit';
import { num, runTo, set, start } from './sim';

/** Values lesson 11.4 quotes from its circuits. */

describe('11.4 SR latch', () => {
  it('starts with Q = 0 (power-on reset), no oscillation', () => {
    const sim = start(latch);
    let changes = 0;
    let last: unknown;
    runTo(sim, 0.5, (r) => {
      if (last !== undefined && r['U1.y'] !== last) changes++;
      last = r['U1.y'];
    });
    const r = runTo(sim, 0.5);
    expect(r['U1.y']).toBe(false);
    expect(r['U2.y']).toBe(true);
    expect(changes).toBeLessThanOrEqual(1);
    expect(num(r, 'D1.brightness')).toBeLessThan(0.01);
  });

  it('a press of S sets Q and it stays after release; a press of R clears it', () => {
    const sim = start(latch);
    runTo(sim, 0.5);
    set(sim, 'B1.pressed', true);
    runTo(sim, 0.6);
    set(sim, 'B1.pressed', false);
    let r = runTo(sim, 1);
    expect(r['U1.y']).toBe(true);
    expect(num(r, 'VQ')).toBeGreaterThan(4.4);
    expect(num(r, 'D1.brightness')).toBeGreaterThan(0.3);
    set(sim, 'B2.pressed', true);
    runTo(sim, 1.1);
    set(sim, 'B2.pressed', false);
    r = runTo(sim, 1.5);
    expect(r['U1.y']).toBe(false);
    expect(r['U2.y']).toBe(true);
  });

  it('S and R pressed together: both outputs 0', () => {
    const sim = start(latch);
    runTo(sim, 0.5);
    set(sim, 'B1.pressed', true);
    set(sim, 'B2.pressed', true);
    const r = runTo(sim, 0.6);
    expect(r['U1.y']).toBe(false);
    expect(r['U2.y']).toBe(false);
  });
});

describe('11.4 D flip-flop', () => {
  it('Q takes D only on the rising edge of the clock', () => {
    const sim = start(flipFlop);
    runTo(sim, 0.01);
    set(sim, 'VD.voltage', 5);
    let r = runTo(sim, 0.02);
    expect(r['U1.q']).toBe(false);
    set(sim, 'VC.voltage', 5);
    r = runTo(sim, 0.03);
    expect(r['U1.q']).toBe(true);
    expect(num(r, 'D1.brightness')).toBeGreaterThan(0.3);
    // D falls with the clock high: Q holds. The clock falls: still holds.
    set(sim, 'VD.voltage', 0);
    runTo(sim, 0.04);
    set(sim, 'VC.voltage', 0);
    r = runTo(sim, 0.05);
    expect(r['U1.q']).toBe(true);
    set(sim, 'VC.voltage', 5);
    r = runTo(sim, 0.06);
    expect(r['U1.q']).toBe(false);
  });

  it('the divider by 2 toggles on every rising edge of the clock', () => {
    const sim = start(flipFlop);
    runTo(sim, 0.01);
    const states: boolean[] = [];
    for (let k = 0; k < 4; k++) {
      set(sim, 'VC.voltage', 5);
      runTo(sim, sim.t + 0.01);
      set(sim, 'VC.voltage', 0);
      states.push(runTo(sim, sim.t + 0.01)['U2.q'] as boolean);
    }
    expect(states).toEqual([true, false, true, false]);
  });
});

describe('11.4 binary counter', () => {
  it('counts the clock in binary: at 1 Hz, 5 after 5,5 s, LEDs 0101', () => {
    const r = runTo(start(counter), 5.5);
    expect(r['U1.count']).toBe(5);
    const lit = ['D4', 'D3', 'D2', 'D1'].map((d) => num(r, `${d}.brightness`) > 0.3);
    expect(lit).toEqual([false, true, false, true]);
  });

  it('wraps from 15 to 0 after 16 clocks', () => {
    const r = runTo(start(counter, { 'CK.frequency': 5 }), 3.3);
    // Rising edges at 0,2 s, 0,4 s… 3,2 s: 16 edges.
    expect(r['U1.count']).toBe(0);
  });
});
