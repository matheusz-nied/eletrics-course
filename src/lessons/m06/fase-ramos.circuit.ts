import { defineCircuit } from '../../engine';

/** Reactance of the coil and of the capacitor at 60 Hz: the same 100 Ω as the resistor. */
const OHMS = 100;
const OMEGA = 2 * Math.PI * 60;

/**
 * 06.3: a 60 Hz generator feeding three branches in parallel, each with its
 * own switch: a 100 Ω resistor, a coil and a capacitor of 100 Ω reactance at
 * 60 Hz. The scope shows the voltage and the total current; the multimeters,
 * the current of each branch and the total. Each branch alone draws about
 * 70,7 mA, but they add as phasors: R and L together give 102 mA, L and C
 * together almost cancel. Values checked in ./fase-ramos.test.ts.
 */
export default defineCircuit({
  id: 'm06/fase-ramos',
  title: 'Tensão e corrente em fase, atrasada e adiantada',
  description:
    'Um gerador de 10 V de pico (7,07 V eficazes) e 60 Hz alimenta três ramos em paralelo, cada um com a sua chave: um resistor de 100 Ω, uma bobina de 265 mH e um capacitor de 26,5 µF, com 0,5 Ω de fios em série. Em 60 Hz, a bobina e o capacitor opõem 100 Ω à corrente, como o resistor, então cada ramo sozinho puxa cerca de 70,7 mA. O osciloscópio mostra a tensão do gerador e a corrente total: com o resistor, a corrente sobe e desce junto com a tensão; com a bobina, atrasa quase um quarto de ciclo; com o capacitor, adianta um quarto de ciclo. Com o resistor e a bobina ligados, a corrente total é de cerca de 102 mA, e não 141 mA. Com a bobina e o capacitor ligados, as duas correntes quase se anulam e o gerador fornece só uns 4 mA.',
  analysis: { kind: 'transient', dt: 5e-5, speed: 0.05 },
  elements: [
    {
      id: 'V1',
      type: 'ac-voltage',
      a: [0, 2],
      b: [0, 14],
      label: 'Gerador',
      params: { amplitude: 10, frequency: 60 },
    },
    { id: 'G', type: 'ground', at: [0, 14] },
    {
      id: 'W0',
      type: 'wire',
      points: [
        [0, 2],
        [4, 2],
      ],
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [4, 2],
        [8, 2],
        [16, 2],
        [24, 2],
      ],
    },
    {
      id: 'SR',
      type: 'switch',
      a: [8, 2],
      b: [8, 7],
      label: 'SR',
      params: { closed: true },
      control: { param: 'closed', label: 'Ramo do resistor', kind: 'toggle' },
    },
    {
      id: 'SL',
      type: 'switch',
      a: [16, 2],
      b: [16, 7],
      label: 'SL',
      params: { closed: false },
      control: { param: 'closed', label: 'Ramo da bobina', kind: 'toggle' },
    },
    {
      id: 'SC',
      type: 'switch',
      a: [24, 2],
      b: [24, 7],
      label: 'SC',
      params: { closed: false },
      control: { param: 'closed', label: 'Ramo do capacitor', kind: 'toggle' },
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [8, 7],
      b: [8, 14],
      label: 'R',
      params: { resistance: OHMS, watts: 2 },
    },
    {
      id: 'L1',
      type: 'inductor',
      a: [16, 7],
      b: [16, 14],
      label: 'L',
      params: { inductance: OHMS / OMEGA, resistance: 5 },
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [24, 10],
      b: [24, 14],
      label: 'C',
      params: { capacitance: 1 / (OMEGA * OHMS), voltage: 63 },
    },
    {
      id: 'RF',
      type: 'resistor',
      a: [24, 7],
      b: [24, 10],
      label: 'Fios',
      params: { resistance: 0.5, watts: 5 },
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
    { id: 'IT', kind: 'current', element: 'W0', label: 'Corrente total' },
    { id: 'IR', kind: 'current', element: 'R1', label: 'Corrente no resistor' },
    { id: 'IL', kind: 'current', element: 'L1', label: 'Corrente na bobina' },
    { id: 'IC', kind: 'current', element: 'C1', label: 'Corrente no capacitor' },
  ],
});
