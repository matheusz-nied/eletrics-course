import { defineDevice, num } from '../device';
import { R_SERIES_MIN } from '../models/constants';

/** Battery: EMF in series with its internal resistance. Pin a is the positive terminal. */
export default defineDevice({
  info: {
    type: 'battery',
    label: 'Pilha / bateria',
    terminals: 'two',
    pins: [
      { name: 'a', offset: [0, 0], label: 'positivo (+)' },
      { name: 'b', offset: [0, 0], label: 'negativo (−)' },
    ],
    params: {
      voltage: { default: 9, label: 'Tensão (força eletromotriz)', unit: 'V' },
      resistance: { default: 0.1, label: 'Resistência interna', unit: 'Ω', min: 0 },
    },
    readouts: ['current', 'voltage', 'power'],
    readoutInfo: {
      current: { label: 'Corrente fornecida', unit: 'A' },
      voltage: { label: 'Tensão nos terminais', unit: 'V' },
      power: { label: 'Potência fornecida', unit: 'W' },
    },
  },
  referencePin: 'b',
  source: true,
  create({ params, pins: [a, b], branch }) {
    const br = branch();
    return {
      stamp(m, step) {
        m.branch(
          br,
          a,
          b,
          num(params, 'voltage') * step.nl.sourceScale,
          Math.max(num(params, 'resistance'), R_SERIES_MIN),
        );
      },
      stampAc(m, ctx) {
        const r = Math.max(num(params, 'resistance'), R_SERIES_MIN);
        m.branch(br, a, b, ctx.source === ctx.id ? 1 : 0, 0, r);
      },
      pinCurrents(x, out) {
        out[0] = x.x[br];
        out[1] = -x.x[br];
      },
    };
  },
});
