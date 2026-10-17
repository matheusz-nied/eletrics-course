import { defineDevice, num } from '../device';

/** Ideal DC current source: pushes `current` out of pin a into the circuit (back in at b). */
export default defineDevice({
  info: {
    type: 'dc-current',
    label: 'Fonte de corrente contínua',
    terminals: 'two',
    pins: [
      { name: 'a', offset: [0, 0], label: 'saída da corrente (seta)' },
      { name: 'b', offset: [0, 0], label: 'retorno' },
    ],
    params: {
      current: { default: 0.01, label: 'Corrente', unit: 'A' },
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
  create({ params, pins: [a, b] }) {
    return {
      stamp(m) {
        m.current(b, a, num(params, 'current'));
      },
      pinCurrents(_x, out) {
        out[0] = -num(params, 'current');
        out[1] = num(params, 'current');
      },
    };
  },
});
