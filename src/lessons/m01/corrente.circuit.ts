import { defineCircuit } from '../../engine';

/**
 * Lesson 1.2 (electric current): a 12 V battery, a switch and a 12 V / 6 W
 * lamp, the kind of lamp used in cars and in 12 V gate accessories. Three
 * ammeters in different points of the loop (wires cannot carry a probe) show
 * the same current, about
 * 0,5 A, the value used in the worked example of the lesson.
 */
export default defineCircuit({
  id: 'm01/corrente',
  title: 'Bateria, chave e lâmpada de 12 V',
  description:
    'Uma bateria de 12 V ligada a uma lâmpada de 12 V e 6 W por uma chave liga/desliga. Três amperímetros medem a corrente em pontos diferentes do caminho: na chave, na lâmpada e dentro da própria bateria. Feche a chave para acender a lâmpada.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'B1',
      type: 'battery',
      a: [0, 10],
      b: [0, 20],
      label: 'Bateria',
      params: { voltage: 12, resistance: 0.05 },
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
      id: 'W2',
      type: 'wire',
      points: [
        [20, 0],
        [30, 0],
      ],
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [30, 0],
      b: [30, 20],
      label: 'Lâmpada 12 V',
      params: { voltage: 12, power: 6 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [30, 20],
        [0, 20],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 20] },
  ],
  probes: [
    { id: 'chave', kind: 'current', element: 'S1', label: 'Corrente na chave' },
    { id: 'lampada', kind: 'current', element: 'L1', label: 'Corrente na lâmpada' },
    { id: 'bateria', kind: 'current', element: 'B1', label: 'Corrente na bateria' },
  ],
  goals: [
    {
      id: 'acender',
      description: 'Feche a chave e acenda a lâmpada',
      check: { readout: 'L1.brightness', op: '>', value: 0.95 },
      solution: { 'S1.closed': true },
    },
    {
      id: 'meio-ampere',
      description: 'Com a chave fechada, a lâmpada recebe cerca de 0,5 A',
      check: { readout: 'L1.current', op: 'between', value: [0.49, 0.51] },
      solution: { 'S1.closed': true },
    },
    {
      id: 'mesma-corrente',
      description: 'A corrente que atravessa a bateria é a mesma que passa pela chave',
      check: { readout: 'B1.current', op: 'between', value: [0.49, 0.51] },
      solution: { 'S1.closed': true },
    },
  ],
});
