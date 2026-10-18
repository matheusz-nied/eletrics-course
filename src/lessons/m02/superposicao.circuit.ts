import { defineCircuit } from '../../engine';

/**
 * 02.8: superposition with two sources (12 V and 6 V) feeding a 2 kΩ resistor
 * through 1 kΩ and 2 kΩ. Each source can be turned off: an ideal voltage
 * source at 0 V is a wire.
 */
const sourceControl = (label: string, volts: number) => ({
  param: 'voltage',
  label,
  kind: 'select' as const,
  options: [
    { value: volts, label: `Ligada (${volts} V)` },
    { value: 0, label: 'Desligada: vira um fio (0 V)' },
  ],
});

export default defineCircuit({
  id: 'm02/superposicao',
  title: 'Superposição com duas fontes',
  description:
    'Duas fontes, V1 de 12 V e V2 de 6 V, alimentam o resistor R3 de 2 kΩ através de R1 (1 kΩ) e R2 (2 kΩ). Cada fonte pode ser desligada, o que a transforma num fio (0 V). Com as duas fontes, R3 fica com 7,5 V; só com V1, 6 V; só com V2, 1,5 V. A soma das duas contribuições dá o valor com as duas fontes juntas.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 12],
      params: { voltage: 12 },
      control: sourceControl('Fonte V1', 12),
    },
    { id: 'R1', type: 'resistor', a: [0, 0], b: [12, 0], params: { resistance: 1000 } },
    { id: 'R3', type: 'resistor', a: [12, 0], b: [12, 12], params: { resistance: 2000 } },
    { id: 'R2', type: 'resistor', a: [12, 0], b: [24, 0], params: { resistance: 2000 } },
    {
      id: 'V2',
      type: 'dc-voltage',
      a: [24, 0],
      b: [24, 12],
      params: { voltage: 6 },
      control: sourceControl('Fonte V2', 6),
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 12],
        [12, 12],
        [24, 12],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 12] },
  ],
  probes: [
    { id: 'V3', kind: 'voltage', plus: 'R3.a', minus: 'R3.b', label: 'Tensão em R3' },
    { id: 'I3', kind: 'current', element: 'R3', label: 'Corrente em R3' },
  ],
  goals: [
    {
      id: 'duas-fontes',
      description: 'Com as duas fontes ligadas, R3 fica com 7,5 V.',
      check: { readout: 'V3', op: 'between', value: [7.49, 7.51] },
    },
    {
      id: 'so-v1',
      description: 'Desligue só V2: com V1 sozinha, R3 fica com 6 V.',
      check: { readout: 'V3', op: 'between', value: [5.99, 6.01] },
      solution: { 'V2.voltage': 0 },
    },
    {
      id: 'so-v2',
      description: 'Agora ligue V2 e desligue só V1: com V2 sozinha, R3 fica com 1,5 V.',
      check: { readout: 'V3', op: 'between', value: [1.49, 1.51] },
      solution: { 'V1.voltage': 0 },
    },
  ],
});
