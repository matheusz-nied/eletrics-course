import { bool, defineDevice, TWO_PINS } from '../device';
import { R_CLOSED, R_OPEN } from '../models/constants';

/** Jumper: a link on two header pins of a board, fitted (closed) or removed (open). */
export default defineDevice({
  info: {
    type: 'jumper',
    label: 'Jumper',
    terminals: 'two',
    pins: TWO_PINS,
    params: {
      fitted: { default: true, label: 'Colocado' },
    },
    readouts: ['current', 'voltage', 'power', 'fitted'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão', unit: 'V' },
      power: { label: 'Potência', unit: 'W' },
      fitted: { label: 'Colocado' },
    },
  },
  create({ params, pins: [a, b] }) {
    const g = () => 1 / (bool(params, 'fitted') ? R_CLOSED : R_OPEN);
    return {
      stamp(m) {
        m.conductance(a, b, g());
      },
      stampAc(m) {
        m.admittance(a, b, g());
      },
      pinCurrents(x, out) {
        out[0] = g() * (x.v(a) - x.v(b));
        out[1] = -out[0];
      },
      readouts(_x, out) {
        out('fitted', bool(params, 'fitted'));
      },
    };
  },
});
