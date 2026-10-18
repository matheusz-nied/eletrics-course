import { defineCircuit } from '../../engine';

/**
 * 9.5: the simple zener regulator. A 220 Ω series resistor and a 5,1 V,
 * 0,5 W zener feed a variable load; the input goes from 9 V to 15 V.
 */
export default defineCircuit({
  id: 'm09/zener-regulador',
  title: 'Regulador com diodo zener',
  description:
    'Uma fonte ajustável de 9 V a 15 V alimenta o resistor Rs, de 220 Ω, e o diodo zener DZ, de 5,1 V e 0,5 W, ligado com o catodo para o lado positivo. A carga RL, ajustável de 100 Ω a 10 kΩ, fica em paralelo com o zener e pode ser desligada pela chave S1. Enquanto sobra corrente para o zener, a saída fica perto de 5,1 V mesmo com a entrada e a carga mudando. Com uma carga pesada demais, abaixo de uns 160 Ω, o zener deixa de conduzir e a saída cai.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 16],
      label: 'Entrada',
      params: { voltage: 12 },
      control: {
        param: 'voltage',
        label: 'Tensão de entrada',
        kind: 'slider',
        min: 9,
        max: 15,
        step: 0.1,
        unit: 'V',
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
      id: 'RS',
      type: 'resistor',
      a: [4, 0],
      b: [14, 0],
      label: 'Rs',
      params: { resistance: 220, watts: 1 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [14, 0],
        [20, 0],
        [26, 0],
      ],
    },
    {
      id: 'DZ',
      type: 'zener',
      a: [20, 16],
      b: [20, 0],
      label: 'DZ',
      params: { voltage: 5.1, power: 0.5 },
    },
    {
      id: 'S1',
      type: 'switch',
      a: [26, 0],
      b: [32, 0],
      params: { closed: true },
      control: { param: 'closed', label: 'Ligar a carga', kind: 'toggle' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [32, 0],
        [36, 0],
      ],
    },
    {
      id: 'RL',
      type: 'resistor',
      a: [36, 0],
      b: [36, 16],
      label: 'RL',
      params: { resistance: 1000, watts: 1 },
      control: {
        param: 'resistance',
        label: 'Carga RL',
        kind: 'slider',
        min: 100,
        max: 10000,
        log: true,
        unit: 'Ω',
      },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [36, 16],
        [20, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
  ],
  probes: [
    { id: 'VOUT', kind: 'voltage', plus: 'DZ.b', minus: 'GND', label: 'Tensão na saída' },
    { id: 'IS', kind: 'current', element: 'RS', label: 'Corrente em Rs' },
    { id: 'IL', kind: 'current', element: 'RL', label: 'Corrente na carga' },
    { id: 'PZ', kind: 'power', element: 'DZ', label: 'Potência no zener' },
  ],
  goals: [
    {
      id: 'nominal',
      description: 'Com 12 V na entrada e a carga de 1 kΩ, a saída fica perto de 5,2 V.',
      check: { readout: 'VOUT', op: 'between', value: [5.15, 5.25] },
    },
    {
      id: 'entrada-baixa',
      description: 'Baixe a entrada para 9 V: a saída quase não muda.',
      check: { readout: 'VOUT', op: 'between', value: [5.12, 5.18] },
      solution: { 'V1.voltage': 9 },
    },
    {
      id: 'entrada-alta',
      description: 'Suba a entrada para 15 V: a saída sobe só alguns centésimos de volt.',
      check: { readout: 'VOUT', op: 'between', value: [5.2, 5.26] },
      solution: { 'V1.voltage': 15 },
    },
    {
      id: 'carga-pesada',
      description:
        'Com 12 V, baixe a carga para 100 Ω: o zener deixa de conduzir e a saída despenca para menos de 4 V.',
      check: { readout: 'VOUT', op: '<', value: 4 },
      solution: { 'RL.resistance': 100 },
    },
    {
      id: 'sem-carga',
      description:
        'Desligue a carga com a entrada em 15 V: toda a corrente vai para o zener, que passa a dissipar cerca de 0,23 W.',
      check: { readout: 'PZ', op: 'between', value: [0.21, 0.25] },
      solution: { 'V1.voltage': 15, 'S1.closed': false },
    },
  ],
});
