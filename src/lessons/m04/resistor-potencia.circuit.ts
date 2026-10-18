import { defineCircuit } from '../../engine';

/**
 * 04.1: a resistor on 12 V and its power rating. 100 Ω dissipates 1,44 W:
 * a 1/4 W part burns in seconds, 1/2 W and 1 W run far too hot, 2 W is within
 * its rating and 3 W (twice the power, the rule of thumb) runs with margin.
 * The temperatures the lesson quotes are checked in ./resistores.test.ts.
 */
export default defineCircuit({
  id: 'm04/resistor-potencia',
  title: 'Potência nominal de um resistor',
  description:
    'Uma fonte de 12 V alimenta um resistor quando a chave S1 fecha. A resistência pode ser 100 Ω, 220 Ω, 470 Ω ou 1 kΩ, e a potência nominal do resistor pode ser 1/4 W, 1/2 W, 1 W, 2 W ou 3 W. Com 100 Ω, o resistor dissipa 1,44 W: o de 1/4 W queima em cerca de 16 segundos, os de 1/2 W e 1 W esquentam demais, o de 2 W fica abaixo do limite e o de 3 W trabalha com folga. Com 1 kΩ, a potência cai para 0,144 W e até o de 1/4 W aguenta.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 14],
      label: 'Fonte 12 V',
      params: { voltage: 12 },
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
      id: 'S1',
      type: 'switch',
      a: [8, 0],
      b: [16, 0],
      control: { param: 'closed', label: 'Chave S1', kind: 'toggle' },
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
      id: 'R1',
      type: 'resistor',
      a: [24, 0],
      b: [24, 14],
      params: { resistance: 100, watts: 0.25 },
      control: [
        {
          param: 'resistance',
          label: 'Resistência de R1',
          kind: 'select',
          options: [
            { value: 100, label: '100 Ω' },
            { value: 220, label: '220 Ω' },
            { value: 470, label: '470 Ω' },
            { value: 1000, label: '1 kΩ' },
          ],
        },
        {
          param: 'watts',
          label: 'Potência nominal de R1',
          kind: 'select',
          options: [
            { value: 0.25, label: '1/4 W' },
            { value: 0.5, label: '1/2 W' },
            { value: 1, label: '1 W' },
            { value: 2, label: '2 W' },
            { value: 3, label: '3 W' },
          ],
        },
      ],
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
    { id: 'IR', kind: 'current', element: 'R1', label: 'Corrente em R1' },
    { id: 'PR', kind: 'power', element: 'R1', label: 'Potência dissipada em R1' },
  ],
  goals: [
    {
      id: 'potencia',
      description: 'Feche a chave: o resistor de 100 Ω dissipa 1,44 W.',
      check: { readout: 'PR', op: 'between', value: [1.43, 1.45] },
      solution: { 'S1.closed': true },
    },
    {
      id: 'queima',
      description: 'Deixe ligado: o resistor de 1/4 W queima em poucos segundos.',
      check: { readout: 'R1.burned', op: '==', value: true },
      at: 20,
      solution: { 'S1.closed': true },
    },
    {
      id: 'mil-ohms',
      description: 'Use Reiniciar e troque para 1 kΩ: a potência cai para 0,144 W.',
      check: { readout: 'PR', op: 'between', value: [0.143, 0.145] },
      solution: { 'S1.closed': true, 'R1.resistance': 1000 },
    },
  ],
});
