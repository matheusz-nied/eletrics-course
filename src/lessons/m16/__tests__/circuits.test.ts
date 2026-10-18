import { describe, expect, it } from 'vitest';
import type { CircuitDoc } from '../../../engine/contract';
import { Simulator } from '../../../engine/analysis/simulator';
import { checkGoal } from '../../../engine/analysis/goals';
import { validateCircuit } from '../../../engine/format/validate';
import descarga from '../descarga-capacitor.circuit';
import fimDeCurso from '../fim-de-curso.circuit';
import fotocelula from '../fotocelula-nf.circuit';
import motor, { CAPACITOR, MOTOR_MODEL } from '../motor-capacitor.circuit';
import trimpot from '../trimpot-pausa.circuit';

/**
 * The M16 lesson circuits: they validate, meet their goals, and the motor
 * circuit gives the currents and phase the lesson quotes.
 */
const circuits: [string, CircuitDoc][] = [
  ['descarga-capacitor', descarga],
  ['fim-de-curso', fimDeCurso],
  ['fotocelula-nf', fotocelula],
  ['motor-capacitor', motor],
  ['trimpot-pausa', trimpot],
];

function runTo(sim: Simulator, t: number): void {
  sim.refresh();
  while (sim.t < t - sim.dt * 1e-6) sim.step();
}

describe('M16 lesson circuits', () => {
  for (const [file, doc] of circuits) {
    describe(file, () => {
      it('has the id of its path and validates', () => {
        expect(doc.id).toBe(`m16/${file}`);
        expect(validateCircuit(doc).errors).toEqual([]);
      });

      for (const goal of doc.goals ?? []) {
        it(`meets goal "${goal.id}"`, () => {
          const sim = new Simulator(doc);
          for (const [key, value] of Object.entries(goal.solution ?? {})) {
            const dot = key.indexOf('.');
            sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
          }
          const tEnd = (doc.analysis.kind === 'transient' && doc.analysis.tStop) || 1;
          runTo(sim, goal.at ?? tEnd);
          const frame = sim.frame();
          expect(
            checkGoal(goal, frame),
            `${goal.check.readout} = ${String(frame.readouts[goal.check.readout])}`,
          ).toBe(true);
        });
      }
    });
  }
});

/** RMS value and the time of the last positive zero crossing of a probe, over whole cycles. */
function measure(sim: Simulator, probe: string, from: number, cycles: number) {
  const period = 1 / 60;
  runTo(sim, from);
  let sum = 0;
  let n = 0;
  let prev = Number(sim.frame({ samples: false }).readouts[probe]);
  let rising = Number.NaN;
  const end = from + cycles * period;
  while (sim.t < end - sim.dt * 1e-6) {
    sim.step();
    const v = Number(sim.frame({ samples: false }).readouts[probe]);
    sum += v * v;
    n++;
    if (prev < 0 && v >= 0) rising = sim.t - (v / (v - prev)) * sim.dt;
    prev = v;
  }
  return { rms: Math.sqrt(sum / n), rising };
}

/** Phase of `b` ahead of `a`, in degrees (0 to 360). */
function lead(a: number, b: number): number {
  const deg = ((a - b) * 60 * 360) % 360;
  return deg < 0 ? deg + 360 : deg;
}

