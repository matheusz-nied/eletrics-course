import { defineCircuit } from '../../engine';

/**
 * 12.4: actuators on a microcontroller (firmware m12/liga-desliga). Each
 * touch of the button toggles D7, which drives a 12 V relay through an NPN
 * transistor with a base resistor, a base pull-down and a freewheeling
 * diode; the relay contact switches a 12 V lamp. A small active piezo buzzer
 * on D8, straight on the pin, beeps to confirm. The values the lesson quotes
 * are checked in ./circuitos.test.ts.
 */
export default defineCircuit({
  id: 'm12/rele-lampada',
  title: 'Relé e buzzer comandados pelo microcontrolador',
  description:
    'Um microcontrolador alimentado por 5 V lê um botão no pino D2, com o pull-up interno. Cada toque inverte o pino D7 e faz o pino D8 dar um bipe de 0,1 s num buzzer piezoelétrico ativo pequeno, ligado direto ao pino. O pino D7 comanda, por um resistor de 1 kΩ, a base de um transistor NPN; um resistor de 10 kΩ liga a base ao negativo. O transistor liga ao negativo a bobina de um relé de 12 V, que tem um diodo de roda livre em paralelo. O contato normalmente aberto do relé acende uma lâmpada de 12 V e 5 W, alimentada por uma fonte de 12 V. As duas fontes têm o negativo em comum. A entrada do receptor de rádio não é usada e fica ligada ao negativo.',
  analysis: { kind: 'transient', dt: 0.001, speed: 1 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 6],
      b: [0, 28],
      label: '5 V',
      params: { voltage: 5 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 6],
        [20, 6],
        [20, 12],
      ],
    },
    {
      id: 'U1',
      type: 'mcu',
      at: [20, 15],
      label: 'Micro',
      params: { firmware: 'm12/liga-desliga', pinsLeft: 'D2,RF', pinsRight: 'D7,D8' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [14, 14],
        [10, 14],
      ],
    },
    {
      id: 'S1',
      type: 'push-button',
      a: [10, 14],
      b: [5, 14],
      label: 'Botão',
      control: { param: 'pressed', label: 'Botão (D2)', kind: 'momentary' },
    },
    { id: 'G2', type: 'ground', at: [5, 14] },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [14, 16],
        [12, 16],
        [12, 28],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [20, 18],
        [20, 28],
      ],
    },
    // D8: the buzzer, straight on the pin.
    {
      id: 'W5',
      type: 'wire',
      points: [
        [26, 16],
        [28, 16],
        [28, 21],
      ],
    },
    {
      id: 'BZ1',
      type: 'buzzer',
      a: [28, 21],
      b: [28, 28],
      label: 'BZ1',
      params: { voltage: 5, current: 0.012 },
    },
    // D7: transistor and relay.
    {
      id: 'RB',
      type: 'resistor',
      a: [26, 14],
      b: [32, 14],
      params: { resistance: 1000 },
    },
    {
      id: 'RBE',
      type: 'resistor',
      a: [32, 14],
      b: [32, 28],
      params: { resistance: 10000 },
    },
    {
      id: 'Q1',
      type: 'npn',
      at: [34, 14],
      label: 'Q1',
      // A BC548-style small transistor: 30 V, 0,5 W.
      params: { beta: 200, vceo: 30, power: 0.5 },
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [35, 16],
        [35, 28],
      ],
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [35, 12],
        [35, 10],
        [36, 10],
      ],
    },
    {
      id: 'K1',
      type: 'relay-spdt',
      at: [38, 8],
      label: 'K1',
      params: { coilVoltage: 12, coilResistance: 400 },
    },
    {
      id: 'W8',
      type: 'wire',
      points: [
        [35, 10],
        [30, 10],
      ],
    },
    {
      id: 'D1',
      type: 'diode',
      a: [30, 10],
      b: [30, 0],
      label: 'D1',
      params: { model: 'signal' },
    },
    {
      id: 'W9',
      type: 'wire',
      points: [
        [36, 0],
        [36, 6],
      ],
    },
    {
      id: 'W10',
      type: 'wire',
      points: [
        [40, 10],
        [40, 28],
      ],
    },
    {
      id: 'W11',
      type: 'wire',
      points: [
        [41, 6],
        [44, 6],
      ],
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [44, 0],
      b: [44, 6],
      label: 'Lâmpada 12 V',
      params: { voltage: 12, power: 5 },
    },
    {
      id: 'V2',
      type: 'dc-voltage',
      a: [48, 0],
      b: [48, 28],
      label: '12 V',
      params: { voltage: 12 },
    },
    {
      id: 'W12',
      type: 'wire',
      points: [
        [30, 0],
        [36, 0],
        [44, 0],
        [48, 0],
      ],
    },
    {
      id: 'W13',
      type: 'wire',
      points: [
        [0, 28],
        [12, 28],
        [20, 28],
        [28, 28],
        [32, 28],
        [35, 28],
        [40, 28],
        [48, 28],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 28] },
  ],
  probes: [
    { id: 'IB', kind: 'current', element: 'RB', label: 'Corrente de base (sai do pino D7)' },
    { id: 'IK', kind: 'current', element: 'W9', label: 'Corrente na bobina do relé' },
    { id: 'IL', kind: 'current', element: 'L1', label: 'Corrente na lâmpada' },
    { id: 'IBZ', kind: 'current', element: 'BZ1', label: 'Corrente no buzzer (sai do pino D8)' },
  ],
  goals: [
    {
      id: 'desligado',
      description: 'Ao ligar a placa, o relé fica solto e a lâmpada apagada.',
      check: { readout: 'K1.closed', op: '==', value: false },
      at: 0.2,
    },
  ],
});
