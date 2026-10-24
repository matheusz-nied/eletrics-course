import { defineCircuit } from '../../engine';

/**
 * 13.3: a 433 MHz receiver board with a relay (firmware m13/receptor). The
 * receiver module hands each frame to the microcontroller, which checks it
 * against the learned remotes and toggles a 12 V relay through a transistor;
 * the relay switches a 12 V lamp. The learn LED goes from 5 V into its pin.
 * The behaviour the lesson describes is checked in ./receptor.test.ts.
 */
type P = [number, number];
const wire = (id: string, ...points: P[]) => ({ id, type: 'wire', points });

export default defineCircuit({
  id: 'm13/receptor-rele',
  title: 'Receptor de controle remoto com relé',
  description:
    'Uma placa receptora de controle remoto. O módulo receptor de 433 MHz, alimentado por 5 V, entrega cada aperto do controle ao microcontrolador. O microcontrolador tem um botão APRENDER, que fecha a entrada para o negativo, e um LED de cadastro ligado do 5 V até o pino por um resistor de 1 kΩ. Quando chega um botão cadastrado, o microcontrolador liga ou desliga, por um resistor de 1 kΩ e um transistor NPN, a bobina de um relé de 12 V com diodo de roda livre. O contato normalmente aberto do relé acende uma lâmpada de 12 V e 5 W. Um toque em APRENDER cadastra o próximo controle; segurar APRENDER por 5 segundos apaga todos. Com rolling code, o receptor recusa a repetição de um código copiado.',
  analysis: { kind: 'transient', dt: 0.001, speed: 1 },
  elements: [
    {
      id: 'V2',
      type: 'dc-voltage',
      a: [0, 6],
      b: [0, 30],
      label: '5 V (regulador)',
      params: { voltage: 5 },
    },
    wire('W1', [0, 6], [3, 6], [20, 6], [28, 6]),
    {
      id: 'RX',
      type: 'rf-receiver',
      at: [8, 14],
      label: 'Receptor 433 MHz',
      control: [
        { param: 'press', label: 'Apertar o botão do controle', kind: 'momentary' },
        {
          param: 'remote',
          label: 'Controle na mão',
          kind: 'select',
          options: [
            { value: '5A3C91', label: 'Seu controle' },
            { value: '9E04B7', label: 'Controle do vizinho' },
          ],
        },
        { param: 'rolling', label: 'Controle rolling code', kind: 'toggle' },
        { param: 'replay', label: 'Copiador: repetir o último código', kind: 'momentary' },
      ],
    },
    wire('W2', [5, 13], [3, 13], [3, 6]),
    wire('W3', [5, 15], [3, 15], [3, 30]),
    wire('W4', [11, 14], [12, 14], [12, 15], [14, 15]),
    {
      id: 'U1',
      type: 'mcu',
      at: [20, 16],
      label: 'Microcontrolador',
      params: { firmware: 'm13/receptor', pinsLeft: 'RF,APRENDER', pinsRight: 'LED,RELE' },
    },
    wire('W5', [20, 6], [20, 13]),
    wire('W6', [20, 19], [20, 30]),
    wire('W7', [14, 17], [12, 17], [12, 20]),
    {
      id: 'SW1',
      type: 'push-button',
      a: [12, 20],
      b: [12, 26],
      label: 'APRENDER',
      control: { param: 'pressed', label: 'Botão APRENDER', kind: 'momentary' },
    },
    wire('W8', [12, 26], [12, 30]),
    {
      id: 'D1',
      type: 'led',
      a: [28, 6],
      b: [28, 10],
      label: 'LED',
      params: { color: 'red' },
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [28, 10],
      b: [28, 15],
      label: 'R1',
      params: { resistance: 1000 },
    },
    wire('W9', [26, 15], [28, 15]),
    wire('W10', [26, 17], [27, 17], [27, 22]),
    {
      id: 'RB',
      type: 'resistor',
      a: [27, 22],
      b: [33, 22],
      label: 'RB',
      params: { resistance: 1000 },
    },
    {
      id: 'Q1',
      type: 'npn',
      at: [35, 22],
      label: 'Q1',
      params: { beta: 200, vceo: 45, power: 0.5 },
    },
    wire('W11', [36, 24], [36, 30]),
    {
      id: 'K1',
      type: 'relay-spdt',
      at: [38, 16],
      label: 'Relé 12 V',
      params: { coilVoltage: 12, coilResistance: 400, coilInductance: 0.15 },
    },
    wire('W12', [32, 18], [36, 18], [36, 20]),
    {
      id: 'D2',
      type: 'diode',
      a: [32, 18],
      b: [32, 12],
      label: 'D2',
      params: { model: 'rectifier' },
    },
    wire('W13', [32, 12], [32, 2]),
    wire('W14', [36, 14], [36, 2]),
    wire('W15', [32, 2], [36, 2], [41, 2], [50, 2]),
    wire('W16', [41, 14], [41, 2]),
    wire('W17', [40, 18], [44, 18]),
    {
      id: 'L1',
      type: 'lamp',
      a: [44, 18],
      b: [44, 26],
      label: 'Lâmpada 12 V',
      params: { voltage: 12, power: 5 },
    },
    wire('W18', [44, 26], [44, 30]),
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [50, 2],
      b: [50, 30],
      label: 'Fonte 12 V',
      params: { voltage: 12 },
    },
    wire('W19', [0, 30], [3, 30], [12, 30], [20, 30], [36, 30], [44, 30], [50, 30]),
    { id: 'G', type: 'ground', at: [0, 30] },
  ],
  probes: [{ id: 'IL', kind: 'current', element: 'L1', label: 'Corrente na lâmpada' }],
});
