import { defineDevice } from '../device';

/**
 * Ideal wire, a polyline in `points` (or `a`→`b`). It joins nodes in the
 * netlist and never enters the matrix. Readouts `current.k` give the current
 * in segment k, from points[k] to points[k+1]; `current` is segment 0.
 */
export default defineDevice({
  info: {
    type: 'wire',
    label: 'Fio',
    terminals: 'two',
    pins: [
      { name: 'a', offset: [0, 0], label: 'ponta inicial' },
      { name: 'b', offset: [0, 0], label: 'ponta final' },
    ],
    params: {},
    readouts: ['current'],
    readoutInfo: { current: { label: 'Corrente no fio', unit: 'A' } },
  },
  create: () => ({ stamp() {}, pinCurrents() {} }),
});
