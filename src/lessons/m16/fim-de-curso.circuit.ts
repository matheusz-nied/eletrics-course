import { defineCircuit } from '../../engine';

/**
 * Lesson 16.4: the two limit-switch inputs of the CD-1. Each reed switch
 * pulls its pin to GND against a 10 kΩ pull-up, so "magnet near" reads 0 V.
 */
export default defineCircuit({
  id: 'm16/fim-de-curso',
  title: 'Entradas de fim de curso com resistor de pull-up',
  description:
    'A fonte de 5 V da lógica alimenta dois resistores de pull-up de 10 kΩ, um para o pino FCA e outro para o pino FCF do microcontrolador. Cada pino vai ao GND por um reed switch. Com o ímã longe, o reed fica aberto e o pino lê 5 V; com o ímã perto, o reed fecha, o pino lê 0 V e passa 0,5 mA pelo resistor. No início o portão está fechado: o ímã de fechamento está no reed FCF.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 14],
      params: { voltage: 5 },
      label: '5 V da lógica',
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
      id: 'W2',
      type: 'wire',
      points: [
        [10, 0],
        [24, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [10, 0],
      b: [10, 7],
      params: { resistance: 10000 },
      label: 'pull-up FCA',
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [24, 0],
      b: [24, 7],
      params: { resistance: 10000 },
      label: 'pull-up FCF',
    },
    {
      id: 'S1',
      type: 'switch',
      a: [10, 7],
      b: [10, 14],
      params: { closed: false },
      label: 'reed FCA',
      control: { param: 'closed', label: 'Ímã de abertura perto do reed FCA', kind: 'toggle' },
    },
    {
      id: 'S2',
      type: 'switch',
      a: [24, 7],
      b: [24, 14],
      params: { closed: true },
      label: 'reed FCF',
      control: { param: 'closed', label: 'Ímã de fechamento perto do reed FCF', kind: 'toggle' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [0, 14],
        [10, 14],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [10, 14],
        [24, 14],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 14] },
  ],
  probes: [
    { id: 'VFCA', kind: 'voltage', plus: 'R1.b', minus: 'GND', label: 'Pino FCA' },
    { id: 'VFCF', kind: 'voltage', plus: 'R2.b', minus: 'GND', label: 'Pino FCF' },
  ],
  goals: [
    {
      id: 'portao-aberto',
      description:
        'Abra o portão: tire o ímã de fechamento do reed FCF e leve o de abertura até o reed FCA. O pino FCA vai a 0 V.',
      check: { readout: 'VFCA', op: '<', value: 0.05 },
      solution: { 'S1.closed': true, 'S2.closed': false },
    },
    {
      id: 'meio-do-curso',
      description: 'Deixe o portão no meio do caminho, sem ímã perto: o pino FCF também vai a 5 V.',
      check: { readout: 'VFCF', op: '>', value: 4.95 },
      solution: { 'S2.closed': false },
    },
  ],
});
