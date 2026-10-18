import { defineCircuit } from '../../engine';

/**
 * 03.5: a 12 V supply with ripple seen with DC and AC coupling. The AC
 * coupling is drawn as what it is inside the scope: a capacitor in series
 * with the 1 MΩ input. The values the lesson quotes are checked in
 * ./osciloscopio.test.ts.
 */
export default defineCircuit({
  id: 'm03/osc-ondulacao',
  title: 'Ondulação numa fonte de 12 V',
  description:
    'Uma fonte de 12 V alimenta uma placa que puxa cerca de 0,5 A. A saída tem uma pequena ondulação de 120 Hz: 0,2 V de pico a pico com o capacitor de filtro bom e 2 V de pico a pico com o capacitor ressecado. O canal 1 do osciloscópio vê a tensão inteira (acoplamento CC); o canal 2 passa por um capacitor de 22 nF antes da entrada de 1 MΩ (acoplamento CA) e vê só a ondulação.',
  analysis: { kind: 'transient', dt: 2e-5, speed: 0.02 },
  elements: [
    {
      id: 'V1',
      type: 'ac-voltage',
      a: [0, 0],
      b: [0, 14],
      label: 'Fonte 12 V',
      params: { offset: 12, amplitude: 0.1, frequency: 120 },
      control: {
        param: 'amplitude',
        label: 'Capacitor de filtro da fonte',
        kind: 'select',
        options: [
          { value: 0.1, label: 'Bom (0,2 V de ondulação)' },
          { value: 1, label: 'Ressecado (2 V de ondulação)' },
        ],
      },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [10, 0],
        [20, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [10, 0],
      b: [10, 14],
      label: 'Placa',
      params: { resistance: 24, watts: 10 },
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [20, 0],
      b: [28, 0],
      label: 'Acoplamento CA',
      // Starts charged to the supply voltage, as after a few seconds connected.
      params: { capacitance: 22e-9, ic: 12 },
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [28, 0],
      b: [28, 14],
      label: 'Entrada 1 MΩ',
      params: { resistance: 1e6 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [28, 14],
        [10, 14],
        [0, 14],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 14] },
  ],
  probes: [
    { id: 'VDC', kind: 'voltage', plus: 'V1.a', minus: 'GND', label: 'CH1, acoplamento CC' },
    { id: 'VAC', kind: 'voltage', plus: 'R2.a', minus: 'GND', label: 'CH2, acoplamento CA' },
  ],
});
