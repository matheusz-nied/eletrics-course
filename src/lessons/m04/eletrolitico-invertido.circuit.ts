import { defineCircuit } from '../../engine';

/**
 * 04.3: an electrolytic capacitor of 1.000 µF / 16 V connected right, above
 * its rated voltage and reversed. The engine bulges and shorts it in the last
 * two cases; "Reiniciar" puts a new one in place.
 */
export default defineCircuit({
  id: 'm04/eletrolitico-invertido',
  title: 'Eletrolítico ligado certo, acima da tensão e invertido',
  description:
    'Uma fonte ajustável alimenta, por um resistor de 100 Ω, um capacitor eletrolítico de 1.000 µF e 16 V. Com 12 V na polaridade certa, o capacitor carrega e a corrente cai a zero. Com 25 V, acima da tensão nominal, ou com 12 V invertidos, o capacitor esquenta, estufa em menos de um segundo e entra em curto: a corrente sobe e fica passando por ele.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 14],
      label: 'Fonte',
      params: { voltage: 12 },
      control: {
        param: 'voltage',
        label: 'Ligação do capacitor',
        kind: 'select',
        options: [
          { value: 12, label: '12 V, polaridade certa' },
          { value: 25, label: '25 V, acima da nominal (16 V)' },
          { value: -12, label: '12 V invertidos' },
        ],
      },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [4, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [4, 0],
      b: [14, 0],
      params: { resistance: 100, watts: 10 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [14, 0],
        [18, 0],
      ],
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [18, 0],
      b: [18, 14],
      label: '1.000 µF 16 V',
      params: { capacitance: 0.001, voltage: 16, polarized: true },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [18, 14],
        [0, 14],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 14] },
  ],
  probes: [
    { id: 'VC', kind: 'voltage', plus: 'C1.a', minus: 'C1.b', label: 'Tensão no capacitor' },
    { id: 'IC', kind: 'current', element: 'R1', label: 'Corrente no capacitor' },
  ],
  goals: [
    {
      id: 'certo',
      description: 'Ligado certo, com 12 V: o capacitor carrega e a corrente fica em zero.',
      check: { readout: 'IC', op: 'between', value: [-0.0001, 0.0001] },
    },
    {
      id: 'sobretensao',
      description: 'Escolha 25 V: acima dos 16 V da etiqueta, o capacitor estufa.',
      check: { readout: 'C1.bulged', op: '==', value: true },
      solution: { 'V1.voltage': 25 },
    },
    {
      id: 'invertido',
      description:
        'Reinicie e escolha 12 V invertidos: o capacitor estufa e passa a conduzir uns 0,12 A.',
      check: { readout: 'IC', op: 'between', value: [-0.125, -0.11] },
      solution: { 'V1.voltage': -12 },
    },
  ],
});
