import { defineCircuit } from '../engine';

/** LED with a series resistor: too little resistance burns it. */
export default defineCircuit({
  id: 'demo/led-resistor',
  title: 'LED com resistor em série',
  description:
    'Uma bateria de 9 V acende um LED vermelho através de um resistor ajustável. Com resistência baixa demais, a corrente passa do máximo do LED e ele queima.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'B1', type: 'battery', a: [0, 0], b: [0, 10], params: { voltage: 9 } },
    {
      id: 'R1',
      type: 'resistor',
      a: [0, 0],
      b: [10, 0],
      params: { resistance: 1000 },
      control: {
        param: 'resistance',
        label: 'Resistor R1',
        kind: 'slider',
        min: 10,
        max: 10000,
        log: true,
        unit: 'Ω',
      },
    },
    { id: 'D1', type: 'led', a: [10, 0], b: [10, 10], params: { color: 'red' } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [10, 10],
        [0, 10],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 10] },
  ],
  probes: [
    { id: 'ID', kind: 'current', element: 'D1', label: 'Corrente no LED' },
    { id: 'VD', kind: 'voltage', plus: 'D1.a', minus: 'D1.b', label: 'Tensão no LED' },
  ],
  goals: [
    {
      id: 'corrente',
      description: 'Ajuste R1 para o LED trabalhar entre 10 mA e 20 mA.',
      check: { readout: 'D1.current', op: 'between', value: [0.01, 0.02] },
      solution: { 'R1.resistance': 470 },
    },
  ],
});
