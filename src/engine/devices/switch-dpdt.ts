import { bool, defineDevice } from '../device';
import { R_CLOSED, R_OPEN } from '../models/constants';

/**
 * Two-pole changeover switch (DPDT, "chave reversora de dois polos"): two
 * SPDT contacts moved together. At rest each common touches its NF contact
 * (nc1, nc2); actuated, its NA contact (no1, no2). It switches the phase and
 * the neutral of a load at once, so a lesson can move an appliance from one
 * circuit to another (with and without a DR, for example).
 */
export default defineDevice({
  info: {
    type: 'switch-dpdt',
    label: 'Chave de dois polos e duas posições (DPDT)',
    terminals: 'fixed',
    pins: [
      { name: 'com1', offset: [-3, -3], label: 'comum do polo 1' },
      { name: 'nc1', offset: [3, -5], label: 'polo 1, normalmente fechado (NF)' },
      { name: 'no1', offset: [3, -1], label: 'polo 1, normalmente aberto (NA)' },
      { name: 'com2', offset: [-3, 3], label: 'comum do polo 2' },
      { name: 'nc2', offset: [3, 1], label: 'polo 2, normalmente fechado (NF)' },
      { name: 'no2', offset: [3, 5], label: 'polo 2, normalmente aberto (NA)' },
    ],
    params: {
      actuated: { default: false, label: 'Acionada (comuns no NA)' },
    },
    readouts: ['actuated'],
    readoutInfo: { actuated: { label: 'Acionada' } },
  },
  create({ params, pins: [com1, nc1, no1, com2, nc2, no2] }) {
    const gNc = () => 1 / (bool(params, 'actuated') ? R_OPEN : R_CLOSED);
    const gNo = () => 1 / (bool(params, 'actuated') ? R_CLOSED : R_OPEN);
    return {
      stamp(m) {
        m.conductance(com1, nc1, gNc());
        m.conductance(com1, no1, gNo());
        m.conductance(com2, nc2, gNc());
        m.conductance(com2, no2, gNo());
      },
      stampAc(m) {
        m.admittance(com1, nc1, gNc());
        m.admittance(com1, no1, gNo());
        m.admittance(com2, nc2, gNc());
        m.admittance(com2, no2, gNo());
      },
      pinCurrents(x, out) {
        const pole = (com: number, nc: number, no: number, k: number) => {
          const iNc = gNc() * (x.v(com) - x.v(nc));
          const iNo = gNo() * (x.v(com) - x.v(no));
          out[k] = iNc + iNo;
          out[k + 1] = -iNc;
          out[k + 2] = -iNo;
        };
        pole(com1, nc1, no1, 0);
        pole(com2, nc2, no2, 3);
      },
      readouts(_x, out) {
        out('actuated', bool(params, 'actuated'));
      },
    };
  },
});
