import { bool, defineDevice, TWO_PINS } from '../device';
import { R_CLOSED, R_OPEN } from '../models/constants';

/** Momentary push button, normally open (NA) or normally closed (NF). */
export default defineDevice({
  info: {
    type: 'push-button',
    label: 'Botão pulsador',
    terminals: 'two',
    pins: TWO_PINS,
    params: {
      pressed: { default: false, label: 'Apertado' },
      normallyClosed: { default: false, label: 'Normalmente fechado (NF)' },
    },
    readouts: ['current', 'voltage', 'pressed', 'closed'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão entre os contatos', unit: 'V' },
      pressed: { label: 'Apertado' },
      closed: { label: 'Contato fechado' },
    },
  },
  create({ params, pins: [a, b] }) {
    const closed = () => bool(params, 'pressed') !== bool(params, 'normallyClosed');
    const g = () => 1 / (closed() ? R_CLOSED : R_OPEN);
    return {
      stamp(m) {
        m.conductance(a, b, g());
      },
      pinCurrents(x, out) {
        out[0] = g() * (x.v(a) - x.v(b));
        out[1] = -out[0];
      },
      readouts(_x, out) {
        out('pressed', bool(params, 'pressed'));
        out('closed', closed());
      },
    };
  },
});
