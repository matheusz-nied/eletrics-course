import { defineCircuit } from '../../engine';

/**
 * 05.6: start/stop with seal-in and interlock for a reversing motor, in 24 V
 * DC control. K1 and K2 stand for the two contactors; each one's single
 * changeover contact does two jobs: its NA seals its own coil (in parallel
 * with its start button) and its NF feeds the other one's start button
 * (interlock). B0 (NF) stops both. The lamps stand for the main contacts.
 * Each SPDT's NF sits between its coil and its NA, so the drawing has one
 * crossing per relay.
 */
export default defineCircuit({
  id: 'm05/partida-selo-intertravamento',
  title: 'Partida com selo e intertravamento',
  description:
    'Uma fonte de 24 V alimenta o comando de dois relés, K1 e K2, que fazem o papel dos contatores de um motor com dois sentidos. A fonte passa por uma chave de energia e pelo botão Desliga B0, normalmente fechado, e chega ao comum dos dois relés. O botão Liga 1, B1, recebe a tensão pelo contato NF de K2 e alimenta a bobina de K1; o contato NA de K1 fica em paralelo com B1 e mantém a bobina ligada depois que o botão é solto: é o selo. Do mesmo jeito, o botão Liga 2, B2, recebe a tensão pelo contato NF de K1 e alimenta a bobina de K2, selada pelo NA de K2. Uma lâmpada em paralelo com cada bobina mostra o sentido do motor, no lugar dos contatos principais. Cada bobina tem um diodo em paralelo e puxa cerca de 17 mA. Com K1 ligado, o NF de K1 está aberto e B2 não consegue ligar K2: é o intertravamento. Apertar B0 ou cortar a energia solta tudo, e nada religa sozinho quando a energia volta.',
  analysis: { kind: 'transient', dt: 2e-4, speed: 1 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 6],
      b: [0, 28],
      label: 'Fonte',
      params: { voltage: 24 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 6],
        [0, 0],
        [3, 0],
      ],
    },
    {
      id: 'EN',
      type: 'switch',
      a: [3, 0],
      b: [8, 0],
      label: 'Energia',
      params: { closed: true },
      control: { param: 'closed', label: 'Energia ligada', kind: 'toggle' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [8, 0],
        [10, 0],
      ],
    },
    {
      id: 'B0',
      type: 'push-button',
      a: [10, 0],
      b: [15, 0],
      label: 'B0 Desliga',
      params: { normallyClosed: true },
      control: { param: 'pressed', label: 'B0 Desliga', kind: 'momentary' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [15, 0],
        [18, 0],
        [44, 0],
        [44, 8],
        [48, 8],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [18, 0],
        [18, 8],
        [22, 8],
      ],
    },

    // K1: coil on the right, contacts below.
    {
      id: 'K1',
      type: 'relay-spdt',
      at: [24, 10],
      rot: 180,
      label: 'K1',
      params: { coilVoltage: 24, coilResistance: 1440, coilInductance: 0.5, contactRating: 10 },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [26, 8],
        [29, 8],
        [32, 8],
      ],
    },
    { id: 'G1', type: 'ground', at: [29, 8] },
    { id: 'D1', type: 'diode', a: [32, 8], b: [32, 12], label: 'D1' },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [26, 12],
        [32, 12],
        [32, 16],
        [21, 16],
        [18, 16],
        [13, 16],
      ],
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [21, 12],
        [21, 16],
      ],
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [13, 16],
      b: [13, 28],
      label: 'Sentido 1',
      params: { voltage: 24, power: 5 },
    },

    // K2: the same, to the right.
    {
      id: 'K2',
      type: 'relay-spdt',
      at: [50, 10],
      rot: 180,
      label: 'K2',
      params: { coilVoltage: 24, coilResistance: 1440, coilInductance: 0.5, contactRating: 10 },
    },
    {
      id: 'W8',
      type: 'wire',
      points: [
        [52, 8],
        [55, 8],
        [58, 8],
      ],
    },
    { id: 'G2', type: 'ground', at: [55, 8] },
    { id: 'D2', type: 'diode', a: [58, 8], b: [58, 12], label: 'D2' },
    {
      id: 'W9',
      type: 'wire',
      points: [
        [52, 12],
        [58, 12],
        [58, 16],
        [62, 16],
      ],
    },
    {
      id: 'W10',
      type: 'wire',
      points: [
        [58, 16],
        [47, 16],
        [44, 16],
      ],
    },
    {
      id: 'W11',
      type: 'wire',
      points: [
        [47, 12],
        [47, 16],
      ],
    },
    {
      id: 'L2',
      type: 'lamp',
      a: [62, 16],
      b: [62, 28],
      label: 'Sentido 2',
      params: { voltage: 24, power: 5 },
    },

    // Interlock: K1's NF feeds B2, K2's NF feeds B1.
    {
      id: 'W12',
      type: 'wire',
      points: [
        [23, 12],
        [23, 20],
        [34, 20],
      ],
    },
    {
      id: 'B2',
      type: 'push-button',
      a: [34, 20],
      b: [40, 20],
      label: 'B2 Liga 2',
      control: { param: 'pressed', label: 'B2 Liga sentido 2', kind: 'momentary' },
    },
    {
      id: 'W13',
      type: 'wire',
      points: [
        [40, 20],
        [44, 20],
        [44, 16],
      ],
    },
    {
      id: 'W14',
      type: 'wire',
      points: [
        [49, 12],
        [49, 24],
        [28, 24],
      ],
    },
    {
      id: 'B1',
      type: 'push-button',
      a: [28, 24],
      b: [22, 24],
      label: 'B1 Liga 1',
      control: { param: 'pressed', label: 'B1 Liga sentido 1', kind: 'momentary' },
    },
    {
      id: 'W15',
      type: 'wire',
      points: [
        [22, 24],
        [18, 24],
        [18, 16],
      ],
    },

    {
      id: 'W16',
      type: 'wire',
      points: [
        [0, 28],
        [13, 28],
        [62, 28],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 28] },
  ],
  probes: [{ id: 'IT', kind: 'current', element: 'B0', label: 'Corrente no comando' }],
  goals: [
    {
      id: 'k1',
      description: 'Aperte o play e aperte B1: K1 atrai e a lâmpada do sentido 1 acende.',
      check: { readout: 'K1.closed', op: '==', value: true },
      solution: { 'B1.pressed': true },
    },
    {
      id: 'bobina',
      description: 'A bobina de K1 puxa cerca de 17 mA (clique em K1 no esquema).',
      check: { readout: 'K1.coilCurrent', op: 'between', value: [0.0162, 0.0171] },
      solution: { 'B1.pressed': true },
    },
    {
      id: 'k2',
      description: 'Desligue com B0 e aperte B2: K2 atrai e o motor gira no outro sentido.',
      check: { readout: 'K2.closed', op: '==', value: true },
      solution: { 'B2.pressed': true },
    },
  ],
});
