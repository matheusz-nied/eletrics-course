import { defineDevice, num } from '../device';
import { R_SERIES_MIN } from '../models/constants';

/** Ideal DC voltage source (a 1 µΩ series resistance keeps a short finite). Pin a is +. */
export default defineDevice({
  info: {
    type: 'dc-voltage',
    label: 'Fonte de tensão contínua',
    terminals: 'two',
    pins: [
      { name: 'a', offset: [0, 0], label: 'positivo (+)' },
      { name: 'b', offset: [0, 0], label: 'negativo (−)' },
    ],
    params: {
      voltage: { default: 5, label: 'Tensão', unit: 'V' },
    },
    readouts: ['current', 'voltage', 'power'],
    readoutInfo: {
      current: { label: 'Corrente fornecida', unit: 'A' },
      voltage: { label: 'Tensão', unit: 'V' },
      power: { label: 'Potência fornecida', unit: 'W' },
    },
  },
  referencePin: 'b',
  source: true,
  create({ params, pins: [a, b], branch }) {
    const br = branch();
    return {
      stamp(m) {
        m.branch(br, a, b, num(params, 'voltage'), R_SERIES_MIN);
      },
      pinCurrents(x, out) {
        out[0] = x.x[br];
        out[1] = -x.x[br];
      },
    };
  },
});
