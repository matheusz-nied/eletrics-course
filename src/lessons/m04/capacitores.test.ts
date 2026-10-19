import { describe, expect, it } from 'vitest';
import type { CircuitDoc, ParamValue } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import guardarCarga from './guardar-carga.circuit';
import rcCargaDescarga from './rc-carga-descarga.circuit';
import temporizador from './temporizador-escada.circuit';

/**
 * Values lessons 4.3 and 4.4 quote from sequences the goal panel cannot
 * express: charge, then release, then discharge. Each run applies `actions`
 * at their instants and calls `watch` after every step.
 */
function play(
  doc: CircuitDoc,
  until: number,
  actions: [number, string, ParamValue][],
  watch: (t: number, readouts: Record<string, number | boolean | string>) => void,
) {
  const sim = new Simulator(doc);
  sim.refresh();
  const pending = [...actions].sort((a, b) => a[0] - b[0]);
  while (sim.t < until - 1e-9) {
    while (pending.length > 0 && pending[0]![0] <= sim.t + 1e-9) {
      const [, key, value] = pending.shift()!;
      const dot = key.indexOf('.');
      sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
    }
    sim.step();
    watch(sim.t, sim.frame({ samples: false }).readouts);
  }
}

describe('4.3 guardar carga', () => {
  it('charged to 9 V, it lights the LED with about 15 mA and keeps about 1,7 V when the LED goes out', () => {
    let peak = 0;
    let last: Record<string, number | boolean | string> = {};
    let held = 0;
    play(
      guardarCarga,
      5,
      [
        [0, 'S1.pressed', true],
        [1, 'S1.pressed', false],
        [2, 'S2.pressed', true],
      ],
      (t, r) => {
        if (t > 1.5 && t < 1.51) held = r.VC as number;
        if (t > 2) peak = Math.max(peak, r.ILED as number);
        last = r;
      },
    );
    expect(held).toBeGreaterThan(8.99);
    expect(peak).toBeGreaterThan(0.0145);
    expect(peak).toBeLessThan(0.0155);
    // Three seconds later the LED is dark, and the capacitor still holds charge.
    expect(last['D1.brightness'] as number).toBeLessThan(0.01);
    expect(last.VC as number).toBeGreaterThan(1.5);
    expect(last.VC as number).toBeLessThan(1.8);
  });

  it('the LED fades to under 5 % of its brightness about 1,5 s after the discharge starts', () => {
    let at15 = 1;
    play(
      guardarCarga,
      3.6,
      [
        [0, 'S1.pressed', true],
        [1, 'S1.pressed', false],
        [2, 'S2.pressed', true],
      ],
      (t, r) => {
        if (Math.abs(t - 3.5) < 0.001) at15 = r['D1.brightness'] as number;
      },
    );
    expect(at15).toBeLessThan(0.05);
  });
});

describe('4.4 carga e descarga', () => {
  it('discharging from 10 V, 3,7 V are left after one time constant (1 s)', () => {
    let start = 0;
    let after = 0;
    play(
      rcCargaDescarga,
      13,
      [
        [0, 'S1.actuated', true],
        [12, 'S1.actuated', false],
      ],
      (t, r) => {
        if (Math.abs(t - 12) < 0.0005) start = r.VC as number;
        if (Math.abs(t - 13) < 0.0005) after = r.VC as number;
      },
    );
    expect(start).toBeGreaterThan(9.99);
    expect(after / start).toBeGreaterThan(0.365);
    expect(after / start).toBeLessThan(0.371);
  });
});

describe('4.4 temporizador de escada', () => {
  /** Seconds the light stays on after the button is released. */
  function onTime(trimpot: number): number {
    const release = 1;
    let off = Infinity;
    play(
      temporizador,
      release + (trimpot / 300000) * 34,
      [
        [0, 'R2.resistance', trimpot],
        [0.1, 'S1.pressed', true],
        [release, 'S1.pressed', false],
      ],
      (t, r) => {
        if (t > release && off === Infinity && (r['D1.brightness'] as number) < 0.01) off = t;
      },
    );
    return off - release;
  }

  it('with 300 kΩ the light stays on about 30 s', () => {
    const t = onTime(300000);
    expect(t).toBeGreaterThan(29.5);
    expect(t).toBeLessThan(31);
  });

  it('with 600 kΩ, about 60 s', () => {
    const t = onTime(600000);
    expect(t).toBeGreaterThan(59);
    expect(t).toBeLessThan(62);
  });

  it('lights the LED with about 14 mA while it is on', () => {
    let current = 0;
    play(temporizador, 1, [[0.1, 'S1.pressed', true]], (_t, r) => {
      current = r['D1.current'] as number;
    });
    expect(current).toBeGreaterThan(0.013);
    expect(current).toBeLessThan(0.016);
  });
});
