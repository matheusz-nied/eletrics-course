import { defineCircuit } from '../../engine';

/** 02.6: a 10 kΩ potentiometer as an adjustable divider on a 5 V supply. */
export default defineCircuit({
  id: 'm02/divisor-potenciometro',
  title: 'Potenciômetro como divisor de tensão',
  description:
    'Uma fonte de 5 V alimenta as duas pontas de um potenciômetro de 10 kΩ. O cursor divide a pista em dois resistores, e a tensão entre o cursor e o negativo vai de 0 a 5 V conforme a posição. É assim que um botão de volume ou um ajuste numa placa entrega uma tensão variável a um circuito.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'V1', type: 'dc-voltage', a: [0, 0], b: [0, 16], params: { voltage: 5 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [8, 0],
      ],
    },
    {
      id: 'P1',
      type: 'potentiometer',
      at: [12, 0],
      rot: 180,
      params: { resistance: 10000, position: 0.5 },
      control: {
        param: 'position',
        label: 'Posição do cursor de P1',
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
        [22, 0],
        [22, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [12, 3],
        [12, 9],
      ],
    },
  ],
  probes: [{ id: 'VS', kind: 'voltage', plus: 'P1.w', minus: 'GND', label: 'Tensão no cursor' }],
  goals: [
    {
      id: 'meio',
      description: 'Com o cursor no meio, a saída fica em 2,5 V.',
      check: { readout: 'VS', op: 'between', value: [2.45, 2.55] },
    },
    {
      id: 'tres-v-tres',
      description: 'Ajuste o cursor para a saída ficar entre 3,2 V e 3,4 V.',
      check: { readout: 'VS', op: 'between', value: [3.2, 3.4] },
      solution: { 'P1.position': 0.66 },
    },
  ],
});
