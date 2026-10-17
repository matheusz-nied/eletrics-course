import { defineDevice, num } from '../device';

/**
 * Capacitor. Transient: companion model of the trapezoidal rule (backward
 * Euler after discontinuities); DC: open circuit. Starts at `ic` volts.
 * Pin a is + when `polarized`.
 */
export default defineDevice({
  info: {
    type: 'capacitor',
    label: 'Capacitor',
    terminals: 'two',
    pins: [
      { name: 'a', offset: [0, 0], label: 'terminal a (+ se polarizado)' },
      { name: 'b', offset: [0, 0], label: 'terminal b (− se polarizado)' },
    ],
    params: {
      capacitance: { default: 1e-6, label: 'Capacitância', unit: 'F', min: 1e-15 },
      voltage: { default: 50, label: 'Tensão nominal', unit: 'V', min: 0 },
      polarized: { default: false, label: 'Polarizado (eletrolítico)' },
      ic: { default: 0, label: 'Tensão inicial', unit: 'V' },
    },
    readouts: ['current', 'voltage', 'power', 'charge', 'energy'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão', unit: 'V' },
      power: { label: 'Potência', unit: 'W' },
      charge: { label: 'Carga', unit: 'C' },
      energy: { label: 'Energia armazenada', unit: 'J' },
    },
  },
  create({ params, pins: [a, b] }) {
    let vPrev = num(params, 'ic');
    let iPrev = 0;
    let v = vPrev;
    let i = 0;
    // Companion model i = g·v − h for the step being solved.
    const companion = (step: { mode: string; dt: number; method: string }) => {
      if (step.mode === 'dc' || step.dt <= 0) return { g: 0, h: 0 };
      const c = num(params, 'capacitance');
      if (step.method === 'be') {
        const g = c / step.dt;
        return { g, h: g * vPrev };
      }
      const g = (2 * c) / step.dt;
      return { g, h: g * vPrev + iPrev };
    };
    return {
      stamp(m, step) {
        const { g, h } = companion(step);
        if (g === 0) return;
        m.conductance(a, b, g);
        m.current(b, a, h);
      },
      stampAc(m, { omega }) {
        m.admittance(a, b, 0, omega * num(params, 'capacitance'));
      },
      update(step, x, ctx) {
        v = x.v(a) - x.v(b);
        const { g, h } = companion(step);
        i = g * v - h;
        if (ctx.commit) {
          vPrev = v;
          iPrev = i;
        }
      },
      pinCurrents(_x, out) {
        out[0] = i;
        out[1] = -i;
      },
      readouts(_x, out) {
        const c = num(params, 'capacitance');
        out('charge', c * v);
        out('energy', 0.5 * c * v * v);
      },
      reset() {
        vPrev = v = num(params, 'ic');
        iPrev = i = 0;
      },
    };
  },
});
