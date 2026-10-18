import { defineCircuit } from '../../engine';

/** 03.6: the divider built on the breadboard, measured; one switch reproduces the "same column" mistake. */
export default defineCircuit({
  id: 'm03/montagem-divisor',
  title: 'Divisor montado na protoboard',
  description:
    'A fonte de bancada, ajustada em 9 V, alimenta um resistor de 1 kΩ em série com um de 2,2 kΩ. A corrente é de cerca de 2,81 mA e o resistor de 2,2 kΩ fica com cerca de 6,19 V. Uma chave simula o erro de encaixar o resistor de 2,2 kΩ com as duas pernas na mesma coluna: ele fica em curto, a tensão nele vai a zero e a corrente sobe para 9 mA.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 16],
      label: 'Fonte 9 V',
      params: { voltage: 9 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [14, 0],
      ],
    },
    { id: 'R1', type: 'resistor', a: [14, 0], b: [14, 8], params: { resistance: 1000 } },
    { id: 'R2', type: 'resistor', a: [14, 8], b: [14, 16], params: { resistance: 2200 } },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [14, 8],
        [24, 8],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [24, 8],
      b: [24, 16],
      label: 'Mesma coluna',
      params: { closed: false },
      control: {
        param: 'closed',
        label: 'Encaixar R2 com as duas pernas na mesma coluna',
        kind: 'toggle',
      },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [24, 16],
        [14, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
  ],
  probes: [
    { id: 'VR2', kind: 'voltage', plus: 'R2.a', minus: 'R2.b', label: 'Tensão em R2' },
    { id: 'I', kind: 'current', element: 'R1', label: 'Corrente do circuito' },
  ],
  goals: [
    {
      id: 'tensao-r2',
      description: 'Montado certo, R2 fica com cerca de 6,19 V.',
      check: { readout: 'VR2', op: 'between', value: [6.17, 6.2] },
    },
    {
      id: 'corrente',
      description: 'A corrente é de cerca de 2,81 mA.',
      check: { readout: 'I', op: 'between', value: [0.0028, 0.00282] },
    },
    {
      id: 'mesma-coluna',
      description: 'Com R2 na mesma coluna, a tensão nele vai a zero…',
      check: { readout: 'VR2', op: '<', value: 0.01 },
      solution: { 'S1.closed': true },
    },
    {
      id: 'corrente-sobe',
      description: '…e a corrente sobe para 9 mA.',
      check: { readout: 'I', op: 'between', value: [0.00899, 0.00901] },
      solution: { 'S1.closed': true },
    },
  ],
});
