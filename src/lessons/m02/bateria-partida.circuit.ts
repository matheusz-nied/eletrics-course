import { defineCircuit } from '../../engine';

/**
 * 02.7: a car battery during engine cranking. The starter motor is modelled
 * as a 0,05 Ω resistor (typical cranking current of about 200 A); the
 * headlights (2 × 55 W) dim while it turns.
 */
export default defineCircuit({
  id: 'm02/bateria-partida',
  title: 'Bateria de carro na partida',
  description:
    'Uma bateria de carro de 12,6 V, com resistência interna ajustável, alimenta dois faróis de 55 W, sempre acesos, e o motor de partida, que puxa perto de 200 A enquanto o botão "Girar a chave" está apertado. Com a bateria boa (0,015 Ω), a tensão nos terminais cai de cerca de 12,5 V para cerca de 9,6 V durante a partida e os faróis enfraquecem. Com a bateria fraca (0,05 Ω), a tensão despenca para cerca de 6,1 V.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'B1',
      type: 'battery',
      a: [0, 0],
      b: [0, 16],
      params: { voltage: 12.6, resistance: 0.015 },
      control: {
        param: 'resistance',
        label: 'Resistência interna da bateria',
        kind: 'slider',
        min: 0.005,
        max: 0.1,
        step: 0.001,
        unit: 'Ω',
      },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [12, 0],
      ],
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [12, 0],
      b: [12, 16],
      label: 'Farol E',
      params: { voltage: 12, power: 55 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 0],
        [22, 0],
      ],
    },
    {
      id: 'L2',
      type: 'lamp',
      a: [22, 0],
      b: [22, 16],
      label: 'Farol D',
      params: { voltage: 12, power: 55 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [22, 0],
        [32, 0],
      ],
    },
    {
      id: 'X1',
      type: 'push-button',
      a: [32, 0],
      b: [32, 6],
      label: 'Chave',
      control: { param: 'pressed', label: 'Girar a chave (partida)', kind: 'momentary' },
    },
    {
      id: 'M1',
      type: 'resistor',
      a: [32, 6],
      b: [32, 16],
      label: 'Motor de partida',
      params: { resistance: 0.05, watts: 5000 },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [32, 16],
        [22, 16],
        [12, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
  ],
  probes: [
    {
      id: 'VB',
      kind: 'voltage',
      plus: 'B1.a',
      minus: 'B1.b',
      label: 'Tensão nos terminais da bateria',
    },
    { id: 'IM', kind: 'current', element: 'M1', label: 'Corrente no motor de partida' },
    { id: 'IF', kind: 'current', element: 'L1', label: 'Corrente em um farol' },
  ],
  goals: [
    {
      id: 'farois',
      description: 'Só com os faróis acesos, a bateria boa mantém cerca de 12,5 V.',
      check: { readout: 'VB', op: 'between', value: [12.4, 12.5] },
    },
    {
      id: 'corrente-farol',
      description: 'Confira a corrente de um farol: uns 4,7 A.',
      check: { readout: 'IF', op: 'between', value: [4.6, 4.8] },
    },
    {
      id: 'partida-boa',
      description: 'Gire a chave: com a bateria boa, a tensão cai para cerca de 9,6 V.',
      check: { readout: 'VB', op: 'between', value: [9.5, 9.75] },
      solution: { 'X1.pressed': true },
    },
    {
      id: 'corrente-partida',
      description: 'Durante a partida, o motor puxa perto de 190 A.',
      check: { readout: 'IM', op: 'between', value: [185, 197] },
      solution: { 'X1.pressed': true },
    },
    {
      id: 'brilho-partida',
      description: 'Repare nos faróis durante a partida: perdem cerca de metade do brilho.',
      check: { readout: 'L1.brightness', op: 'between', value: [0.4, 0.6] },
      solution: { 'X1.pressed': true },
    },
    {
      id: 'farois-fraca',
      description:
        'Suba a resistência interna para 0,05 Ω: sem girar a chave, a bateria ainda mostra 12,1 V.',
      check: { readout: 'VB', op: 'between', value: [12.05, 12.2] },
      solution: { 'B1.resistance': 0.05 },
    },
    {
      id: 'partida-fraca',
      description: 'Com 0,05 Ω, gire a chave: a tensão despenca para cerca de 6,1 V.',
      check: { readout: 'VB', op: 'between', value: [6, 6.25] },
      solution: { 'X1.pressed': true, 'B1.resistance': 0.05 },
    },
    {
      id: 'corrente-fraca',
      description: 'Com 0,05 Ω, o motor de partida recebe só uns 120 A.',
      check: { readout: 'IM', op: 'between', value: [115, 128] },
      solution: { 'X1.pressed': true, 'B1.resistance': 0.05 },
    },
  ],
});
