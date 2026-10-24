import { defineCircuit } from '../../engine';

/**
 * 11.6: PWM as an average voltage. A 100 Hz square wave of 0 V and 5 V with
 * a selectable duty cycle feeds an RC low-pass filter (10 kΩ and a
 * selectable capacitor); the capacitor settles at duty × 5 V, with a ripple
 * that the bigger capacitor makes small. Runs ten times slower than real
 * time. Checked in ./conversao.test.ts.
 */
export default defineCircuit({
  id: 'm11/pwm-filtro',
  title: 'PWM e filtro RC',
  description:
    'Uma fonte de onda quadrada de 0 V e 5 V, com 100 Hz e ciclo de trabalho que pode ser escolhido, faz o papel da saída PWM de um microcontrolador. Ela alimenta um filtro RC: um resistor de 10 kΩ em série e um capacitor, que também pode ser escolhido, para o GND. A tensão no capacitor é a saída filtrada. A simulação roda dez vezes mais devagar que o tempo real.',
  analysis: { kind: 'transient', dt: 1e-4, speed: 0.1 },
  elements: [
    {
      id: 'VP',
      type: 'square-voltage',
      a: [0, 0],
      b: [0, 10],
      label: 'PWM',
      params: { high: 5, low: 0, frequency: 100, duty: 0.25 },
      control: {
        param: 'duty',
        label: 'Ciclo de trabalho',
        kind: 'select',
        options: [
          { value: 0.1, label: '10 %' },
          { value: 0.25, label: '25 %' },
          { value: 0.5, label: '50 %' },
          { value: 0.75, label: '75 %' },
          { value: 0.9, label: '90 %' },
        ],
      },
    },
    { id: 'G1', type: 'ground', at: [0, 10] },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [4, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [4, 0],
      b: [12, 0],
      label: 'R1',
      params: { resistance: 10000 },
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [12, 0],
      b: [12, 10],
      label: 'C1',
      params: { capacitance: 10e-6 },
      control: {
        param: 'capacitance',
        label: 'Capacitor do filtro',
        kind: 'select',
        options: [
          { value: 1e-6, label: '1 µF' },
          { value: 10e-6, label: '10 µF' },
        ],
      },
    },
    { id: 'G2', type: 'ground', at: [12, 10] },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 0],
        [18, 0],
      ],
    },
  ],
  probes: [
    { id: 'VPWM', kind: 'voltage', plus: 'VP.a', minus: 'GND', label: 'Sinal PWM' },
    { id: 'VMED', kind: 'voltage', plus: 'C1.a', minus: 'GND', label: 'Saída do filtro' },
  ],
  goals: [
    {
      id: 'tres-volts',
      description: 'Escolha o ciclo de trabalho que leva a saída do filtro para perto de 3,75 V.',
      check: { readout: 'VMED', op: 'between', value: [3.5, 4] },
      at: 1,
      solution: { 'VP.duty': 0.75 },
    },
  ],
});
