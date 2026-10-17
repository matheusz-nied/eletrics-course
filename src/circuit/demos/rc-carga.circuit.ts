import { defineCircuit } from '../engine';

/** Capacitor charged through a resistor and discharged by a push-button. */
export default defineCircuit({
  id: 'demo/rc-carga',
  title: 'Carga e descarga de um capacitor',
  description:
    'Uma bateria de 9 V carrega um capacitor de 47 µF através de um resistor de 10 kΩ quando a chave S1 fecha. O botão S2 descarrega o capacitor por um resistor de 1 kΩ.',
  analysis: { kind: 'transient', dt: 0.001 },
  elements: [
    { id: 'B1', type: 'battery', a: [0, 0], b: [0, 12], params: { voltage: 9 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [4, 0],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [4, 0],
      b: [10, 0],
      control: { param: 'closed', label: 'Chave de carga S1', kind: 'toggle' },
    },
    { id: 'R1', type: 'resistor', a: [10, 0], b: [18, 0], params: { resistance: 10000 } },
    {
      id: 'C1',
      type: 'capacitor',
      a: [18, 0],
      b: [18, 12],
      params: { capacitance: 47e-6, voltage: 16, polarized: true },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [18, 0],
        [26, 0],
      ],
    },
    { id: 'R2', type: 'resistor', a: [26, 0], b: [26, 6], params: { resistance: 1000 } },
    {
      id: 'S2',
      type: 'push-button',
      a: [26, 6],
      b: [26, 12],
      control: { param: 'pressed', label: 'Botão de descarga S2', kind: 'momentary' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [26, 12],
        [18, 12],
        [0, 12],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 12] },
  ],
  probes: [
    { id: 'VC', kind: 'voltage', plus: 'C1.a', minus: 'GND', label: 'Tensão no capacitor' },
    { id: 'IR', kind: 'current', element: 'R1', label: 'Corrente de carga' },
  ],
});
