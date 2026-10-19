import { bool, defineDevice } from '../device';
import { R_CLOSED, R_OPEN } from '../models/constants';

/**
 * Intermediate switch ("interruptor intermediário", four-way): a crossover
 * DPDT placed between the two travelers of a pair of three-way switches. At
 * rest it connects straight (a1–b1, a2–b2); actuated, it crosses the
 * travelers (a1–b2, a2–b1). Each flip of the lever swaps the travelers, so
 * any of the switches on the run changes the lamp. Drawn with the a pins on
 * the left and the b pins on the right.
 */
export default defineDevice({
  info: {
    type: 'switch-intermediate',
    label: 'Interruptor intermediário (four-way)',
    terminals: 'fixed',
    pins: [
      { name: 'a1', offset: [-3, -2], label: 'entrada 1' },
      { name: 'a2', offset: [-3, 2], label: 'entrada 2' },
      { name: 'b1', offset: [3, -2], label: 'saída 1' },
      { name: 'b2', offset: [3, 2], label: 'saída 2' },
    ],
    params: {
      actuated: { default: false, label: 'Acionado (viajantes cruzados)' },
    },
    readouts: ['actuated'],
    readoutInfo: { actuated: { label: 'Acionado (cruzado)' } },
  },
  create({ params, pins: [a1, a2, b1, b2] }) {
    const gStraight = () => 1 / (bool(params, 'actuated') ? R_OPEN : R_CLOSED);
    const gCrossed = () => 1 / (bool(params, 'actuated') ? R_CLOSED : R_OPEN);
    return {
      stamp(m) {
        m.conductance(a1, b1, gStraight());
        m.conductance(a2, b2, gStraight());
        m.conductance(a1, b2, gCrossed());
        m.conductance(a2, b1, gCrossed());
      },
      stampAc(m) {
        m.admittance(a1, b1, gStraight());
        m.admittance(a2, b2, gStraight());
        m.admittance(a1, b2, gCrossed());
        m.admittance(a2, b1, gCrossed());
      },
      pinCurrents(x, out) {
        const i11 = gStraight() * (x.v(a1) - x.v(b1));
        const i22 = gStraight() * (x.v(a2) - x.v(b2));
        const i12 = gCrossed() * (x.v(a1) - x.v(b2));
        const i21 = gCrossed() * (x.v(a2) - x.v(b1));
        out[0] = i11 + i12;
        out[1] = i22 + i21;
        out[2] = -i11 - i21;
        out[3] = -i22 - i12;
      },
      readouts(_x, out) {
        out('actuated', bool(params, 'actuated'));
      },
    };
  },
});
