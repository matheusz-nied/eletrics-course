import { defineCircuit } from '../../engine';

/** Turns ratio of the primary taps: 0–220 V and 0–127 V (the same secondary). */
const RATIO_220 = 17;
const RATIO_127 = (RATIO_220 * 127) / 220;

/**
 * 05.4: the 220 → 12 V transformer of an old gate central, with a 127/220 V
 * selector on the primary. The secondary feeds a test load: a resistor that
 * draws what the board draws and a 12 V lamp that shows at a glance what
 * reaches the secondary. Typical values for a small 15 VA transformer.
 */
export default defineCircuit({
  id: 'm05/trafo-central',
  title: 'O transformador da central com a chave 127/220 V',
  description:
    'A rede elétrica alimenta o primário de um transformador de 15 VA por uma chave seletora de 127 ou 220 V. O secundário, isolado da rede, alimenta por uma chave uma carga de teste: um resistor de 24 Ω no lugar da placa da central e uma lâmpada de 12 V e 5 W. Com a rede de 220 V e a seletora em 220 V, o secundário dá cerca de 12 V com carga e 12,9 V sem carga; a lâmpada acende normal. Com a seletora em 127 V numa rede de 220 V, o secundário vai a mais de 20 V e a lâmpada queima. Com a seletora em 220 V numa rede de 127 V, o secundário dá só uns 7 V e a lâmpada fica fraca.',
  analysis: { kind: 'transient', dt: 1e-4, speed: 0.1 },
  elements: [
    {
      id: 'R',
      type: 'mains',
      at: [0, 6],
      label: 'Rede',
      params: { voltage: 220 },
      control: {
        param: 'voltage',
        label: 'Tensão da rede',
        kind: 'select',
        options: [
          { value: 220, label: '220 V' },
          { value: 127, label: '127 V' },
        ],
      },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [2, 4],
        [10, 4],
      ],
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [2, 6],
        [6, 6],
        [6, 8],
        [10, 8],
      ],
    },
    {
      id: 'T1',
      type: 'transformer',
      at: [12, 6],
      label: 'Trafo',
      params: {
        ratio: RATIO_220,
        inductance: 20,
        coupling: 0.998,
        rPrimary: 80,
        rSecondary: 0.6,
        voltage: 220,
        power: 15,
      },
      control: {
        param: 'ratio',
        label: 'Chave seletora do trafo',
        kind: 'select',
        options: [
          { value: RATIO_220, label: 'Posição 220 V' },
          { value: RATIO_127, label: 'Posição 127 V' },
        ],
      },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [14, 4],
        [18, 4],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [18, 4],
      b: [22, 4],
      label: 'Carga',
      params: { closed: true },
      control: { param: 'closed', label: 'Carga ligada ao secundário', kind: 'toggle' },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [22, 4],
        [26, 4],
        [34, 4],
      ],
    },
    {
      id: 'RC',
      type: 'resistor',
      a: [26, 4],
      b: [26, 10],
      label: 'Placa',
      params: { resistance: 24, watts: 25 },
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [34, 4],
      b: [34, 10],
      label: 'Lâmpada',
      params: { voltage: 12, power: 5 },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [14, 8],
        [14, 10],
        [26, 10],
        [34, 10],
      ],
    },
  ],
  probes: [
    { id: 'VP', kind: 'voltage', plus: 'T1.p1', minus: 'T1.p2', label: 'Tensão no primário' },
    { id: 'IP', kind: 'current', element: 'W1', label: 'Corrente no primário' },
    { id: 'VS', kind: 'voltage', plus: 'T1.s1', minus: 'T1.s2', label: 'Tensão no secundário' },
    { id: 'IS', kind: 'current', element: 'S1', label: 'Corrente no secundário' },
  ],
  // Only readouts that stay still over a cycle (the RMS values are checked in trafo-central.test.ts).
  goals: [
    {
      id: 'certo',
      description: 'Rede de 220 V e seletora em 220 V: a lâmpada de 12 V acende normal.',
      check: { readout: 'L1.brightness', op: 'between', value: [0.9, 1.15] },
    },
    {
      id: 'errado',
      description:
        'Deixe a seletora em 127 V com a rede de 220 V: o secundário passa de 20 V e a lâmpada queima.',
      check: { readout: 'L1.burned', op: '==', value: true },
      solution: { 'T1.ratio': RATIO_127 },
    },
  ],
});
