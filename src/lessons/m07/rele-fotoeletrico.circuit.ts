import { defineCircuit } from '../../engine';
import type { ParamValue } from '../../engine/contract';

/**
 * 07.7: a photoelectric switch (relé fotoelétrico) turning on a garden lamp
 * at dusk. Inside, simplified: a 12 V supply, an LDR over a 20 kΩ resistor,
 * a comparator against half the supply, a transistor and a relay whose
 * contact switches the phase to the 127 V lamp. The LDR has 20 kΩ at 10 lx,
 * so the lamp turns on below 10 lx. Typical light levels in the select.
 * The values the lesson quotes are checked in ./rele-fotoeletrico.test.ts.
 */

/** Light on the sensor through the day (lx, typical). */
export const LIGHT: { value: ParamValue; label: string }[] = [
  { value: 5000, label: 'Dia nublado (5.000 lx)' },
  { value: 200, label: 'Fim de tarde (200 lx)' },
  { value: 20, label: 'Pôr do sol (20 lx)' },
  { value: 3, label: 'Anoitecer (3 lx)' },
  { value: 0.3, label: 'Noite com lua (0,3 lx)' },
];

export default defineCircuit({
  id: 'm07/rele-fotoeletrico',
  title: 'Relé fotoelétrico acendendo a luz do jardim',
  description:
    'Dentro do relé fotoelétrico, uma fonte de 12 V alimenta um LDR em série com um resistor de 20 kΩ. Um comparador compara a tensão do resistor com 6 V, metade da fonte. Com pouca luz, o LDR passa de 20 kΩ, a tensão cai abaixo de 6 V, o comparador liga o transistor e o relé fecha o contato que leva a fase da rede de 127 V à lâmpada do jardim. Com luz, o LDR baixa, a tensão sobe acima de 6 V e a lâmpada apaga. Escolha a luz do ambiente, do dia nublado até a noite.',
  analysis: { kind: 'transient', dt: 2e-4, speed: 0.5 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 20],
      label: 'Fonte 12 V',
      params: { voltage: 12 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [6, 0],
        [10, 0],
        [24, 0],
        [27, 0],
      ],
    },
    {
      id: 'LDR',
      type: 'ldr',
      a: [6, 0],
      b: [6, 8],
      label: 'LDR',
      params: { lux: 5000, r10: 20000, gamma: 0.7, rDark: 1e6 },
      control: { param: 'lux', label: 'Luz sobre o sensor', kind: 'select', options: LIGHT },
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [6, 8],
      b: [6, 20],
      label: '20 kΩ',
      params: { resistance: 20000 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [6, 8],
        [13, 8],
      ],
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [10, 0],
      b: [10, 4],
      label: '10 kΩ',
      params: { resistance: 10000 },
    },
    {
      // Crosses W2 without touching it: the reference comes down to the + input.
      id: 'W3',
      type: 'wire',
      points: [
        [10, 4],
        [10, 10],
        [10, 13],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [10, 10],
        [13, 10],
      ],
    },
    {
      id: 'R3',
      type: 'resistor',
      a: [10, 13],
      b: [10, 20],
      label: '10 kΩ',
      params: { resistance: 10000 },
    },
    {
      id: 'U1',
      type: 'opamp',
      at: [16, 9],
      label: 'Comparador',
      // A comparator whose output goes all the way down: low really turns Q1 off.
      params: { vcc: 12, vee: 0, headroom: 0.1 },
    },
    {
      id: 'RB',
      type: 'resistor',
      a: [19, 9],
      b: [24, 9],
      label: '4,7 kΩ',
      params: { resistance: 4700 },
    },
    {
      id: 'Q1',
      type: 'npn',
      at: [26, 9],
      label: 'Q1',
      params: { beta: 200, vceo: 30, power: 0.5 },
    },
    {
      id: 'K1',
      type: 'relay-spdt',
      at: [29, 4],
      label: 'Relé 12 V',
      params: { coilVoltage: 12, coilResistance: 400, coilInductance: 0.15 },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [27, 0],
        [27, 2],
      ],
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [27, 6],
        [27, 7],
      ],
    },
    {
      id: 'D1',
      type: 'diode',
      a: [24, 6],
      b: [24, 2],
      label: 'D1',
      params: { model: 'rectifier' },
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [24, 2],
        [27, 2],
      ],
    },
    {
      id: 'W8',
      type: 'wire',
      points: [
        [24, 6],
        [27, 6],
      ],
    },
    {
      id: 'W9',
      type: 'wire',
      points: [
        [27, 11],
        [27, 20],
      ],
    },
    {
      id: 'W10',
      type: 'wire',
      points: [
        [0, 20],
        [6, 20],
        [10, 20],
        [27, 20],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 20] },
    {
      id: 'REDE',
      type: 'mains',
      at: [46, 8],
      rot: 180,
      label: 'Rede 127 V',
      params: { voltage: 127 },
    },
    {
      // Phase to the common of the relay contact.
      id: 'W11',
      type: 'wire',
      points: [
        [44, 10],
        [31, 10],
        [31, 6],
      ],
    },
    {
      id: 'W12',
      type: 'wire',
      points: [
        [32, 2],
        [32, -3],
        [38, -3],
      ],
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [38, -3],
      b: [38, 8],
      label: 'Lâmpada do jardim',
      params: { voltage: 127, power: 60 },
    },
    {
      id: 'W13',
      type: 'wire',
      points: [
        [38, 8],
        [44, 8],
      ],
    },
  ],
  probes: [
    { id: 'VS', kind: 'voltage', plus: 'R1.a', minus: 'GND', label: 'Tensão do sensor' },
    { id: 'VREF', kind: 'voltage', plus: 'R3.a', minus: 'GND', label: 'Referência' },
  ],
  goals: [
    {
      id: 'dia',
      description: 'De dia, com 5.000 lx, a lâmpada fica apagada.',
      check: { readout: 'L1.brightness', op: '<', value: 0.01 },
      at: 0.3,
    },
    {
      id: 'referencia',
      description: 'A referência do comparador é metade da fonte: 6 V.',
      check: { readout: 'VREF', op: 'between', value: [5.99, 6.01] },
      at: 0.3,
    },
    {
      id: 'por-do-sol',
      description:
        'No pôr do sol, com 20 lx, o sensor ainda marca uns 7,4 V e a lâmpada não acende.',
      check: { readout: 'VS', op: 'between', value: [7.3, 7.5] },
      solution: { 'LDR.lux': 20 },
      at: 0.3,
    },
    {
      id: 'anoitecer',
      description: 'No anoitecer, com 3 lx, o sensor cai para uns 3,6 V e o relé acende a lâmpada.',
      check: { readout: 'K1.closed', op: '==', value: true },
      solution: { 'LDR.lux': 3 },
      at: 0.3,
    },
    {
      id: 'acesa',
      description: 'Com o relé fechado, a lâmpada de 60 W acende com o brilho normal.',
      check: { readout: 'L1.brightness', op: '>', value: 0.9 },
      solution: { 'LDR.lux': 0.3 },
      at: 0.5,
    },
  ],
});
