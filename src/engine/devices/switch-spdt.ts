import { bool, defineDevice } from '../device';
import { R_CLOSED, R_OPEN } from '../models/constants';

/**
 * Changeover switch (SPDT, "chave de duas posições"): at rest the common
 * contact touches NF (nc); actuated, it touches NA (no). Drawn with the common
 * on the left and the two contacts on the right.
 */
export default defineDevice({
  info: {
    type: 'switch-spdt',
    label: 'Chave de duas posições (SPDT)',
    terminals: 'fixed',
    pins: [
      { name: 'com', offset: [-3, 0], label: 'comum (C)' },
      { name: 'nc', offset: [3, -2], label: 'normalmente fechado (NF)' },
      { name: 'no', offset: [3, 2], label: 'normalmente aberto (NA)' },
    ],
    params: {
      actuated: { default: false, label: 'Acionada (comum no NA)' },
    },
    readouts: ['actuated'],
    readoutInfo: { actuated: { label: 'Acionada' } },
  },
  create({ params, pins: [com, nc, no] }) {
    const gNc = () => 1 / (bool(params, 'actuated') ? R_OPEN : R_CLOSED);
    const gNo = () => 1 / (bool(params, 'actuated') ? R_CLOSED : R_OPEN);
    return {
      stamp(m) {
        m.conductance(com, nc, gNc());
        m.conductance(com, no, gNo());
      },
      stampAc(m) {
        m.admittance(com, nc, gNc());
        m.admittance(com, no, gNo());
      },
      pinCurrents(x, out) {
        const iNc = gNc() * (x.v(com) - x.v(nc));
        const iNo = gNo() * (x.v(com) - x.v(no));
        out[0] = iNc + iNo;
        out[1] = -iNc;
        out[2] = -iNo;
      },
      readouts(_x, out) {
        out('actuated', bool(params, 'actuated'));
      },
    };
  },
});
