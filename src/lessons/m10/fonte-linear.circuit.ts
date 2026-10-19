import { defineCircuit } from '../../engine';

/**
 * 10.1: the complete 12 V linear supply. The 9.3 bridge supply (mains,
 * transformer, four 1N4007 and the filter capacitor) now feeds a 7812, with
 * the 100 µF output capacitor of the datasheet circuits. The student picks
 * the transformer (12 V or 15 V), the filter capacitor and the load. The
 * values the lesson quotes are checked in ./fonte-linear.test.ts.
 */
export default defineCircuit({
  id: 'm10/fonte-linear',
  title: 'Fonte linear de 12 V com regulador 7812',
  description:
    'A tomada de 127 V alimenta um transformador, uma ponte de quatro diodos e um capacitor de filtro, como na aula de retificadores. Depois do capacitor vem um regulador 7812, com um capacitor de 100 µF na saída, e a carga. O canal 1 do osciloscópio mostra a tensão no capacitor de filtro, que tem ondulação, e o canal 2 mostra a saída do regulador, lisa em 12 V enquanto a entrada fica uns 2 V acima dela. Dá para escolher o transformador, o capacitor de filtro e a corrente da carga.',
  analysis: { kind: 'transient', dt: 2e-5, speed: 0.05 },
  elements: [
    { id: 'M', type: 'mains', at: [0, 8], label: 'Tomada' },
    { id: 'G0', type: 'ground', at: [2, 10] },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [2, 6],
        [12, 6],
      ],
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [2, 8],
        [10, 8],
        [10, 10],
        [12, 10],
      ],
    },
    {
      id: 'T1',
      type: 'transformer',
      at: [14, 8],
      label: 'Trafo',
      params: { ratio: 127 / 12, power: 30, coupling: 0.9995 },
      control: {
        param: 'ratio',
        label: 'Transformador',
        kind: 'select',
        options: [
          { value: 127 / 12, label: '127 V → 12 V' },
          { value: 127 / 15, label: '127 V → 15 V' },
        ],
      },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [16, 6],
        [22, 6],
        [22, 10],
        [25, 10],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [16, 10],
        [17, 10],
        [17, 24],
        [35, 24],
        [35, 10],
        [31, 10],
      ],
    },
    { id: 'D1', type: 'diode', a: [25, 10], b: [25, 2], label: 'D1' },
    { id: 'D3', type: 'diode', a: [25, 18], b: [25, 10], label: 'D3' },
    { id: 'D2', type: 'diode', a: [31, 10], b: [31, 2], label: 'D2' },
    { id: 'D4', type: 'diode', a: [31, 18], b: [31, 10], label: 'D4' },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [25, 18],
        [28, 18],
        [31, 18],
      ],
    },
    { id: 'G1', type: 'ground', at: [28, 18] },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [25, 2],
        [31, 2],
        [39, 2],
        [45, 2],
      ],
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [39, 2],
      b: [39, 16],
      label: 'C1',
      params: { capacitance: 2200e-6, voltage: 35, polarized: true },
      control: {
        param: 'capacitance',
        label: 'Capacitor de filtro',
        kind: 'select',
        options: [
          { value: 1000e-6, label: '1.000 µF' },
          { value: 2200e-6, label: '2.200 µF' },
          { value: 4700e-6, label: '4.700 µF' },
        ],
      },
    },
    {
      id: 'U1',
      type: 'voltage-regulator',
      at: [49, 2],
      label: 'U1',
      params: { vref: 12, rth: 6, tau: 30 },
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [49, 5],
        [49, 16],
      ],
    },
    {
      id: 'W8',
      type: 'wire',
      points: [
        [53, 2],
        [58, 2],
        [66, 2],
      ],
    },
    {
      id: 'C2',
      type: 'capacitor',
      a: [58, 2],
      b: [58, 16],
      label: 'C2',
      params: { capacitance: 100e-6, voltage: 25, polarized: true },
    },
    {
      id: 'RL',
      type: 'resistor',
      a: [66, 2],
      b: [66, 16],
      label: 'Carga',
      params: { resistance: 24, watts: 20 },
      control: {
        param: 'resistance',
        label: 'Carga',
        kind: 'select',
        options: [
          { value: 48, label: '0,25 A (48 Ω)' },
          { value: 24, label: '0,5 A (24 Ω)' },
          { value: 12, label: '1 A (12 Ω)' },
        ],
      },
    },
    {
      id: 'W9',
      type: 'wire',
      points: [
        [39, 16],
        [44, 16],
        [49, 16],
        [58, 16],
        [66, 16],
      ],
    },
    { id: 'G2', type: 'ground', at: [44, 16] },
  ],
  probes: [
    { id: 'VIN', kind: 'voltage', plus: 'C1.a', minus: 'GND', label: 'Entrada do regulador' },
    { id: 'VOUT', kind: 'voltage', plus: 'RL.a', minus: 'GND', label: 'Saída' },
  ],
});
