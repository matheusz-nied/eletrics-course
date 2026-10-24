import { defineCircuit } from '../../engine';

/**
 * 12.3: a dusk-to-dawn light with an LDR (firmware m12/luz-automatica). The
 * LDR from 5 V and a 10 kΩ resistor to GND make a divider read on A0; the
 * program lights the lamp (here an LED) after 3 s of dark and turns it off
 * after 3 s of light. The values the lesson quotes are checked in
 * ./circuitos.test.ts.
 */
export default defineCircuit({
  id: 'm12/luz-automatica',
  title: 'Luz automática com LDR',
  description:
    'Um LDR, ligado aos 5 V, e um resistor de 10 kΩ, ligado ao negativo, formam um divisor de tensão. O ponto do meio vai à entrada analógica A0 do microcontrolador. Quanto mais luz, menor a resistência do LDR e maior a tensão em A0. O programa acende a luz, aqui um LED, quando a leitura fica abaixo de 250 por 3 s seguidos, e apaga quando ela fica acima de 350 por 3 s seguidos. A quantidade de luz sobre o LDR é ajustável. A entrada do receptor de rádio não é usada e fica ligada ao negativo.',
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
        [12, 4],
        [26, 4],
        [26, 10],
      ],
    },
    {
      id: 'LDR1',
      type: 'ldr',
      a: [12, 4],
      b: [12, 12],
      label: 'LDR',
      params: { lux: 100 },
      control: {
        param: 'lux',
        label: 'Luz sobre o LDR',
        kind: 'slider',
        min: 0.5,
        max: 10000,
        log: true,
        unit: 'lx',
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 12],
        [20, 12],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [12, 12],
      b: [12, 22],
      params: { resistance: 10000 },
    },
    {
      id: 'U1',
      type: 'mcu',
      at: [26, 13],
      label: 'Micro',
      params: { firmware: 'm12/luz-automatica', pinsLeft: 'A0,RF', pinsRight: 'LUZ' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [20, 14],
        [18, 14],
        [18, 22],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [26, 16],
        [26, 22],
      ],
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [32, 12],
      b: [38, 12],
      params: { resistance: 150 },
    },
    {
      id: 'D1',
      type: 'led',
      a: [38, 12],
      b: [43, 12],
      label: 'Luz',
      params: { color: 'white' },
    },
    { id: 'G2', type: 'ground', at: [43, 12] },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [0, 22],
        [12, 22],
        [18, 22],
        [26, 22],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 22] },
  ],
  probes: [{ id: 'VA0', kind: 'voltage', plus: 'U1.A0', minus: 'GND', label: 'Tensão em A0' }],
  goals: [
    {
      id: 'dia',
      description: 'Com 100 lx sobre o LDR, a leitura passa de 700 e a luz fica apagada.',
      check: { readout: 'U1.leitura', op: '>', value: 700 },
      at: 0.5,
    },
    {
      id: 'noite',
      description: 'Diminua a luz para 2 lx e espere: depois de 3 s, a luz acende.',
      check: { readout: 'U1.estado', op: '==', value: 'NOITE' },
      solution: { 'LDR1.lux': 2 },
      at: 3.5,
    },
  ],
});
