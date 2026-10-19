import { defineCircuit } from '../../engine';

/**
 * 11.3: contact bounce and its cure. A push button whose contact bounces for
 * about 4 ms pulls a 10 kΩ pull-up to GND. A changeover switch feeds the
 * Schmitt trigger inverter either straight from the contact or through an RC
 * filter (10 kΩ and 470 nF); the inverter clocks a counter, which counts
 * every press it sees. Without the filter one press counts several times;
 * with it, once. Runs 50 times slower than real time. Checked in
 * ./pull-up-debounce.test.ts.
 */
export default defineCircuit({
  id: 'm11/debounce',
  title: 'Botão que trepida e o filtro RC',
  description:
    'Um botão liga ao GND uma entrada com resistor de pull-up de 10 kΩ para 5 V. O contato do botão trepida por alguns milissegundos a cada aperto. Uma chave escolhe o que vai para a entrada de uma porta inversora com entrada Schmitt trigger: o contato direto, ou o contato passando por um filtro RC, com um resistor de 10 kΩ e um capacitor de 470 nF. A saída da porta fica em nível alto com o botão apertado e alimenta o clock de um contador de 4 bits, que mostra quantos apertos ele viu. Um segundo botão zera o contador. A simulação roda 50 vezes mais devagar que o tempo real.',
  analysis: { kind: 'transient', dt: 2e-5, speed: 0.02 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 20],
      label: 'Fonte',
      params: { voltage: 5 },
    },
    { id: 'G1', type: 'ground', at: [0, 20] },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [6, 0],
        [31, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [6, 0],
      b: [6, 8],
      label: 'R1',
      params: { resistance: 10000 },
    },
    {
      id: 'B1',
      type: 'bouncing-button',
      a: [6, 8],
      b: [6, 18],
      label: 'Botão',
      params: { bounce: 0.004 },
      control: { param: 'pressed', label: 'Botão apertado', kind: 'toggle' },
    },
    { id: 'G2', type: 'ground', at: [6, 18] },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [6, 8],
        [11, 8],
        [11, 6],
        [17, 6],
      ],
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [11, 8],
      b: [11, 14],
      label: 'R2',
      params: { resistance: 10000 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [11, 14],
        [15, 14],
        [15, 10],
        [17, 10],
      ],
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [15, 14],
      b: [15, 20],
      label: 'C1',
      params: { capacitance: 470e-9 },
    },
    { id: 'G3', type: 'ground', at: [15, 20] },
    {
      id: 'SW',
      type: 'switch-spdt',
      at: [20, 8],
      flip: true,
      label: 'Filtro',
      control: { param: 'actuated', label: 'Filtro RC (debounce)', kind: 'toggle' },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [23, 8],
        [25, 8],
      ],
    },
    { id: 'U1', type: 'not', at: [27, 8], label: 'U1' },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [29, 8],
        [33, 8],
      ],
    },
    { id: 'U2', type: 'counter-4bit', at: [37, 10], label: 'Contador' },
    {
      id: 'B2',
      type: 'push-button',
      a: [31, 0],
      b: [31, 12],
      label: 'Zerar',
      control: { param: 'pressed', label: 'Zerar o contador', kind: 'momentary' },
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [31, 12],
        [33, 12],
      ],
    },
    {
      id: 'R3',
      type: 'resistor',
      a: [31, 12],
      b: [31, 20],
      label: 'R3',
      params: { resistance: 10000 },
    },
    { id: 'G4', type: 'ground', at: [31, 20] },
  ],
  probes: [
    { id: 'VCONT', kind: 'voltage', plus: 'B1.a', minus: 'GND', label: 'Contato do botão' },
    { id: 'VIN', kind: 'voltage', plus: 'U1.a', minus: 'GND', label: 'Entrada da porta' },
  ],
});
