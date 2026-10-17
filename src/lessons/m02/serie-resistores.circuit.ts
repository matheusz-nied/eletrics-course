import { defineCircuit } from '../../engine';

/** 02.2: three resistors in series; the voltages add up to the source voltage. */
export default defineCircuit({
  id: 'm02/serie-resistores',
  title: 'Três resistores em série',
  description:
    'Uma fonte de 12 V alimenta três resistores em série: 1 kΩ, 2,2 kΩ e 4,7 kΩ. A resistência equivalente é 7,9 kΩ e a corrente, igual nos três, é de cerca de 1,52 mA. As tensões nos resistores somam 12 V. O controle muda o valor de R2.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'E1', type: 'dc-voltage', a: [0, 0], b: [0, 12], params: { voltage: 12 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [4, 0],
      ],
    },
    { id: 'R1', type: 'resistor', a: [4, 0], b: [10, 0], params: { resistance: 1000 } },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [10, 0],
        [14, 0],
      ],
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [14, 0],
      b: [20, 0],
      params: { resistance: 2200 },
      control: {
        param: 'resistance',
        label: 'Resistência de R2',
        kind: 'slider',
        min: 100,
        max: 10000,
        log: true,
        unit: 'Ω',
      },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [20, 0],
        [26, 0],
      ],
    },
    { id: 'R3', type: 'resistor', a: [26, 0], b: [26, 12], params: { resistance: 4700 } },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [26, 12],
        [0, 12],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 12] },
  ],
  probes: [
    { id: 'I', kind: 'current', element: 'R1', label: 'Corrente no circuito' },
    { id: 'V1', kind: 'voltage', plus: 'R1.a', minus: 'R1.b', label: 'Tensão em R1' },
    { id: 'V2', kind: 'voltage', plus: 'R2.a', minus: 'R2.b', label: 'Tensão em R2' },
    { id: 'V3', kind: 'voltage', plus: 'R3.a', minus: 'R3.b', label: 'Tensão em R3' },
  ],
  goals: [
    {
      id: 'corrente',
      description: 'Confira: com 7,9 kΩ no total, a corrente fica em cerca de 1,52 mA.',
      check: { readout: 'I', op: 'between', value: [0.00151, 0.00153] },
    },
    {
      id: 'maior-tensao',
      description: 'O maior resistor, R3, fica com a maior parte da tensão: cerca de 7,14 V.',
      check: { readout: 'V3', op: 'between', value: [7.1, 7.18] },
    },
    {
      id: 'dois-ma',
      description: 'Ajuste R2 para a corrente do circuito chegar a 2 mA.',
      check: { readout: 'I', op: 'between', value: [0.00198, 0.00202] },
      solution: { 'R2.resistance': 300 },
    },
  ],
});
