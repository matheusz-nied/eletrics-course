import { defineCircuit } from '../../engine';

/**
 * 06.6: a first-order two-way speaker crossover. The woofer gets the signal
 * through a 0,47 mH coil (low-pass), the tweeter through a 6,8 µF capacitor
 * (high-pass). Speakers are modelled as 8 Ω resistors, which a real speaker
 * only approximates. A switch shorts the capacitor, as when someone wires
 * the tweeter straight to the amplifier.
 * The values the lesson quotes are checked in ./filtros.test.ts.
 */
export default defineCircuit({
  id: 'm06/divisor-frequencias',
  title: 'Divisor de frequências de uma caixa de som',
  description:
    'A saída do amplificador alimenta dois ramos. No primeiro, uma bobina de 0,47 mH em série com o woofer, representado por um resistor de 8 Ω. No segundo, um capacitor de 6,8 µF em série com o tweeter, também de 8 Ω. O gráfico de Bode, de 20 Hz a 20 kHz, mostra a tensão em cada alto-falante: o woofer recebe os graves e perde 3 dB perto de 2,7 kHz; o tweeter recebe os agudos e perde 3 dB perto de 2,9 kHz. Uma chave curto-circuita o capacitor: o tweeter passa a receber os graves com força total.',
  analysis: { kind: 'ac-sweep', source: 'V1', fStart: 20, fStop: 20_000, points: 121 },
  elements: [
    {
      id: 'V1',
      type: 'ac-voltage',
      a: [0, 0],
      b: [0, 14],
      label: 'Amplificador',
      params: { amplitude: 1 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [6, 0],
        [10, 0],
      ],
    },
    {
      id: 'L1',
      type: 'inductor',
      a: [10, 0],
      b: [18, 0],
      label: 'Bobina 0,47 mH',
      params: { inductance: 0.47e-3 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [18, 0],
        [30, 0],
      ],
    },
    {
      id: 'RW',
      type: 'resistor',
      a: [30, 0],
      b: [30, 14],
      label: 'Woofer 8 Ω',
      params: { resistance: 8, watts: 100 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [6, 0],
        [6, 6],
        [10, 6],
      ],
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [10, 6],
      b: [16, 6],
      label: 'Capacitor 6,8 µF',
      params: { capacitance: 6.8e-6 },
    },
    {
      id: 'S1',
      type: 'switch',
      a: [10, 6],
      b: [10, 10],
      label: 'Jumper',
      params: { closed: false },
      control: {
        param: 'closed',
        label: 'Tweeter ligado direto (sem o capacitor)',
        kind: 'toggle',
      },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [10, 10],
        [16, 10],
        [16, 6],
        [22, 6],
      ],
    },
    {
      id: 'RT',
      type: 'resistor',
      a: [22, 6],
      b: [22, 14],
      label: 'Tweeter 8 Ω',
      params: { resistance: 8, watts: 20 },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [30, 14],
        [22, 14],
        [0, 14],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 14] },
  ],
  probes: [
    { id: 'VW', kind: 'voltage', plus: 'RW.a', minus: 'GND', label: 'No woofer' },
    { id: 'VT', kind: 'voltage', plus: 'RT.a', minus: 'GND', label: 'No tweeter' },
  ],
});
