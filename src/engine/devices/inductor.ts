import { defineDevice, num } from '../device';
import { R_SERIES_MIN } from '../models/constants';

/**
 * Inductor with winding resistance, as a branch-current unknown:
 * v = R·i + L·di/dt (trapezoidal, backward Euler after discontinuities).
 * DC: the winding resistance only. Starts with `ic` amperes; changing `ic`
 * sets the current to it at once.
 */
export default defineDevice({
  info: {
    type: 'inductor',
    label: 'Indutor (bobina)',
    terminals: 'two',
    pins: [
      { name: 'a', offset: [0, 0] },
      { name: 'b', offset: [0, 0] },
    ],
    params: {
      inductance: { default: 1e-3, label: 'Indutância', unit: 'H', min: 1e-12 },
      resistance: { default: 0, label: 'Resistência do enrolamento', unit: 'Ω', min: 0 },
      ic: { default: 0, label: 'Corrente inicial', unit: 'A' },
    },
    readouts: ['current', 'voltage', 'power', 'energy'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão', unit: 'V' },
      power: { label: 'Potência', unit: 'W' },
      energy: { label: 'Energia armazenada', unit: 'J' },
    },
  },
  create({ params, pins: [a, b], branch }) {
    const br = branch();
    let iPrev = num(params, 'ic');
    let vPrev = 0;
    let i = iPrev;
    return {
      stamp(m, step) {
        const r = Math.max(num(params, 'resistance'), R_SERIES_MIN);
        if (step.mode === 'dc') {
          m.branch(br, a, b, 0, r);
          return;
        }
        const l = num(params, 'inductance');
        const dt = step.dt > 0 ? step.dt : 1e-9;
        if (step.method === 'be') {
          m.branch(br, a, b, -(l / dt) * iPrev, r + l / dt);
        } else {
          m.branch(br, a, b, -vPrev + (r - (2 * l) / dt) * iPrev, r + (2 * l) / dt);
        }
      },
      stampAc(m, { omega }) {
        const r = Math.max(num(params, 'resistance'), R_SERIES_MIN);
        m.branch(br, a, b, 0, 0, r, omega * num(params, 'inductance'));
      },
      update(_step, x, ctx) {
        i = x.x[br];
        if (ctx.commit) {
          iPrev = i;
          vPrev = x.v(a) - x.v(b);
        }
      },
      pinCurrents(_x, out) {
        out[0] = i;
        out[1] = -i;
      },
      readouts(_x, out) {
        out('energy', 0.5 * num(params, 'inductance') * i * i);
      },
      paramChanged(name) {
        // A new initial current takes effect now.
        if (name !== 'ic') return;
        iPrev = i = num(params, 'ic');
        vPrev = 0;
      },
      reset() {
        iPrev = i = num(params, 'ic');
        vPrev = 0;
      },
    };
  },
});
