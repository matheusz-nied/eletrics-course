import { defineCircuit } from '../../engine';

/**
 * Lessons 16.2 and 16.7: a motor capacitor removed charged at the peak of
 * 127 V, discharged through a resistor instead of a screwdriver.
 */
export default defineCircuit({
  id: 'm16/descarga-capacitor',
  title: 'Descarga segura do capacitor do motor',
  description:
    'Um capacitor de 40 µF ficou carregado com 180 V, o pico da rede de 127 V. Ao fechar a chave, um resistor de 10 kΩ e 5 W é ligado aos terminais e descarrega o capacitor. A corrente começa em 18 mA e a tensão cai pela metade a cada 0,28 s, aproximadamente; em 2 s sobra pouco mais de 1 V.',
  analysis: { kind: 'transient', dt: 1e-3, speed: 0.5, tStop: 3 },
  elements: [
    {
      id: 'C1',
      type: 'capacitor',
      a: [0, 0],
      b: [0, 10],
      params: { capacitance: 40e-6, voltage: 400, ic: 180 },
      label: 'capacitor do motor',
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [8, 0],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [8, 0],
      b: [16, 0],
      params: { closed: false },
      label: 'pontas do resistor',
      control: { param: 'closed', label: 'Resistor encostado nos terminais', kind: 'toggle' },
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [16, 0],
      b: [16, 10],
      params: { resistance: 10000, watts: 5 },
      label: 'resistor de descarga',
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [16, 10],
        [0, 10],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 10] },
  ],
  probes: [
    { id: 'VC', kind: 'voltage', plus: 'C1.a', minus: 'GND', label: 'Tensão no capacitor' },
    { id: 'IR', kind: 'current', element: 'R1', label: 'Corrente no resistor' },
  ],
  goals: [
    {
      id: 'descarregado',
      description:
        'Encoste o resistor nos terminais e espere a tensão cair abaixo de 5 V (leva pouco mais de 1 s).',
      check: { readout: 'VC', op: '<', value: 5 },
      at: 2,
      solution: { 'S1.closed': true },
    },
  ],
});
