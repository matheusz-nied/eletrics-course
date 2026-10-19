import { defineCircuit } from '../../engine';

/**
 * 9.8: the same gate voltage on two MOSFETs, each switching a 12 V 21 W lamp
 * on the low side. Q1 is a standard MOSFET (parameters close to an IRF520:
 * 0,27 Ω at 10 V on the gate), Q2 a logic-level one (close to an IRLZ44N:
 * 0,025 Ω at 5 V). Neither has a heatsink. The values the lesson quotes are
 * checked in ./mosfet.test.ts.
 */
export default defineCircuit({
  id: 'm09/mosfet-gate',
  title: 'Tensão no gate: MOSFET comum e de nível lógico',
  description:
    'Uma fonte de 12 V alimenta duas lâmpadas de 12 V e 21 W. Cada lâmpada é ligada e desligada por um MOSFET canal N entre a lâmpada e o negativo: Q1 é um MOSFET comum, que precisa de cerca de 10 V no gate, e Q2 é um MOSFET de nível lógico, que conduz totalmente com 3,3 V ou 5 V. A mesma fonte de sinal alimenta os dois gates, com 0 V, 3,3 V, 5 V ou 10 V. Com 3,3 V, só a lâmpada de Q2 acende. Com 5 V, Q1 conduz só em parte, fica com quase toda a tensão, dissipa cerca de 8 W sem dissipador e queima em poucos segundos, em curto. Com 10 V, os dois conduzem totalmente.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 22],
      label: 'Fonte 12 V',
      params: { voltage: 12 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [8, 0],
        [32, 0],
      ],
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [8, 0],
      b: [8, 8],
      label: 'L1',
      params: { voltage: 12, power: 21 },
    },
    {
      id: 'Q1',
      type: 'nmos',
      at: [9, 10],
      flip: true,
      label: 'Q1',
      params: { vth: 3.5, kp: 0.57, power: 2 },
    },
    {
      id: 'L2',
      type: 'lamp',
      a: [32, 0],
      b: [32, 8],
      label: 'L2',
      params: { voltage: 12, power: 21 },
    },
    {
      id: 'Q2',
      type: 'nmos',
      at: [31, 10],
      label: 'Q2',
      params: { vth: 1.5, kp: 11.4, power: 2, vgsMax: 16 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [11, 10],
        [20, 10],
        [29, 10],
      ],
    },
    {
      id: 'V2',
      type: 'dc-voltage',
      a: [20, 10],
      b: [20, 22],
      label: 'Sinal no gate',
      params: { voltage: 0 },
      control: {
        param: 'voltage',
        label: 'Tensão no gate',
        kind: 'select',
        options: [
          { value: 0, label: '0 V (desligado)' },
          { value: 3.3, label: '3,3 V (saída de um ESP32)' },
          { value: 5, label: '5 V (saída de um Arduino Uno)' },
          { value: 10, label: '10 V' },
        ],
      },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [8, 12],
        [8, 22],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [32, 12],
        [32, 22],
        [20, 22],
        [8, 22],
        [0, 22],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 22] },
  ],
  probes: [
    { id: 'IL1', kind: 'current', element: 'L1', label: 'Corrente em L1 (Q1, comum)' },
    { id: 'PQ1', kind: 'power', element: 'Q1', label: 'Potência em Q1' },
    { id: 'IL2', kind: 'current', element: 'L2', label: 'Corrente em L2 (Q2, nível lógico)' },
    { id: 'PQ2', kind: 'power', element: 'Q2', label: 'Potência em Q2' },
  ],
  goals: [
    {
      id: 'logico-33',
      description: 'Com 3,3 V no gate, o MOSFET de nível lógico já conduz totalmente: L2 acende.',
      check: { readout: 'L2.brightness', op: '>', value: 0.9 },
      solution: { 'V2.voltage': 3.3 },
    },
    {
      id: 'comum-5',
      description: 'Com 5 V, o MOSFET comum conduz só em parte e dissipa vários watts.',
      check: { readout: 'Q1.power', op: '>', value: 5 },
      solution: { 'V2.voltage': 5 },
      at: 0.5,
    },
    {
      id: 'queima',
      description: 'Deixe o MOSFET comum com 5 V até ele queimar. Como fica a L1 depois disso?',
      check: { readout: 'Q1.burned', op: '==', value: true },
      solution: { 'V2.voltage': 5 },
      at: 3,
    },
    {
      id: 'comum-10',
      description:
        'Reinicie e escolha 10 V: o MOSFET comum conduz totalmente, como um resistor de valor baixo.',
      check: { readout: 'Q1.region', op: '==', value: 'triodo' },
      solution: { 'V2.voltage': 10 },
      at: 3,
    },
  ],
});
