import { defineCircuit } from '../../engine';

/** 03.2: where each lead of the voltmeter goes decides what it shows, and the sign. */
export default defineCircuit({
  id: 'm03/tensao-pontos',
  title: 'Onde ficam as pontas do voltímetro',
  description:
    'Uma bateria de 12 V alimenta três resistores em série: 2 kΩ, 1 kΩ e 3 kΩ. A corrente é de 2 mA, e os pontos A (o positivo, em cima de R1), B (entre R1 e R2) e C (entre R2 e R3) ficam em 12 V, 8 V e 6 V em relação ao negativo. À esquerda, um voltímetro de 10 MΩ tem a ponta vermelha no ponto B ou no negativo, e a ponta preta no negativo ou no ponto C. Com a preta no negativo e a vermelha em B, ele mostra 8 V; com a preta em C, mostra 2 V, a tensão só do resistor do meio; com a vermelha no negativo e a preta em C, mostra 6 V com sinal de menos.',
  analysis: { kind: 'dc' },
  elements: [
    // The circuit being measured.
    { id: 'B1', type: 'battery', a: [40, 0], b: [40, 24], params: { voltage: 12, resistance: 0 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [40, 0],
        [26, 0],
      ],
    },
    { id: 'R1', type: 'resistor', a: [26, 0], b: [26, 8], params: { resistance: 2000 } },
    { id: 'R2', type: 'resistor', a: [26, 8], b: [26, 16], params: { resistance: 1000 } },
    { id: 'R3', type: 'resistor', a: [26, 16], b: [26, 24], params: { resistance: 3000 } },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [26, 24],
        [40, 24],
      ],
    },
    { id: 'G1', type: 'ground', at: [40, 24] },

    // The voltmeter and where each lead touches.
    {
      id: 'VM',
      type: 'resistor',
      a: [2, 6],
      b: [2, 18],
      label: 'Voltímetro',
      params: { resistance: 1e7 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [2, 6],
        [7, 6],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [2, 18],
        [7, 18],
      ],
    },
    {
      id: 'PV',
      type: 'switch-spdt',
      at: [10, 6],
      label: 'Ponta vermelha',
      params: { actuated: false },
      control: {
        param: 'actuated',
        label: 'Ponta vermelha',
        kind: 'select',
        options: [
          { value: false, label: 'No ponto B (entre R1 e R2)' },
          { value: true, label: 'No negativo da bateria' },
        ],
      },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [13, 4],
        [20, 4],
        [20, 8],
        [26, 8],
      ],
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [13, 8],
        [15, 8],
      ],
    },
    { id: 'G2', type: 'ground', at: [15, 8] },
    {
      id: 'PP',
      type: 'switch-spdt',
      at: [10, 18],
      label: 'Ponta preta',
      params: { actuated: true },
      control: {
        param: 'actuated',
        label: 'Ponta preta',
        kind: 'select',
        options: [
          { value: true, label: 'No negativo da bateria' },
          { value: false, label: 'No ponto C (entre R2 e R3)' },
        ],
      },
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [13, 16],
        [26, 16],
      ],
    },
    {
      id: 'W8',
      type: 'wire',
      points: [
        [13, 20],
        [15, 20],
      ],
    },
    { id: 'G3', type: 'ground', at: [15, 20] },
  ],
  probes: [
    { id: 'V', kind: 'voltage', plus: 'VM.a', minus: 'VM.b', label: 'Leitura do voltímetro' },
    { id: 'I', kind: 'current', element: 'R1', label: 'Corrente nos resistores' },
  ],
  goals: [
    {
      id: 'ponto-b',
      description: 'Com a preta no negativo e a vermelha no ponto B, o voltímetro mostra 8 V.',
      check: { readout: 'V', op: 'between', value: [7.99, 8.01] },
    },
    {
      id: 'so-r2',
      description: 'Passe a ponta preta para o ponto C e meça só o resistor do meio: 2 V.',
      check: { readout: 'V', op: 'between', value: [1.99, 2.01] },
      solution: { 'PP.actuated': false },
    },
    {
      id: 'invertido',
      description:
        'Deixe a preta em C e leve a vermelha para o negativo: o visor mostra 6 V com sinal de menos.',
      check: { readout: 'V', op: 'between', value: [-6.01, -5.99] },
      solution: { 'PP.actuated': false, 'PV.actuated': true },
    },
  ],
});
