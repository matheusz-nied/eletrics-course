import { defineDevice, num } from '../device';
import { R_SERIES_MIN } from '../models/constants';

/**
 * Sinusoidal voltage source: v(t) = offset + amplitude·sin(2π·f·t + phase).
 * `amplitude` is the peak value (127 V rms mains ≈ 179,6 V peak). In a DC
 * analysis it holds its offset; in the quasi-static one it is the phasor of
 * its sine (zero if its frequency is not the analysis frequency). Pin a is
 * the reference "+" terminal.
 */
export default defineDevice({
  info: {
    type: 'ac-voltage',
    label: 'Fonte de tensão alternada',
    terminals: 'two',
    pins: [
      { name: 'a', offset: [0, 0], label: 'terminal de referência (+)' },
      { name: 'b', offset: [0, 0], label: 'terminal (−)' },
    ],
    params: {
      amplitude: { default: 10, label: 'Amplitude (pico)', unit: 'V', min: 0 },
      frequency: { default: 60, label: 'Frequência', unit: 'Hz', min: 0 },
      phase: { default: 0, label: 'Fase', unit: '°' },
      offset: { default: 0, label: 'Nível contínuo', unit: 'V' },
    },
    readouts: ['current', 'voltage', 'power'],
    readoutInfo: {
      current: { label: 'Corrente fornecida', unit: 'A' },
      voltage: { label: 'Tensão instantânea', unit: 'V' },
      power: { label: 'Potência fornecida', unit: 'W' },
    },
  },
  referencePin: 'b',
  source: true,
  create({ params, pins: [a, b], branch }) {
    const br = branch();
    const value = (t: number) =>
      num(params, 'offset') +
      num(params, 'amplitude') *
        Math.sin(
          2 * Math.PI * num(params, 'frequency') * t + (num(params, 'phase') * Math.PI) / 180,
        );
    return {
      stamp(m, step) {
        m.branch(
          br,
          a,
          b,
          (step.mode === 'dc' ? num(params, 'offset') : value(step.t)) * step.nl.sourceScale,
          R_SERIES_MIN,
        );
      },
      // In a sweep, the source under test carries 1 V at phase 0; any other is a short.
      // In the quasi-static analysis, its RMS phasor at the analysis frequency.
      stampAc(m, ctx) {
        let re = ctx.source === ctx.id ? 1 : 0;
        let im = 0;
        if (ctx.phasor) {
          const omega = 2 * Math.PI * num(params, 'frequency');
          const rms =
            Math.abs(omega - ctx.omega) <= 1e-6 * ctx.omega
              ? num(params, 'amplitude') / Math.SQRT2
              : 0;
          const phase = (num(params, 'phase') * Math.PI) / 180;
          re = rms * Math.cos(phase);
          im = rms * Math.sin(phase);
        }
        m.branch(br, a, b, re, im, R_SERIES_MIN);
      },
      pinCurrents(x, out) {
        out[0] = x.x[br];
        out[1] = -x.x[br];
      },
    };
  },
});
