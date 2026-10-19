import { defineCircuit } from '../../engine';

/**
 * 12.2: a staircase light timer as a state machine (firmware m12/minuteria).
 * The button on BOT uses the internal pull-up; the TEMPO trimpot sets the
 * timer (10 s as it starts); the light is a white LED. The behavior the
 * lesson describes is checked in ./circuitos.test.ts.
 */
export default defineCircuit({
  id: 'm12/minuteria',
  title: 'Minuteria de escada com microcontrolador',
  description:
    'Um microcontrolador alimentado por 5 V roda a máquina de estados de uma luz de escada. O botão da escada liga o pino BOT ao negativo, com o pull-up interno. Um trimpot de 10 kΩ na entrada analógica TEMPO ajusta o tempo da luz, de 5 a 60 s; ele começa em 10 s. A saída LUZ acende um LED branco por um resistor de 150 Ω. Um toque acende a luz pelo tempo ajustado; outro toque com a luz acesa recomeça a contagem; segurar o botão por 2 s deixa a luz acesa direto, até o próximo toque. A entrada do receptor de rádio não é usada e fica ligada ao negativo.',
  analysis: { kind: 'transient', dt: 0.001, speed: 1 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 4],
      b: [0, 22],
      label: '5 V',
      params: { voltage: 5 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 4],
        [14, 4],
        [26, 4],
        [26, 10],
      ],
    },
    {
      id: 'P1',
      type: 'potentiometer',
      at: [14, 12],
      rot: 90,
      flip: true,
      label: 'Tempo',
      params: { resistance: 10000, position: 0.09 },
      control: {
        param: 'position',
        label: 'Trimpot do tempo',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [14, 4],
        [14, 8],
      ],
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [17, 12],
        [20, 12],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [14, 16],
        [14, 22],
      ],
    },
    {
      id: 'U1',
      type: 'mcu',
      at: [26, 13],
      label: 'Micro',
      params: { firmware: 'm12/minuteria', pinsLeft: 'TEMPO,RF', pinsRight: 'BOT,LUZ' },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [20, 14],
        [18, 14],
        [18, 22],
      ],
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [26, 16],
        [26, 22],
      ],
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [32, 12],
        [34, 12],
        [34, 7],
        [36, 7],
      ],
    },
    {
      id: 'S1',
      type: 'push-button',
      a: [36, 7],
      b: [42, 7],
      label: 'Botão da escada',
      control: { param: 'pressed', label: 'Botão da escada', kind: 'momentary' },
    },
    { id: 'G2', type: 'ground', at: [42, 7] },
    {
      id: 'W8',
      type: 'wire',
      points: [
        [32, 14],
        [34, 14],
        [34, 18],
        [36, 18],
      ],
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [36, 18],
      b: [42, 18],
      params: { resistance: 150 },
    },
    {
      id: 'D1',
      type: 'led',
      a: [42, 18],
      b: [47, 18],
      label: 'Luz',
      params: { color: 'white' },
    },
    { id: 'G3', type: 'ground', at: [47, 18] },
    {
      id: 'W9',
      type: 'wire',
      points: [
        [0, 22],
        [14, 22],
        [18, 22],
        [26, 22],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 22] },
  ],
  probes: [{ id: 'ILUZ', kind: 'current', element: 'D1', label: 'Corrente na luz' }],
  goals: [
    {
      id: 'tempo',
      description: 'Com o trimpot no começo, a luz fica acesa 10 s a cada toque.',
      check: { readout: 'U1.tempo', op: '==', value: 10 },
      at: 0.05,
    },
    {
      id: 'maximo',
      description: 'Gire o trimpot até o fim: a luz passa a ficar acesa 60 s.',
      check: { readout: 'U1.tempo', op: '==', value: 60 },
      solution: { 'P1.position': 1 },
      at: 0.05,
    },
  ],
});
