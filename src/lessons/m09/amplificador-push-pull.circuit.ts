import { defineCircuit } from '../../engine';

/**
 * 9.7: a complementary push-pull output stage on ±12 V. The NPN pushes the
 * positive half into the load and the PNP pulls the negative half. Two diodes
 * hold the bases about 1,3 V apart so both transistors conduct a little at
 * rest (class AB); the switch S1 shorts them and the stage becomes class B,
 * with the crossover gap. The values the lesson quotes are checked in
 * ./amplificador.test.ts.
 */
export default defineCircuit({
  id: 'm09/amplificador-push-pull',
  title: 'Estágio de saída push-pull',
  description:
    'Dois transistores complementares, um NPN em cima e um PNP embaixo, com os emissores juntos na saída e uma carga de 100 Ω para o terra. A fonte é simétrica, de +12 V e −12 V. Um divisor de dois resistores de 2,2 kΩ com dois diodos no meio polariza as bases; o gerador de sinais entra na base do NPN por um capacitor de 10 µF. A chave S1 põe os diodos em curto: fechada, o estágio é classe B e a saída fica parada enquanto a entrada está entre cerca de −0,6 V e +0,6 V; aberta, os diodos deixam os dois transistores conduzindo um pouco em repouso (classe AB) e a saída acompanha a entrada.',
  analysis: { kind: 'transient', dt: 2e-5, speed: 0.02 },
  elements: [
    {
      id: 'V2',
      type: 'ac-voltage',
      a: [0, 15],
      b: [0, 30],
      label: 'Gerador',
      params: { amplitude: 2, frequency: 1000 },
      control: {
        param: 'amplitude',
        label: 'Amplitude do sinal de entrada (pico)',
        kind: 'slider',
        min: 0.2,
        max: 8,
        step: 0.1,
        unit: 'V',
      },
    },
    {
      id: 'W0',
      type: 'wire',
      points: [
        [0, 15],
        [0, 8],
      ],
    },
    {
      id: 'CIN',
      type: 'capacitor',
      a: [0, 8],
      b: [6, 8],
      label: 'Entrada',
      params: { capacitance: 10e-6 },
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [12, 0],
      b: [12, 8],
      label: 'R1',
      params: { resistance: 2200 },
    },
    {
      id: 'D1',
      type: 'diode',
      a: [12, 8],
      b: [12, 15],
      label: 'D1',
      params: { model: 'signal' },
    },
    {
      id: 'D2',
      type: 'diode',
      a: [12, 15],
      b: [12, 22],
      label: 'D2',
      params: { model: 'signal' },
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [12, 22],
      b: [12, 30],
      label: 'R2',
      params: { resistance: 2200 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [12, 8],
        [6, 8],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [6, 8],
      b: [6, 22],
      label: 'S1',
      params: { closed: true },
      control: { param: 'closed', label: 'Diodos em curto (classe B)', kind: 'toggle' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [6, 22],
        [12, 22],
      ],
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [12, 8],
        [18, 8],
      ],
    },
    {
      id: 'Q1',
      type: 'npn',
      at: [20, 8],
      label: 'Q1',
      params: { beta: 200, vceo: 45, power: 0.625 },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [12, 22],
        [18, 22],
      ],
    },
    {
      id: 'Q2',
      type: 'pnp',
      at: [20, 22],
      rot: 180,
      flip: true,
      label: 'Q2',
      params: { beta: 200, vceo: 45, power: 0.625 },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [21, 10],
        [21, 15],
        [21, 20],
      ],
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [21, 15],
        [27, 15],
      ],
    },
    {
      id: 'RL',
      type: 'resistor',
      a: [27, 15],
      b: [27, 30],
      label: 'Carga',
      params: { resistance: 100 },
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [12, 0],
        [21, 0],
        [21, 6],
      ],
    },
    {
      id: 'W8',
      type: 'wire',
      points: [
        [21, 0],
        [36, 0],
      ],
    },
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [36, 0],
      b: [36, 15],
      label: '+12 V',
      params: { voltage: 12 },
    },
    {
      id: 'V3',
      type: 'dc-voltage',
      a: [36, 15],
      b: [36, 36],
      label: '−12 V',
      params: { voltage: 12 },
    },
    {
      id: 'W9',
      type: 'wire',
      points: [
        [12, 30],
        [12, 36],
        [21, 36],
        [36, 36],
      ],
    },
    {
      id: 'W10',
      type: 'wire',
      points: [
        [21, 24],
        [21, 36],
      ],
    },
    {
      id: 'W11',
      type: 'wire',
      points: [
        [0, 30],
        [27, 30],
        [32, 30],
        [32, 15],
        [36, 15],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 30] },
  ],
  probes: [
    { id: 'VIN', kind: 'voltage', plus: 'V2.a', minus: 'GND', label: 'Entrada' },
    { id: 'VOUT', kind: 'voltage', plus: 'RL.a', minus: 'GND', label: 'Saída' },
  ],
  goals: [
    {
      id: 'classe-ab',
      description:
        'Abra S1: os diodos voltam a separar as bases, os dois transistores conduzem um pouco em repouso e a saída acompanha a entrada sem o degrau no zero.',
      check: { readout: 'D1.current', op: '>', value: 1e-3 },
      solution: { 'S1.closed': false },
    },
  ],
});
