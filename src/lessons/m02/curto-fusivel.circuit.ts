import { defineCircuit } from '../../engine';

/** 02.1: a short circuit across the lamp blows the fuse in a few milliseconds. */
export default defineCircuit({
  id: 'm02/curto-fusivel',
  title: 'Curto-circuito e fusível',
  description:
    'Uma bateria de 12 V alimenta uma lâmpada de 12 V e 5 W através de um fusível de 2 A e de uma chave. O botão "Curto" representa um fio descascado encostando nos dois lados da lâmpada: a corrente passa de 100 A e o fusível rompe em poucos milissegundos, apagando o circuito.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'B1', type: 'battery', a: [0, 0], b: [0, 14], params: { voltage: 12, resistance: 0.02 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [4, 0],
      ],
    },
    { id: 'F1', type: 'fuse', a: [4, 0], b: [10, 0], params: { rating: 2, kind: 'fast' } },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [10, 0],
        [12, 0],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [12, 0],
      b: [18, 0],
      params: { closed: true },
      control: { param: 'closed', label: 'Chave S1', kind: 'toggle' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [18, 0],
        [24, 0],
      ],
    },
    { id: 'L1', type: 'lamp', a: [24, 0], b: [24, 14], params: { voltage: 12, power: 5 } },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [24, 0],
        [34, 0],
      ],
    },
    {
      id: 'X1',
      type: 'push-button',
      a: [34, 0],
      b: [34, 14],
      label: 'Curto',
      control: { param: 'pressed', label: 'Encostar o fio (curto)', kind: 'momentary' },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [34, 14],
        [24, 14],
        [0, 14],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 14] },
  ],
  probes: [
    { id: 'IF', kind: 'current', element: 'F1', label: 'Corrente no fusível' },
    { id: 'VL', kind: 'voltage', plus: 'L1.a', minus: 'L1.b', label: 'Tensão na lâmpada' },
  ],
  goals: [
    {
      id: 'normal',
      description: 'Sem curto, a lâmpada acende e o fusível conduz cerca de 0,42 A.',
      check: { readout: 'IF', op: 'between', value: [0.4, 0.43] },
    },
    {
      id: 'rompe',
      description: 'Provoque o curto e veja o fusível romper.',
      check: { readout: 'F1.blown', op: '==', value: true },
      solution: { 'X1.pressed': true },
    },
    {
      id: 'apaga',
      description: 'Depois que o fusível rompe, a lâmpada fica apagada mesmo sem o curto.',
      check: { readout: 'L1.brightness', op: '<', value: 0.01 },
      solution: { 'X1.pressed': true },
    },
  ],
});
