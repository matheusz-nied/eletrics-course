import { defineCircuit } from '../../engine';

/**
 * Lesson 1.4 (Ohm's law): an adjustable source and an adjustable resistor.
 * It starts at 9 V and 100 Ω (90 mA); the lesson asks to change R to 1 kΩ
 * (9 mA). The resistor is rated 5 W so no setting burns it: this lesson is
 * about V = R·I, power comes in lesson 1.5.
 */
export default defineCircuit({
  id: 'm01/lei-de-ohm',
  title: 'Lei de Ohm: tensão, resistência e corrente',
  description:
    'Uma fonte de tensão ajustável, de 0 a 12 V, ligada a um resistor ajustável, de 100 Ω a 5 kΩ. Começa com 9 V e 100 Ω, o que dá 90 mA. Mude a tensão ou a resistência e veja a corrente seguir a Lei de Ohm: I = V ÷ R.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 10],
      b: [0, 20],
      label: 'Fonte',
      params: { voltage: 9 },
      control: {
        param: 'voltage',
        label: 'Tensão da fonte',
        kind: 'slider',
        min: 0,
        max: 12,
        step: 0.5,
        unit: 'V',
      },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 10],
        [0, 0],
        [20, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [20, 0],
      b: [20, 20],
      label: 'R',
      params: { resistance: 100, watts: 5 },
      control: {
        param: 'resistance',
        label: 'Resistência',
        kind: 'slider',
        min: 100,
        max: 5000,
        step: 100,
        unit: 'Ω',
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [20, 20],
        [0, 20],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 20] },
  ],
  probes: [
    { id: 'corrente', kind: 'current', element: 'R1', label: 'Corrente no resistor' },
    { id: 'tensao', kind: 'voltage', plus: 'R1.a', minus: 'R1.b', label: 'Tensão no resistor' },
  ],
  goals: [
    {
      id: 'nove-ma',
      description: 'Com 9 V, mude a resistência para 1 kΩ: a corrente cai para 9 mA',
      check: { readout: 'R1.current', op: 'between', value: [0.00899, 0.00901] },
      solution: { 'V1.voltage': 9, 'R1.resistance': 1000 },
    },
    {
      id: 'metade',
      description: 'Ainda com 9 V, escolha a resistência que deixa a corrente em 4,5 mA',
      check: { readout: 'R1.current', op: 'between', value: [0.00449, 0.00451] },
      solution: { 'V1.voltage': 9, 'R1.resistance': 2000 },
    },
    {
      id: 'central',
      description: 'Monte o exemplo da aula: 12 V num resistor de 4,7 kΩ',
      check: { readout: 'R1.current', op: 'between', value: [0.00255, 0.00256] },
      solution: { 'V1.voltage': 12, 'R1.resistance': 4700 },
    },
    {
      id: 'cinquenta',
      description: 'Faça passar 50 mA usando só 5 V',
      check: { readout: 'R1.current', op: 'between', value: [0.0499, 0.0501] },
      solution: { 'V1.voltage': 5, 'R1.resistance': 100 },
    },
  ],
});
