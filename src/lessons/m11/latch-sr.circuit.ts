import { defineCircuit } from '../../engine';

/**
 * 11.4: the SR latch, two NOR gates with each output fed back to the other.
 * "Liga" (S) and "Desliga" (R) are push buttons to 5 V with 10 kΩ
 * pull-downs; the LED shows Q. A 10 µF capacitor from 5 V to the R input
 * holds R high for a moment at power-up (a power-on reset), so the latch
 * always starts with Q = 0. Checked in ./flip-flops.test.ts.
 */
export default defineCircuit({
  id: 'm11/latch-sr',
  title: 'Trava SR com duas portas NÃO-OU',
  description:
    'Uma fonte de 5 V alimenta dois botões. O botão "Liga (S)" leva a entrada S a 5 V e o botão "Desliga (R)" leva a entrada R a 5 V; cada entrada tem um resistor de 10 kΩ para o GND. Duas portas NÃO-OU formam a trava: a de cima recebe R e a saída da de baixo, e a sua saída é Q; a de baixo recebe S e Q, e a sua saída é Q barrado. Um LED verde, com resistor de 220 Ω, mostra Q. Um capacitor de 10 µF entre o 5 V e a entrada R zera a trava quando o circuito é ligado.',
  analysis: { kind: 'transient', dt: 1e-3 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 32],
      label: 'Fonte',
      params: { voltage: 5 },
    },
    { id: 'G1', type: 'ground', at: [0, 32] },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [4, 0],
        [8, 0],
        [14, 0],
      ],
    },
    // R: button and power-on capacitor to 5 V, pull-down to GND.
    {
      id: 'B2',
      type: 'push-button',
      a: [8, 0],
      b: [8, 8],
      label: 'Desliga (R)',
      control: { param: 'pressed', label: 'Desliga (R)', kind: 'momentary' },
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [14, 0],
      b: [14, 8],
      label: 'C1',
      params: { capacitance: 10e-6 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [8, 8],
        [14, 8],
        [18, 8],
        [23, 8],
      ],
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [18, 8],
      b: [18, 14],
      label: 'R2',
      params: { resistance: 10000 },
    },
    { id: 'G2', type: 'ground', at: [18, 14] },
    // S: button to 5 V, pull-down to GND.
    {
      id: 'W3',
      type: 'wire',
      points: [
        [4, 0],
        [4, 18],
        [8, 18],
      ],
    },
    {
      id: 'B1',
      type: 'push-button',
      a: [8, 18],
      b: [8, 26],
      label: 'Liga (S)',
      control: { param: 'pressed', label: 'Liga (S)', kind: 'momentary' },
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [8, 26],
      b: [8, 32],
      label: 'R1',
      params: { resistance: 10000 },
    },
    { id: 'G3', type: 'ground', at: [8, 32] },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [8, 26],
        [23, 26],
      ],
    },
    // The latch: Q = NOR(R, Q̄), Q̄ = NOR(S, Q).
    { id: 'U1', type: 'nor', at: [26, 9], label: 'U1' },
    { id: 'U2', type: 'nor', at: [26, 25], label: 'U2' },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [29, 25],
        [31, 25],
        [31, 15],
        [21, 15],
        [21, 10],
        [23, 10],
      ],
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [29, 9],
        [33, 9],
        [33, 19],
        [20, 19],
        [20, 24],
        [23, 24],
      ],
    },
    {
      id: 'R3',
      type: 'resistor',
      a: [33, 9],
      b: [39, 9],
      label: 'R3',
      params: { resistance: 220 },
    },
    {
      id: 'D1',
      type: 'led',
      a: [39, 9],
      b: [39, 17],
      label: 'Q',
      params: { color: 'green' },
    },
    { id: 'G4', type: 'ground', at: [39, 17] },
  ],
  probes: [
    { id: 'VQ', kind: 'voltage', plus: 'U1.y', minus: 'GND', label: 'Q' },
    { id: 'VNQ', kind: 'voltage', plus: 'U2.y', minus: 'GND', label: 'Q barrado' },
  ],
});
