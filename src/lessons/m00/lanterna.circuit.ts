import { defineCircuit } from '../../engine';

/**
 * Lesson 0.1 (how to use the course): a flashlight with two AA cells, a switch
 * and a 3 V bulb. The cell selector lets the student burn the bulb on purpose
 * and use "Reiniciar". At 6 V the filament passes 3.300 K and opens.
 */
export default defineCircuit({
  id: 'm00/lanterna',
  title: 'Lanterna: pilhas, chave e lâmpada',
  description:
    'Uma lanterna simples: duas pilhas AA em série (3 V) ligadas a uma lâmpada de 3 V por uma chave liga/desliga. Feche a chave para acender a lâmpada e troque o número de pilhas para ver o brilho mudar.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'B1',
      type: 'battery',
      a: [0, 10],
      b: [0, 20],
      label: 'Pilhas',
      params: { voltage: 3, resistance: 0.3 },
      control: {
        param: 'voltage',
        label: 'Pilhas em série',
        kind: 'select',
        options: [
          { value: 1.5, label: '1 pilha (1,5 V)' },
          { value: 3, label: '2 pilhas (3 V)' },
          { value: 4.5, label: '3 pilhas (4,5 V)' },
          { value: 6, label: '4 pilhas (6 V)' },
        ],
      },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 10],
        [0, 0],
        [10, 0],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [10, 0],
      b: [20, 0],
      label: 'Chave',
      control: { param: 'closed', label: 'Chave liga/desliga', kind: 'toggle' },
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [20, 0],
      b: [20, 20],
      label: 'Lâmpada 3 V',
      params: { voltage: 3, power: 0.6 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [20, 20],
        [0, 20],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 20] },
  ],
  probes: [
    { id: 'corrente', kind: 'current', element: 'L1', label: 'Corrente na lâmpada' },
    { id: 'tensao', kind: 'voltage', plus: 'L1.a', minus: 'L1.b', label: 'Tensão na lâmpada' },
  ],
  goals: [
    {
      id: 'acender',
      description: 'Feche a chave e acenda a lâmpada',
      check: { readout: 'L1.brightness', op: '>', value: 0.8 },
      solution: { 'S1.closed': true },
    },
    {
      id: 'queimar',
      description: 'Descubra com quantas pilhas a lâmpada queima',
      check: { readout: 'L1.burned', op: '==', value: true },
      solution: { 'S1.closed': true, 'B1.voltage': 6 },
    },
  ],
});
