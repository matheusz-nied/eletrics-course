import { defineCircuit } from '../engine';

/** RC low-pass filter driven by a 60 Hz sine: the output is smaller and lags behind. */
export default defineCircuit({
  id: 'demo/rc-senoide',
  title: 'Filtro RC com tensão alternada',
  description:
    'Uma fonte senoidal de 5 V de pico e 60 Hz alimenta um resistor de 1 kΩ em série com um capacitor de 2,2 µF. A tensão no capacitor é menor que a da fonte e fica atrasada.',
  analysis: { kind: 'transient', dt: 5e-5, speed: 0.05 },
  elements: [
    {
      id: 'V1',
      type: 'ac-voltage',
      a: [0, 0],
      b: [0, 10],
      params: { amplitude: 5, frequency: 60 },
      control: {
        param: 'frequency',
        label: 'Frequência da fonte',
        kind: 'slider',
        min: 10,
        max: 1000,
        log: true,
        unit: 'Hz',
      },
    },
    { id: 'R1', type: 'resistor', a: [0, 0], b: [10, 0], params: { resistance: 1000 } },
    { id: 'C1', type: 'capacitor', a: [10, 0], b: [10, 10], params: { capacitance: 2.2e-6 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [10, 10],
        [0, 10],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 10] },
  ],
  probes: [
    { id: 'VE', kind: 'voltage', plus: 'V1.a', minus: 'GND', label: 'Entrada (fonte)' },
    { id: 'VS', kind: 'voltage', plus: 'C1.a', minus: 'GND', label: 'Saída (capacitor)' },
  ],
});
