import { defineCircuit } from '../../engine';

/**
 * 04.4: the static charge curve of the lesson's figure: 10 V through
 * 10 kΩ into 100 µF (τ = 1 s), starting empty at t = 0.
 */
export default defineCircuit({
  id: 'm04/rc-curva',
  title: 'Curva de carga de um circuito RC',
  description:
    'Uma fonte de 10 V carrega um capacitor de 100 µF, inicialmente vazio, por um resistor de 10 kΩ. A constante de tempo é de 1 s: a tensão no capacitor sobe rápido no começo e cada vez mais devagar, passando por 6,3 V em 1 s, 8,6 V em 2 s e 9,5 V em 3 s. A corrente começa em 1 mA e cai na mesma proporção.',
  analysis: { kind: 'transient', dt: 0.001, tStop: 5 },
  elements: [
    { id: 'V1', type: 'dc-voltage', a: [0, 0], b: [0, 12], params: { voltage: 10 } },
    { id: 'R1', type: 'resistor', a: [0, 0], b: [12, 0], params: { resistance: 10000 } },
    {
      id: 'C1',
      type: 'capacitor',
      a: [12, 0],
      b: [12, 12],
      params: { capacitance: 0.0001, voltage: 25, polarized: true },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [12, 12],
        [0, 12],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 12] },
  ],
  probes: [
    { id: 'VC', kind: 'voltage', plus: 'C1.a', minus: 'GND', label: 'Tensão no capacitor' },
    { id: 'IR', kind: 'current', element: 'R1', label: 'Corrente' },
  ],
  goals: [
    {
      id: 'dois-tau',
      description: 'Em 2 s (duas constantes de tempo), 8,6 V.',
      check: { readout: 'VC', op: 'between', value: [8.6, 8.7] },
      at: 2,
    },
    {
      id: 'tres-tau',
      description: 'Em 3 s, 9,5 V.',
      check: { readout: 'VC', op: 'between', value: [9.48, 9.55] },
      at: 3,
    },
  ],
});
