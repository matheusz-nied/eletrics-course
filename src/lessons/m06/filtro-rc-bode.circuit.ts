import { defineCircuit } from '../../engine';

/**
 * 06.6: the RC circuit of lesson 3.5 (1 kΩ and 2,7 µF) in an AC sweep. The
 * capacitor voltage is the low-pass output, the resistor voltage the
 * high-pass one; both cross at the cut-off frequency, 1/(2πRC) ≈ 59 Hz.
 * The values the lesson quotes are checked in ./filtros.test.ts.
 */
export default defineCircuit({
  id: 'm06/filtro-rc-bode',
  title: 'Filtros RC: passa-baixas e passa-altas',
  description:
    'Um gerador de sinais alimenta um resistor ajustável, de 1 kΩ no início, em série com um capacitor de 2,7 µF. O gráfico de Bode mostra, de 1 Hz a 100 kHz, o ganho e a fase da tensão no capacitor (filtro passa-baixas) e da tensão no resistor (filtro passa-altas). As duas curvas se cruzam em −3 dB na frequência de corte, perto de 59 Hz. Em 600 Hz, a tensão no capacitor fica em cerca de −20 dB, um décimo da entrada.',
  analysis: { kind: 'ac-sweep', source: 'V1', fStart: 1, fStop: 100_000, points: 101 },
  elements: [
    {
      id: 'V1',
      type: 'ac-voltage',
      a: [0, 0],
      b: [0, 10],
      label: 'Gerador',
      params: { amplitude: 1 },
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [0, 0],
      b: [10, 0],
      label: 'R',
      params: { resistance: 1000 },
      control: {
        param: 'resistance',
        label: 'Resistor R',
        kind: 'slider',
        min: 100,
        max: 10_000,
        log: true,
        unit: 'Ω',
      },
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [10, 0],
      b: [10, 10],
      label: 'C',
      params: { capacitance: 2.7e-6 },
    },
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
    { id: 'VC', kind: 'voltage', plus: 'C1.a', minus: 'GND', label: 'No capacitor (passa-baixas)' },
    { id: 'VR', kind: 'voltage', plus: 'R1.a', minus: 'R1.b', label: 'No resistor (passa-altas)' },
  ],
});
