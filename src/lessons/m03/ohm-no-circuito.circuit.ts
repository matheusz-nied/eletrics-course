import { defineCircuit } from '../../engine';

/**
 * 03.4: an ohmmeter is a small current source plus a voltmeter. Measuring a
 * resistor still soldered to the board, the current also finds the path
 * through R2 and R3, and the reading comes out low.
 */
export default defineCircuit({
  id: 'm03/ohm-no-circuito',
  title: 'O ohmímetro mede tudo o que está ligado entre as pontas',
  description:
    'O ohmímetro, representado por uma fonte de corrente de 1 mA, mede o resistor R1 de 4,7 kΩ. Com R1 soldado na placa, a corrente também passa pelo caminho de R2 (10 kΩ) e R3 (2,2 kΩ), e a tensão nas pontas é de cerca de 3,39 V, o que dá uma leitura de 3,39 kΩ. Soltando uma perna de R1, a tensão sobe para 4,7 V e a leitura fica certa: 4,7 kΩ.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'I1',
      type: 'dc-current',
      a: [0, 0],
      b: [0, 12],
      label: 'Ohmímetro',
      params: { current: 0.001 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [10, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [10, 0],
      b: [10, 12],
      params: { resistance: 4700 },
    },
    {
      id: 'S1',
      type: 'switch',
      a: [10, 0],
      b: [16, 0],
      label: 'Solda',
      params: { closed: true },
      control: { param: 'closed', label: 'Perna de R1 soldada na placa', kind: 'toggle' },
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [16, 0],
      b: [26, 0],
      params: { resistance: 10000 },
    },
    {
      id: 'R3',
      type: 'resistor',
      a: [26, 0],
      b: [26, 12],
      params: { resistance: 2200 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [26, 12],
        [10, 12],
        [0, 12],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 12] },
  ],
  probes: [
    { id: 'VP', kind: 'voltage', plus: 'R1.a', minus: 'R1.b', label: 'Tensão entre as pontas' },
    { id: 'IR1', kind: 'current', element: 'R1', label: 'Corrente que passa por R1' },
  ],
  goals: [
    {
      id: 'na-placa',
      description:
        'Com R1 soldado na placa, a tensão nas pontas é de cerca de 3,39 V: leitura de 3,39 kΩ.',
      check: { readout: 'VP', op: 'between', value: [3.38, 3.4] },
    },
    {
      id: 'solto',
      description: 'Solte uma perna de R1 e veja a leitura subir para 4,7 kΩ (4,7 V com 1 mA).',
      check: { readout: 'VP', op: 'between', value: [4.69, 4.71] },
      solution: { 'S1.closed': false },
    },
  ],
});
