import { defineCircuit } from '../../engine';

/**
 * 9.7: a common-emitter amplifier biased by a voltage divider (R1, R2) with
 * emitter resistor RE. The bypass capacitor CE can be switched out to show
 * the trade between gain and linearity. The capacitors start charged to the
 * operating point, so the amplifier is ready from the first cycle. The values
 * the lesson quotes are checked in ./amplificador.test.ts.
 */
export default defineCircuit({
  id: 'm09/amplificador-emissor-comum',
  title: 'Amplificador emissor comum',
  description:
    'Um transistor NPN alimentado por 12 V, com a base polarizada por um divisor de 56 kΩ e 10 kΩ, resistor de coletor de 4,7 kΩ e resistor de emissor de 1 kΩ. Um gerador de sinais de 1 kHz entra pela base através de um capacitor de 10 µF, e a saída sai do coletor por outro capacitor de 10 µF para uma carga de 10 kΩ. Um capacitor de 100 µF, que uma chave liga e desliga, fica em paralelo com o resistor de emissor. Com ele, a saída é cerca de 130 vezes maior que a entrada e invertida; sem ele, só cerca de 3 vezes maior.',
  analysis: { kind: 'transient', dt: 2e-5, speed: 0.02 },
  elements: [
    {
      id: 'V2',
      type: 'ac-voltage',
      a: [0, 16],
      b: [0, 30],
      label: 'Gerador',
      params: { amplitude: 0.005, frequency: 1000 },
      control: {
        param: 'amplitude',
        label: 'Amplitude do sinal de entrada (pico)',
        kind: 'slider',
        min: 0.001,
        max: 0.1,
        step: 0.001,
        unit: 'V',
      },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 16],
        [0, 14],
        [3, 14],
      ],
    },
    {
      id: 'CIN',
      type: 'capacitor',
      a: [3, 14],
      b: [10, 14],
      label: 'Entrada',
      params: { capacitance: 10e-6, ic: -1.8 },
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [10, 0],
      b: [10, 14],
      label: 'R1',
      params: { resistance: 56000 },
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [10, 14],
      b: [10, 30],
      label: 'R2',
      params: { resistance: 10000 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [10, 14],
        [15, 14],
      ],
    },
    {
      id: 'Q1',
      type: 'npn',
      at: [17, 14],
      label: 'Q1',
      params: { beta: 200 },
    },
    {
      id: 'RC',
      type: 'resistor',
      a: [18, 0],
      b: [18, 9],
      label: 'RC',
      params: { resistance: 4700 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [18, 9],
        [18, 10],
        [18, 12],
      ],
    },
    {
      id: 'COUT',
      type: 'capacitor',
      a: [18, 10],
      b: [28, 10],
      label: 'Saída',
      params: { capacitance: 10e-6, ic: 6.7 },
    },
    {
      id: 'RL',
      type: 'resistor',
      a: [28, 10],
      b: [28, 30],
      label: 'Carga',
      params: { resistance: 10000 },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [18, 16],
        [18, 19],
        [23, 19],
      ],
    },
    {
      id: 'RE',
      type: 'resistor',
      a: [18, 19],
      b: [18, 30],
      label: 'RE',
      params: { resistance: 1000 },
    },
    {
      id: 'S1',
      type: 'switch',
      a: [23, 19],
      b: [23, 23],
      label: 'S1',
      params: { closed: true },
      control: { param: 'closed', label: 'Capacitor de desvio CE ligado', kind: 'toggle' },
    },
    {
      id: 'CE',
      type: 'capacitor',
      a: [23, 23],
      b: [23, 30],
      label: 'CE',
      params: { capacitance: 100e-6, ic: 1.1 },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [10, 0],
        [18, 0],
        [36, 0],
      ],
    },
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [36, 0],
      b: [36, 30],
      label: 'Fonte 12 V',
      params: { voltage: 12 },
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [0, 30],
        [10, 30],
        [18, 30],
        [23, 30],
        [28, 30],
        [36, 30],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 30] },
  ],
  probes: [
    { id: 'VIN', kind: 'voltage', plus: 'V2.a', minus: 'GND', label: 'Entrada' },
    { id: 'VOUT', kind: 'voltage', plus: 'RL.a', minus: 'GND', label: 'Saída' },
    { id: 'VB', kind: 'voltage', plus: 'Q1.b', minus: 'GND', label: 'Tensão na base' },
    { id: 'VEM', kind: 'voltage', plus: 'Q1.e', minus: 'GND', label: 'Tensão no emissor' },
    { id: 'VC', kind: 'voltage', plus: 'Q1.c', minus: 'GND', label: 'Tensão no coletor' },
  ],
});
