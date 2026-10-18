import { defineCircuit } from '../../engine';

/**
 * 9.6: an NPN transistor as a switch. A microcontroller pin drives the base
 * through RB; the transistor switches a 12 V lamp. With RB small enough it
 * saturates (VCE near zero, little heat); with RB too large it stays in the
 * active region, the lamp glows dim and the transistor heats up. The values
 * the lesson quotes are checked in ./transistor.test.ts.
 */
export default defineCircuit({
  id: 'm09/transistor-chave',
  title: 'Transistor como chave',
  description:
    'Um pino de microcontrolador, de 5 V, liga a base de um transistor NPN por um resistor RB. O coletor do transistor liga uma lâmpada de 12 V e 1,2 W a uma fonte de 12 V, e o emissor vai ao negativo. Com o pino em 0 V, o transistor corta e a lâmpada fica apagada. Com o pino em 5 V e RB pequeno, o transistor satura e a lâmpada acende com brilho total. Com RB grande demais, a corrente de base não basta: a lâmpada fica fraca e o transistor esquenta.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V2',
      type: 'dc-voltage',
      a: [0, 12],
      b: [0, 22],
      label: 'Pino',
      params: { voltage: 5 },
      control: {
        param: 'voltage',
        label: 'Pino do microcontrolador',
        kind: 'select',
        options: [
          { value: 5, label: 'Nível alto (5 V)' },
          { value: 0, label: 'Nível baixo (0 V)' },
        ],
      },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 12],
        [6, 12],
      ],
    },
    {
      id: 'RB',
      type: 'resistor',
      a: [6, 12],
      b: [16, 12],
      label: 'RB',
      params: { resistance: 1000 },
      control: {
        param: 'resistance',
        label: 'Resistor de base RB',
        kind: 'slider',
        min: 470,
        max: 1e6,
        log: true,
        unit: 'Ω',
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [16, 12],
        [18, 12],
      ],
    },
    {
      id: 'Q1',
      type: 'npn',
      at: [20, 12],
      label: 'Q1',
      // A BC337-style small transistor: 45 V, 0,625 W.
      params: { beta: 250, vceo: 45, power: 0.625 },
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [21, 2],
      b: [21, 10],
      label: 'Lâmpada',
      params: { voltage: 12, power: 1.2 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [21, 2],
        [32, 2],
      ],
    },
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [32, 2],
      b: [32, 22],
      label: 'Fonte 12 V',
      params: { voltage: 12 },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [21, 14],
        [21, 22],
      ],
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [0, 22],
        [21, 22],
        [32, 22],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 22] },
  ],
  probes: [
    { id: 'IB', kind: 'current', element: 'RB', label: 'Corrente de base' },
    { id: 'IC', kind: 'current', element: 'L1', label: 'Corrente de coletor (na lâmpada)' },
    { id: 'VCE', kind: 'voltage', plus: 'Q1.c', minus: 'Q1.e', label: 'Tensão coletor-emissor' },
    { id: 'PQ', kind: 'power', element: 'Q1', label: 'Potência no transistor' },
  ],
});
