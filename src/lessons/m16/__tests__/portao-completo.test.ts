import { describe, expect, it } from 'vitest';
import type { ElementDoc, SimEvent, SimFrame } from '../../../engine/contract';
import { buildNetlist } from '../../../engine/format/netlist';
import { validateCircuit } from '../../../engine/format/validate';
import { Simulator } from '../../../engine/analysis/simulator';
import doc from '../portao-completo.circuit';

type Readouts = SimFrame['readouts'];

/** Drives the lesson circuit the way the student does, keeping every event. */
class Bench {
  readonly sim: Simulator;
  readonly events: SimEvent[] = [];
  r: Readouts;

  /** `params` changes the circuit before it starts: { G1: { position: 3.98 } }. */
  constructor(params: Record<string, Record<string, number | boolean>> = {}) {
    this.sim = new Simulator({
      ...doc,
      elements: doc.elements.map((el: ElementDoc) =>
        params[el.id] ? { ...el, params: { ...el.params, ...params[el.id] } } : el,
      ),
    });
    this.sim.refresh();
    this.r = this.frame();
  }

  private frame(): Readouts {
    const f = this.sim.frame({ samples: false });
    this.events.push(...f.events);
    this.r = f.readouts;
    return f.readouts;
  }

  run(seconds: number): Readouts {
    const n = Math.round(seconds / this.sim.dt);
    for (let i = 0; i < n; i++) {
      this.sim.step();
      this.frame();
    }
    return this.r;
  }

  until(done: (r: Readouts) => boolean, max: number): number {
    const start = this.sim.t;
    const n = Math.round(max / this.sim.dt);
    for (let i = 0; i < n; i++) {
      this.sim.step();
      if (done(this.frame())) return this.sim.t - start;
    }
    throw new Error(`não aconteceu em ${max} s; estado ${String(this.r['U1.estado'])}`);
  }

  press(id: string, param = 'pressed'): void {
    this.sim.setParam(id, param, true);
    this.run(0.1);
    this.sim.setParam(id, param, false);
    this.run(0.05);
  }

  said(text: string): boolean {
    return this.events.some((e) => e.message.includes(text));
  }
}

const num = (r: Readouts, key: string) => r[key] as number;

