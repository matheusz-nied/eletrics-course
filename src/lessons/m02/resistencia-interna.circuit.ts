import { defineCircuit } from '../../engine';

/** 02.7: measuring the internal resistance of a 9 V battery with a load resistor. */
export default defineCircuit({
  id: 'm02/resistencia-interna',
  title: 'Resistência interna de uma bateria de 9 V',
  description:
    'Uma bateria de 9 V com resistência interna típica de 1,7 Ω alimenta um resistor de carga ajustável de 1 Ω a 1 kΩ através de uma chave. Sem carga, os terminais mostram 9 V. Com a carga ligada, parte da tensão fica dentro da bateria: com 10 Ω, os terminais caem para cerca de 7,7 V e a corrente é de cerca de 0,77 A.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'B1', type: 'battery', a: [0, 0], b: [0, 14], params: { voltage: 9, resistance: 1.7 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [10, 0],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [10, 0],
      b: [16, 0],
      params: { closed: false },
      control: { param: 'closed', label: 'Ligar a carga', kind: 'toggle' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [16, 0],
        [24, 0],
      ],
    },
    {
      id: 'RL',
      type: 'resistor',
      a: [24, 0],
      b: [24, 14],
      label: 'RL',
      params: { resistance: 10, watts: 20 },
      control: {
        param: 'resistance',
        label: 'Resistência da carga RL',
        kind: 'slider',
        min: 1,
        max: 1000,
        log: true,
        unit: 'Ω',
      },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [24, 14],
        [0, 14],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 14] },
  ],
  probes: [
    { id: 'VT', kind: 'voltage', plus: 'B1.a', minus: 'B1.b', label: 'Tensão nos terminais' },
    { id: 'I', kind: 'current', element: 'RL', label: 'Corrente na carga' },
  ],
  goals: [
    {
      id: 'aberto',
      description: 'Sem carga, leia a tensão nos terminais: 9 V.',
      check: { readout: 'VT', op: 'between', value: [8.99, 9.01] },
    },
    {
      id: 'carga-10',
      description: 'Ligue a carga de 10 Ω: os terminais caem para cerca de 7,7 V.',
      check: { readout: 'VT', op: 'between', value: [7.65, 7.73] },
      solution: { 'S1.closed': true, 'RL.resistance': 10 },
    },
    {
      id: 'corrente-10',
      description: 'Com 10 Ω, a corrente fica perto de 0,77 A.',
      check: { readout: 'I', op: 'between', value: [0.765, 0.773] },
      solution: { 'S1.closed': true, 'RL.resistance': 10 },
    },
    {
      id: 'carga-100',
      description:
        'Suba a carga para 100 Ω (carga leve): a queda é pequena, os terminais ficam em 8,85 V.',
      check: { readout: 'VT', op: 'between', value: [8.83, 8.87] },
      solution: { 'S1.closed': true, 'RL.resistance': 100 },
    },
    {
      id: 'carga-1',
      description: 'Desça a carga até 1 Ω: os terminais ficam com só 3,3 V.',
      check: { readout: 'VT', op: 'between', value: [3.3, 3.37] },
      solution: { 'S1.closed': true, 'RL.resistance': 1 },
    },
    {
      id: 'carga-pesada',
      description:
        'Baixe a carga para 1,7 Ω (igual à resistência interna): os terminais ficam com a metade, 4,5 V.',
      check: { readout: 'VT', op: 'between', value: [4.45, 4.55] },
      solution: { 'S1.closed': true, 'RL.resistance': 1.7 },
    },
  ],
});
