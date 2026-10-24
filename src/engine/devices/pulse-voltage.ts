import { defineDevice, num } from '../device';
import { R_SERIES_MIN } from '../models/constants';

/**
 * Square-wave (PWM) voltage source: `high` for the first `duty` of each
 * period of 1/`frequency`, `low` for the rest, with straight edges of
 * `edge` seconds so the solver sees each switching instant. It stands for
 * the gate driver of a switching supply or any logic clock. In a DC
 * analysis it holds its average; in a sweep it is a short. Pin a is "+".
 */
export default defineDevice({
  info: {
    type: 'pulse-voltage',
    label: 'Fonte de onda quadrada (PWM)',
    terminals: 'two',
    pins: [
      { name: 'a', offset: [0, 0], label: 'positivo (+)' },
      { name: 'b', offset: [0, 0], label: 'negativo (−)' },
    ],
    params: {
      high: { default: 5, label: 'Nível alto', unit: 'V' },
      low: { default: 0, label: 'Nível baixo', unit: 'V' },
      frequency: { default: 1000, label: 'Frequência', unit: 'Hz', min: 1e-3, max: 1e7 },
      duty: { default: 0.5, label: 'Ciclo de trabalho', min: 0, max: 1 },
      edge: { default: 0, label: 'Tempo de subida e descida (0 = um passo)', unit: 's', min: 0 },
    },
    readouts: ['current', 'voltage', 'power', 'level'],
    readoutInfo: {
      current: { label: 'Corrente fornecida', unit: 'A' },
      voltage: { label: 'Tensão instantânea', unit: 'V' },
      power: { label: 'Potência fornecida', unit: 'W' },
      level: { label: 'Nível', unit: '' },
    },
  },
  referencePin: 'b',
  source: true,
  create({ params, pins: [a, b], branch }) {
    const br = branch();
    let lastLevel = false;
    /** Fraction of the period the output is high at time t (0…1, ramps on the edges). */
    const highness = (t: number, dt: number) => {
      const period = 1 / num(params, 'frequency');
      const duty = Math.min(1, Math.max(0, num(params, 'duty')));
      if (duty <= 0) return 0;
      if (duty >= 1) return 1;
      const edge = Math.min(Math.max(num(params, 'edge'), dt), (duty * period) / 2);
      const phase = t - Math.floor(t / period) * period;
      if (edge <= 0) return phase < duty * period ? 1 : 0;
      if (phase < edge) return phase / edge;
      if (phase < duty * period) return 1;
      if (phase < duty * period + edge) return 1 - (phase - duty * period) / edge;
      return 0;
    };
    const value = (step: { mode: string; t: number; dt: number }) => {
      const high = num(params, 'high');
      const low = num(params, 'low');
      if (step.mode === 'dc') return low + (high - low) * num(params, 'duty');
      return low + (high - low) * highness(step.t, step.dt);
    };
    return {
      stamp(m, step) {
        m.branch(br, a, b, value(step) * step.nl.sourceScale, R_SERIES_MIN);
      },
      stampAc(m, ctx) {
        m.branch(br, a, b, ctx.source === ctx.id ? 1 : 0, 0, R_SERIES_MIN);
      },
      update(step, _x, ctx) {
        if (!ctx.commit || step.mode === 'dc' || step.dt <= 0) return;
        const level = highness(step.t, step.dt) > 0.5;
        if (level !== lastLevel) ctx.discontinuity();
        lastLevel = level;
      },
      pinCurrents(x, out) {
        out[0] = x.x[br];
        out[1] = -x.x[br];
      },
      readouts(_x, out) {
        out('level', lastLevel ? 'alto' : 'baixo');
      },
      reset() {
        lastLevel = false;
      },
    };
  },
});
