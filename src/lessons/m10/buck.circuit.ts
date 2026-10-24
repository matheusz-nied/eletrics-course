import { defineCircuit } from '../../engine';

/**
 * 10.2: a buck converter from 12 V. A P-channel MOSFET switches at 50 kHz,
 * driven by a PWM source tied to the input (the gate goes 10 V below the
 * source while the switch is on); a Schottky diode, a 100 µH inductor and a
 * 100 µF capacitor turn the pulses into a steady voltage. The values the
 * lesson quotes are checked in ./fontes-chaveadas.test.ts.
 */
export default defineCircuit({
  id: 'm10/buck',
  title: 'Conversor buck de 12 V',
  description:
    'Uma fonte de 12 V alimenta um MOSFET que liga e desliga 50 mil vezes por segundo, comandado por um sinal PWM. Quando o MOSFET está ligado, a corrente passa pelo indutor e carrega o capacitor de saída; quando desliga, o indutor mantém a corrente circulando pelo diodo Schottky. A saída fica perto do ciclo de trabalho vezes 12 V. O canal 1 do osciloscópio mostra o nó de chaveamento, que pula entre 12 V e quase zero; o canal 2 mostra a corrente no indutor, em dente de serra. Dá para mudar o ciclo de trabalho e a carga.',
  analysis: { kind: 'transient', dt: 2.5e-7, speed: 0.0005, tStop: 0.012 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 4],
      b: [0, 16],
      label: 'Entrada 12 V',
      params: { voltage: 12 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 4],
        [4, 4],
        [8, 4],
      ],
    },
    {
      id: 'VG',
      type: 'pulse-voltage',
      a: [4, -4],
      b: [10, -4],
      label: 'PWM',
      params: { high: 10, low: 0, frequency: 50e3, duty: 0.44 },
      control: {
        param: 'duty',
        label: 'Ciclo de trabalho',
        kind: 'slider',
        min: 0.1,
        max: 0.9,
        step: 0.01,
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [4, -4],
        [4, 4],
      ],
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [10, -4],
        [10, 1],
      ],
    },
    {
      id: 'Q1',
      type: 'pmos',
      at: [10, 3],
      rot: 90,
      label: 'Q1',
      params: { vth: 2, kp: 10, power: 2 },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [12, 4],
        [14, 4],
        [16, 4],
      ],
    },
    {
      id: 'D1',
      type: 'diode',
      a: [14, 16],
      b: [14, 4],
      label: 'D1',
      params: { model: 'schottky' },
    },
    {
      id: 'L1',
      type: 'inductor',
      a: [16, 4],
      b: [26, 4],
      label: 'L1',
      params: { inductance: 100e-6, resistance: 0.05 },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [26, 4],
        [30, 4],
        [36, 4],
      ],
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [30, 4],
      b: [30, 16],
      label: 'C1',
      params: { capacitance: 100e-6, voltage: 16, polarized: true },
    },
    {
      id: 'RL',
      type: 'resistor',
      a: [36, 4],
      b: [36, 16],
      label: 'Carga',
      params: { resistance: 10, watts: 20 },
      control: {
        param: 'resistance',
        label: 'Carga',
        kind: 'select',
        options: [
          { value: 50, label: '0,1 A (50 Ω)' },
          { value: 10, label: '0,5 A (10 Ω)' },
          { value: 5, label: '1 A (5 Ω)' },
        ],
      },
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [0, 16],
        [14, 16],
        [22, 16],
        [30, 16],
        [36, 16],
      ],
    },
    { id: 'G1', type: 'ground', at: [22, 16] },
  ],
  probes: [
    { id: 'VSW', kind: 'voltage', plus: 'Q1.d', minus: 'GND', label: 'Nó de chaveamento' },
    { id: 'IL', kind: 'current', element: 'L1', label: 'Corrente no indutor' },
    { id: 'VOUT', kind: 'voltage', plus: 'RL.a', minus: 'GND', label: 'Saída' },
    { id: 'IIN', kind: 'current', element: 'V1', label: 'Corrente da entrada' },
  ],
});
