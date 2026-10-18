import { defineCircuit } from '../../engine';

/**
 * 9.8: dimming a 12 V LED strip with PWM. A microcontroller (firmware
 * m09/pwm) reads a potentiometer and switches a logic-level MOSFET at
 * 500 Hz; the strip is two segments of 3 white LEDs and 150 Ω, as in 9.4.
 * Runs 200 times slower than real time, so the blinking shows. The values
 * the lesson quotes are checked in ./mosfet.test.ts.
 */
const SEGMENTS = [3, 10];
const LED_X = [16, 23, 30, 37];

export default defineCircuit({
  id: 'm09/pwm-fita',
  title: 'Fita de LED com PWM',
  description:
    'Um microcontrolador alimentado por 5 V lê um potenciômetro na entrada A0 e liga e desliga um MOSFET de nível lógico 500 vezes por segundo pelo pino D9, através de um resistor de 220 Ω; um resistor de 10 kΩ mantém o gate em 0 V quando o pino solta. O MOSFET liga ao negativo dois segmentos de fita de LED de 12 V, cada um com um resistor de 150 Ω e três LEDs brancos. A fração de cada ciclo em que o MOSFET fica ligado, o ciclo de trabalho, acompanha o potenciômetro, e a corrente média na fita acompanha o ciclo de trabalho. A simulação roda 200 vezes mais devagar que o tempo real, e por isso os LEDs piscam.',
  analysis: { kind: 'transient', dt: 2e-5, speed: 0.005 },
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
        [6, 0],
        [6, 3],
        [6, 10],
      ],
    },
    ...SEGMENTS.flatMap((y, s) => [
      {
        id: `W${s + 2}`,
        type: 'wire',
        points: [
          [6, y],
          [10, y],
        ] as [number, number][],
      },
      {
        id: `R${s + 1}`,
        type: 'resistor',
        a: [10, y] as [number, number],
        b: [16, y] as [number, number],
        params: { resistance: 150 },
      },
      ...LED_X.slice(0, 3).map((x, k) => ({
        id: `D${3 * s + k + 1}`,
        type: 'led',
        a: [x, y] as [number, number],
        b: [LED_X[k + 1]!, y] as [number, number],
        params: { color: 'white' },
      })),
    ]),
    {
      id: 'W4',
      type: 'wire',
      points: [
        [37, 3],
        [41, 3],
        [41, 10],
        [41, 21],
      ],
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [37, 10],
        [41, 10],
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
      params: { firmware: 'm09/pwm', pinsLeft: 'A0,RF', pinsRight: 'D9' },
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
    { id: 'VG', kind: 'voltage', plus: 'Q1.g', minus: 'GND', label: 'Tensão no gate' },
    { id: 'VD', kind: 'voltage', plus: 'Q1.d', minus: 'GND', label: 'Tensão no dreno' },
    { id: 'IF', kind: 'current', element: 'R1', label: 'Corrente num segmento da fita' },
  ],
  goals: [
    {
      id: 'quarto',
      description: 'Gire o potenciômetro até o ciclo de trabalho ficar em 25 %.',
      check: { readout: 'U1.ciclo', op: 'between', value: [0.24, 0.26] },
      solution: { 'P1.position': 0.25 },
      at: 0.01,
    },
    {
      id: 'maximo',
      description: 'Gire o potenciômetro até o fim: o MOSFET fica ligado o tempo todo.',
      check: { readout: 'U1.ciclo', op: '>=', value: 0.99 },
      solution: { 'P1.position': 1 },
      at: 0.01,
    },
  ],
});
