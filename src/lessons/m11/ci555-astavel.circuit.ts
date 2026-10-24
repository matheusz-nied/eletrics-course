import { defineCircuit } from '../../engine';

/**
 * 11.5: the 555 astable, the classic two-LED flasher. R1 (10 kΩ) and R2
 * (selectable) charge the 10 µF capacitor from 9 V; the 555 discharges it
 * through R2 when it reaches 6 V and lets it charge again at 3 V. The
 * output lights LED 1 (to GND) while high and LED 2 (from 9 V) while low.
 * f = 1,44 / ((R1 + 2·R2)·C): about 0,99 Hz with 68 kΩ. Checked in
 * ./ci555.test.ts.
 */
export default defineCircuit({
  id: 'm11/ci555-astavel',
  title: 'Pisca-pisca com o 555 (astável)',
  description:
    'Uma fonte de 9 V alimenta um 555 ligado como astável. Do 9 V, um resistor R1 de 10 kΩ vai ao pino 7 (descarga); do pino 7, um resistor R2, que pode ser escolhido, vai aos pinos 6 e 2 (limiar e disparo), que estão ligados juntos; um capacitor de 10 µF liga esse ponto ao GND. O pino 4 (reset) vai ao 9 V, e o pino 5 (controle) tem um capacitor de 10 nF para o GND. A saída, no pino 3, acende o LED 1 (para o GND, com 470 Ω) quando está em nível alto, e o LED 2 (vindo do 9 V, com 470 Ω) quando está em nível baixo.',
  analysis: { kind: 'transient', dt: 1e-3 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 26],
      label: 'Fonte',
      params: { voltage: 9 },
    },
    { id: 'G1', type: 'ground', at: [0, 26] },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [12, 0],
        [23, 0],
        [25, 0],
        [38, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [12, 0],
      b: [12, 10],
      label: 'R1',
      params: { resistance: 10000 },
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [12, 10],
      b: [12, 18],
      label: 'R2',
      params: { resistance: 68000 },
      control: {
        param: 'resistance',
        label: 'Resistor R2',
        kind: 'select',
        options: [
          { value: 68000, label: '68 kΩ' },
          { value: 33000, label: '33 kΩ' },
          { value: 15000, label: '15 kΩ' },
        ],
      },
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [12, 18],
      b: [12, 26],
      label: 'C1',
      params: { capacitance: 10e-6 },
    },
    { id: 'G2', type: 'ground', at: [12, 26] },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 10],
        [20, 10],
      ],
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [12, 18],
        [18, 18],
        [18, 14],
        [18, 12],
        [20, 12],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [18, 14],
        [20, 14],
      ],
    },
    { id: 'U1', type: 'timer-555', at: [24, 12], label: '555' },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [23, 7],
        [23, 0],
      ],
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [25, 7],
        [25, 0],
      ],
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [23, 17],
        [23, 23],
      ],
    },
    { id: 'G3', type: 'ground', at: [23, 23] },
    {
      id: 'C2',
      type: 'capacitor',
      a: [25, 17],
      b: [25, 23],
      label: 'C2',
      params: { capacitance: 10e-9 },
    },
    { id: 'G4', type: 'ground', at: [25, 23] },
    {
      id: 'W8',
      type: 'wire',
      points: [
        [28, 12],
        [32, 12],
        [38, 12],
      ],
    },
    {
      id: 'R3',
      type: 'resistor',
      a: [32, 12],
      b: [32, 18],
      label: 'R3',
      params: { resistance: 470 },
    },
    {
      id: 'D1',
      type: 'led',
      a: [32, 18],
      b: [32, 26],
      label: 'LED 1',
      params: { color: 'red' },
    },
    { id: 'G5', type: 'ground', at: [32, 26] },
    {
      id: 'R4',
      type: 'resistor',
      a: [38, 0],
      b: [38, 6],
      label: 'R4',
      params: { resistance: 470 },
    },
    {
      id: 'D2',
      type: 'led',
      a: [38, 6],
      b: [38, 12],
      label: 'LED 2',
      params: { color: 'yellow' },
    },
  ],
  probes: [
    { id: 'VC', kind: 'voltage', plus: 'C1.a', minus: 'GND', label: 'Capacitor C1' },
    { id: 'VOUT', kind: 'voltage', plus: 'U1.out', minus: 'GND', label: 'Saída (pino 3)' },
  ],
});
