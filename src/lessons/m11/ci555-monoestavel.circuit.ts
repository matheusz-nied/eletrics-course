import { defineCircuit } from '../../engine';

/**
 * 11.5: the 555 monostable, a stair-light timer. A push button pulls the
 * trigger (with a 10 kΩ pull-up) to GND; the output goes high and lights
 * the LED while the 10 µF capacitor charges through R1 to 6 V, then the
 * 555 discharges it and the output falls. t = 1,1·R1·C: 1,1 s with
 * 100 kΩ. Checked in ./ci555.test.ts.
 */
export default defineCircuit({
  id: 'm11/ci555-monoestavel',
  title: 'Temporizador com o 555 (monoestável)',
  description:
    'Uma fonte de 9 V alimenta um 555 ligado como monoestável. O pino 2 (disparo) tem um resistor de pull-up de 10 kΩ para o 9 V e um botão para o GND. Do 9 V, um resistor R1, que pode ser escolhido, vai aos pinos 7 e 6 (descarga e limiar), ligados juntos; um capacitor de 10 µF liga esse ponto ao GND. O pino 4 (reset) vai ao 9 V, e o pino 5 (controle) tem um capacitor de 10 nF para o GND. A saída, no pino 3, acende um LED com 470 Ω.',
  analysis: { kind: 'transient', dt: 1e-3 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 32],
      label: 'Fonte',
      params: { voltage: 9 },
    },
    { id: 'G1', type: 'ground', at: [0, 32] },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [6, 0],
        [12, 0],
        [23, 0],
        [25, 0],
      ],
    },
    // Trigger: pull-up and push button.
    {
      id: 'R2',
      type: 'resistor',
      a: [6, 0],
      b: [6, 8],
      label: 'R2',
      params: { resistance: 10000 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [6, 8],
        [6, 24],
        [16, 24],
        [16, 14],
        [20, 14],
      ],
    },
    {
      id: 'B1',
      type: 'push-button',
      a: [6, 24],
      b: [6, 32],
      label: 'Disparo',
      control: { param: 'pressed', label: 'Apertar o botão', kind: 'momentary' },
    },
    { id: 'G2', type: 'ground', at: [6, 32] },
    // Timing: R1 and C1, discharge and threshold together.
    {
      id: 'R1',
      type: 'resistor',
      a: [12, 0],
      b: [12, 10],
      label: 'R1',
      params: { resistance: 100000 },
      control: {
        param: 'resistance',
        label: 'Resistor R1',
        kind: 'select',
        options: [
          { value: 100000, label: '100 kΩ' },
          { value: 220000, label: '220 kΩ' },
          { value: 470000, label: '470 kΩ' },
        ],
      },
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [12, 10],
      b: [12, 20],
      label: 'C1',
      params: { capacitance: 10e-6 },
    },
    { id: 'G3', type: 'ground', at: [12, 20] },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [12, 10],
        [18, 10],
        [20, 10],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [18, 10],
        [18, 12],
        [20, 12],
      ],
    },
    { id: 'U1', type: 'timer-555', at: [24, 12], label: 'U1' },
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
    { id: 'G4', type: 'ground', at: [23, 23] },
    {
      id: 'C2',
      type: 'capacitor',
      a: [25, 17],
      b: [25, 23],
      label: 'C2',
      params: { capacitance: 10e-9 },
    },
    { id: 'G5', type: 'ground', at: [25, 23] },
    {
      id: 'W8',
      type: 'wire',
      points: [
        [28, 12],
        [32, 12],
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
      label: 'Luz',
      params: { color: 'yellow' },
    },
    { id: 'G6', type: 'ground', at: [32, 26] },
  ],
  probes: [
    { id: 'VTRIG', kind: 'voltage', plus: 'U1.trig', minus: 'GND', label: 'Disparo (pino 2)' },
    { id: 'VC', kind: 'voltage', plus: 'C1.a', minus: 'GND', label: 'Capacitor C1' },
    { id: 'VOUT', kind: 'voltage', plus: 'U1.out', minus: 'GND', label: 'Saída (pino 3)' },
  ],
});
