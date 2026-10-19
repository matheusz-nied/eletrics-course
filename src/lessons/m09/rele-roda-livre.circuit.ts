import { defineCircuit } from '../../engine';

/**
 * 9.6: a transistor drives a 12 V relay from a 3,3 V microcontroller pin.
 * Switching the coil off makes its current look for a path: with the
 * freewheeling diode it circulates through the diode and the collector only
 * goes to about 12,7 V; without it the collector shoots up until the
 * transistor goes into avalanche (the engine warns). The values the lesson
 * quotes are checked in ./transistor.test.ts.
 */
export default defineCircuit({
  id: 'm09/rele-roda-livre',
  title: 'Relé com e sem diodo de roda livre',
  description:
    'Um pino de 3,3 V de um microcontrolador liga a base de um transistor NPN por um resistor de 820 Ω, com um resistor de 10 kΩ da base ao negativo. O transistor liga a bobina de um relé de 12 V, e o contato do relé acende um LED. Em paralelo com a bobina há um diodo, que uma chave pode tirar do circuito. Com o diodo, quando o pino desliga, a tensão no coletor sobe só até cerca de 12,7 V e a corrente da bobina morre aos poucos pelo diodo. Sem o diodo, o coletor dispara para mais de 30 V, a tensão máxima do transistor, que entra em avalanche.',
  analysis: { kind: 'transient', dt: 1e-5, speed: 0.01 },
  elements: [
    {
      id: 'V2',
      type: 'dc-voltage',
      a: [0, 20],
      b: [0, 30],
      label: 'Pino 3,3 V',
      params: { voltage: 3.3 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 20],
        [3, 20],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [3, 20],
      b: [7, 20],
      label: 'Pino',
      params: { closed: false },
      control: { param: 'closed', label: 'Pino do microcontrolador ligado', kind: 'toggle' },
    },
    {
      id: 'RB',
      type: 'resistor',
      a: [7, 20],
      b: [13, 20],
      label: 'RB',
      params: { resistance: 820 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [13, 20],
        [15, 20],
        [17, 20],
      ],
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [15, 20],
      b: [15, 30],
      label: 'R2',
      params: { resistance: 10000 },
    },
    {
      id: 'Q1',
      type: 'npn',
      at: [19, 20],
      label: 'Q1',
      // A BC548: 30 V between collector and emitter, 0,5 W.
      params: { beta: 200, vceo: 30, power: 0.5 },
    },
    {
      id: 'K1',
      type: 'relay-spdt',
      at: [22, 12],
      label: 'Relé 12 V',
      params: { coilVoltage: 12, coilResistance: 400, coilInductance: 0.15 },
    },
    {
      id: 'WK',
      type: 'wire',
      points: [
        [20, 0],
        [20, 10],
      ],
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [20, 14],
        [20, 16],
        [20, 18],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [20, 16],
        [12, 16],
      ],
    },
    {
      id: 'D1',
      type: 'diode',
      a: [12, 16],
      b: [12, 10],
      label: 'D1',
      params: { model: 'rectifier' },
    },
    {
      id: 'S2',
      type: 'switch',
      a: [12, 10],
      b: [12, 4],
      label: 'S2',
      params: { closed: true },
      control: { param: 'closed', label: 'Diodo de roda livre ligado', kind: 'toggle' },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [12, 4],
        [12, 0],
        [20, 0],
        [30, 0],
        [38, 0],
      ],
    },
    {
      id: 'LED1',
      type: 'led',
      a: [30, 0],
      b: [30, 5],
      label: 'LED',
      params: { color: 'red' },
    },
    {
      id: 'R3',
      type: 'resistor',
      a: [30, 5],
      b: [30, 10],
      label: 'R3',
      params: { resistance: 470 },
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [30, 10],
        [25, 10],
      ],
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [24, 14],
        [24, 30],
      ],
    },
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [38, 0],
      b: [38, 30],
      label: 'Fonte 12 V',
      params: { voltage: 12 },
    },
    {
      id: 'W8',
      type: 'wire',
      points: [
        [20, 22],
        [20, 30],
      ],
    },
    {
      id: 'W9',
      type: 'wire',
      points: [
        [0, 30],
        [15, 30],
        [20, 30],
        [24, 30],
        [38, 30],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 30] },
  ],
  probes: [
    { id: 'VC', kind: 'voltage', plus: 'Q1.c', minus: 'GND', label: 'Tensão no coletor' },
    { id: 'IK', kind: 'current', element: 'WK', label: 'Corrente na bobina' },
    { id: 'VP', kind: 'voltage', plus: 'RB.a', minus: 'GND', label: 'Tensão do pino' },
  ],
  goals: [
    {
      id: 'liga',
      description: 'Ligue o pino: o transistor satura, o relé atraca e o LED acende.',
      check: { readout: 'K1.closed', op: '==', value: true },
      at: 0.05,
      solution: { 'S1.closed': true },
    },
  ],
});
