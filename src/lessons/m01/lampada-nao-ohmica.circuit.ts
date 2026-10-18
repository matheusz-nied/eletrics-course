import { defineCircuit } from '../../engine';

/**
 * Lesson 1.4 (Ohm's law): a 12 V / 5 W incandescent lamp on an adjustable
 * source. The filament heats up, so its resistance grows with the voltage:
 * at 12 V it is 28,8 Ω (417 mA); at 6 V it takes about 287 mA, not half.
 */
export default defineCircuit({
  id: 'm01/lampada-nao-ohmica',
  title: 'Uma lâmpada não segue a Lei de Ohm',
  description:
    'Uma fonte ajustável de 0 a 12 V ligada a uma lâmpada incandescente de 12 V e 5 W. Com 12 V o filamento fica muito quente e tem cerca de 29 Ω; com tensões menores ele esfria e a resistência cai. Por isso, com metade da tensão, a corrente não cai pela metade.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 10],
      b: [0, 20],
      label: 'Fonte',
      params: { voltage: 12 },
      control: {
        param: 'voltage',
        label: 'Tensão da fonte',
        kind: 'slider',
        min: 0,
        max: 12,
        step: 0.5,
        unit: 'V',
      },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 10],
        [0, 0],
        [20, 0],
      ],
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [20, 0],
      b: [20, 20],
      label: 'Lâmpada 12 V',
      params: { voltage: 12, power: 5 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [20, 20],
        [0, 20],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 20] },
  ],
  probes: [
    { id: 'corrente', kind: 'current', element: 'L1', label: 'Corrente na lâmpada' },
    { id: 'tensao', kind: 'voltage', plus: 'L1.a', minus: 'L1.b', label: 'Tensão na lâmpada' },
  ],
  goals: [
    {
      id: 'quente',
      description: 'Com 12 V, o filamento quente tem cerca de 29 Ω',
      check: { readout: 'L1.resistance', op: 'between', value: [28.5, 29.1] },
    },
    {
      id: 'meia-tensao',
      description: 'Baixe para 6 V: a corrente fica bem acima da metade de 417 mA',
      check: { readout: 'L1.current', op: 'between', value: [0.28, 0.295] },
      solution: { 'V1.voltage': 6 },
    },
  ],
});
