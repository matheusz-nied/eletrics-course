import { defineCircuit } from '../../engine';

/** 02.6: a 10 kΩ + 10 kΩ divider whose output sags when a load is connected. */
export default defineCircuit({
  id: 'm02/divisor-carga',
  title: 'Divisor de tensão com carga',
  description:
    'Uma fonte de 12 V alimenta dois resistores de 10 kΩ em série. Sem nada ligado, o ponto do meio fica em 6 V. A chave S1 liga uma carga RL, ajustável de 10 Ω a 1 MΩ, em paralelo com o resistor de baixo: quanto menor a resistência da carga, mais a tensão de saída cai. Com RL de 10 kΩ, a saída vai para 4 V; com 1 kΩ, para cerca de 1 V.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'V1', type: 'dc-voltage', a: [0, 0], b: [0, 16], params: { voltage: 12 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [12, 0],
      ],
    },
    { id: 'R1', type: 'resistor', a: [12, 0], b: [12, 8], params: { resistance: 10000 } },
    { id: 'R2', type: 'resistor', a: [12, 8], b: [12, 16], params: { resistance: 10000 } },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [12, 8],
        [22, 8],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [22, 8],
      b: [28, 8],
      params: { closed: false },
      control: { param: 'closed', label: 'Ligar a carga', kind: 'toggle' },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [28, 8],
        [34, 8],
      ],
    },
    {
      id: 'RL',
      type: 'resistor',
      a: [34, 8],
      b: [34, 16],
      label: 'RL',
      params: { resistance: 10000, watts: 5 },
      control: {
        param: 'resistance',
        label: 'Resistência da carga RL',
        kind: 'slider',
        min: 10,
        max: 1000000,
        log: true,
        unit: 'Ω',
      },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [34, 16],
        [12, 16],
      ],
    },
  ],
  probes: [
    { id: 'VS', kind: 'voltage', plus: 'R2.a', minus: 'GND', label: 'Tensão na saída do divisor' },
    { id: 'I1', kind: 'current', element: 'R1', label: 'Corrente em R1' },
    { id: 'I2', kind: 'current', element: 'R2', label: 'Corrente em R2' },
    { id: 'IL', kind: 'current', element: 'RL', label: 'Corrente na carga' },
  ],
  goals: [
    {
      id: 'sem-carga',
      description: 'Sem carga, confira que a saída fica na metade da fonte: 6 V.',
      check: { readout: 'VS', op: 'between', value: [5.95, 6.05] },
    },
    {
      id: 'carga-10k',
      description: 'Ligue uma carga de 10 kΩ e veja a saída cair para 4 V.',
      check: { readout: 'VS', op: 'between', value: [3.95, 4.05] },
      solution: { 'S1.closed': true, 'RL.resistance': 10000 },
    },
    {
      id: 'carga-1k',
      description: 'Baixe a carga para 1 kΩ: a saída despenca para 1 V.',
      check: { readout: 'VS', op: 'between', value: [0.98, 1.02] },
      solution: { 'S1.closed': true, 'RL.resistance': 1000 },
    },
    {
      id: 'carga-alta',
      description: 'Suba a carga para 1 MΩ: a saída quase não muda e fica em 5,97 V.',
      check: { readout: 'VS', op: 'between', value: [5.96, 5.98] },
      solution: { 'S1.closed': true, 'RL.resistance': 1000000 },
    },
    {
      id: 'aparelho',
      description:
        'Simule um aparelho de 6 V e 100 mA (RL = 60 Ω): a saída despenca para menos de 0,1 V.',
      check: { readout: 'VS', op: '<', value: 0.1 },
      solution: { 'S1.closed': true, 'RL.resistance': 60 },
    },
    {
      id: 'divisor-corrente',
      description: 'Com a carga de 1 kΩ, confira que ela recebe 1 mA, dez vezes a corrente de R2.',
      check: { readout: 'IL', op: 'between', value: [0.00098, 0.00102] },
      solution: { 'S1.closed': true, 'RL.resistance': 1000 },
    },
  ],
});
