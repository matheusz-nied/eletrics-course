import { defineCircuit } from '../../engine';

/** 03.1: the 10 MΩ input of a multimeter loads a high-resistance divider. */
export default defineCircuit({
  id: 'm03/carga-voltimetro',
  title: 'O voltímetro também é um resistor',
  description:
    'Uma fonte de 10 V alimenta dois resistores de 1 MΩ em série. Sozinho, o ponto do meio fica em 5 V. Quando o multímetro encosta no resistor de baixo, a resistência de entrada dele, de 10 MΩ, fica em paralelo com esse resistor e a tensão medida cai para cerca de 4,76 V.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'V1', type: 'dc-voltage', a: [0, 0], b: [0, 16], params: { voltage: 10 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [14, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [14, 0],
      b: [14, 8],
      params: { resistance: 1e6 },
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [14, 8],
      b: [14, 16],
      params: { resistance: 1e6 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [14, 8],
        [22, 8],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [22, 8],
      b: [28, 8],
      label: 'Pontas',
      params: { closed: false },
      control: { param: 'closed', label: 'Encostar o multímetro', kind: 'toggle' },
    },
    {
      id: 'RM',
      type: 'resistor',
      a: [28, 8],
      b: [28, 16],
      label: 'Multímetro',
      params: { resistance: 1e7 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [28, 16],
        [14, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
  ],
  probes: [
    { id: 'VM', kind: 'voltage', plus: 'R2.a', minus: 'R2.b', label: 'Tensão no ponto do meio' },
    { id: 'IM', kind: 'current', element: 'RM', label: 'Corrente que o multímetro desvia' },
  ],
  goals: [
    {
      id: 'sem-medidor',
      description: 'Sem o multímetro, o ponto do meio fica em 5 V.',
      check: { readout: 'VM', op: 'between', value: [4.99, 5.01] },
    },
    {
      id: 'com-medidor',
      description: 'Encoste o multímetro e veja a tensão cair para cerca de 4,76 V.',
      check: { readout: 'VM', op: 'between', value: [4.75, 4.77] },
      solution: { 'S1.closed': true },
    },
  ],
});
