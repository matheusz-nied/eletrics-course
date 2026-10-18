import { defineCircuit } from '../../engine';

/** 02.4: the mixed circuit of the step-by-step reduction (R1 in series with R2 ∥ (R3 + R4)). */
export default defineCircuit({
  id: 'm02/circuito-misto',
  title: 'Circuito misto: série e paralelo juntos',
  description:
    'Uma fonte de 12 V alimenta R1 = 150 Ω em série com um grupo paralelo: de um lado R2 = 300 Ω, do outro R3 = 100 Ω e R4 = 200 Ω em série. A resistência equivalente é 300 Ω e a corrente total é 40 mA; o grupo paralelo fica com 6 V, e cada ramo dele conduz 20 mA. Um controle muda o valor de R1.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'V1', type: 'dc-voltage', a: [0, 0], b: [0, 16], params: { voltage: 12 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [4, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [4, 0],
      b: [12, 0],
      params: { resistance: 150, watts: 0.5 },
      control: {
        param: 'resistance',
        label: 'Resistência de R1',
        kind: 'slider',
        min: 50,
        max: 1000,
        step: 50,
        unit: 'Ω',
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 0],
        [18, 0],
      ],
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [18, 0],
      b: [18, 16],
      params: { resistance: 300, watts: 0.5 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [18, 0],
        [28, 0],
      ],
    },
    { id: 'R3', type: 'resistor', a: [28, 0], b: [28, 8], params: { resistance: 100, watts: 0.5 } },
    {
      id: 'R4',
      type: 'resistor',
      a: [28, 8],
      b: [28, 16],
      params: { resistance: 200, watts: 0.5 },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [28, 16],
        [18, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
  ],
  probes: [
    { id: 'IT', kind: 'current', element: 'R1', label: 'Corrente total (em R1)' },
    { id: 'VP', kind: 'voltage', plus: 'R2.a', minus: 'R2.b', label: 'Tensão no grupo paralelo' },
    { id: 'I2', kind: 'current', element: 'R2', label: 'Corrente em R2' },
    { id: 'V4', kind: 'voltage', plus: 'R4.a', minus: 'R4.b', label: 'Tensão em R4' },
  ],
  goals: [
    {
      id: 'corrente-total',
      description: 'Confira a corrente total calculada: 12 V ÷ 300 Ω = 40 mA.',
      check: { readout: 'IT', op: 'between', value: [0.0399, 0.0401] },
    },
    {
      id: 'tensao-paralelo',
      description: 'Confira os 6 V do grupo paralelo (150 Ω × 40 mA).',
      check: { readout: 'VP', op: 'between', value: [5.99, 6.01] },
    },
    {
      id: 'ramo-r2',
      description: 'Confira os 20 mA que passam por R2 (6 V ÷ 300 Ω).',
      check: { readout: 'I2', op: 'between', value: [0.0199, 0.0201] },
    },
    {
      id: 'tensao-r4',
      description: 'Confira os 4 V em R4 (200 Ω × 20 mA).',
      check: { readout: 'V4', op: 'between', value: [3.99, 4.01] },
    },
    {
      id: 'r1-450',
      description: 'Mude R1 para 450 Ω e veja a corrente total cair para 20 mA.',
      check: { readout: 'IT', op: 'between', value: [0.0199, 0.0201] },
      solution: { 'R1.resistance': 450 },
    },
  ],
});
