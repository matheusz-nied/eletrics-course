import { defineCircuit } from '../../engine';

/**
 * 04.7: the auxiliary headlights of a car switched by a relay. A dashboard
 * push-button or a toggle switch (either one) feeds the coil through a small
 * fuse; the relay contact carries the lamps' current through its own fuse.
 * The coil values are typical of a 12 V automotive mini relay (about 85 Ω).
 */
export default defineCircuit({
  id: 'm04/rele-farol',
  title: 'Relé acendendo os faróis auxiliares',
  description:
    'Uma bateria de carro de 12,6 V alimenta dois circuitos. No circuito de comando, um botão pulsador e uma chave com retenção, ligados em paralelo, levam corrente à bobina de um relé através de um fusível de 1 A; um diodo em paralelo com a bobina absorve o pico ao desligar. No circuito de força, o comum do relé recebe a bateria por um fusível de 15 A; o contato NA liga dois faróis auxiliares de 55 W e o contato NF liga uma lâmpada pequena de 5 W. Em repouso, só a lâmpada do NF acende. Com o botão apertado ou a chave ligada, a bobina puxa cerca de 0,15 A, o relé muda de posição, a lâmpada do NF apaga e os faróis acendem puxando cerca de 9,3 A.',
  analysis: { kind: 'transient', dt: 2e-4, speed: 1 },
  elements: [
    {
      id: 'B1',
      type: 'battery',
      a: [0, 0],
      b: [0, 26],
      label: 'Bateria',
      params: { voltage: 12.6, resistance: 0.01 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [21, 0],
        [44, 0],
      ],
    },
    {
      id: 'F1',
      type: 'fuse',
      a: [21, 0],
      b: [21, 6],
      label: 'F1',
      params: { rating: 15, kind: 'fast' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [21, 6],
        [21, 10],
        [26, 10],
      ],
    },
    {
      id: 'K1',
      type: 'relay-spdt',
      at: [28, 12],
      rot: 180,
      label: 'Relé',
      params: {
        coilVoltage: 12,
        coilResistance: 85,
        coilInductance: 0.05,
        contactRating: 30,
      },
    },
    {
      id: 'F2',
      type: 'fuse',
      a: [44, 0],
      b: [44, 4],
      label: 'F2',
      params: { rating: 1, kind: 'fast' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [44, 4],
        [47, 4],
        [54, 4],
      ],
    },
    {
      id: 'S1',
      type: 'push-button',
      a: [47, 4],
      b: [47, 8],
      label: 'Botão',
      control: { param: 'pressed', label: 'Botão pulsador', kind: 'momentary' },
    },
    {
      id: 'S2',
      type: 'switch',
      a: [54, 4],
      b: [54, 8],
      label: 'Chave',
      control: { param: 'closed', label: 'Chave com retenção', kind: 'toggle' },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [54, 8],
        [47, 8],
        [44, 8],
        [44, 14],
        [38, 14],
        [30, 14],
      ],
    },
    {
      id: 'D1',
      type: 'diode',
      a: [38, 10],
      b: [38, 14],
      label: 'Diodo',
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [30, 10],
        [35, 10],
        [38, 10],
      ],
    },
    { id: 'G2', type: 'ground', at: [35, 10] },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [25, 14],
        [25, 16],
        [20, 16],
        [10, 16],
      ],
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [10, 16],
      b: [10, 26],
      label: 'Farol E',
      params: { voltage: 12, power: 55 },
    },
    {
      id: 'L2',
      type: 'lamp',
      a: [20, 16],
      b: [20, 26],
      label: 'Farol D',
      params: { voltage: 12, power: 55 },
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [27, 14],
        [27, 18],
        [40, 18],
      ],
    },
    {
      id: 'L3',
      type: 'lamp',
      a: [40, 18],
      b: [40, 26],
      label: 'Lâmpada no NF',
      params: { voltage: 12, power: 5 },
    },
    {
      id: 'W8',
      type: 'wire',
      points: [
        [0, 26],
        [10, 26],
        [20, 26],
        [40, 26],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 26] },
  ],
  probes: [
    { id: 'IC', kind: 'current', element: 'F2', label: 'Corrente no comando (bobina)' },
    { id: 'IF', kind: 'current', element: 'F1', label: 'Corrente na força (contato do relé)' },
  ],
  goals: [
    {
      id: 'repouso',
      description: 'Em repouso, só a lâmpada do NF acende: o comum está encostado no NF.',
      check: { readout: 'L3.brightness', op: '>', value: 0.9 },
    },
    {
      id: 'bobina',
      description: 'Acione o relé: a bobina puxa cerca de 0,15 A pelo comando.',
      check: { readout: 'IC', op: 'between', value: [0.145, 0.155] },
      solution: { 'S2.closed': true },
    },
    {
      id: 'farois',
      description: 'Com o relé acionado, os faróis acendem e o contato conduz cerca de 9,3 A.',
      check: { readout: 'IF', op: 'between', value: [9.2, 9.45] },
      solution: { 'S2.closed': true },
    },
    {
      id: 'nf-apaga',
      description: 'Com o relé acionado, a lâmpada do NF apaga.',
      check: { readout: 'L3.voltage', op: '<', value: 0.5 },
      solution: { 'S1.pressed': true },
    },
  ],
});
