import { defineCircuit } from '../../engine';

/**
 * 10.1: the adjustable LM317. The regulator holds 1,25 V between OUT and
 * ADJ; R1 (240 Ω) and R2 set the output, Vout = 1,25·(1 + R2/R1) plus the
 * 50 µA of the ADJ pin through R2.
 */
export default defineCircuit({
  id: 'm10/lm317',
  title: 'Regulador ajustável LM317',
  description:
    'Uma entrada de 15 V alimenta um regulador ajustável LM317. Entre a saída e o pino de ajuste ficam sempre 1,25 V, aplicados sobre o resistor R1, de 240 Ω. A corrente de R1 desce por R2, que é ajustável, até o negativo: quanto maior R2, maior a tensão na saída. A carga é um resistor de 1 kΩ.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 2],
      b: [0, 22],
      label: 'Entrada',
      params: { voltage: 15 },
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
      params: { vref: 1.25, adjustable: true, iq: 50e-6, rth: 50 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [16, 2],
        [22, 2],
        [30, 2],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [22, 2],
      b: [22, 10],
      label: 'R1',
      params: { resistance: 240, watts: 0.25 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [12, 5],
        [12, 10],
        [22, 10],
      ],
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [22, 10],
      b: [22, 22],
      label: 'R2',
      params: { resistance: 1000, watts: 0.25 },
      control: {
        param: 'resistance',
        label: 'R2',
        kind: 'slider',
        min: 10,
        max: 2200,
        step: 10,
        unit: 'Ω',
      },
    },
    {
      id: 'RL',
      type: 'resistor',
      a: [30, 2],
      b: [30, 22],
      label: 'Carga',
      params: { resistance: 1000, watts: 0.5 },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [0, 22],
        [22, 22],
        [30, 22],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 22] },
  ],
  probes: [
    { id: 'VOUT', kind: 'voltage', plus: 'RL.a', minus: 'GND', label: 'Saída' },
    { id: 'VR1', kind: 'voltage', plus: 'R1.a', minus: 'R1.b', label: 'Tensão em R1' },
  ],
  goals: [
    {
      id: 'referencia',
      description: 'Em R1 ficam sempre 1,25 V.',
      check: { readout: 'VR1', op: 'between', value: [1.24, 1.26] },
    },
    {
      id: 'cinco-volts',
      description: 'Ajuste R2 para cerca de 720 Ω: a saída fica em 5 V.',
      check: { readout: 'VOUT', op: 'between', value: [4.95, 5.1] },
      solution: { 'R2.resistance': 720 },
    },
    {
      id: 'nove-volts',
      description: 'Com R2 de 1,5 kΩ, a saída fica perto de 9,1 V.',
      check: { readout: 'VOUT', op: 'between', value: [9.05, 9.2] },
      solution: { 'R2.resistance': 1500 },
    },
    {
      id: 'minimo',
      description:
        'Com R2 no mínimo, a saída cai para perto de 1,3 V: abaixo de 1,25 V o LM317 não desce.',
      check: { readout: 'VOUT', op: 'between', value: [1.25, 1.32] },
      solution: { 'R2.resistance': 10 },
    },
  ],
});
