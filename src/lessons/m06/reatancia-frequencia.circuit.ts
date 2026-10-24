import { defineCircuit } from '../../engine';

/**
 * 06.4: a generator with adjustable frequency feeding a resistor, a capacitor
 * and a coil in parallel, one multimeter on each. The resistor's current does
 * not change with the frequency, the capacitor's grows with it and the coil's
 * falls. Near 160 Hz the capacitor and the coil both oppose about 100 Ω, the
 * same as the resistor. Values checked in ./reatancia-frequencia.test.ts.
 */
export default defineCircuit({
  id: 'm06/reatancia-frequencia',
  title: 'Resistor, capacitor e bobina quando a frequência muda',
  description:
    'Um gerador de 10 V de pico (7,07 V eficazes) com frequência ajustável de 50 Hz a 1.000 Hz alimenta três ramos em paralelo: um resistor de 100 Ω, um capacitor de 10 µF (com 0,5 Ω de fios em série) e uma bobina de 100 mH com 2 Ω de fio. Em 60 Hz, o resistor puxa 70,7 mA, o capacitor 26,7 mA e a bobina 187 mA. Subindo a frequência, a corrente do resistor não muda, a do capacitor cresce e a da bobina cai. Perto de 160 Hz as três correntes ficam quase iguais, perto de 70 mA. Em 1.000 Hz, o capacitor puxa cerca de 445 mA e a bobina só 11 mA.',
  analysis: { kind: 'transient', dt: 2.5e-5, speed: 0.05 },
  elements: [
    {
      id: 'V1',
      type: 'ac-voltage',
      a: [0, 2],
      b: [0, 14],
      label: 'Gerador',
      params: { amplitude: 10, frequency: 60 },
      control: {
        param: 'frequency',
        label: 'Frequência do gerador',
        kind: 'slider',
        min: 50,
        max: 1000,
        step: 10,
        unit: 'Hz',
      },
    },
    { id: 'G', type: 'ground', at: [0, 14] },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 2],
        [8, 2],
        [16, 2],
        [24, 2],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [8, 2],
      b: [8, 14],
      label: 'R',
      params: { resistance: 100, watts: 2 },
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [16, 2],
      b: [16, 10],
      label: 'C',
      params: { capacitance: 10e-6, voltage: 25 },
    },
    {
      id: 'RF',
      type: 'resistor',
      a: [16, 10],
      b: [16, 14],
      label: 'Fios',
      params: { resistance: 0.5, watts: 5 },
    },
    {
      id: 'L1',
      type: 'inductor',
      a: [24, 2],
      b: [24, 14],
      label: 'L',
      params: { inductance: 0.1, resistance: 2 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [0, 14],
        [8, 14],
        [16, 14],
        [24, 14],
      ],
    },
  ],
  probes: [
    { id: 'VE', kind: 'voltage', plus: 'V1.a', minus: 'GND', label: 'Tensão do gerador' },
    { id: 'IR', kind: 'current', element: 'R1', label: 'Corrente no resistor' },
    { id: 'IC', kind: 'current', element: 'C1', label: 'Corrente no capacitor' },
    { id: 'IL', kind: 'current', element: 'L1', label: 'Corrente na bobina' },
  ],
});
