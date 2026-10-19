import { defineCircuit } from '../../engine';

/**
 * 12.1: the basic jobs of a microcontroller (firmware m12/primeiro-programa).
 * A potentiometer on A0 (ADC), a button on D2 with the internal pull-up
 * (digital input), an LED on D13 that follows the button (digital output) and
 * an LED on D12 that blinks once a second (timer). The values the lesson
 * quotes are checked in ./circuitos.test.ts.
 */
export default defineCircuit({
  id: 'm12/primeiro-programa',
  title: 'Entradas e saídas de um microcontrolador',
  description:
    'Uma placa de microcontrolador alimentada por 5 V pela porta USB. Na entrada analógica A0, o cursor de um potenciômetro de 10 kΩ ligado entre 5 V e o negativo: o conversor analógico-digital lê de 0 a 1023. No pino D2, um botão ligado ao negativo, com o resistor de pull-up interno do chip: solto, o pino lê nível alto; apertado, nível baixo. O pino D13 acende um LED vermelho, por um resistor de 220 Ω, enquanto o botão está apertado. O pino D12 acende e apaga outro LED, também por 220 Ω, uma vez por segundo, contando o tempo pelo relógio do chip. A entrada do receptor de rádio não é usada e fica ligada ao negativo.',
  analysis: { kind: 'transient', dt: 0.001, speed: 1 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 4],
      b: [0, 24],
      label: '5 V (USB)',
      params: { voltage: 5 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 4],
        [14, 4],
        [26, 4],
        [26, 10],
      ],
    },
    {
      id: 'P1',
      type: 'potentiometer',
      at: [14, 12],
      rot: 90,
      // Flipped: the end that reads 0 V (a) at the bottom, so turning it up raises the reading.
      flip: true,
      label: 'P1',
      params: { resistance: 10000, position: 0.5 },
      control: {
        param: 'position',
        label: 'Potenciômetro',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [14, 4],
        [14, 8],
      ],
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [17, 12],
        [20, 12],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [14, 16],
        [14, 24],
      ],
    },
    {
      id: 'U1',
      type: 'mcu',
      at: [26, 14],
      label: 'Placa',
      params: { firmware: 'm12/primeiro-programa', pinsLeft: 'A0,RF', pinsRight: 'D2,D13,D12' },
    },
    // The radio input is not used: tied to ground, as unused inputs should be.
    {
      id: 'W5',
      type: 'wire',
      points: [
        [20, 14],
        [18, 14],
        [18, 24],
      ],
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [26, 18],
        [26, 24],
      ],
    },
    // D2: the button to ground, above.
    {
      id: 'W7',
      type: 'wire',
      points: [
        [32, 12],
        [34, 12],
        [34, 7],
        [36, 7],
      ],
    },
    {
      id: 'S1',
      type: 'push-button',
      a: [36, 7],
      b: [42, 7],
      label: 'Botão',
      control: { param: 'pressed', label: 'Botão (D2)', kind: 'momentary' },
    },
    { id: 'G2', type: 'ground', at: [42, 7] },
    // D13: LED of the button.
    {
      id: 'R2',
      type: 'resistor',
      a: [32, 14],
      b: [38, 14],
      params: { resistance: 220 },
    },
    {
      id: 'D1',
      type: 'led',
      a: [38, 14],
      b: [43, 14],
      label: 'D13',
      params: { color: 'red' },
    },
    { id: 'G3', type: 'ground', at: [43, 14] },
    // D12: the blinking LED, below.
    {
      id: 'W8',
      type: 'wire',
      points: [
        [32, 16],
        [34, 16],
        [34, 21],
        [36, 21],
      ],
    },
    {
      id: 'R3',
      type: 'resistor',
      a: [36, 21],
      b: [42, 21],
      params: { resistance: 220 },
    },
    {
      id: 'D2',
      type: 'led',
      a: [42, 21],
      b: [47, 21],
      label: 'D12',
      params: { color: 'green' },
    },
    { id: 'G4', type: 'ground', at: [47, 21] },
    {
      id: 'W9',
      type: 'wire',
      points: [
        [0, 24],
        [14, 24],
        [18, 24],
        [26, 24],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 24] },
  ],
  probes: [
    { id: 'VA0', kind: 'voltage', plus: 'U1.A0', minus: 'GND', label: 'Tensão em A0' },
    { id: 'VD2', kind: 'voltage', plus: 'U1.D2', minus: 'GND', label: 'Tensão em D2' },
    { id: 'ID13', kind: 'current', element: 'D1', label: 'Corrente no LED do D13' },
  ],
  goals: [
    {
      id: 'metade',
      description: 'Com o potenciômetro no meio, A0 tem cerca de 2,5 V e o conversor lê perto de 512.',
      check: { readout: 'U1.leitura', op: 'between', value: [505, 515] },
      at: 0.05,
    },
    {
      id: 'botao',
      description: 'Aperte o botão: o pino D2 vai a 0 V e o LED do D13 acende com uns 11 mA.',
      check: { readout: 'ID13', op: 'between', value: [0.0105, 0.0125] },
      solution: { 'S1.pressed': true },
      at: 0.1,
    },
    {
      id: 'quarto',
      description: 'Gire o potenciômetro até a leitura ficar perto de 256 (um quarto da escala).',
      check: { readout: 'U1.leitura', op: 'between', value: [246, 266] },
      solution: { 'P1.position': 0.25 },
      at: 0.05,
    },
  ],
});
