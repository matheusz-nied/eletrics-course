import { defineCircuit } from '../../engine';

/**
 * 02.5, real case: jump-starting a car. A charged battery (12,6 V) is put in
 * parallel with a weak one (11,8 V, higher internal resistance) through the
 * jumper cables; the starter motor is modeled as a 0,05 Ω load.
 */
export default defineCircuit({
  id: 'm02/chupeta',
  title: 'Chupeta: duas baterias ligadas pelos cabos',
  description:
    'À esquerda, a bateria boa (12,6 V, resistência interna de 0,01 Ω); à direita, a bateria fraca do carro parado (11,8 V, 0,03 Ω) e o motor de partida (0,05 Ω), acionado por um botão. Os cabos de chupeta, com 0,02 Ω no total (ida e volta), ligam as duas baterias em paralelo. Só com os cabos, passam cerca de 13 A da bateria boa para a fraca. Na partida, a bateria fraca sozinha cai para cerca de 7,4 V; com os cabos, a tensão fica perto de 9,4 V e a bateria boa fornece mais da metade da corrente do motor.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'B1',
      type: 'battery',
      a: [0, 0],
      b: [0, 14],
      label: 'Boa',
      params: { voltage: 12.6, resistance: 0.01 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [2, 0],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [2, 0],
      b: [8, 0],
      label: 'Cabos',
      params: { closed: false },
      control: { param: 'closed', label: 'Cabos de chupeta ligados', kind: 'toggle' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [8, 0],
        [10, 0],
      ],
    },
    {
      id: 'RC',
      type: 'resistor',
      a: [10, 0],
      b: [16, 0],
      label: 'Cabos',
      params: { resistance: 0.02, watts: 2000 },
      control: {
        param: 'resistance',
        label: 'Resistência dos cabos (ida e volta)',
        kind: 'slider',
        min: 0.005,
        max: 0.2,
        step: 0.005,
        unit: 'Ω',
      },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [16, 0],
        [20, 0],
      ],
    },
    {
      id: 'B2',
      type: 'battery',
      a: [20, 0],
      b: [20, 14],
      label: 'Fraca',
      params: { voltage: 11.8, resistance: 0.03 },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [20, 0],
        [28, 0],
      ],
    },
    {
      id: 'P1',
      type: 'push-button',
      a: [28, 0],
      b: [28, 6],
      label: 'Partida',
      control: { param: 'pressed', label: 'Dar a partida', kind: 'momentary' },
    },
    {
      id: 'RM',
      type: 'resistor',
      a: [28, 6],
      b: [28, 14],
      label: 'Motor',
      params: { resistance: 0.05, watts: 5000 },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [28, 14],
        [20, 14],
        [0, 14],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 14] },
  ],
  probes: [
    { id: 'VF', kind: 'voltage', plus: 'B2.a', minus: 'B2.b', label: 'Tensão na bateria fraca' },
    { id: 'IC', kind: 'current', element: 'RC', label: 'Corrente nos cabos' },
    { id: 'IF', kind: 'current', element: 'B2', label: 'Corrente fornecida pela bateria fraca' },
    { id: 'IM', kind: 'current', element: 'RM', label: 'Corrente no motor de partida' },
  ],
  goals: [
    {
      id: 'sozinha',
      description: 'Sem os cabos, dê a partida: a bateria fraca desaba para cerca de 7,4 V.',
      check: { readout: 'VF', op: 'between', value: [7.3, 7.45] },
      solution: { 'P1.pressed': true },
    },
    {
      id: 'recebe',
      description:
        'Ligue os cabos sem dar a partida: cerca de 13 A passam da bateria boa para a fraca, e a corrente da fraca fica negativa, porque ela está recebendo carga.',
      check: { readout: 'IF', op: 'between', value: [-13.7, -13] },
      solution: { 'S1.closed': true },
    },
    {
      id: 'com-cabos',
      description: 'Com os cabos ligados, dê a partida: a tensão fica perto de 9,4 V.',
      check: { readout: 'VF', op: 'between', value: [9.3, 9.45] },
      solution: { 'S1.closed': true, 'P1.pressed': true },
    },
    {
      id: 'motor',
      description: 'Na partida com os cabos, o motor puxa cerca de 187 A.',
      check: { readout: 'IM', op: 'between', value: [185, 190] },
      solution: { 'S1.closed': true, 'P1.pressed': true },
    },
    {
      id: 'divide',
      description:
        'Na partida com os cabos, cerca de 107 A chegam pelos cabos: mais da metade da corrente do motor.',
      check: { readout: 'IC', op: 'between', value: [105, 108.5] },
      solution: { 'S1.closed': true, 'P1.pressed': true },
    },
    {
      id: 'cabo-fino',
      description: 'Com cabos finos (0,1 Ω), a tensão na partida cai para cerca de 8,1 V.',
      check: { readout: 'VF', op: 'between', value: [8.05, 8.25] },
      solution: { 'RC.resistance': 0.1, 'S1.closed': true, 'P1.pressed': true },
    },
  ],
});
