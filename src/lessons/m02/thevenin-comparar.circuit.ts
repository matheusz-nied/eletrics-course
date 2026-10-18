import { defineCircuit } from '../../engine';

/**
 * 02.8: a network (12 V, 2,2 kΩ, 3,3 kΩ, 680 Ω) next to its Thévenin
 * equivalent (7,2 V in series with 2 kΩ). For the same load, both deliver the
 * same voltage and current.
 */
export default defineCircuit({
  id: 'm02/thevenin-comparar',
  title: 'Circuito original × equivalente de Thévenin',
  description:
    'À esquerda, uma fonte de 12 V com três resistores (2,2 kΩ, 3,3 kΩ e 680 Ω) alimenta a carga RL1. À direita, o equivalente de Thévenin desse circuito, uma fonte de 7,2 V em série com 2 kΩ, alimenta a carga RL2. Com o mesmo valor de carga, as duas cargas recebem a mesma tensão e a mesma corrente.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'V1', type: 'dc-voltage', a: [0, 0], b: [0, 14], params: { voltage: 12 } },
    { id: 'R1', type: 'resistor', a: [0, 0], b: [8, 0], params: { resistance: 2200 } },
    { id: 'R2', type: 'resistor', a: [8, 0], b: [8, 14], params: { resistance: 3300 } },
    { id: 'R3', type: 'resistor', a: [8, 0], b: [16, 0], params: { resistance: 680 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [16, 0],
        [22, 0],
      ],
    },
    {
      id: 'RL1',
      type: 'resistor',
      a: [22, 0],
      b: [22, 14],
      params: { resistance: 1000 },
      control: {
        param: 'resistance',
        label: 'Carga RL1 (circuito original)',
        kind: 'slider',
        min: 100,
        max: 1000000,
        log: true,
        unit: 'Ω',
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [22, 14],
        [8, 14],
        [0, 14],
      ],
    },
    { id: 'G1', type: 'ground', at: [0, 14] },

    { id: 'VTH', type: 'dc-voltage', a: [36, 0], b: [36, 14], params: { voltage: 7.2 } },
    { id: 'RTH', type: 'resistor', a: [36, 0], b: [46, 0], params: { resistance: 2000 } },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [46, 0],
        [52, 0],
      ],
    },
    {
      id: 'RL2',
      type: 'resistor',
      a: [52, 0],
      b: [52, 14],
      params: { resistance: 1000 },
      control: {
        param: 'resistance',
        label: 'Carga RL2 (equivalente de Thévenin)',
        kind: 'slider',
        min: 100,
        max: 1000000,
        log: true,
        unit: 'Ω',
      },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [52, 14],
        [36, 14],
      ],
    },
    { id: 'G2', type: 'ground', at: [36, 14] },
  ],
  probes: [
    {
      id: 'VL1',
      kind: 'voltage',
      plus: 'RL1.a',
      minus: 'RL1.b',
      label: 'Tensão em RL1 (original)',
    },
    { id: 'IL1', kind: 'current', element: 'RL1', label: 'Corrente em RL1 (original)' },
    {
      id: 'VL2',
      kind: 'voltage',
      plus: 'RL2.a',
      minus: 'RL2.b',
      label: 'Tensão em RL2 (equivalente)',
    },
    { id: 'IL2', kind: 'current', element: 'RL2', label: 'Corrente em RL2 (equivalente)' },
  ],
  goals: [
    {
      id: 'original-1k',
      description: 'Com 1 kΩ, a carga do circuito original recebe 2,4 mA.',
      check: { readout: 'IL1', op: 'between', value: [0.00239, 0.00241] },
    },
    {
      id: 'equivalente-1k',
      description: 'Com 1 kΩ, a carga do equivalente também recebe 2,4 mA.',
      check: { readout: 'IL2', op: 'between', value: [0.00239, 0.00241] },
    },
    {
      id: 'original-10k',
      description: 'Coloque RL1 em 10 kΩ: a tensão na carga original sobe para 6 V.',
      check: { readout: 'VL1', op: 'between', value: [5.99, 6.01] },
      solution: { 'RL1.resistance': 10000 },
    },
    {
      id: 'equivalente-10k',
      description: 'Coloque RL2 em 10 kΩ: a carga do equivalente também fica com 6 V.',
      check: { readout: 'VL2', op: 'between', value: [5.99, 6.01] },
      solution: { 'RL2.resistance': 10000 },
    },
    {
      id: 'metade',
      description:
        'Coloque RL2 em 2 kΩ, o mesmo valor da resistência de Thévenin: a carga fica com metade dos 7,2 V, ou 3,6 V.',
      check: { readout: 'VL2', op: 'between', value: [3.59, 3.61] },
      solution: { 'RL2.resistance': 2000 },
    },
  ],
});
