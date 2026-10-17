import { defineCircuit } from '../../engine';

/** 02.1: the four parts of a circuit (source, conductor, switch, load) and the open circuit. */
export default defineCircuit({
  id: 'm02/circuito-basico',
  title: 'Fonte, chave, carga e condutores',
  description:
    'Uma bateria de 12 V, uma chave liga/desliga e uma lâmpada de 12 V e 5 W ligadas por fios num único caminho fechado. Com a chave aberta não há corrente e a tensão inteira da bateria aparece entre os contatos da chave; com a chave fechada a lâmpada acende com cerca de 0,42 A.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'B1', type: 'battery', a: [0, 0], b: [0, 12], params: { voltage: 12, resistance: 0.05 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [8, 0],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [8, 0],
      b: [14, 0],
      params: { closed: false },
      control: { param: 'closed', label: 'Chave S1', kind: 'toggle' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [14, 0],
        [24, 0],
      ],
    },
    { id: 'L1', type: 'lamp', a: [24, 0], b: [24, 12], params: { voltage: 12, power: 5 } },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [24, 12],
        [0, 12],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 12] },
  ],
  probes: [
    {
      id: 'VS',
      kind: 'voltage',
      plus: 'S1.a',
      minus: 'S1.b',
      label: 'Tensão entre os contatos da chave',
    },
    { id: 'VL', kind: 'voltage', plus: 'L1.a', minus: 'L1.b', label: 'Tensão na lâmpada' },
    { id: 'IL', kind: 'current', element: 'L1', label: 'Corrente no circuito' },
  ],
  goals: [
    {
      id: 'chave-aberta',
      description:
        'Com a chave aberta, a tensão inteira da bateria aparece entre os contatos da chave.',
      check: { readout: 'VS', op: 'between', value: [11.9, 12.1] },
    },
    {
      id: 'acender',
      description: 'Feche a chave para acender a lâmpada.',
      check: { readout: 'L1.brightness', op: '>', value: 0.95 },
      solution: { 'S1.closed': true },
    },
    {
      id: 'corrente',
      description: 'Com a chave fechada, a corrente fica perto de 0,42 A (5 W ÷ 12 V).',
      check: { readout: 'IL', op: 'between', value: [0.4, 0.43] },
      solution: { 'S1.closed': true },
    },
  ],
});
