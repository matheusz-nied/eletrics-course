import { describe, expect, it } from 'vitest';
import type { CircuitDoc, SimEvent, SimFrame } from '../contract';
import { Simulator } from '../analysis/simulator';
import { gateCircuit, type Options } from './gate-circuit';

type Readouts = SimFrame['readouts'];

/** Drives the simulation and keeps every event it reports. */
class Bench {
  readonly sim: Simulator;
  readonly events: SimEvent[] = [];
  r: Readouts;

  constructor(doc: CircuitDoc) {
    this.sim = new Simulator(doc);
    this.sim.refresh();
    this.r = this.frame();
  }

  private frame(): Readouts {
    const f = this.sim.frame({ samples: false });
    this.events.push(...f.events);
    this.r = f.readouts;
    return f.readouts;
  }

  /** Runs `seconds`, calling `each` with the readouts every step. */
  run(seconds: number, each?: (r: Readouts) => void): Readouts {
    const n = Math.round(seconds / this.sim.dt);
    for (let i = 0; i < n; i++) {
      this.sim.step();
      if (!each && i % 10 !== 9 && i !== n - 1) continue;
      const r = this.frame();
      each?.(r);
    }
    return this.r;
  }

  /** Runs until `done` holds (failing after `max` seconds); returns the time it took. */
  until(done: (r: Readouts) => boolean, max: number): number {
    const start = this.sim.t;
    const n = Math.round(max / this.sim.dt);
    for (let i = 0; i < n; i++) {
      this.sim.step();
      if (done(this.frame())) return this.sim.t - start;
    }
    throw new Error(`não aconteceu em ${max} s; estado ${String(this.r['U1.estado'])}`);
  }

  /** Presses a button (or the remote) for a moment. */
  press(id: string, param = 'pressed', seconds = 0.1): void {
    this.sim.setParam(id, param, true);
    this.run(seconds);
    this.sim.setParam(id, param, false);
    this.run(0.05);
  }

  said(text: string): boolean {
    return this.events.some((e) => e.message.includes(text));
  }
}

const num = (r: Readouts, key: string) => r[key] as number;
const motorOff = (r: Readouts) =>
  num(r, 'Q1.conduction') === 0 && r['K1.energized'] === false && r['K2.energized'] === false;

