import { defineCircuit } from '../../engine';

/**
 * 07.6: three points of control. An intermediate (four-way) switch sits in
 * the middle of the two travelers of the three-way pair: at rest it passes
 * them straight, actuated it crosses them. Any of the three switches changes
 * the lamp. Checked in ./escada-paralelo.test.ts.
 */
export default defineCircuit({
  id: 'm07/tres-pontos',
  title: 'Uma lâmpada comandada de três lugares',
  description:
    'A rede de 127 V alimenta, por um disjuntor de 10 A, o comum de um interruptor paralelo. Os dois viajantes passam por um interruptor intermediário antes de chegar ao segundo interruptor paralelo: em repouso, o intermediário liga os viajantes direto; acionado, ele os cruza. Do comum do segundo paralelo sai o retorno para a lâmpada de 127 V e 60 W, e o neutro vai direto à lâmpada. No começo, a lâmpada está acesa. Mudando qualquer um dos três interruptores, ela troca de estado.',
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
    // com (9,6), borne 1 (15,4), borne 2 (15,8)
    {
      id: 'S1',
      type: 'switch-spdt',
      at: [12, 6],
      label: 'Paralelo 1',
      control: { param: 'actuated', label: 'Paralelo 1 (pé da escada)', kind: 'toggle' },
    },
    {
      id: 'WA1',
      type: 'wire',
      points: [
        [15, 4],
        [19, 4],
      ],
    },
    {
      id: 'WA2',
      type: 'wire',
      points: [
        [15, 8],
        [19, 8],
      ],
    },
    // a1 (19,4), a2 (19,8), b1 (25,4), b2 (25,8)
    {
      id: 'X1',
      type: 'switch-intermediate',
      at: [22, 6],
      label: 'Intermediário',
      control: { param: 'actuated', label: 'Intermediário (meio do corredor)', kind: 'toggle' },
    },
    {
      id: 'WB1',
      type: 'wire',
      points: [
        [25, 4],
        [33, 4],
      ],
    },
    {
      id: 'WB2',
      type: 'wire',
      points: [
        [25, 8],
        [33, 8],
      ],
    },
    // Mirrored: borne 1 (33,4), borne 2 (33,8), com (39,6)
    {
      id: 'S2',
      type: 'switch-spdt',
      at: [36, 6],
      flip: true,
      label: 'Paralelo 2',
      control: { param: 'actuated', label: 'Paralelo 2 (alto da escada)', kind: 'toggle' },
    },
    {
      id: 'WR',
      type: 'wire',
      label: 'Retorno',
      points: [
        [39, 6],
        [44, 6],
      ],
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [44, 6],
      b: [44, 14],
      label: 'Lâmpada 60 W',
      params: { voltage: 127, power: 60 },
    },
    {
      id: 'WN',
      type: 'wire',
      label: 'Neutro',
      points: [
        [2, 14],
        [44, 14],
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
      description: 'No começo, a lâmpada está acesa.',
      check: { readout: 'L1.brightness', op: '>', value: 0.9 },
    },
    {
      id: 'apaga-no-meio',
      description: 'Mude só o intermediário: ele cruza os viajantes e a lâmpada apaga.',
      check: { readout: 'L1.brightness', op: '<', value: 0.01 },
      solution: { 'X1.actuated': true },
    },
    {
      id: 'acende-no-pe',
      description: 'Agora mude o paralelo 1: a lâmpada acende de novo.',
      check: { readout: 'L1.brightness', op: '>', value: 0.9 },
      solution: { 'X1.actuated': true, 'S1.actuated': true },
    },
    {
      id: 'apaga-no-alto',
      description: 'Por fim, mude o paralelo 2: a lâmpada apaga outra vez.',
      check: { readout: 'L1.brightness', op: '<', value: 0.01 },
      solution: { 'X1.actuated': true, 'S1.actuated': true, 'S2.actuated': true },
    },
  ],
});
