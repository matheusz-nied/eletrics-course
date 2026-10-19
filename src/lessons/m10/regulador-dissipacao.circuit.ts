import { defineCircuit } from '../../engine';

/**
 * 10.1: how hot a 7805 gets. An adjustable unregulated input feeds a 7805
 * and a load; the student picks the heatsink. The regulator's thermal time
 * constant is shortened to 10 s so the heating shows in under a minute (a
 * real one takes a few minutes). Values quoted in the lesson are goals.
 */
export default defineCircuit({
  id: 'm10/regulador-dissipacao',
  title: 'Quanto esquenta um regulador 7805',
  description:
    'Uma fonte ajustável, de 7 V a 30 V, faz o papel da saída não regulada de uma fonte e alimenta um regulador 7805, que entrega 5 V a uma carga. Toda a tensão que sobra entre a entrada e a saída vira calor no regulador, multiplicada pela corrente. Dá para escolher a corrente da carga e o dissipador. Sem dissipador e com muita potência, o regulador passa de 150 °C e a proteção térmica desliga a saída. Clique no regulador para ver a potência e a temperatura. O aquecimento está acelerado: o real leva alguns minutos.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 2],
      b: [0, 16],
      label: 'Entrada',
      params: { voltage: 12 },
      control: {
        param: 'voltage',
        label: 'Tensão de entrada',
        kind: 'slider',
        min: 7,
        max: 30,
        step: 0.5,
        unit: 'V',
      },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 2],
        [8, 2],
      ],
    },
    {
      id: 'U1',
      type: 'voltage-regulator',
      at: [12, 2],
      label: 'U1',
      params: { vref: 5, rth: 50, tau: 10 },
      control: {
        param: 'rth',
        label: 'Dissipador',
        kind: 'select',
        options: [
          { value: 50, label: 'Sem dissipador (50 °C/W)' },
          { value: 20, label: 'Dissipador pequeno (20 °C/W)' },
          { value: 8, label: 'Dissipador grande (8 °C/W)' },
        ],
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 5],
        [12, 16],
      ],
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [16, 2],
        [24, 2],
      ],
    },
    {
      id: 'RL',
      type: 'resistor',
      a: [24, 2],
      b: [24, 16],
      label: 'Carga',
      params: { resistance: 10, watts: 10 },
      control: {
        param: 'resistance',
        label: 'Carga',
        kind: 'select',
        options: [
          { value: 50, label: '0,1 A (50 Ω)' },
          { value: 10, label: '0,5 A (10 Ω)' },
          { value: 5, label: '1 A (5 Ω)' },
        ],
      },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [0, 16],
        [12, 16],
        [24, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
  ],
  probes: [
    { id: 'VOUT', kind: 'voltage', plus: 'RL.a', minus: 'GND', label: 'Saída' },
    { id: 'IL', kind: 'current', element: 'RL', label: 'Corrente na carga' },
  ],
  goals: [
    {
      id: 'potencia',
      description:
        'Com 12 V na entrada e 0,5 A, o regulador dissipa cerca de 3,6 W: (12 − 5) × 0,5 mais a corrente própria dele.',
      check: { readout: 'U1.power', op: 'between', value: [3.5, 3.62] },
      at: 0.5,
    },
    {
      id: 'sem-dissipador',
      description:
        'Sem dissipador, com 12 V e 0,5 A, a proteção térmica desliga a saída em menos de 20 segundos.',
      check: { readout: 'U1.shutdown', op: '==', value: true },
      at: 15,
    },
    {
      id: 'dissipador-grande',
      description: 'Com o dissipador grande, o regulador se estabiliza perto de 54 °C.',
      check: { readout: 'U1.temperature', op: 'between', value: [52, 56] },
      solution: { 'U1.rth': 8 },
      at: 60,
    },
    {
      id: 'entrada-menor',
      description:
        'Sem dissipador e com 0,5 A, baixe a entrada para 8 V: o regulador dissipa só 1,5 W e se estabiliza perto de 100 °C, sem desligar.',
      check: { readout: 'U1.temperature', op: 'between', value: [95, 105] },
      solution: { 'V1.voltage': 8 },
      at: 60,
    },
  ],
});
