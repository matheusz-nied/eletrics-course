import { defineCircuit } from '../../engine';

/**
 * 03.5: a signal generator on the oscilloscope; read peak to peak and frequency.
 * The values the lesson quotes are checked in ./osciloscopio.test.ts.
 */
export default defineCircuit({
  id: 'm03/osc-senoide',
  title: 'Um gerador de sinais no osciloscópio',
  description:
    'Um gerador de sinais entrega uma senoide de 2 V de pico e 1 kHz a um resistor de 1 kΩ. O osciloscópio mostra a tensão na saída do gerador ao longo do tempo: 4 V de pico a pico e um ciclo a cada 1 ms. A amplitude e a frequência podem ser trocadas.',
  analysis: { kind: 'transient', dt: 1e-5, speed: 0.02 },
  elements: [
    {
      id: 'V1',
      type: 'ac-voltage',
      a: [0, 0],
      b: [0, 12],
      label: 'Gerador',
      params: { amplitude: 2, frequency: 1000 },
      control: [
        {
          param: 'amplitude',
          label: 'Amplitude do gerador (pico)',
          kind: 'slider',
          min: 0.5,
          max: 10,
          step: 0.5,
          unit: 'V',
        },
        {
          param: 'frequency',
          label: 'Frequência do gerador',
          kind: 'select',
          options: [
            { value: 60, label: '60 Hz' },
            { value: 1000, label: '1 kHz' },
          ],
        },
      ],
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [12, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [12, 0],
      b: [12, 12],
      label: 'Carga',
      params: { resistance: 1000 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 12],
        [0, 12],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 12] },
  ],
  probes: [{ id: 'VE', kind: 'voltage', plus: 'V1.a', minus: 'GND', label: 'Saída do gerador' }],
});
