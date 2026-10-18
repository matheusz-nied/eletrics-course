import { defineCircuit } from '../engine';

/** A limit switch (changeover, held by hand) moves the current from one LED to the other. */
export default defineCircuit({
  id: 'demo/fim-de-curso',
  title: 'Chave fim de curso',
  description:
    'Uma bateria de 12 V alimenta o comum de uma chave fim de curso. Em repouso, o contato NF acende o LED verde. Com a chave acionada, como quando o portão chega ao fim do trilho, o contato NA acende o LED vermelho.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'B1', type: 'battery', a: [0, 0], b: [0, 12], params: { voltage: 12 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [7, 0],
        [7, 6],
      ],
    },
    // com (7,6), nc (13,4), no (13,8)
    {
      id: 'S1',
      type: 'switch-spdt',
      at: [10, 6],
      control: { param: 'actuated', label: 'Chave fim de curso S1', kind: 'momentary' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [13, 4],
        [16, 4],
        [16, 0],
      ],
    },
    { id: 'R1', type: 'resistor', a: [16, 0], b: [22, 0], params: { resistance: 1000 } },
    { id: 'D1', type: 'led', a: [22, 0], b: [28, 0], params: { color: 'green' } },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [13, 8],
        [16, 8],
      ],
    },
    { id: 'R2', type: 'resistor', a: [16, 8], b: [22, 8], params: { resistance: 1000 } },
    { id: 'D2', type: 'led', a: [22, 8], b: [28, 8], params: { color: 'red' } },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [28, 0],
        [30, 0],
        [30, 8],
        [30, 12],
      ],
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [28, 8],
        [30, 8],
      ],
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [0, 12],
        [30, 12],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 12] },
  ],
  probes: [
    { id: 'IV', kind: 'current', element: 'D1', label: 'Corrente no LED verde' },
    { id: 'IR', kind: 'current', element: 'D2', label: 'Corrente no LED vermelho' },
  ],
});
