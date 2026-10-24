import { defineCircuit } from '../../engine';

/** Peak of a 127 V (RMS) phase: 127·√2 ≈ 179,6 V. */
const PEAK = 127 * Math.SQRT2;

/** A 1.500 W heater at 127 V: R = 127² / 1.500 ≈ 10,75 Ω. */
const HEATER_OHMS = (127 * 127) / 1500;

/**
 * 06.7: a two-phase (bifásico) 127/220 V house. A small 15 W lamp is on
 * L1–N, a 1.500 W heater on L2–N. With the neutral broken between the
 * service entrance and the panel, the two loads end up in series across the
 * 220 V between phases: the light load takes almost all of it and burns.
 * The RMS values the lesson quotes are checked in neutro-rompido.test.ts.
 */
export default defineCircuit({
  id: 'm06/neutro-rompido',
  title: 'Neutro rompido numa casa bifásica',
  description:
    'Duas fases de 127 V, L1 e L2, defasadas de 120°, com 220 V entre elas, e o neutro. Entre L1 e o neutro há uma lâmpada pequena de 127 V e 15 W; entre L2 e o neutro, um aquecedor de 1.500 W com chave. Uma chave no neutro simula o fio que vem do padrão de entrada. Com o neutro ligado, cada aparelho recebe 127 V. Com o neutro rompido e o aquecedor ligado, a lâmpada e o aquecedor ficam em série nos 220 V entre as fases: a lâmpada recebe quase tudo e queima, e o aquecedor fica quase sem tensão.',
  analysis: { kind: 'transient', dt: 1e-4, speed: 0.05 },
  elements: [
    {
      id: 'V1',
      type: 'ac-voltage',
      a: [2, 12],
      b: [2, 18],
      label: 'L1',
      params: { amplitude: PEAK, frequency: 60, phase: 0 },
    },
    {
      id: 'V2',
      type: 'ac-voltage',
      a: [6, 12],
      b: [6, 18],
      label: 'L2',
      params: { amplitude: PEAK, frequency: 60, phase: -120 },
    },
    {
      id: 'WL1',
      type: 'wire',
      points: [
        [2, 12],
        [2, 2],
        [26, 2],
      ],
    },
    {
      id: 'WL2',
      type: 'wire',
      points: [
        [6, 12],
        [6, 6],
        [16, 6],
      ],
    },
    {
      id: 'SH',
      type: 'switch',
      a: [16, 6],
      b: [20, 6],
      label: 'SH',
      params: { closed: true },
      control: { param: 'closed', label: 'Aquecedor ligado', kind: 'toggle' },
    },
    {
      id: 'RH',
      type: 'resistor',
      a: [20, 6],
      b: [20, 12],
      label: 'Aquecedor 1.500 W',
      params: { resistance: HEATER_OHMS, watts: 5000 },
    },
    {
      id: 'LP',
      type: 'lamp',
      a: [26, 2],
      b: [26, 12],
      label: 'Lâmpada 15 W',
      params: { voltage: 127, power: 15 },
    },
    {
      id: 'WC',
      type: 'wire',
      points: [
        [12, 12],
        [20, 12],
        [26, 12],
      ],
    },
    {
      id: 'WN1',
      type: 'wire',
      points: [
        [12, 12],
        [12, 13],
      ],
    },
    {
      id: 'SN',
      type: 'switch',
      a: [12, 13],
      b: [12, 18],
      label: 'Neutro',
      params: { closed: true },
      control: {
        param: 'closed',
        label: 'Neutro ligado (fio do padrão até o quadro)',
        kind: 'toggle',
      },
    },
    {
      id: 'WN',
      type: 'wire',
      points: [
        [12, 18],
        [6, 18],
        [2, 18],
      ],
    },
    { id: 'G', type: 'ground', at: [2, 18] },
  ],
  probes: [
    { id: 'VL', kind: 'voltage', plus: 'LP.a', minus: 'LP.b', label: 'Na lâmpada (L1)' },
    { id: 'VH', kind: 'voltage', plus: 'RH.a', minus: 'RH.b', label: 'No aquecedor (L2)' },
    { id: 'V12', kind: 'voltage', plus: 'V1.a', minus: 'V2.a', label: 'Entre L1 e L2' },
    { id: 'IN', kind: 'current', element: 'SN', label: 'Corrente no neutro' },
  ],
  goals: [
    {
      id: 'normal',
      description: 'Com o neutro ligado, a lâmpada de 15 W acende normal.',
      check: { readout: 'LP.brightness', op: 'between', value: [0.9, 1.1] },
    },
    {
      id: 'rompido',
      description: 'Rompa o neutro com o aquecedor ligado: a lâmpada recebe quase 220 V e queima.',
      check: { readout: 'LP.burned', op: '==', value: true },
      solution: { 'SN.closed': false },
    },
  ],
});
