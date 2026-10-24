import { defineCircuit } from '../../engine';

/**
 * 12.4: speed of a small 12 V DC motor by PWM (firmware m12/motor-pwm). The
 * potentiometer on A0 sets the duty cycle of a 1 kHz square wave on D9,
 * which switches a logic-level MOSFET (as in 9.8) through 220 Ω, with a
 * 10 kΩ gate pull-down; a 1N4007-type diode across the motor carries its
 * current while the MOSFET is off. The soft start switch on D4 ramps the
 * duty cycle over 1 s. Runs ten times slower than real time. The values the
 * lesson quotes are checked in ./circuitos.test.ts.
 */
export default defineCircuit({
  id: 'm12/motor-pwm',
  title: 'Velocidade de um motor CC por PWM',
  description:
    'Um microcontrolador alimentado por 5 V lê um potenciômetro na entrada A0 e gera no pino D9 uma onda quadrada de 1 kHz cujo ciclo de trabalho acompanha o potenciômetro. O pino comanda, por um resistor de 220 Ω, o gate de um MOSFET de nível lógico; um resistor de 10 kΩ mantém o gate em 0 V quando o pino solta. O MOSFET liga ao negativo um motor CC de 12 V, alimentado por uma fonte de 12 V, com um diodo em paralelo que dá caminho à corrente do motor enquanto o MOSFET está desligado. Uma chave no pino D4 liga a partida suave: o ciclo de trabalho sobe aos poucos, de 0 a 100 % em 1 s, em vez de saltar direto para o valor do potenciômetro. A simulação roda dez vezes mais devagar que o tempo real.',
  analysis: { kind: 'transient', dt: 5e-5, speed: 0.1 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 6],
      b: [0, 28],
      label: '5 V',
      params: { voltage: 5 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 6],
        [6, 6],
        [22, 6],
        [22, 11],
      ],
    },
    {
      id: 'P1',
      type: 'potentiometer',
      at: [6, 13],
      rot: 90,
      flip: true,
      label: 'Velocidade',
      params: { resistance: 10000, position: 0 },
      control: {
        param: 'position',
        label: 'Potenciômetro da velocidade',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.05,
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [6, 6],
        [6, 9],
      ],
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [9, 13],
        [16, 13],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [6, 17],
        [6, 28],
      ],
    },
    {
      id: 'U1',
      type: 'mcu',
      at: [22, 15],
      label: 'Micro',
      params: { firmware: 'm12/motor-pwm', pinsLeft: 'A0,D4,RF', pinsRight: 'D9' },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [16, 15],
        [12, 15],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [12, 15],
      b: [12, 22],
      label: 'Suave',
      params: { closed: true },
      control: { param: 'closed', label: 'Partida suave', kind: 'toggle' },
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [12, 22],
        [12, 28],
      ],
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [16, 17],
        [14, 17],
        [14, 28],
      ],
    },
    {
      id: 'W8',
      type: 'wire',
      points: [
        [22, 19],
        [22, 28],
      ],
    },
    {
      id: 'RG',
      type: 'resistor',
      a: [28, 13],
      b: [32, 13],
      params: { resistance: 220 },
    },
    {
      id: 'W9',
      type: 'wire',
      points: [
        [32, 13],
        [34, 13],
      ],
    },
    {
      id: 'RPD',
      type: 'resistor',
      a: [32, 13],
      b: [32, 28],
      params: { resistance: 10000 },
    },
    {
      id: 'Q1',
      type: 'nmos',
      at: [36, 13],
      label: 'Q1',
      // A logic-level MOSFET like the one of lesson 9.8.
      params: { vth: 1.5, kp: 11.4, power: 2, vgsMax: 16 },
    },
    {
      id: 'W10',
      type: 'wire',
      points: [
        [37, 15],
        [37, 28],
      ],
    },
    {
      id: 'M1',
      type: 'dc-motor',
      a: [37, 2],
      b: [37, 9],
      label: 'Motor 12 V',
      params: { load: 0.005 },
    },
    {
      id: 'W11',
      type: 'wire',
      points: [
        [37, 9],
        [37, 11],
      ],
    },
    {
      id: 'W12',
      type: 'wire',
      points: [
        [37, 9],
        [45, 9],
      ],
    },
    {
      id: 'D1',
      type: 'diode',
      a: [45, 9],
      b: [45, 2],
      label: 'D1',
      params: { model: 'rectifier' },
    },
    {
      id: 'V2',
      type: 'dc-voltage',
      a: [51, 2],
      b: [51, 28],
      label: '12 V',
      params: { voltage: 12 },
    },
    {
      id: 'W13',
      type: 'wire',
      points: [
        [37, 2],
        [45, 2],
        [51, 2],
      ],
    },
    {
      id: 'W14',
      type: 'wire',
      points: [
        [0, 28],
        [6, 28],
        [12, 28],
        [14, 28],
        [22, 28],
        [32, 28],
        [37, 28],
        [51, 28],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 28] },
  ],
  probes: [
    { id: 'IM', kind: 'current', element: 'M1', label: 'Corrente no motor' },
    { id: 'VD', kind: 'voltage', plus: 'Q1.d', minus: 'GND', label: 'Tensão no dreno' },
  ],
  goals: [
    {
      id: 'metade',
      description: 'Gire o potenciômetro até o meio: o ciclo de trabalho vai a 50 %.',
      check: { readout: 'U1.ciclo', op: 'between', value: [49, 51] },
      solution: { 'P1.position': 0.5 },
      at: 0.7,
    },
  ],
});
