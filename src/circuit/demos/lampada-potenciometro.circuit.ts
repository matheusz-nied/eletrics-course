import { defineCircuit } from '../engine';

/** Lamp dimmed by a potentiometer wired as a rheostat, with an on/off switch. */
export default defineCircuit({
  id: 'demo/lampada-potenciometro',
  title: 'Lâmpada com chave e potenciômetro',
  description:
    'Uma bateria de 12 V alimenta uma lâmpada de 12 V e 5 W através de uma chave liga/desliga e de um potenciômetro de 50 Ω ligado como reostato. Girar o potenciômetro muda a corrente e o brilho da lâmpada.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'B1', type: 'battery', a: [0, 0], b: [0, 12], params: { voltage: 12 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [6, 0],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [6, 0],
      b: [12, 0],
      params: { closed: true },
      control: { param: 'closed', label: 'Chave S1', kind: 'toggle' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 0],
        [16, 0],
      ],
    },
    {
      id: 'P1',
      type: 'potentiometer',
      at: [20, 0],
      params: { resistance: 50, position: 0.3, watts: 10 },
      control: {
        param: 'position',
        label: 'Potenciômetro P1',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
      },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [20, -3],
        [24, -3],
        [24, 0],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [24, 0],
        [28, 0],
      ],
    },
    { id: 'L1', type: 'lamp', a: [28, 0], b: [28, 12], params: { voltage: 12, power: 5 } },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [28, 12],
        [0, 12],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 12] },
  ],
  probes: [
    { id: 'VL', kind: 'voltage', plus: 'L1.a', minus: 'L1.b', label: 'Tensão na lâmpada' },
    { id: 'IL', kind: 'current', element: 'L1', label: 'Corrente na lâmpada' },
  ],
  goals: [
    {
      id: 'brilho',
      description: 'Deixe a lâmpada com pelo menos 90 % do brilho nominal.',
      check: { readout: 'L1.brightness', op: '>=', value: 0.9 },
      solution: { 'P1.position': 0 },
    },
  ],
});
