import { defineCircuit } from '../../engine';

/**
 * 9.3: the 12 V linear supply without its regulator. Mains, a 127 V → 12 V
 * transformer, a bridge of four 1N4007 and a filter capacitor that can be
 * switched in. The values the lesson quotes are checked in ./retificadores.test.ts
 * (measured as the oscilloscope measures them).
 */
export default defineCircuit({
  id: 'm09/retificador-ponte',
  title: 'Fonte de 12 V com ponte retificadora',
  description:
    'A tomada de 127 V alimenta o primário de um transformador de 127 V para 12 V. O secundário vai a uma ponte de quatro diodos 1N4007, que entrega à carga só semiciclos positivos: a tensão pulsa 120 vezes por segundo, com picos de cerca de 16 V. Uma chave liga um capacitor de filtro em paralelo com a carga; com ele, a tensão fica quase lisa, perto de 15 V, com uma pequena ondulação. Dá para escolher o capacitor e a corrente da carga. O canal 1 do osciloscópio mostra o secundário do transformador e o canal 2, a saída.',
  analysis: { kind: 'transient', dt: 2e-5, speed: 0.05 },
  elements: [
    { id: 'M', type: 'mains', at: [0, 8], label: 'Tomada 127 V' },
    { id: 'G0', type: 'ground', at: [2, 10] },
    { id: 'W1', type: 'wire', points: [[2, 6], [6, 6]] },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [2, 8],
        [4, 8],
        [4, 10],
        [6, 10],
      ],
    },
    {
      id: 'T1',
      type: 'transformer',
      at: [8, 8],
      label: 'Trafo 127 V → 12 V',
      params: { ratio: 10, power: 20, coupling: 0.9995 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [10, 6],
        [13, 6],
        [13, 10],
        [16, 10],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [10, 10],
        [11, 10],
        [11, 24],
        [26, 24],
        [26, 10],
        [22, 10],
      ],
    },
    { id: 'D1', type: 'diode', a: [16, 10], b: [16, 2], label: 'D1' },
    { id: 'D3', type: 'diode', a: [16, 18], b: [16, 10], label: 'D3' },
    { id: 'D2', type: 'diode', a: [22, 10], b: [22, 2], label: 'D2' },
    { id: 'D4', type: 'diode', a: [22, 18], b: [22, 10], label: 'D4' },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [16, 18],
        [19, 18],
        [22, 18],
      ],
    },
    { id: 'G1', type: 'ground', at: [19, 18] },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [16, 2],
        [22, 2],
        [32, 2],
        [40, 2],
      ],
    },
    {
      id: 'SW1',
      type: 'switch',
      a: [32, 2],
      b: [32, 8],
      label: 'Filtro',
      params: { closed: false },
      control: { param: 'closed', label: 'Capacitor de filtro ligado', kind: 'toggle' },
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [32, 8],
      b: [32, 16],
      label: 'C1',
      params: { capacitance: 3300e-6, voltage: 25, polarized: true },
      control: {
        param: 'capacitance',
        label: 'Capacitor de filtro',
        kind: 'select',
        options: [
          { value: 1000e-6, label: '1.000 µF' },
          { value: 3300e-6, label: '3.300 µF' },
        ],
      },
    },
    {
      id: 'RL',
      type: 'resistor',
      a: [40, 2],
      b: [40, 16],
      label: 'Carga',
      params: { resistance: 30, watts: 20 },
      control: {
        param: 'resistance',
        label: 'Carga',
        kind: 'select',
        options: [
          { value: 30, label: 'Cerca de 0,5 A (30 Ω)' },
          { value: 100, label: 'Cerca de 0,15 A (100 Ω)' },
        ],
      },
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [32, 16],
        [36, 16],
        [40, 16],
      ],
    },
    { id: 'G2', type: 'ground', at: [36, 16] },
  ],
  probes: [
    { id: 'VSEC', kind: 'voltage', plus: 'T1.s1', minus: 'T1.s2', label: 'Secundário' },
    { id: 'VOUT', kind: 'voltage', plus: 'RL.a', minus: 'GND', label: 'Saída' },
  ],
});
