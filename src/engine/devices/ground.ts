import { defineDevice } from '../device';

/** Ground symbol: its pin is the reference node "GND". Handled by the netlist. */
export default defineDevice({
  info: {
    type: 'ground',
    label: 'Terra (referência)',
    terminals: 'fixed',
    pins: [{ name: 'g', offset: [0, 0], label: 'referência (0 V)' }],
    params: {},
    readouts: [],
  },
  create: () => ({ stamp() {}, stampAc() {}, pinCurrents() {} }),
});
