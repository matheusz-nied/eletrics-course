import { defineCircuit } from '../../engine';

/**
 * 9.9: the classic lamp dimmer. The potentiometer and R1 charge C1 from the
 * voltage across the TRIAC; when C1 reaches the DIAC's breakover voltage
 * (about 32 V), the DIAC dumps the charge into the gate and the TRIAC
 * conducts until the next zero crossing. More resistance, later firing,
 * less power. The values the lesson quotes are checked in ./tiristores.test.ts.
 */
export default defineCircuit({
  id: 'm09/dimmer-triac',
  title: 'Dimmer com TRIAC',
  description:
    'Uma tomada de 127 V alimenta uma lâmpada incandescente de 60 W em série com um TRIAC. Em paralelo com o TRIAC há uma rede de atraso: um resistor de 3,3 kΩ, um potenciômetro de 330 kΩ e um capacitor de 100 nF. Quando a tensão no capacitor chega a cerca de 32 V, o DIAC conduz e descarrega o capacitor no gatilho do TRIAC, que passa a conduzir até o fim do semiciclo. Com o potenciômetro no máximo, o TRIAC dispara logo no começo de cada semiciclo e a lâmpada brilha quase toda. Quanto menor a posição, mais resistência, mais tarde o disparo e menos brilho, até a lâmpada apagar.',
  analysis: { kind: 'transient', dt: 2e-5, speed: 0.02 },
  elements: [
    {
      id: 'V1',
      type: 'ac-voltage',
      a: [0, 0],
      b: [0, 24],
      label: 'Tomada 127 V',
      params: { amplitude: 179.6, frequency: 60 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [6, 0],
      ],
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [6, 0],
      b: [14, 0],
      label: 'Lâmpada',
      params: { voltage: 127, power: 60 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [14, 0],
        [18, 0],
        [44, 0],
        [44, 10],
      ],
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [18, 0],
        [18, 7],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [18, 7],
      b: [24, 7],
      label: 'R1',
      params: { resistance: 3300 },
    },
    {
      id: 'P1',
      type: 'potentiometer',
      at: [28, 7],
      // End a on the left, towards R1, and the wiper below.
      rot: 180,
      flip: true,
      label: 'P1',
      params: { resistance: 330000, position: 0.8 },
      control: {
        param: 'position',
        label: 'Potenciômetro do dimmer',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
      },
    },
    // Wiper tied to end a: a variable resistor from the wiper to end b.
    {
      id: 'W4',
      type: 'wire',
      points: [
        [28, 10],
        [24, 10],
        [24, 7],
      ],
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [32, 7],
        [34, 7],
        [34, 13],
        [34, 15],
      ],
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [34, 15],
      b: [34, 24],
      label: 'C1',
      params: { capacitance: 1e-7 },
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [34, 13],
        [36, 13],
      ],
    },
    {
      id: 'D1',
      type: 'diac',
      a: [36, 13],
      b: [40, 13],
      label: 'DIAC',
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [40, 13],
        [42, 13],
      ],
    },
    {
      id: 'T1',
      type: 'triac',
      at: [44, 12],
      rot: 90,
      label: 'TRIAC',
    },
    {
      id: 'W8',
      type: 'wire',
      points: [
        [44, 14],
        [44, 24],
        [34, 24],
        [0, 24],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 24] },
  ],
  probes: [
    { id: 'VL', kind: 'voltage', plus: 'L1.a', minus: 'L1.b', label: 'Tensão na lâmpada' },
    { id: 'VC', kind: 'voltage', plus: 'C1.a', minus: 'C1.b', label: 'Tensão no capacitor' },
    { id: 'VT', kind: 'voltage', plus: 'V1.a', minus: 'V1.b', label: 'Tensão da tomada' },
  ],
  goals: [
    {
      id: 'cheio',
      description:
        'Gire o potenciômetro até o fim: o TRIAC dispara logo no começo de cada semiciclo e a lâmpada brilha quase toda.',
      check: { readout: 'L1.brightness', op: '>', value: 0.8 },
      solution: { 'P1.position': 1 },
      at: 0.3,
    },
    {
      id: 'apagada',
      description:
        'Gire o potenciômetro para 25 % ou menos: o capacitor não chega mais aos 32 V do DIAC, e a lâmpada apaga.',
      check: { readout: 'P1.position', op: '<=', value: 0.25 },
      solution: { 'P1.position': 0.2 },
      at: 0.3,
    },
  ],
});
