import { defineCircuit } from '../../engine';

/**
 * Lesson 16.8: the PAUSA trimpot is a voltage divider read by the ADC of
 * the microcontroller; the firmware turns 0–5 V into 0–120 s.
 */
export default defineCircuit({
  id: 'm16/trimpot-pausa',
  title: 'Trimpot PAUSA como divisor de tensão',
  description:
    'Um trimpot de 10 kΩ está ligado entre o GND e os 5 V da lógica, e o cursor vai a uma entrada analógica do microcontrolador. No meio do curso o cursor fica em 2,5 V; a central converte a leitura em tempo de pausa: 50 % de 120 s, ou seja, 60 s. Abaixo de 2 s a central desliga o fechamento automático.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 10],
      params: { voltage: 5 },
      label: '5 V da lógica',
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [16, 0],
      ],
    },
    {
      id: 'P1',
      type: 'potentiometer',
      at: [12, 10],
      params: { resistance: 10000, position: 0.5 },
      label: 'trimpot PAUSA',
      control: {
        param: 'position',
        label: 'Trimpot PAUSA',
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
        [16, 0],
        [16, 10],
      ],
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [0, 10],
        [8, 10],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [12, 7],
        [12, 3],
        [24, 3],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [24, 3],
      b: [24, 10],
      params: { resistance: 1000000 },
      label: 'entrada analógica',
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [24, 10],
        [24, 14],
        [0, 14],
        [0, 10],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 10] },
  ],
  probes: [{ id: 'VP', kind: 'voltage', plus: 'P1.w', minus: 'GND', label: 'Cursor do trimpot' }],
  goals: [
    {
      id: 'trinta-segundos',
      description: 'Ajuste o trimpot para 30 s de pausa: 25 % do curso, 1,25 V no cursor.',
      check: { readout: 'VP', op: 'between', value: [1.23, 1.26] },
      solution: { 'P1.position': 0.25 },
    },
    {
      id: 'maximo',
      description: 'Leve a pausa ao máximo, 120 s: o cursor chega a 5 V.',
      check: { readout: 'VP', op: '>', value: 4.95 },
      solution: { 'P1.position': 1 },
    },
    {
      id: 'desligada',
      description:
        'Desligue o fechamento automático: abaixo de 2 s de pausa (menos de 0,08 V) a central não fecha sozinha.',
      check: { readout: 'VP', op: '<', value: 0.08 },
      solution: { 'P1.position': 0 },
    },
  ],
});