describe('motor-capacitor numbers quoted in lesson 16.2', () => {
  // Phasors: winding Z = R + jωL; capacitor branch adds −j/(ωC).
  const w = 2 * Math.PI * 60;
  const xl = w * MOTOR_MODEL.inductance;
  const xc = 1 / (w * CAPACITOR);
  const zMain = Math.hypot(MOTOR_MODEL.resistance, xl);
  const zAux = Math.hypot(MOTOR_MODEL.resistance, xl - xc);

  it('main winding about 3,3 A, capacitor winding about 2,5 A, capacitor about 165 V', () => {
    expect(127 / zMain).toBeCloseTo(3.26, 2);
    expect(127 / zAux).toBeCloseTo(2.48, 2);
    expect((127 / zAux) * xc).toBeCloseTo(164.6, 0);

    const sim = new Simulator(motor);
    const ia = measure(sim, 'IA', 0.5, 6);
    const sim2 = new Simulator(motor);
    const iF = measure(sim2, 'IF', 0.5, 6);
    expect(ia.rms).toBeCloseTo(127 / zMain, 1);
    expect(iF.rms).toBeCloseTo(127 / zAux, 1);
    const sim3 = new Simulator(motor);
    expect(measure(sim3, 'VC', 0.5, 6).rms).toBeGreaterThan(160);
  });

  it('the capacitor winding leads by about 94°, and the relay swaps the order', () => {
    const phase = (doc: CircuitDoc, actuated: boolean) => {
      const a = new Simulator(doc);
      const b = new Simulator(doc);
      a.setParam('K1', 'actuated', actuated);
      b.setParam('K1', 'actuated', actuated);
      return lead(measure(a, 'IA', 0.5, 3).rising, measure(b, 'IF', 0.5, 3).rising);
    };
    const expected =
      (Math.atan2(xl, MOTOR_MODEL.resistance) - Math.atan2(xl - xc, MOTOR_MODEL.resistance)) *
      (180 / Math.PI);
    expect(expected).toBeCloseTo(93.8, 0);
    // Relay at rest: phase on ABRE, so FECHA (through the capacitor) leads.
    expect(phase(motor, false)).toBeCloseTo(expected, -1);
    // Relay on: phase on FECHA, so ABRE leads; FECHA lags by the same angle.
    expect(360 - phase(motor, true)).toBeCloseTo(expected, -1);
  });

  it('without the capacitor only one winding takes current', () => {
    const sim = new Simulator(motor);
    sim.setParam('S1', 'closed', false);
    expect(measure(sim, 'IF', 0.5, 3).rms).toBeLessThan(0.01);
  });
});

describe('other values quoted in the lessons', () => {
  const at = (doc: CircuitDoc, t: number, params: Record<string, number | boolean> = {}) => {
    const sim = new Simulator(doc);
    for (const [key, value] of Object.entries(params)) {
      const dot = key.indexOf('.');
      sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
    }
    runTo(sim, t);
    return sim.frame().readouts;
  };

  it('limit switches: 5 V open, 0 V and 0,5 mA closed', () => {
    const r = at(fimDeCurso, 1);
    expect(r.VFCA).toBeGreaterThan(4.99);
    expect(r.VFCF).toBeLessThan(0.01);
    expect(Number(r['R2.current'])).toBeCloseTo(0.0005, 6);
  });

  it('photocell: 0 V with the beam free, 5 V when blocked or when the cable breaks', () => {
    expect(at(fotocelula, 1).VFOTO).toBeLessThan(0.01);
    expect(at(fotocelula, 1, { 'B1.pressed': true }).VFOTO).toBeGreaterThan(4.99);
    expect(at(fotocelula, 1, { 'S1.closed': false }).VFOTO).toBeGreaterThan(4.99);
    expect(at(fotocelula, 1, { 'J1.closed': true, 'B1.pressed': true }).VFOTO).toBeLessThan(0.01);
  });

  it('capacitor: keeps 180 V alone; 18 mA at first, about 1,2 V after 2 s with the resistor', () => {
    expect(at(descarga, 3).VC).toBeGreaterThan(179.9);
    expect(Number(at(descarga, 0.001, { 'S1.closed': true }).IR)).toBeCloseTo(0.018, 3);
    expect(Number(at(descarga, 2, { 'S1.closed': true }).VC)).toBeCloseTo(180 * Math.exp(-5), 1);
    // Half-life τ·ln 2 = 0,28 s.
    expect(Number(at(descarga, 0.4 * Math.LN2, { 'S1.closed': true }).VC)).toBeCloseTo(90, 0);
  });

  it('trimpot: 2,5 V in the middle (60 s)', () => {
    expect(Number(at(trimpot, 1).VP)).toBeCloseTo(2.5, 1);
  });
});