describe('gate reference circuit (05-portao.md, section 5)', () => {
  it('opens on a command and stops at the opening limit switch', () => {
    const b = new Bench(gateCircuit());
    b.run(0.5);
    expect(b.r['U1.estado']).toBe('FECHADO');
    expect(b.r['FCF.closed']).toBe(true);
    let lockOpened = false;
    let peak = 0;
    b.press('BOT');
    const took = b.until((r) => {
      lockOpened ||= r['LOCK.open'] === true;
      peak = Math.max(peak, num(r, 'M1.current'));
      return r['U1.estado'] === 'ABERTO';
    }, 30);
    // 4 m at about 15 m/min, after the relay, the soft start and the acceleration.
    expect(took).toBeGreaterThan(15);
    expect(took).toBeLessThan(22);
    expect(lockOpened).toBe(true);
    expect(peak).toBeGreaterThan(3); // starting current, several times the running current
    // The TRIAC cuts the current first; the relay opens with no current after it.
    expect(num(b.r, 'Q1.conduction')).toBe(0);
    expect(b.r['K1.energized']).toBe(true);
    b.run(1);
    expect(motorOff(b.r)).toBe(true);
    expect(b.r['G1.state']).toBe('parado'); // stopped by the reed, before the end stop
    expect(num(b.r, 'G1.distance')).toBeGreaterThan(3.94);
    expect(num(b.r, 'G1.distance')).toBeLessThan(4);
    expect(b.r['G1.blocked']).toBe(false);
    expect(b.r['FCA.closed']).toBe(true);
    expect(b.r['M1.protector']).toBe(false);
    expect(b.said('Fim de curso de abertura')).toBe(true);
    expect(b.events.filter((e) => e.kind === 'warning' || e.kind === 'damaged')).toEqual([]);
  });

  it('closes on the next command and stops at the closing limit switch', () => {
    const b = new Bench(gateCircuit({ position: 3.98 }));
    b.run(0.5);
    expect(b.r['U1.estado']).toBe('ABERTO');
    b.press('BOT');
    let closing = false;
    b.until((r) => {
      closing ||= num(r, 'G1.velocity') < -0.2 && r['K2.energized'] === true;
      return r['U1.estado'] === 'FECHADO';
    }, 30);
    expect(closing).toBe(true);
    b.run(1);
    expect(motorOff(b.r)).toBe(true);
    expect(num(b.r, 'G1.distance')).toBeLessThan(0.06);
    expect(b.r['FCF.closed']).toBe(true);
  });

  it('reverses a closing gate when the photocell beam is broken', () => {
    const b = new Bench(gateCircuit({ position: 3.98 }));
    b.press('BOT');
    b.until((r) => num(r, 'G1.velocity') < -0.2, 5);
    b.run(2);
    const where = num(b.r, 'G1.distance');
    b.sim.setParam('PH', 'blocked', true);
    b.until((r) => r['U1.estado'] === 'ABRINDO', 0.2);
    expect(b.said('Feixe da fotocélula interrompido')).toBe(true);
    // Both relays drop for the dead time, then K1 pulls in and the gate goes back.
    let bothOff = false;
    let together = false;
    b.until((r) => {
      bothOff ||= motorOff(r);
      together ||= r['K1.energized'] === true && r['K2.energized'] === true;
      return num(r, 'G1.velocity') > 0.1;
    }, 4);
    expect(bothOff).toBe(true);
    expect(together).toBe(false);
    expect(num(b.r, 'G1.distance')).toBeGreaterThan(where - 0.6);
    b.until((r) => r['U1.estado'] === 'ABERTO', 30);
    // With the beam still broken, a command does not close it.
    b.press('BOT');
    b.run(1);
    expect(b.r['U1.estado']).toBe('ABERTO');
    expect(b.said('Fotocélula interrompida: a central não fecha')).toBe(true);
  });

  it('reverses a closing gate that hits an obstacle (motor current)', () => {
    const b = new Bench(gateCircuit({ position: 3.98 }));
    b.sim.setParam('G1', 'obstacle', true);
    b.sim.setParam('G1', 'obstacleAt', 1.5);
    b.press('BOT');
    let blocked = false;
    let stalled = 0;
    b.until((r) => {
      blocked ||= r['G1.blocked'] === true;
      if (r['G1.blocked'] === true) stalled = Math.max(stalled, num(r, 'U1.corrente'));
      return r['U1.estado'] === 'ABRINDO';
    }, 30);
    expect(blocked).toBe(true);
    expect(stalled).toBeGreaterThan(num(b.r, 'U1.limiteCorrente') || 1);
    expect(b.said('Obstáculo no fechamento')).toBe(true);
    expect(num(b.r, 'G1.distance')).toBeCloseTo(1.5, 1);
    b.until((r) => num(r, 'G1.velocity') > 0.1, 4);
  });

  it('turns the wrong way with ABRE and FECHA swapped, and DIP INV puts it right', () => {
    const velocity = (opts: Options) => {
      const b = new Bench(gateCircuit({ position: 2, ...opts }));
      b.run(0.2);
      expect(b.r['U1.estado']).toBe('PARADO'); // position unknown: the first command opens
      b.press('BOT');
      b.run(3);
      expect(b.r['U1.estado']).toBe('ABRINDO');
      expect(b.r['K1.energized'] !== b.r['K2.energized']).toBe(true);
      return num(b.r, 'G1.velocity');
    };
    expect(velocity({})).toBeGreaterThan(0.2);
    expect(velocity({ swapped: true })).toBeLessThan(-0.2);
    expect(velocity({ swapped: true, inv: true })).toBeGreaterThan(0.2);
  });

  it('learns a remote, opens with it and refuses a replayed code', () => {
    const b = new Bench(gateCircuit());
    b.run(0.2);
    b.press('RX', 'press');
    b.run(0.5);
    expect(b.r['U1.estado']).toBe('FECHADO'); // not learned yet
    b.press('PROG');
    expect(b.r['U1.cadastro']).toBe(true);
    b.press('RX', 'press');
    expect(b.r['U1.controles']).toBe(1);
    b.run(1);
    b.press('RX', 'press');
    expect(b.r['U1.estado']).toBe('ABRINDO');
    b.press('RX', 'press'); // a second press stops it
    expect(b.r['U1.estado']).toBe('PARADO');
    b.press('RX', 'replay'); // a copy of the last code, captured off the air
    expect(b.r['U1.estado']).toBe('PARADO');
    expect(b.said('rolling code')).toBe(true);
  });
});
