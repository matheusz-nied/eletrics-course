import { defineCircuit } from '../../engine';

/** 02.8: the Norton equivalent of the same network: 3,6 mA in parallel with 2 kΩ. */
export default defineCircuit({
  id: 'm02/norton',
  title: 'Equivalente de Norton',
  description:
    'Uma fonte de corrente de 3,6 mA em paralelo com um resistor de 2 kΩ alimenta a carga RL. É o equivalente de Norton do mesmo circuito da simulação anterior: com qualquer carga, dá a mesma tensão e a mesma corrente que o equivalente de Thévenin de 7,2 V com 2 kΩ.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'IN', type: 'dc-current', a: [0, 0], b: [0, 14], params: { current: 0.0036 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [10, 0],
      ],
    },
    { id: 'RN', type: 'resistor', a: [10, 0], b: [10, 14], params: { resistance: 2000 } },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [10, 0],
        [20, 0],
      ],
    },
    {
      id: 'RL',
      type: 'resistor',
      a: [20, 0],
      b: [20, 14],
      params: { resistance: 1000 },
      control: {
        param: 'resistance',
        label: 'Carga RL',
        kind: 'slider',
        min: 100,
        max: 1000000,
        log: true,
        unit: 'Ω',
      },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [20, 14],
        [10, 14],
        [0, 14],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 14] },
  ],
  probes: [
    { id: 'VL', kind: 'voltage', plus: 'RL.a', minus: 'RL.b', label: 'Tensão na carga' },
    { id: 'IL', kind: 'current', element: 'RL', label: 'Corrente na carga' },
    { id: 'IRN', kind: 'current', element: 'RN', label: 'Corrente no resistor de Norton' },
  ],
  goals: [
    {
      id: 'mesma-corrente',
      description: 'Com 1 kΩ, a carga recebe 2,4 mA, igual ao circuito original.',
      check: { readout: 'IL', op: 'between', value: [0.00239, 0.00241] },
    },
    {
      id: 'divisao',
      description: 'Com 1 kΩ, os 3,6 mA se dividem: 1,2 mA vão pelo resistor de Norton.',
      check: { readout: 'IRN', op: 'between', value: [0.00119, 0.00121] },
    },
    {
      id: 'quase-curto',
      description:
        'Leve RL ao mínimo (100 Ω): quase toda a corrente da fonte, cerca de 3,4 mA, passa pela carga.',
      check: { readout: 'IL', op: 'between', value: [0.0034, 0.0035] },
      solution: { 'RL.resistance': 100 },
    },
  ],
});
