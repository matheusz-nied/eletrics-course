import { defineCircuit } from '../engine';

/** Frequency response of an RC low-pass filter (AC sweep, Bode plot). */
export default defineCircuit({
  id: 'demo/filtro-rc-bode',
  title: 'Resposta em frequência de um filtro RC',
  description:
    'Filtro passa-baixas com resistor de 1 kΩ e capacitor de 100 nF. O gráfico de Bode mostra o ganho e a fase da saída de 10 Hz a 100 kHz; a frequência de corte fica perto de 1,6 kHz.',
  analysis: { kind: 'ac-sweep', source: 'V1', fStart: 10, fStop: 100000, points: 61 },
  elements: [
    { id: 'V1', type: 'ac-voltage', a: [0, 0], b: [0, 10], params: { amplitude: 1 } },
    {
      id: 'R1',
      type: 'resistor',
      a: [0, 0],
      b: [10, 0],
      params: { resistance: 1000 },
      control: {
        param: 'resistance',
        label: 'Resistor R1',
        kind: 'slider',
        min: 100,
        max: 100000,
        log: true,
        unit: 'Ω',
      },
    },
    { id: 'C1', type: 'capacitor', a: [10, 0], b: [10, 10], params: { capacitance: 1e-7 } },
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
  probes: [{ id: 'VS', kind: 'voltage', plus: 'C1.a', minus: 'GND', label: 'Saída do filtro' }],
});
