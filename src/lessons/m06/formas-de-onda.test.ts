import { describe, expect, it } from 'vitest';
import {
  OUTLET_PEAK,
  SINE_FORM_FACTOR,
  reading,
  sample,
  shape,
  type WaveKind,
} from './formas-de-onda';

/** RMS, mean and mean of |v| by sampling one cycle of the wave with peak 1. */
function numeric(kind: WaveKind, alpha = 90) {
  const n = 200000;
  let sq = 0;
  let sum = 0;
  let abs = 0;
  for (let i = 0; i < n; i++) {
    const v = sample(kind, (i + 0.5) / n, alpha);
    sq += v * v;
    sum += v;
    abs += Math.abs(v);
  }
  return { rms: Math.sqrt(sq / n), mean: sum / n, average: abs / n };
}

const KINDS: WaveKind[] = ['senoide', 'quadrada', 'triangular', 'semi-senoidal', 'dimmer'];

describe('formas de onda (aula 6.2)', () => {
  for (const kind of KINDS) {
    it(`${kind}: the formulas match the sampled wave, and the cycle average is zero`, () => {
      for (const alpha of kind === 'dimmer' ? [0, 45, 90, 135] : [90]) {
        const s = shape(kind, alpha);
        const n = numeric(kind, alpha);
        expect(n.rms).toBeCloseTo(s.rms, 4);
        expect(n.average).toBeCloseTo(s.average, 4);
        expect(n.mean).toBeCloseTo(0, 6);
      }
    });
  }

  it('outlet sine: peak 179,6 V, 359,2 V peak to peak, 127 V RMS, 114,3 V half-cycle average', () => {
    const r = reading('senoide');
    expect(OUTLET_PEAK).toBeCloseTo(179.6, 1);
    expect(r.peakToPeak).toBeCloseTo(359.2, 1);
    expect(r.rms).toBeCloseTo(127, 6);
    expect(r.average).toBeCloseTo(114.3, 1);
    expect(r.meter).toBeCloseTo(127, 6);
    expect(r.error).toBeCloseTo(0, 6);
    expect(SINE_FORM_FACTOR).toBeCloseTo(1.111, 3);
  });

  it('square: RMS 179,6 V, the common meter reads 199,5 V (11 % high)', () => {
    const r = reading('quadrada');
    expect(r.rms).toBeCloseTo(179.6, 1);
    expect(r.meter).toBeCloseTo(199.5, 1);
    expect(r.error * 100).toBeCloseTo(11.1, 1);
  });

  it('triangle: RMS 103,7 V, the common meter reads 99,7 V (3,8 % low)', () => {
    const r = reading('triangular');
    expect(r.rms).toBeCloseTo(103.7, 1);
    expect(r.meter).toBeCloseTo(99.7, 1);
    expect(r.error * 100).toBeCloseTo(-3.8, 1);
  });

  it('semi-sine: the same 127 V RMS as the outlet, but the common meter reads 99,7 V (21,5 % low)', () => {
    const r = reading('semi-senoidal');
    expect(r.rms).toBeCloseTo(127, 1);
    expect(r.meter).toBeCloseTo(99.7, 1);
    expect(r.error * 100).toBeCloseTo(-21.5, 1);
  });

  it('dimmer at 90°: RMS 89,8 V, the common meter reads 63,5 V (29,3 % low)', () => {
    const r = reading('dimmer', OUTLET_PEAK, 90);
    expect(r.rms).toBeCloseTo(89.8, 1);
    expect(r.meter).toBeCloseTo(63.5, 1);
    expect(r.error * 100).toBeCloseTo(-29.3, 1);
    expect(r.peak).toBeCloseTo(179.6, 1);
  });

  it('dimmer at 0° is the full sine, and after 90° the peak drops', () => {
    expect(reading('dimmer', OUTLET_PEAK, 0).rms).toBeCloseTo(127, 6);
    expect(reading('dimmer', OUTLET_PEAK, 150).peak).toBeCloseTo(89.8, 1);
  });

  it('a heater on the semi-sine gets the same power as on the outlet; on the dimmer at 90°, half', () => {
    const p = (v: number) => v * v;
    expect(p(reading('semi-senoidal').rms) / p(127)).toBeCloseTo(1, 6);
    expect(p(reading('dimmer', OUTLET_PEAK, 90).rms) / p(127)).toBeCloseTo(0.5, 6);
  });
});
