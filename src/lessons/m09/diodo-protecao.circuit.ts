import { defineCircuit } from '../../engine';

/**
 * 9.2: protection against reversed polarity. A diode in series with the
 * positive line of a 12 V device: with the battery the right way it costs a
 * diode drop; reversed, it blocks and the device sees nothing. The values the
 * lesson quotes are checked by the goals and by ./diodo.test.ts.
 */
export default defineCircuit({
  id: 'm09/diodo-protecao',
  title: 'Diodo contra inversão de polaridade',
  description:
    'Uma bateria de 12 V alimenta um aparelho de 12 V que puxa cerca de 0,5 A, representado por um resistor de 24 Ω. No fio positivo há um diodo em série, com o anodo virado para a bateria. Com a bateria ligada do jeito certo, o diodo conduz e o aparelho recebe 12 V menos a queda do diodo. Com a bateria invertida, o diodo bloqueia e o aparelho fica sem tensão nenhuma. Dá para trocar o diodo comum (1N4007) por um Schottky (1N5819), que perde menos tensão.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'B1',
      type: 'battery',
      a: [0, 0],
      b: [0, 16],
      label: 'Bateria',
      params: { voltage: 12, resistance: 0.02 },
      control: {
        param: 'voltage',
        label: 'Bateria',
        kind: 'select',
        options: [
          { value: 12, label: 'Ligada certo (positivo em cima)' },
          { value: -12, label: 'Invertida (positivo embaixo)' },
        ],
      },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [8, 0],
      ],
    },
    {
      id: 'D1',
      type: 'diode',
      a: [8, 0],
      b: [18, 0],
      label: 'D1',
      params: { model: 'rectifier' },
      control: {
        param: 'model',
        label: 'Diodo de proteção',
        kind: 'select',
        options: [
          { value: 'rectifier', label: '1N4007 (silício comum)' },
          { value: 'schottky', label: '1N5819 (Schottky)' },
        ],
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [18, 0],
        [26, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [26, 0],
      b: [26, 16],
      label: 'Aparelho 12 V',
      params: { resistance: 24, watts: 20 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [26, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
  ],
  probes: [
    { id: 'VAP', kind: 'voltage', plus: 'R1.a', minus: 'R1.b', label: 'Tensão no aparelho' },
    { id: 'IAP', kind: 'current', element: 'R1', label: 'Corrente no aparelho' },
    { id: 'VD1', kind: 'voltage', plus: 'D1.a', minus: 'D1.b', label: 'Tensão no diodo' },
    { id: 'PD1', kind: 'power', element: 'D1', label: 'Potência no diodo' },
  ],
  goals: [
    {
      id: 'queda',
      description:
        'Com a bateria ligada certo e o 1N4007, o aparelho funciona, mas perde a queda do diodo: recebe cerca de 11,1 V.',
      check: { readout: 'VAP', op: 'between', value: [11.05, 11.2] },
    },
    {
      id: 'invertida',
      description: 'Inverta a bateria: o diodo bloqueia e o aparelho fica sem corrente.',
      check: { readout: 'IAP', op: 'between', value: [-0.001, 0.001] },
      solution: { 'B1.voltage': -12 },
    },
    {
      id: 'schottky',
      description: 'Troque o diodo pelo Schottky e veja o aparelho receber mais de 11,5 V.',
      check: { readout: 'VAP', op: '>', value: 11.5 },
      solution: { 'D1.model': 'schottky' },
    },
  ],
});
