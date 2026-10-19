import { defineCircuit } from '../../engine';

/**
 * 12.6: a Wi-Fi smart relay behind a wall switch (firmware m12/rele-wifi).
 * An ESP32-class chip at 3,3 V toggles the light on a command from the app
 * (a momentary contact standing for the Wi-Fi message) and on any change of
 * the wall switch. Its pin drives a 5 V relay through an NPN transistor; the
 * relay contact switches the phase of a 127 V lamp. The two DC supplies stand
 * for the converter inside the relay that makes them from the mains. The
 * values the lesson quotes are checked in ./circuitos.test.ts.
 */
export default defineCircuit({
  id: 'm12/rele-inteligente',
  title: 'Relé inteligente Wi-Fi atrás do interruptor',
  description:
    'Um microcontrolador com Wi-Fi, alimentado por 3,3 V, recebe os comandos do aplicativo pela rede sem fio; na simulação, cada comando é um toque num botão ligado ao pino APP. O interruptor da parede, que agora só avisa o microcontrolador, liga o pino INT ao negativo; cada mudança de posição dele inverte a lâmpada. O pino de saída comanda, por um resistor de 1 kΩ, um transistor NPN que liga a bobina de um relé de 5 V, com diodo de roda livre. O contato do relé interrompe a fase de uma lâmpada de 127 V e 40 W; o neutro vai direto à lâmpada. As fontes de 3,3 V e 5 V representam o conversor dentro do relé inteligente, que as tira da própria rede.',
  analysis: { kind: 'quasi-static', frequency: 60, dtMech: 0.002, speed: 1 },
  elements: [
    {
      id: 'V2',
      type: 'dc-voltage',
      a: [-8, 2],
      b: [-8, 28],
      label: '5 V',
      params: { voltage: 5 },
    },
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 6],
      b: [0, 28],
      label: '3,3 V',
      params: { voltage: 3.3 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 6],
        [20, 6],
        [20, 11],
      ],
    },
    {
      id: 'U1',
      type: 'mcu',
      at: [20, 15],
      label: 'ESP32',
      params: { firmware: 'm12/rele-wifi', pinsLeft: 'APP,INT,RF', pinsRight: 'RELE' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [14, 13],
        [10, 13],
      ],
    },
    {
      id: 'S1',
      type: 'push-button',
      a: [10, 13],
      b: [5, 13],
      label: 'App',
      control: { param: 'pressed', label: 'Comando do aplicativo', kind: 'momentary' },
    },
    { id: 'G2', type: 'ground', at: [5, 13] },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [14, 15],
        [10, 15],
        [10, 20],
      ],
    },
    {
      id: 'S2',
      type: 'switch',
      a: [10, 20],
      b: [10, 26],
      label: 'Interruptor',
      control: { param: 'closed', label: 'Interruptor da parede', kind: 'toggle' },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [10, 26],
        [10, 28],
      ],
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [14, 17],
        [14, 28],
      ],
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [20, 19],
        [20, 28],
      ],
    },
    {
      id: 'RB',
      type: 'resistor',
      a: [26, 13],
      b: [31, 13],
      params: { resistance: 1000 },
    },
    {
      id: 'RBE',
      type: 'resistor',
      a: [31, 13],
      b: [31, 28],
      params: { resistance: 10000 },
    },
    {
      id: 'Q1',
      type: 'npn',
      at: [33, 13],
      label: 'Q1',
      params: { beta: 200, vceo: 30, power: 0.5 },
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [34, 15],
        [34, 28],
      ],
    },
    {
      id: 'K1',
      type: 'relay-spdt',
      at: [38, 9],
      label: 'K1',
      // A common 5 V sugar-cube relay: about 70 Ω, 0,36 W.
      params: { coilVoltage: 5, coilResistance: 70 },
    },
    {
      id: 'W8',
      type: 'wire',
      points: [
        [30, 11],
        [34, 11],
        [36, 11],
      ],
    },
    {
      id: 'D1',
      type: 'diode',
      a: [30, 11],
      b: [30, 2],
      label: 'D1',
      params: { model: 'signal' },
    },
    {
      id: 'WK',
      type: 'wire',
      points: [
        [36, 2],
        [36, 7],
      ],
    },
    {
      id: 'W9',
      type: 'wire',
      points: [
        [-8, 2],
        [30, 2],
        [36, 2],
      ],
    },
    // Mains side: the relay contact interrupts the phase.
    {
      id: 'R',
      type: 'mains',
      at: [46, 22],
      label: 'Rede',
      params: { voltage: 127 },
    },
    {
      id: 'W10',
      type: 'wire',
      points: [
        [48, 20],
        [50, 20],
        [50, 16],
        [40, 16],
        [40, 11],
      ],
    },
    {
      id: 'W11',
      type: 'wire',
      points: [
        [41, 7],
        [41, 4],
        [53, 4],
      ],
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [53, 4],
      b: [53, 12],
      label: 'Lâmpada 127 V',
      params: { voltage: 127, power: 40 },
    },
    {
      id: 'W12',
      type: 'wire',
      points: [
        [53, 12],
        [53, 22],
        [48, 22],
      ],
    },
    {
      id: 'W13',
      type: 'wire',
      points: [
        [-8, 28],
        [0, 28],
        [10, 28],
        [14, 28],
        [20, 28],
        [31, 28],
        [34, 28],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 28] },
  ],
  probes: [
    { id: 'VL', kind: 'voltage', plus: 'L1.a', minus: 'L1.b', label: 'Tensão na lâmpada' },
    { id: 'IK', kind: 'current', element: 'WK', label: 'Corrente na bobina do relé' },
    { id: 'IB', kind: 'current', element: 'RB', label: 'Corrente que sai do pino' },
  ],
  goals: [
    {
      id: 'interruptor',
      description: 'Mude o interruptor de posição: a lâmpada acende.',
      check: { readout: 'L1.brightness', op: '>', value: 0.9 },
      solution: { 'S2.closed': true },
      at: 0.5,
    },
  ],
});
