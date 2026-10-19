import { defineCircuit } from '../../engine';
import { SMALL_MOTOR } from './ponte-h.circuit';

/**
 * 8.2: speed control by PWM. A board like the one of lesson 9.8 (firmware
 * m08/pwm-motor: a potentiometer on A0, 4 kHz PWM on D9) switches a logic-level MOSFET on
 * the negative side of the small motor of ./ponte-h.circuit.ts; a diode
 * across the motor gives its current a path when the MOSFET turns off.
 * Runs 20 times slower than real time, so the pulses show on the
 * oscilloscope while the speed settles.
 */
export default defineCircuit({
  id: 'm08/pwm-motor',
  title: 'Velocidade do motor por PWM',
  description:
    'Um microcontrolador alimentado por 5 V lê um potenciômetro na entrada A0 e liga e desliga um MOSFET 4.000 vezes por segundo pelo pino D9, através de um resistor de 220 Ω; um resistor de 10 kΩ mantém o gate em 0 V quando o pino solta. O MOSFET liga ao negativo um motor de corrente contínua de 12 V, cujo outro terminal vai ao positivo da fonte. Um diodo em paralelo com o motor, com o catodo no positivo, dá caminho à corrente do motor nos instantes em que o MOSFET desliga. O ciclo de trabalho acompanha o potenciômetro, a tensão média no motor acompanha o ciclo de trabalho, e a rotação acompanha a tensão média. A simulação roda 20 vezes mais devagar que o tempo real.',
  analysis: { kind: 'transient', dt: 1.25e-5, speed: 0.05 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [47, 0],
      b: [47, 30],
      label: 'Fonte 12 V',
      params: { voltage: 12 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [47, 0],
        [41, 0],
        [41, 4],
      ],
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [41, 4],
        [33, 4],
      ],
    },
    {
      id: 'M1',
      type: 'dc-motor',
      a: [41, 4],
      b: [41, 16],
      label: 'Motor',
      // A small fan on the shaft: its drag grows with the speed.
      params: { ...SMALL_MOTOR, inductance: 0.003, friction: 2e-5 },
    },
    {
      id: 'D1',
      type: 'diode',
      a: [33, 16],
      b: [33, 4],
      label: 'D1',
      params: { model: 'rectifier' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [33, 16],
        [41, 16],
        [41, 21],
      ],
    },
    {
      id: 'Q1',
      type: 'nmos',
      at: [40, 23],
      label: 'Q1',
      params: { vth: 1.5, kp: 11.4, power: 2, vgsMax: 16 },
    },
    {
      id: 'V2',
      type: 'dc-voltage',
      a: [0, 19],
      b: [0, 30],
      label: '5 V (USB)',
      params: { voltage: 5 },
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [0, 19],
        [0, 16],
        [16, 16],
        [16, 21],
      ],
    },
    // The potentiometer is fed from the side so the wire stays clear of its label.
    {
      id: 'W7',
      type: 'wire',
      points: [
        [0, 19],
        [5, 19],
      ],
    },
    {
      id: 'P1',
      type: 'potentiometer',
      at: [5, 23],
      rot: 90,
      // Flipped: the end that reads 0 V (a) at the bottom, so turning it up raises the duty cycle.
      flip: true,
      label: 'P1',
      params: { resistance: 10000, position: 0.5 },
      control: {
        param: 'position',
        label: 'Potenciômetro',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
      },
    },
    {
      id: 'W8',
      type: 'wire',
      points: [
        [8, 23],
        [10, 23],
      ],
    },
    {
      id: 'U1',
      type: 'mcu',
      at: [16, 24],
      label: 'Arduino',
      params: { firmware: 'm08/pwm-motor', pinsLeft: 'A0,RF', pinsRight: 'D9' },
    },
    // The radio input is not used: tied to ground, as unused inputs should be.
    {
      id: 'W14',
      type: 'wire',
      points: [
        [10, 25],
        [10, 30],
      ],
    },
    {
      id: 'W15',
      type: 'wire',
      points: [
        [22, 23],
        [24, 23],
      ],
    },
    {
      id: 'RG',
      type: 'resistor',
      a: [24, 23],
      b: [30, 23],
      label: 'RG',
      params: { resistance: 220 },
    },
    {
      id: 'W9',
      type: 'wire',
      points: [
        [30, 23],
        [33, 23],
        [38, 23],
      ],
    },
    {
      id: 'RPD',
      type: 'resistor',
      a: [33, 23],
      b: [33, 30],
      label: 'RPD',
      params: { resistance: 10000 },
    },
    {
      id: 'W10',
      type: 'wire',
      points: [
        [41, 25],
        [41, 30],
      ],
    },
    {
      id: 'W11',
      type: 'wire',
      points: [
        [5, 27],
        [5, 30],
      ],
    },
    {
      id: 'W12',
      type: 'wire',
      points: [
        [16, 27],
        [16, 30],
      ],
    },
    {
      id: 'W13',
      type: 'wire',
      points: [
        [47, 30],
        [41, 30],
        [33, 30],
        [16, 30],
        [10, 30],
        [5, 30],
        [0, 30],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 30] },
  ],
  probes: [
    { id: 'VM', kind: 'voltage', plus: 'M1.a', minus: 'M1.b', label: 'Tensão no motor' },
    { id: 'IM', kind: 'current', element: 'M1', label: 'Corrente no motor' },
  ],
  goals: [
    {
      id: 'metade',
      description: 'Com o potenciômetro no meio, o ciclo de trabalho fica em 50 %.',
      check: { readout: 'U1.ciclo', op: 'between', value: [0.49, 0.51] },
      at: 0.01,
    },
    {
      id: 'metade-rpm',
      description: 'Com 50 %, o motor gira a uns 2.200 rpm.',
      check: { readout: 'M1.rpm', op: 'between', value: [2150, 2300] },
      at: 1,
    },
    {
      id: 'cheio',
      description: 'Gire o potenciômetro até o fim: 100 %, e o motor gira a uns 4.770 rpm.',
      check: { readout: 'M1.rpm', op: 'between', value: [4700, 4830] },
      solution: { 'P1.position': 1 },
      at: 1,
    },
  ],
});
