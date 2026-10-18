import { defineCircuit } from '../../engine';

/**
 * 03.5: two channels on an RC circuit; the capacitor voltage is smaller and lags.
 * The values the lesson quotes are checked in ./osciloscopio.test.ts.
 */
export default defineCircuit({
  id: 'm03/osc-rc-fase',
  title: 'Dois canais num circuito RC',
  description:
    'Uma senoide de 5 V de pico e 60 Hz alimenta um resistor de 1 kΩ em série com um capacitor de 2,7 µF. O canal 1 mostra a entrada e o canal 2 a tensão no capacitor, que chega a cerca de 3,5 V de pico e atinge o pico cerca de 2,1 ms depois da entrada. A frequência pode ser ajustada.',
  analysis: { kind: 'transient', dt: 2e-5, speed: 0.02 },
  elements: [
    {
      id: 'V1',
      type: 'ac-voltage',
      a: [0, 0],
      b: [0, 12],
      label: 'Gerador',
      params: { amplitude: 5, frequency: 60 },
      control: {
        param: 'frequency',
        label: 'Frequência do gerador',
        kind: 'slider',
        min: 10,
        max: 1000,
        log: true,
        unit: 'Hz',
      },
    },
    { id: 'R1', type: 'resistor', a: [0, 0], b: [12, 0], params: { resistance: 1000 } },
    {
      id: 'C1',
      type: 'capacitor',
      a: [12, 0],
      b: [12, 12],
      params: { capacitance: 2.7e-6 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [12, 12],
        [0, 12],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 12] },
  ],
  probes: [
    { id: 'VE', kind: 'voltage', plus: 'V1.a', minus: 'GND', label: 'Entrada' },
    { id: 'VC', kind: 'voltage', plus: 'C1.a', minus: 'GND', label: 'Capacitor' },
  ],
});