describe('m16/portao-completo', () => {
  it('validates, with the id of its path', () => {
    expect(doc.id).toBe('m16/portao-completo');
    expect(validateCircuit(doc).errors).toEqual([]);
  });

  it('is wired as the reference circuit (05-portao.md, section 5.1)', () => {
    const { pins } = buildNetlist(doc);
    const same = (...names: string[]) =>
      expect(new Set(names.map((n) => pins[n])).size, names.join(' = ')).toBe(1);
    const gnd = pins['GND1.g'];

    // Power: phase through the fuse and the TRIAC to K1, the interlock, the motor.
    same('AC.l', 'F1.b');
    same('F1.a', 'Q1.mt2');
    same('Q1.mt1', 'K1.com');
    same('K1.nc', 'K2.com');
    same('K1.no', 'M1.w1', 'C1.a');
    same('K2.no', 'M1.w2', 'C1.b');
    same('M1.common', 'CS.a');
    same('CS.b', 'AC.n');
    // Logic.
    same('U1.TRIAC', 'Q1.g');
    same('U1.CORRENTE', 'CS.out');
    same('U1.RF', 'RX.out');
    same('U1.FOTO', 'PH.nc');
    same('U1.FCA', 'FCA.a');
    same('U1.FCF', 'FCF.a');
    same('U1.BOT', 'BOT.a');
    same('U1.PROG', 'PROG.a');
    same('U1.J2', 'J2.a');
    same('U1.PAUSA', 'PAUSA.w');
    same('U1.FORCA', 'FORCA.w');
    same('U1.K1', 'R1.a');
    same('R1.b', 'Q2.b');
    same('Q2.c', 'K1.coil2', 'D1.a');
    same('U1.K2', 'R2.a');
    same('R2.b', 'Q3.b');
    same('Q3.c', 'K2.coil2', 'D2.a');
    same('V12.a', 'K1.coil1', 'K2.coil1', 'D1.b', 'D2.b', 'PH.vp');
    same('V5.a', 'U1.vcc', 'RX.vp', 'PAUSA.b', 'FORCA.b');
    same('U1.LED_PROG', 'R3.a');
    same('R3.b', 'LD1.a');
    for (const p of [
      'U1.gnd',
      'V12.b',
      'V5.b',
      'AC.pe',
      'CS.gnd',
      'Q2.e',
      'Q3.e',
      'LD1.b',
      'PH.gnd',
      'PH.com',
      'RX.gnd',
      'PAUSA.a',
      'FORCA.a',
      'FCA.b',
      'FCF.b',
      'BOT.b',
      'PROG.b',
      'J2.b',
    ])
      expect(pins[p], p).toBe(gnd);
    // Unused pins stay on their own.
    for (const p of [
      'U1.J1',
      'U1.INV',
      'U1.LUZ',
      'U1.TRAVA',
      'U1.AUX',
      'U1.BUZZER',
      'PH.no',
      'K2.nc',
    ])
      expect(Object.values(pins).filter((n) => n === pins[p]).length, p).toBe(1);
  });

  it('opens on the push button and stops at the opening limit switch', () => {
    const b = new Bench();
    b.run(0.5);
    expect(b.r['U1.estado']).toBe('FECHADO');
    expect(b.r['FCF.closed']).toBe(true);
    b.press('BOT');
    let peak = 0;
    const took = b.until((r) => {
      peak = Math.max(peak, num(r, 'M1.current'));
      return r['U1.estado'] === 'ABERTO';
    }, 30);
    expect(took).toBeGreaterThan(15);
    expect(took).toBeLessThan(22);
    expect(peak).toBeGreaterThan(3);
    b.run(1);
    expect(num(b.r, 'Q1.conduction')).toBe(0);
    expect(num(b.r, 'G1.distance')).toBeGreaterThan(3.9);
    expect(b.r['FCA.closed']).toBe(true);
    expect(b.r['LD1.burned']).toBe(false);
    expect(b.events.filter((e) => e.kind === 'warning' || e.kind === 'damaged')).toEqual([]);
  });

  it('learns the remote with PROG and then opens with it', () => {
    const b = new Bench();
    b.run(0.5);
    b.press('RX', 'press');
    b.run(0.5);
    expect(b.r['U1.estado']).toBe('FECHADO');
    b.press('PROG');
    expect(b.r['U1.cadastro']).toBe(true);
    expect(num(b.r, 'LD1.brightness')).toBeGreaterThan(0.2);
    b.press('RX', 'press');
    b.run(0.5);
    expect(b.r['U1.cadastro']).toBe(false);
    b.press('RX', 'press');
    b.until((r) => r['U1.estado'] === 'ABRINDO', 1);
  });

  it('reverses when the beam is broken while closing', () => {
    const b = new Bench({ G1: { position: 3.98 } });
    b.run(0.5);
    expect(b.r['U1.estado']).toBe('ABERTO');
    b.press('BOT');
    b.until((r) => num(r, 'G1.velocity') < -0.2, 5);
    b.run(2);
    b.sim.setParam('PH', 'blocked', true);
    b.until((r) => r['U1.estado'] === 'ABRINDO', 0.2);
    b.until((r) => num(r, 'G1.velocity') > 0.1, 4);
  });

  it('reverses on an obstacle, even one met early in the run', () => {
    // The obstacle sits 0,5 m from the open position: the gate meets it in about 2 s.
    const b = new Bench({ G1: { position: 3.98, obstacle: true, obstacleAt: 3.5 } });
    b.run(0.5);
    b.press('BOT');
    b.until((r) => r['G1.blocked'] === true, 10);
    let peak = 0;
    const took = b.until((r) => {
      peak = Math.max(peak, num(r, 'M1.current'));
      return r['U1.estado'] === 'ABRINDO';
    }, 3);
    expect(took).toBeLessThan(1);
    expect(peak).toBeGreaterThan(1.5);
    b.until((r) => num(r, 'G1.velocity') > 0.1, 4);
  });

  it('reverses on the obstacle the lesson asks for, at its default spot', () => {
    const b = new Bench({ G1: { position: 3.98, obstacle: true } });
    b.run(0.5);
    b.press('BOT');
    b.until((r) => r['G1.blocked'] === true, 20);
    const took = b.until((r) => r['U1.estado'] === 'ABRINDO', 3);
    expect(took).toBeLessThan(1);
    b.until((r) => num(r, 'G1.velocity') > 0.1, 4);
  });

  it('auto closes after the pause with J2 fitted', () => {
    const b = new Bench({
      G1: { position: 3.98 },
      J2: { fitted: true },
      PAUSA: { position: 0.05 },
    });
    b.run(0.5);
    expect(b.r['U1.estado']).toBe('ABERTO');
    expect(b.r['U1.fechamentoAutomatico']).toBe(true);
    b.until((r) => r['U1.estado'] === 'FECHANDO', 12);
  });
});
