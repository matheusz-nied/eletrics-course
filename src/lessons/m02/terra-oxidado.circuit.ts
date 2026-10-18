import { defineCircuit } from '../../engine';

/**
 * 02.4, real case: the car's lamps return to the battery through the body and
 * one ground connection. An oxidized ground is a resistance in series with the
 * whole parallel group, so pressing the brake dims the license-plate lamp.
 */
export default defineCircuit({
  id: 'm02/terra-oxidado',
  title: 'Lanternas do carro com o terra oxidado',
  description:
    'Uma bateria de 12 V alimenta a lâmpada da placa (5 W, chave das lanternas) e, pelo interruptor do pedal, as duas lâmpadas de freio (21 W cada). Todas voltam à bateria pela lataria e por uma única ligação de terra, cuja resistência pode ser ajustada de 0,01 Ω (terra bom) a 1 Ω (terra oxidado). Com o terra ruim, pisar no freio faz a luz da placa enfraquecer.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'B1',
      type: 'battery',
      a: [0, 0],
      b: [0, 18],
      label: 'Bateria',
      params: { voltage: 12, resistance: 0.02 },
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
      id: 'S2',
      type: 'switch',
      a: [10, 0],
      b: [10, 6],
      label: 'Lanternas',
      params: { closed: true },
      control: { param: 'closed', label: 'Lanternas', kind: 'toggle' },
    },
    {
      id: 'L3',
      type: 'lamp',
      a: [10, 6],
      b: [10, 14],
      label: 'Placa',
      params: { voltage: 12, power: 5 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [10, 0],
        [18, 0],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [18, 0],
      b: [24, 0],
      label: 'Freio',
      params: { closed: false },
      control: { param: 'closed', label: 'Pedal do freio', kind: 'toggle' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [24, 0],
        [28, 0],
      ],
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [28, 0],
      b: [28, 14],
      label: 'Freio E',
      params: { voltage: 12, power: 21 },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [28, 0],
        [38, 0],
      ],
    },
    {
      id: 'L2',
      type: 'lamp',
      a: [38, 0],
      b: [38, 14],
      label: 'Freio D',
      params: { voltage: 12, power: 21 },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [38, 14],
        [28, 14],
        [10, 14],
        [10, 18],
      ],
    },
    {
      id: 'RT',
      type: 'resistor',
      a: [10, 18],
      b: [2, 18],
      label: 'Terra',
      params: { resistance: 0.01, watts: 100 },
      control: {
        param: 'resistance',
        label: 'Resistência do terra',
        kind: 'slider',
        min: 0.01,
        max: 1,
        step: 0.01,
        unit: 'Ω',
      },
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [2, 18],
        [0, 18],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 18] },
  ],
  probes: [
    { id: 'VP', kind: 'voltage', plus: 'L3.a', minus: 'L3.b', label: 'Tensão na lâmpada da placa' },
    { id: 'VT', kind: 'voltage', plus: 'RT.a', minus: 'RT.b', label: 'Tensão perdida no terra' },
    { id: 'IT', kind: 'current', element: 'RT', label: 'Corrente no terra' },
  ],
  goals: [
    {
      id: 'terra-bom',
      description: 'Com o terra bom (0,01 Ω), a placa fica com quase 12 V, com ou sem o freio.',
      check: { readout: 'VP', op: '>', value: 11.8 },
      solution: { 'S1.closed': true },
    },
    {
      id: 'terra-ruim',
      description:
        'Suba o terra para 0,4 Ω e pise no freio: a tensão na placa cai para cerca de 10,5 V.',
      check: { readout: 'VP', op: 'between', value: [10.3, 10.6] },
      solution: { 'S1.closed': true, 'RT.resistance': 0.4 },
    },
  ],
});
