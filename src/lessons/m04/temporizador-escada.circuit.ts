import { defineCircuit } from '../../engine';

/**
 * 04.4: a staircase light timer. The push-button fills C1; when it is
 * released, C1 empties through the time trimpot R2. A comparator keeps the
 * light on while the capacitor is above the reference of the R3/R4 divider,
 * 4,38 V: about 37 % of 12 V, so the light stays on for about R2 × C1.
 * The timing the lesson quotes is checked in ./capacitores.test.ts.
 */
export default defineCircuit({
  id: 'm04/temporizador-escada',
  title: 'Temporizador de luz de escada',
  description:
    'O botão da escada liga um capacitor de 100 µF aos 12 V por um resistor de 1 kΩ, e ele se carrega quase na hora. Solto o botão, o capacitor se descarrega pelo trimpot de ajuste do tempo, que começa em 300 kΩ. Um comparador compara a tensão do capacitor com uma referência de 4,38 V, tirada de um divisor de 17,4 kΩ e 10 kΩ, e mantém a luz (um LED branco) acesa enquanto o capacitor estiver acima dela. A luz fica acesa cerca de 30 s depois que o botão é solto, o produto do trimpot pela capacitância. Com o trimpot em 600 kΩ, cerca de 60 s.',
  analysis: { kind: 'transient', dt: 0.01, speed: 5 },
  elements: [
    { id: 'V1', type: 'dc-voltage', a: [0, 0], b: [0, 26], params: { voltage: 12 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [12, 0],
        [58, 0],
      ],
    },
    {
      id: 'S1',
      type: 'push-button',
      a: [12, 0],
      b: [12, 6],
      label: 'Botão',
      control: { param: 'pressed', label: 'Botão da escada', kind: 'momentary' },
    },
    { id: 'R1', type: 'resistor', a: [12, 6], b: [12, 13], params: { resistance: 1000 } },
    {
      id: 'C1',
      type: 'capacitor',
      a: [12, 13],
      b: [12, 26],
      label: '100 µF',
      params: { capacitance: 0.0001, voltage: 25, polarized: true },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 13],
        [26, 13],
        [38, 13],
      ],
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [26, 13],
      b: [26, 26],
      label: 'Trimpot',
      params: { resistance: 300000 },
      control: {
        param: 'resistance',
        label: 'Trimpot do tempo',
        kind: 'slider',
        min: 100000,
        max: 1000000,
        step: 10000,
        unit: 'Ω',
      },
    },
    {
      id: 'U1',
      type: 'opamp',
      at: [41, 12],
      label: 'Comparador',
      params: { vcc: 12, vee: 0, headroom: 0.5 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [58, 8],
        [35, 8],
        [35, 11],
        [38, 11],
      ],
    },
    { id: 'R3', type: 'resistor', a: [58, 0], b: [58, 8], params: { resistance: 17400 } },
    { id: 'R4', type: 'resistor', a: [58, 8], b: [58, 26], params: { resistance: 10000 } },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [44, 12],
        [48, 12],
      ],
    },
    { id: 'R5', type: 'resistor', a: [48, 12], b: [48, 18], params: { resistance: 470 } },
    {
      id: 'D1',
      type: 'led',
      a: [48, 18],
      b: [48, 26],
      label: 'Luz',
      params: { color: 'white' },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [58, 26],
        [48, 26],
        [26, 26],
        [12, 26],
        [0, 26],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 26] },
  ],
  probes: [
    { id: 'VC', kind: 'voltage', plus: 'C1.a', minus: 'GND', label: 'Tensão no capacitor' },
    { id: 'VREF', kind: 'voltage', plus: 'R4.a', minus: 'GND', label: 'Referência' },
  ],
  goals: [
    {
      id: 'acender',
      description: 'Aperte o botão: o capacitor vai a quase 12 V e a luz acende.',
      check: { readout: 'D1.brightness', op: '>', value: 0.5 },
      solution: { 'S1.pressed': true },
      at: 0.5,
    },
    {
      id: 'referencia',
      description: 'Confira a referência do comparador: 4,38 V, cerca de 37 % de 12 V.',
      check: { readout: 'VREF', op: 'between', value: [4.37, 4.39] },
    },
  ],
});
