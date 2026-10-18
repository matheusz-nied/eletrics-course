import { defineCircuit } from '../../engine';

/** 02.4, worked example: 24 V, R1 = 2 kΩ in series with R2 = 6 kΩ ∥ R3 = 3 kΩ. */
export default defineCircuit({
  id: 'm02/misto-exemplo',
  title: 'Exemplo resolvido: 24 V, série e paralelo',
  description:
    'Uma fonte de 24 V alimenta R1 = 2 kΩ em série com R2 = 6 kΩ e R3 = 3 kΩ em paralelo. A resistência equivalente é 4 kΩ e a corrente total é 6 mA; o grupo paralelo fica com 12 V, com 2 mA em R2 e 4 mA em R3.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'V1', type: 'dc-voltage', a: [0, 0], b: [0, 14], params: { voltage: 24 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [4, 0],
      ],
    },
    { id: 'R1', type: 'resistor', a: [4, 0], b: [12, 0], params: { resistance: 2000 } },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 0],
        [18, 0],
      ],
    },
    { id: 'R2', type: 'resistor', a: [18, 0], b: [18, 14], params: { resistance: 6000 } },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [18, 0],
        [26, 0],
      ],
    },
    { id: 'R3', type: 'resistor', a: [26, 0], b: [26, 14], params: { resistance: 3000 } },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [26, 14],
        [18, 14],
        [0, 14],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 14] },
  ],
  probes: [
    { id: 'IT', kind: 'current', element: 'R1', label: 'Corrente total' },
    { id: 'VP', kind: 'voltage', plus: 'R2.a', minus: 'R2.b', label: 'Tensão no paralelo' },
    { id: 'I2', kind: 'current', element: 'R2', label: 'Corrente em R2' },
    { id: 'I3', kind: 'current', element: 'R3', label: 'Corrente em R3' },
  ],
  goals: [
    {
      id: 'total',
      description: 'Confira a corrente total: 24 V ÷ 4 kΩ = 6 mA.',
      check: { readout: 'IT', op: 'between', value: [0.00599, 0.00601] },
    },
    {
      id: 'paralelo',
      description: 'Confira os 12 V no grupo paralelo.',
      check: { readout: 'VP', op: 'between', value: [11.99, 12.01] },
    },
    {
      id: 'r2',
      description: 'Confira os 2 mA em R2.',
      check: { readout: 'I2', op: 'between', value: [0.00199, 0.00201] },
    },
    {
      id: 'r3',
      description: 'Confira os 4 mA em R3, o dobro de R2, porque R3 tem a metade da resistência.',
      check: { readout: 'I3', op: 'between', value: [0.00399, 0.00401] },
    },
  ],
});
