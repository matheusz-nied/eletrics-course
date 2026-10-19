import { describe, expect, it } from 'vitest';
import type { SimFrame } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import rele from './rele-fotoeletrico.circuit';

/** Lesson 7.7: what the photoelectric switch does at each light level. */
function at(lux: number, seconds = 0.4): SimFrame {
  const sim = new Simulator(rele);
  sim.setParam('LDR', 'lux', lux);
  sim.refresh();
  while (sim.t < seconds) sim.step();
  return sim.frame({ samples: false });
}

const num = (frame: SimFrame, key: string) => Number(frame.readouts[key]);

/** R = R10·(lux/10)^(−γ), the LDR model of the engine. */
const ldr = (lux: number) => 20000 * (lux / 10) ** -0.7;

describe('o relé fotoelétrico (aula 7.7)', () => {
  it('turns on where the LDR passes the 20 kΩ of the resistor: 10 lx', () => {
    expect(ldr(10)).toBeCloseTo(20000, 6);
    expect(ldr(20)).toBeCloseTo(12310, -1);
    expect(ldr(3)).toBeCloseTo(46460, -2);
    // The sensor divider: 12 V × 20 kΩ / (20 kΩ + LDR).
    expect((12 * 20000) / (20000 + ldr(20))).toBeCloseTo(7.43, 2);
    expect((12 * 20000) / (20000 + ldr(3))).toBeCloseTo(3.61, 2);
  });

  it('keeps the lamp off in daylight and at sunset', () => {
    for (const lux of [5000, 200, 20]) {
      const f = at(lux);
      expect(f.readouts['K1.closed'], `${lux} lx`).toBe(false);
      expect(num(f, 'L1.brightness'), `${lux} lx`).toBeLessThan(0.01);
      expect(num(f, 'VS'), `${lux} lx`).toBeGreaterThan(6);
    }
    expect(num(at(20), 'VS')).toBeCloseTo(7.43, 1);
    expect(num(at(5000), 'VS')).toBeGreaterThan(11.5);
  });

  it('turns the lamp on at dusk and at night', () => {
    for (const lux of [3, 0.3]) {
      const f = at(lux, 0.6);
      expect(f.readouts['K1.closed'], `${lux} lx`).toBe(true);
      expect(num(f, 'L1.brightness'), `${lux} lx`).toBeGreaterThan(0.9);
    }
    expect(num(at(3), 'VS')).toBeCloseTo(3.61, 1);
    expect(num(at(3), 'VREF')).toBeCloseTo(6, 2);
  });

  it('feeds the relay coil with about 30 mA', () => {
    const f = at(3);
    expect(num(f, 'K1.coilCurrent')).toBeGreaterThan(0.028);
    expect(num(f, 'K1.coilCurrent')).toBeLessThan(0.031);
  });
});
