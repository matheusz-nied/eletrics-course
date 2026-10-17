import { bool, defineDevice, TWO_PINS } from '../device';
import { R_CLOSED, R_OPEN } from '../models/constants';

/** On/off switch (SPST). */
export default defineDevice({
  info: {
    type: 'switch',
    label: 'Chave liga/desliga',
    terminals: 'two',
    pins: TWO_PINS,
    params: {
      closed: { default: false, label: 'Fechada (ligada)' },
    },
    readouts: ['current', 'voltage', 'closed'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão entre os contatos', unit: 'V' },
      closed: { label: 'Fechada' },
    },
  },
  create({ params, pins: [a, b] }) {
    const g = () => 1 / (bool(params, 'closed') ? R_CLOSED : R_OPEN);
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
        out('closed', bool(params, 'closed'));
      },
    };
  },
});
