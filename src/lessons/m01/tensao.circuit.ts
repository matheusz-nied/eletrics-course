import { defineCircuit } from '../../engine';

/**
 * Lesson 1.3 (voltage): a 12 V battery and three resistors in series
 * (1 kΩ, 2 kΩ and 3 kΩ). The drops are 2 V, 4 V and 6 V and add up to the
 * battery voltage; the battery slider shows that every drop scales with it.
 */
export default defineCircuit({
  id: 'm01/tensao',
  title: 'Tensão entre vários pontos de um circuito',
  description:
    'Uma bateria de 12 V alimenta três resistores ligados em sequência: R1 de 1 kΩ, R2 de 2 kΩ e R3 de 3 kΩ. O negativo da bateria é a referência. A tensão em R1 é 2 V, em R2 é 4 V e em R3 é 6 V; somadas, dão os 12 V da bateria. Mude a tensão da bateria para ver todas as tensões mudarem na mesma proporção.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'B1',
      type: 'battery',
      a: [0, 10],
      b: [0, 20],
      label: 'Bateria',
      params: { voltage: 12, resistance: 0 },
      control: {
        param: 'voltage',
        label: 'Tensão da bateria',
        kind: 'slider',
        min: 0,
        max: 24,
        step: 1,
        unit: 'V',
      },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 10],
        [0, 0],
        [10, 0],
      ],
    },
    { id: 'R1', type: 'resistor', a: [10, 0], b: [20, 0], params: { resistance: 1000 } },
    { id: 'R2', type: 'resistor', a: [20, 0], b: [30, 0], params: { resistance: 2000 } },
    { id: 'R3', type: 'resistor', a: [30, 0], b: [30, 20], params: { resistance: 3000 } },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [30, 20],
        [0, 20],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 20] },
  ],
  probes: [
    { id: 'vr1', kind: 'voltage', plus: 'R1.a', minus: 'R1.b', label: 'Tensão em R1' },
    { id: 'vr2', kind: 'voltage', plus: 'R2.a', minus: 'R2.b', label: 'Tensão em R2' },
    { id: 'vr3', kind: 'voltage', plus: 'R3.a', minus: 'R3.b', label: 'Tensão em R3' },
    { id: 'vbat', kind: 'voltage', plus: 'B1.a', minus: 'B1.b', label: 'Tensão na bateria' },
  ],
  goals: [
    {
      id: 'r3-9v',
      description: 'Ajuste a bateria até R3 ficar com 9 V',
      check: { readout: 'R3.voltage', op: 'between', value: [8.99, 9.01] },
      solution: { 'B1.voltage': 18 },
    },
    {
      id: 'r1-1v',
      description: 'Agora deixe R1 com apenas 1 V',
      check: { readout: 'R1.voltage', op: 'between', value: [0.99, 1.01] },
      solution: { 'B1.voltage': 6 },
    },
  ],
});
