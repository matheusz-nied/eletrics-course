import { defineCircuit } from '../../engine';

/** 02.3: three resistors in parallel; the currents add up, Req is below the smallest one. */
export default defineCircuit({
  id: 'm02/paralelo-resistores',
  title: 'Três resistores em paralelo',
  description:
    'Uma fonte de 12 V alimenta três resistores em paralelo: 1 kΩ, 2,2 kΩ e 4,7 kΩ. Cada um recebe os 12 V da fonte. As correntes são cerca de 12 mA, 5,45 mA e 2,55 mA, e a corrente total, a soma delas, fica em 20 mA. A resistência equivalente é de cerca de 600 Ω. O controle muda o valor de R3.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'E1', type: 'dc-voltage', a: [0, 0], b: [0, 12], params: { voltage: 12 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [10, 0],
        [20, 0],
        [30, 0],
      ],
    },
    { id: 'R1', type: 'resistor', a: [10, 0], b: [10, 12], params: { resistance: 1000 } },
    { id: 'R2', type: 'resistor', a: [20, 0], b: [20, 12], params: { resistance: 2200 } },
    {
      id: 'R3',
      type: 'resistor',
      a: [30, 0],
      b: [30, 12],
      params: { resistance: 4700 },
      control: {
        param: 'resistance',
        label: 'Resistência de R3',
        kind: 'slider',
        min: 100,
        max: 10000,
        log: true,
        unit: 'Ω',
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [30, 12],
        [20, 12],
        [10, 12],
        [0, 12],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 12] },
  ],
  probes: [
    { id: 'IT', kind: 'current', element: 'E1', label: 'Corrente total (da fonte)' },
    { id: 'I1', kind: 'current', element: 'R1', label: 'Corrente em R1' },
    { id: 'I2', kind: 'current', element: 'R2', label: 'Corrente em R2' },
    { id: 'I3', kind: 'current', element: 'R3', label: 'Corrente em R3' },
  ],
  goals: [
    {
      id: 'total',
      description: 'Confira: a corrente total é a soma dos três ramos, cerca de 20 mA.',
      check: { readout: 'IT', op: 'between', value: [0.0199, 0.0201] },
    },
    {
      id: 'ramo-r2',
      description: 'R2 recebe os 12 V inteiros da fonte e conduz cerca de 5,45 mA.',
      check: { readout: 'I2', op: 'between', value: [0.0054, 0.0055] },
    },
    {
      id: 'vinte-e-cinco',
      description: 'Ajuste R3 para a corrente total chegar a 25 mA.',
      check: { readout: 'IT', op: 'between', value: [0.0248, 0.0252] },
      solution: { 'R3.resistance': 1600 },
    },
  ],
});
