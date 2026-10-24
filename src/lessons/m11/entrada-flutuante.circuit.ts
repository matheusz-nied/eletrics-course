import { defineCircuit } from '../../engine';

/**
 * 11.3: a floating input. A push button pulls the input of a Schmitt
 * trigger inverter to GND; a switch puts a 10 kΩ pull-up in or out. The
 * input wire runs beside a 127 V mains wire for a few metres: 50 pF between
 * them and 100 pF to the GND wire. The input has the usual clamp diodes to
 * the supply rails. Without the pull-up, the mains drags the input up and
 * down and the LED flickers on its own; with it, the input stays at 5 V
 * until the button is pressed. Checked in ./pull-up-debounce.test.ts.
 */
export default defineCircuit({
  id: 'm11/entrada-flutuante',
  title: 'Entrada flutuante',
  description:
    'Uma fonte de 5 V alimenta a entrada de uma porta inversora com entrada Schmitt trigger. Um botão liga a entrada ao GND, e uma chave liga ou desliga um resistor de pull-up de 10 kΩ entre a entrada e o 5 V. O fio da entrada corre alguns metros ao lado de um fio da rede de 127 V: um capacitor de 50 pF entre os dois e outro de 100 pF entre o fio e o GND representam essa proximidade. Dois diodos de proteção, como os que existem dentro dos chips, prendem a entrada entre o GND e o 5 V. A saída da porta acende um LED, que deve acender só com o botão apertado. A simulação roda dez vezes mais devagar que o tempo real.',
  analysis: { kind: 'transient', dt: 1e-4, speed: 0.1 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 20],
      label: 'Fonte',
      params: { voltage: 5 },
    },
    { id: 'G1', type: 'ground', at: [0, 20] },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [6, 0],
        [23, 0],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [6, 0],
      b: [6, 5],
      label: 'Pull-up',
      params: { closed: false },
      control: { param: 'closed', label: 'Resistor de pull-up ligado', kind: 'toggle' },
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [6, 5],
      b: [6, 11],
      label: 'R1',
      params: { resistance: 10000 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [6, 11],
        [10, 11],
        [17, 11],
        [23, 11],
        [29, 11],
        [33, 11],
      ],
    },
    {
      id: 'B1',
      type: 'push-button',
      a: [10, 11],
      b: [10, 20],
      label: 'Botão',
      control: { param: 'pressed', label: 'Apertar o botão', kind: 'momentary' },
    },
    { id: 'G2', type: 'ground', at: [10, 20] },
    {
      id: 'C2',
      type: 'capacitor',
      a: [17, 11],
      b: [17, 20],
      label: 'Fio–GND',
      params: { capacitance: 100e-12 },
    },
    { id: 'G3', type: 'ground', at: [17, 20] },
    {
      id: 'D1',
      type: 'diode',
      a: [23, 11],
      b: [23, 0],
      label: 'D1',
      params: { model: 'signal' },
    },
    {
      id: 'D2',
      type: 'diode',
      a: [23, 20],
      b: [23, 11],
      label: 'D2',
      params: { model: 'signal' },
    },
    { id: 'G4', type: 'ground', at: [23, 20] },
    {
      id: 'C1',
      type: 'capacitor',
      a: [29, 11],
      b: [29, 16],
      label: 'Fio–rede',
      params: { capacitance: 50e-12, voltage: 400 },
    },
    {
      id: 'VR',
      type: 'ac-voltage',
      a: [29, 16],
      b: [29, 24],
      label: 'Rede 127 V',
      params: { amplitude: 179.6, frequency: 60 },
    },
    { id: 'G5', type: 'ground', at: [29, 24] },
    { id: 'U1', type: 'not', at: [35, 11], label: 'U1' },
    {
      id: 'R2',
      type: 'resistor',
      a: [37, 11],
      b: [43, 11],
      label: 'R2',
      params: { resistance: 220 },
    },
    {
      id: 'D3',
      type: 'led',
      a: [43, 11],
      b: [43, 20],
      label: 'Apertado',
      params: { color: 'green' },
    },
    { id: 'G6', type: 'ground', at: [43, 20] },
  ],
  probes: [{ id: 'VIN', kind: 'voltage', plus: 'U1.a', minus: 'GND', label: 'Entrada da porta' }],
  goals: [
    {
      id: 'pull-up',
      description: 'Ligue o resistor de pull-up: a entrada fica parada em 5 V e o LED, apagado.',
      check: { readout: 'D3.brightness', op: '<', value: 0.01 },
      at: 0.2,
      solution: { 'S1.closed': true },
    },
    {
      id: 'botao',
      description: 'Com o pull-up ligado, aperte o botão: a entrada vai a 0 V e o LED acende.',
      check: { readout: 'D3.brightness', op: '>', value: 0.3 },
      at: 0.2,
      solution: { 'S1.closed': true, 'B1.pressed': true },
    },
  ],
});
