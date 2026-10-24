import { defineCircuit } from '../../engine';

/**
 * 06.6: series RLC (10 mH, 10 µF) in an AC sweep. The resistor voltage is
 * proportional to the current and peaks at f0 = 1/(2π√(LC)) ≈ 503 Hz; the
 * capacitor voltage goes above the source near resonance (Q times it).
 * The sweep is a little wider below f0 than above it, so the low end is the
 * lower one and the Bode plot does not mark a misleading cut-off.
 * The values the lesson quotes are checked in ./filtros.test.ts.
 */
export default defineCircuit({
  id: 'm06/rlc-ressonancia',
  title: 'Ressonância num circuito RLC série',
  description:
    'Um gerador de sinais de 1 V alimenta, em série, um resistor que pode ser de 10, 30 ou 100 Ω, um indutor de 10 mH e um capacitor de 10 µF. O gráfico de Bode vai de 40 Hz a 5 kHz e mostra a tensão no resistor, que acompanha a corrente, e a tensão no capacitor. A corrente é máxima perto de 503 Hz, a frequência de ressonância. Com 10 Ω, a tensão no capacitor chega a cerca de 3,2 vezes a do gerador (+10 dB) na ressonância.',
  analysis: { kind: 'ac-sweep', source: 'V1', fStart: 40, fStop: 5000, points: 161 },
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
      b: [8, 0],
      label: 'R',
      params: { resistance: 10 },
      control: {
        param: 'resistance',
        label: 'Resistor R',
        kind: 'select',
        options: [
          { value: 10, label: '10 Ω' },
          { value: 30, label: '30 Ω' },
          { value: 100, label: '100 Ω' },
        ],
      },
    },
    {
      id: 'L1',
      type: 'inductor',
      a: [8, 0],
      b: [16, 0],
      label: 'L',
      params: { inductance: 0.01 },
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [16, 0],
      b: [16, 10],
      label: 'C',
      params: { capacitance: 10e-6 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [16, 10],
        [0, 10],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 10] },
  ],
  probes: [
    { id: 'VR', kind: 'voltage', plus: 'R1.a', minus: 'R1.b', label: 'No resistor (corrente)' },
    { id: 'VC', kind: 'voltage', plus: 'C1.a', minus: 'GND', label: 'No capacitor' },
  ],
});
