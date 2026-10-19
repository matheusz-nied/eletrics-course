import { defineCircuit } from '../../engine';

/**
 * 07.6: the staircase light with two three-way switches ("interruptores
 * paralelos"). The phase goes to the common of S1, the two travelers join
 * the 1 and 2 terminals of the two switches, and the return leaves the
 * common of S2 to the lamp; the neutral goes straight to the lamp. Either
 * switch changes the lamp. The values the lesson quotes are checked in
 * ./escada-paralelo.test.ts.
 */
export default defineCircuit({
  id: 'm07/escada-paralelo',
  title: 'Luz da escada com dois interruptores paralelos',
  description:
    'A rede de 127 V alimenta, por um disjuntor de 10 A, o comum do interruptor paralelo de baixo da escada. Dois fios, os viajantes, ligam o borne 1 de um interruptor ao borne 1 do outro e o borne 2 ao borne 2. Do comum do interruptor de cima sai o retorno, que vai à lâmpada de 127 V e 60 W; o neutro vai direto à lâmpada. Com os dois interruptores na mesma posição, a lâmpada acende, com cerca de 0,47 A. Mudando qualquer um deles, ela apaga; mudando o outro, acende de novo.',
  analysis: { kind: 'quasi-static', frequency: 60, dtMech: 0.01 },
  elements: [
    { id: 'R', type: 'mains', at: [0, 14], label: 'Rede 127 V', params: { voltage: 127 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [2, 12],
        [5, 12],
      ],
    },
    {
      id: 'DJ',
      type: 'breaker',
      a: [5, 12],
      b: [5, 6],
      label: 'Disjuntor 10 A',
      params: { rating: 10, curve: 'B' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [5, 6],
        [9, 6],
      ],
    },
    // com (9,6), nc = borne 1 (15,4), no = borne 2 (15,8)
    {
      id: 'S1',
      type: 'switch-spdt',
      at: [12, 6],
      label: 'Interruptor de baixo',
      control: { param: 'actuated', label: 'Interruptor de baixo', kind: 'toggle' },
    },
    {
      id: 'WV1',
      type: 'wire',
      label: 'Viajante 1',
      points: [
        [15, 4],
        [25, 4],
      ],
    },
    {
      id: 'WV2',
      type: 'wire',
      label: 'Viajante 2',
      points: [
        [15, 8],
        [25, 8],
      ],
    },
    // Mirrored: borne 1 (25,4), borne 2 (25,8), com (31,6)
    {
      id: 'S2',
      type: 'switch-spdt',
      at: [28, 6],
      flip: true,
      label: 'Interruptor de cima',
      control: { param: 'actuated', label: 'Interruptor de cima', kind: 'toggle' },
    },
    {
      id: 'WR',
      type: 'wire',
      label: 'Retorno',
      points: [
        [31, 6],
        [36, 6],
      ],
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [36, 6],
      b: [36, 14],
      label: 'Lâmpada 60 W',
      params: { voltage: 127, power: 60 },
    },
    {
      id: 'WN',
      type: 'wire',
      label: 'Neutro',
      points: [
        [2, 14],
        [36, 14],
      ],
    },
  ],
  probes: [
    { id: 'VL', kind: 'voltage', plus: 'L1.a', minus: 'L1.b', label: 'Tensão na lâmpada' },
    { id: 'IL', kind: 'current', element: 'L1', label: 'Corrente na lâmpada' },
  ],
  goals: [
    {
      id: 'acesa',
      description:
        'Com os dois interruptores na mesma posição, a lâmpada acende com cerca de 0,47 A.',
      check: { readout: 'L1.current', op: 'between', value: [0.46, 0.48] },
    },
    {
      id: 'apaga-de-baixo',
      description: 'Mude só o interruptor de baixo: a lâmpada apaga.',
      check: { readout: 'L1.brightness', op: '<', value: 0.01 },
      solution: { 'S1.actuated': true },
    },
    {
      id: 'apaga-de-cima',
      description: 'Volte o de baixo e mude só o de cima: a lâmpada também apaga.',
      check: { readout: 'L1.brightness', op: '<', value: 0.01 },
      solution: { 'S2.actuated': true },
    },
    {
      id: 'acende-de-novo',
      description: 'Mude os dois: eles ficam de novo na mesma posição, e a lâmpada acende.',
      check: { readout: 'L1.brightness', op: '>', value: 0.9 },
      solution: { 'S1.actuated': true, 'S2.actuated': true },
    },
  ],
});
