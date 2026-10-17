import { defineCircuit } from '../../engine';

/** 02.2: three lamps in series; removing one (its socket switch) turns all off. */
export default defineCircuit({
  id: 'm02/serie-lampadas',
  title: 'Três lâmpadas em série',
  description:
    'Uma bateria de 12 V acende três lâmpadas de 4 V e 1 W ligadas em série, uma depois da outra. Cada lâmpada recebe 4 V e a mesma corrente de 0,25 A passa por todas. A chave do soquete de L2 permite tirar essa lâmpada: o caminho abre e as três apagam. O controle de L3 troca essa lâmpada por outra de potência diferente.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'B1', type: 'battery', a: [0, 0], b: [0, 14], params: { voltage: 12, resistance: 0.05 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [5, 0],
      ],
    },
    { id: 'L1', type: 'lamp', a: [5, 0], b: [11, 0], params: { voltage: 4, power: 1 } },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [11, 0],
        [15, 0],
      ],
    },
    {
      id: 'S2',
      type: 'switch',
      a: [15, 0],
      b: [20, 0],
      label: 'Soquete de L2',
      params: { closed: true },
      control: { param: 'closed', label: 'Lâmpada L2 no soquete', kind: 'toggle' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [20, 0],
        [23, 0],
      ],
    },
    { id: 'L2', type: 'lamp', a: [23, 0], b: [29, 0], params: { voltage: 4, power: 1 } },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [29, 0],
        [34, 0],
      ],
    },
    {
      id: 'L3',
      type: 'lamp',
      a: [34, 0],
      b: [34, 14],
      params: { voltage: 4, power: 1 },
      control: {
        param: 'power',
        label: 'Potência de L3 (troque a lâmpada)',
        kind: 'slider',
        min: 0.5,
        max: 4,
        step: 0.5,
        unit: 'W',
      },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [34, 14],
        [0, 14],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 14] },
  ],
  probes: [
    { id: 'I', kind: 'current', element: 'L1', label: 'Corrente no circuito' },
    { id: 'V1', kind: 'voltage', plus: 'L1.a', minus: 'L1.b', label: 'Tensão em L1' },
    { id: 'V2', kind: 'voltage', plus: 'L2.a', minus: 'L2.b', label: 'Tensão em L2' },
    { id: 'V3', kind: 'voltage', plus: 'L3.a', minus: 'L3.b', label: 'Tensão em L3' },
  ],
  goals: [
    {
      id: 'corrente',
      description: 'Repare: a mesma corrente, cerca de 0,25 A, passa pelas três lâmpadas.',
      check: { readout: 'I', op: 'between', value: [0.245, 0.255] },
    },
    {
      id: 'tensao',
      description: 'Cada lâmpada fica com cerca de 4 V, um terço dos 12 V da bateria.',
      check: { readout: 'V2', op: 'between', value: [3.9, 4.1] },
    },
    {
      id: 'apagam',
      description: 'Tire L2 do soquete e veja o que acontece com L1 e L3.',
      check: { readout: 'L1.brightness', op: '<', value: 0.01 },
      solution: { 'S2.closed': false },
    },
    {
      id: 'mais-fraca',
      description: 'Coloque em L3 uma lâmpada de 0,5 W e descubra o que acontece com ela.',
      check: { readout: 'L3.burned', op: '==', value: true },
      solution: { 'L3.power': 0.5 },
    },
  ],
});
