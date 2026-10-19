import { defineCircuit } from '../../engine';

/**
 * 9.4: an LED with its current-limiting resistor on 9 V. The jumper S1
 * shorts the resistor, and the LED, now straight across the battery, burns.
 */
export default defineCircuit({
  id: 'm09/led-resistor',
  title: 'LED com resistor limitador',
  description:
    'Uma fonte de 9 V alimenta um LED através do resistor R1, ajustável de 47 Ω a 4,7 kΩ. Com 330 Ω, o LED vermelho recebe cerca de 21 mA. Trocar a cor do LED muda a tensão direta e, com ela, a corrente. O jumper S1, em paralelo com o resistor, tira o resistor do circuito: o LED fica ligado direto na fonte e queima.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 6],
      b: [0, 20],
      label: 'Fonte',
      params: { voltage: 9 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 6],
        [8, 6],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [8, 6],
      b: [20, 6],
      label: 'R1',
      params: { resistance: 330 },
      control: {
        param: 'resistance',
        label: 'Resistor limitador R1',
        kind: 'slider',
        min: 47,
        max: 4700,
        log: true,
        unit: 'Ω',
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [8, 6],
        [8, 0],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [8, 0],
      b: [20, 0],
      label: 'Jumper',
      params: { closed: false },
      control: { param: 'closed', label: 'Jumper sobre o resistor (tira o R1)', kind: 'toggle' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [20, 0],
        [20, 6],
        [28, 6],
      ],
    },
    {
      id: 'D1',
      type: 'led',
      a: [28, 6],
      b: [28, 20],
      label: 'LED',
      params: { color: 'red' },
      control: {
        param: 'color',
        label: 'Cor do LED',
        kind: 'select',
        options: [
          { value: 'red', label: 'Vermelho' },
          { value: 'yellow', label: 'Amarelo' },
          { value: 'green', label: 'Verde (2,2 V)' },
          { value: 'blue', label: 'Azul' },
          { value: 'white', label: 'Branco' },
        ],
      },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [28, 20],
        [0, 20],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 20] },
  ],
  probes: [
    { id: 'ILED', kind: 'current', element: 'D1', label: 'Corrente no LED' },
    { id: 'VLED', kind: 'voltage', plus: 'D1.a', minus: 'D1.b', label: 'Tensão no LED' },
    { id: 'VR1', kind: 'voltage', plus: 'R1.a', minus: 'R1.b', label: 'Tensão no resistor' },
    { id: 'PR1', kind: 'power', element: 'R1', label: 'Potência no resistor' },
  ],
  goals: [
    {
      id: 'r330',
      description: 'Com R1 de 330 Ω, confira que o LED vermelho recebe cerca de 21 mA.',
      check: { readout: 'ILED', op: 'between', value: [0.0205, 0.0218] },
    },
    {
      id: 'r1k',
      description: 'Suba R1 para 1 kΩ: a corrente cai para cerca de 7 mA e o LED fica mais fraco.',
      check: { readout: 'ILED', op: 'between', value: [0.0068, 0.0076] },
      solution: { 'R1.resistance': 1000 },
    },
    {
      id: 'azul',
      description:
        'Volte para 330 Ω e troque o LED por um azul: a corrente cai para cerca de 18 mA, porque sobra menos tensão para o resistor.',
      check: { readout: 'ILED', op: 'between', value: [0.0175, 0.0185] },
      solution: { 'D1.color': 'blue' },
    },
    {
      id: 'queimar',
      description: 'Ligue o jumper sobre o resistor e veja o que acontece com o LED.',
      check: { readout: 'D1.burned', op: '==', value: true },
      solution: { 'S1.closed': true },
    },
  ],
});
