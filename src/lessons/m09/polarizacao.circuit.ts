import { defineCircuit } from '../../engine';

/**
 * 9.1: forward and reverse bias. Two lamps, each in series with a diode,
 * the diodes facing opposite ways; inverting the battery swaps which lamp lights.
 */
export default defineCircuit({
  id: 'm09/polarizacao',
  title: 'Polarização direta e reversa',
  description:
    'Uma bateria de 12 V alimenta dois ramos em paralelo. No ramo da esquerda, o diodo D1 tem o anodo virado para o positivo e acende a lâmpada L1. No ramo da direita, o diodo D2 está ao contrário, com o catodo virado para o positivo, e a lâmpada L2 fica apagada. Invertendo a bateria, os papéis se trocam: L2 acende e L1 apaga.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'B1',
      type: 'battery',
      a: [0, 0],
      b: [0, 18],
      label: 'Bateria',
      params: { voltage: 12, resistance: 0.05 },
      control: {
        param: 'voltage',
        label: 'Polaridade da bateria',
        kind: 'select',
        options: [
          { value: 12, label: 'Normal (positivo em cima)' },
          { value: -12, label: 'Invertida (positivo embaixo)' },
        ],
      },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [12, 0],
        [26, 0],
      ],
    },
    { id: 'D1', type: 'diode', a: [12, 0], b: [12, 9] },
    { id: 'L1', type: 'lamp', a: [12, 9], b: [12, 18], params: { voltage: 12, power: 5 } },
    { id: 'D2', type: 'diode', a: [26, 9], b: [26, 0] },
    { id: 'L2', type: 'lamp', a: [26, 9], b: [26, 18], params: { voltage: 12, power: 5 } },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [26, 18],
        [12, 18],
        [0, 18],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 18] },
  ],
  probes: [
    { id: 'VD1', kind: 'voltage', plus: 'D1.a', minus: 'D1.b', label: 'Tensão em D1 (anodo − catodo)' },
    { id: 'VD2', kind: 'voltage', plus: 'D2.a', minus: 'D2.b', label: 'Tensão em D2 (anodo − catodo)' },
    { id: 'IL1', kind: 'current', element: 'L1', label: 'Corrente em L1' },
    { id: 'IL2', kind: 'current', element: 'L2', label: 'Corrente em L2' },
  ],
  goals: [
    {
      id: 'direta',
      description:
        'Com a bateria normal, D1 está em polarização direta: L1 acende e D1 fica com cerca de 0,8 V.',
      check: { readout: 'VD1', op: 'between', value: [0.75, 0.9] },
    },
    {
      id: 'reversa',
      description: 'D2 está em polarização reversa: bloqueia e fica com quase toda a tensão da bateria.',
      check: { readout: 'VD2', op: '<', value: -11.5 },
    },
    {
      id: 'inverter',
      description: 'Inverta a bateria e acenda a lâmpada L2.',
      check: { readout: 'L2.brightness', op: '>', value: 0.7 },
      solution: { 'B1.voltage': -12 },
    },
  ],
});
