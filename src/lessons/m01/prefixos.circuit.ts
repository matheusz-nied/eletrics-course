import { defineCircuit } from '../../engine';

/**
 * Lesson 1.6 (units): 12 V on a resistor whose value goes up ten times at a
 * time, from 470 Ω to 4,7 MΩ. The current falls ten times at a time, so the
 * digits "255" stay and only the comma and the prefix move on the meter.
 */
export default defineCircuit({
  id: 'm01/prefixos',
  title: 'Prefixos no multímetro',
  description:
    'Uma fonte de 12 V ligada a um resistor. Escolha resistores de 470 Ω a 4,7 MΩ, cada um dez vezes maior que o anterior, e veja a corrente mudar de miliampères para microampères no multímetro.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 16],
      label: 'Fonte 12 V',
      params: { voltage: 12 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [16, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [16, 0],
      b: [16, 16],
      label: 'Resistor',
      params: { resistance: 4700, watts: 0.5, tolerance: 0 },
      control: {
        param: 'resistance',
        label: 'Marcação do resistor',
        kind: 'select',
        options: [
          { value: 470, label: '470R (470 Ω)' },
          { value: 4700, label: '4K7 (4,7 kΩ)' },
          { value: 47_000, label: '47K (47 kΩ)' },
          { value: 470_000, label: '470K (470 kΩ)' },
          { value: 4_700_000, label: '4M7 (4,7 MΩ)' },
        ],
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [16, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
  ],
  probes: [{ id: 'corrente', kind: 'current', element: 'R1', label: 'Corrente no resistor' }],
  goals: [
    {
      id: '4k7',
      description: 'Com 4K7, a corrente é de 2,55 mA',
      check: { readout: 'R1.current', op: 'between', value: [0.00254, 0.00256] },
    },
    {
      id: '470r',
      description: 'Com 470R, a corrente é dez vezes maior: 25,5 mA',
      check: { readout: 'R1.current', op: 'between', value: [0.0254, 0.0256] },
      solution: { 'R1.resistance': 470 },
    },
    {
      id: '4m7',
      description: 'Com 4M7, a corrente cai para 2,55 µA',
      check: { readout: 'R1.current', op: 'between', value: [0.00000254, 0.00000256] },
      solution: { 'R1.resistance': 4_700_000 },
    },
  ],
});
