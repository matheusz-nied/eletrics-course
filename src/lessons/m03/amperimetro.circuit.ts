import { defineCircuit } from '../../engine';

/**
 * 03.3: an ammeter (the 1 Ω shunt and 400 mA fuse of the mA jack) measures
 * only once the original wire is opened, and blows its fuse when its black
 * lead goes to the battery's negative instead of the far side of the opening.
 */
export default defineCircuit({
  id: 'm03/amperimetro',
  title: 'O amperímetro entra no lugar do fio',
  description:
    'Uma bateria de 12 V acende uma lâmpada de 12 V e 3 W. Entre os pontos A e B passa o fio original, que pode ser aberto. Em cima fica o multímetro no borne mA: um fusível de 400 mA e um shunt de 1 Ω. A ponta vermelha está no ponto A; a preta pode ir ao ponto B ou ao negativo da bateria. Com o fio original no lugar, quase toda a corrente passa pelo fio e o multímetro mostra perto de zero. Aberto o fio, a corrente atravessa o multímetro e ele mostra cerca de 0,25 A. Com a ponta preta no negativo, o multímetro fica em curto com a bateria e o fusível rompe.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'B1', type: 'battery', a: [0, 0], b: [0, 16], params: { voltage: 12, resistance: 0.05 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [10, 0],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [10, 0],
      b: [20, 0],
      label: 'Fio original A–B',
      params: { closed: true },
      control: {
        param: 'closed',
        label: 'Fio original entre A e B',
        kind: 'select',
        options: [
          { value: true, label: 'No lugar' },
          { value: false, label: 'Aberto para medir' },
        ],
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [20, 0],
        [34, 0],
      ],
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [34, 0],
      b: [34, 16],
      label: 'Lâmpada 12 V 3 W',
      params: { voltage: 12, power: 3 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [34, 16],
        [0, 16],
      ],
    },
    { id: 'G1', type: 'ground', at: [0, 16] },

    // The multimeter on its mA jack: fuse and shunt between the red lead and COM.
    {
      id: 'W4',
      type: 'wire',
      points: [
        [10, 0],
        [10, -10],
      ],
    },
    {
      id: 'F1',
      type: 'fuse',
      a: [10, -10],
      b: [18, -10],
      label: 'Fusível 400 mA',
      params: { rating: 0.4, kind: 'fast' },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [18, -10],
        [22, -10],
      ],
    },
    {
      id: 'RS',
      type: 'resistor',
      a: [22, -10],
      b: [30, -10],
      label: 'Shunt',
      params: { resistance: 1, watts: 5 },
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [30, -10],
        [33, -10],
      ],
    },
    {
      id: 'PP',
      type: 'switch-spdt',
      at: [36, -10],
      label: 'Ponta preta',
      params: { actuated: true },
      control: {
        param: 'actuated',
        label: 'Ponta preta do multímetro',
        kind: 'select',
        options: [
          { value: true, label: 'No ponto B' },
          { value: false, label: 'No negativo da bateria' },
        ],
      },
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [39, -12],
        [43, -12],
      ],
    },
    { id: 'G2', type: 'ground', at: [43, -12] },
    {
      id: 'W8',
      type: 'wire',
      points: [
        [39, -8],
        [41, -8],
        [41, -4],
        [20, -4],
        [20, 0],
      ],
    },
  ],
  probes: [
    { id: 'IM', kind: 'current', element: 'RS', label: 'Leitura do multímetro' },
    { id: 'IL', kind: 'current', element: 'L1', label: 'Corrente na lâmpada' },
  ],
  goals: [
    {
      id: 'fio-no-lugar',
      description: 'Com o fio original no lugar, o multímetro mostra quase zero.',
      check: { readout: 'IM', op: 'between', value: [-0.001, 0.001] },
    },
    {
      id: 'em-serie',
      description: 'Abra o fio original: a corrente passa pelo multímetro, cerca de 0,25 A.',
      check: { readout: 'IM', op: 'between', value: [0.24, 0.255] },
      solution: { 'S1.closed': false },
    },
    {
      id: 'curto',
      description:
        'Leve a ponta preta para o negativo da bateria e veja o que acontece com o fusível.',
      check: { readout: 'F1.blown', op: '==', value: true },
      solution: { 'PP.actuated': false },
    },
  ],
});
