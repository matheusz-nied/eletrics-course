import { defineCircuit } from '../../engine';

/** 02.1, real case: a 9 V battery shorted by coins in a pocket. */
export default defineCircuit({
  id: 'm02/pilha-moedas',
  title: 'Bateria de 9 V e moedas no bolso',
  description:
    'Uma bateria de 9 V, com resistência interna típica de 1,7 Ω, fica em curto quando moedas encostam nos dois polos ao mesmo tempo. As moedas têm resistência quase nula, então a corrente sobe para mais de 5 A e quase toda a energia vira calor dentro da própria bateria.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'B1', type: 'battery', a: [0, 0], b: [0, 12], params: { voltage: 9, resistance: 1.7 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [10, 0],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [10, 0],
      b: [16, 0],
      label: 'Contato',
      params: { closed: false },
      control: { param: 'closed', label: 'Moedas encostando nos dois polos', kind: 'toggle' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [16, 0],
        [22, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [22, 0],
      b: [22, 12],
      label: 'Moedas',
      params: { resistance: 0.05, watts: 50 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [22, 12],
        [0, 12],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 12] },
  ],
  probes: [
    { id: 'I', kind: 'current', element: 'R1', label: 'Corrente pelas moedas' },
    {
      id: 'VB',
      kind: 'voltage',
      plus: 'B1.a',
      minus: 'B1.b',
      label: 'Tensão nos polos da bateria',
    },
  ],
  goals: [
    {
      id: 'curto',
      description: 'Com as moedas encostadas, a corrente passa de 5 A.',
      check: { readout: 'I', op: 'between', value: [5, 5.2] },
      solution: { 'S1.closed': true },
    },
    {
      id: 'tensao-cai',
      description: 'Em curto, a tensão nos polos cai para menos de 0,3 V.',
      check: { readout: 'VB', op: '<', value: 0.3 },
      solution: { 'S1.closed': true },
    },
  ],
});
