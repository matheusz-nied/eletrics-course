import { defineCircuit } from '../../engine';

/** 02.3: car lamps in parallel behind one fuse; too many on at once blows it. */
export default defineCircuit({
  id: 'm02/paralelo-lampadas',
  title: 'Lâmpadas em paralelo com fusível',
  description:
    'Uma bateria de 12 V alimenta, através de um fusível retardado de 2 A, três lâmpadas de carro ligadas em paralelo, cada uma com a sua chave: L1 de 5 W, L2 de 21 W e L3 de 21 W. Todas recebem os mesmos 12 V e a corrente no fusível é a soma das correntes das lâmpadas ligadas. Com as três acesas, a corrente chega a cerca de 3,9 A, quase o dobro do fusível, e ele rompe depois de alguns segundos.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'B1', type: 'battery', a: [0, 0], b: [0, 16], params: { voltage: 12, resistance: 0.02 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [4, 0],
      ],
    },
    { id: 'F1', type: 'fuse', a: [4, 0], b: [10, 0], params: { rating: 2, kind: 'slow' } },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [10, 0],
        [16, 0],
        [26, 0],
        [36, 0],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [16, 0],
      b: [16, 6],
      params: { closed: true },
      control: { param: 'closed', label: 'Chave de L1 (5 W)', kind: 'toggle' },
    },
    { id: 'L1', type: 'lamp', a: [16, 6], b: [16, 16], params: { voltage: 12, power: 5 } },
    {
      id: 'S2',
      type: 'switch',
      a: [26, 0],
      b: [26, 6],
      params: { closed: true },
      control: { param: 'closed', label: 'Chave de L2 (21 W)', kind: 'toggle' },
    },
    { id: 'L2', type: 'lamp', a: [26, 6], b: [26, 16], params: { voltage: 12, power: 21 } },
    {
      id: 'S3',
      type: 'switch',
      a: [36, 0],
      b: [36, 6],
      params: { closed: false },
      control: { param: 'closed', label: 'Chave de L3 (21 W)', kind: 'toggle' },
    },
    { id: 'L3', type: 'lamp', a: [36, 6], b: [36, 16], params: { voltage: 12, power: 21 } },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [36, 16],
        [26, 16],
        [16, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
  ],
  probes: [
    { id: 'IT', kind: 'current', element: 'F1', label: 'Corrente no fusível (total)' },
    { id: 'I1', kind: 'current', element: 'L1', label: 'Corrente em L1' },
    { id: 'I2', kind: 'current', element: 'L2', label: 'Corrente em L2' },
    { id: 'I3', kind: 'current', element: 'L3', label: 'Corrente em L3' },
  ],
  goals: [
    {
      id: 'mesma-tensao',
      description:
        'Repare: L1 e L2 recebem a mesma tensão, quase 12 V, mesmo tendo potências diferentes.',
      check: { readout: 'L1.voltage', op: 'between', value: [11.7, 12] },
    },
    {
      id: 'soma',
      description: 'Com L1 e L2 acesas, a corrente no fusível é a soma das duas: cerca de 2,15 A.',
      check: { readout: 'IT', op: 'between', value: [2.1, 2.2] },
    },
    {
      id: 'sobrecarga',
      description: 'Acenda também L3 e espere alguns segundos.',
      check: { readout: 'F1.blown', op: '==', value: true },
      solution: { 'S3.closed': true },
      at: 10,
    },
  ],
});
