import { defineCircuit } from '../../engine';

/**
 * 04.6: a 2 A glass fuse with a load chosen from normal to short circuit, and
 * the fuse type (fast or time-lag). The blow times the lesson quotes are
 * checked in ./fusiveis.test.ts.
 */

/** Load resistances for exactly the labelled currents with the battery's 0,01 Ω and the fuse's 0,05 Ω. */
const load = (amps: number) => Math.round((12 / amps - 0.06) * 1000) / 1000;

export const LOADS = {
  normal: load(1.5),
  leve: load(3),
  sobrecarga: load(4),
  forte: load(8),
  curto: 0.01,
};

export default defineCircuit({
  id: 'm04/fusivel-sobrecarga',
  title: 'Fusível de 2 A com carga variável',
  description:
    'Uma bateria de 12 V alimenta uma carga através de um fusível de vidro de 2 A. A carga pode ser normal (1,5 A), uma sobrecarga leve (3 A), uma sobrecarga (4 A), uma sobrecarga forte (8 A) ou um curto-circuito. O fusível pode ser rápido (F) ou retardado (T). Com 1,5 A e com 3 A ele não rompe. Com 4 A, o rápido rompe em cerca de 0,3 s e o retardado em cerca de 6 s; com 8 A, em cerca de 0,06 s e 1 s; no curto, em menos de um milésimo de segundo e em poucos milésimos.',
  analysis: { kind: 'transient', dt: 1e-3, speed: 1 },
  elements: [
    {
      id: 'B1',
      type: 'battery',
      a: [0, 0],
      b: [0, 16],
      label: 'Bateria 12 V',
      params: { voltage: 12, resistance: 0.01 },
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
      id: 'F1',
      type: 'fuse',
      a: [6, 0],
      b: [16, 0],
      label: 'Fusível 2 A',
      params: { rating: 2, kind: 'fast' },
      control: {
        param: 'kind',
        label: 'Tipo do fusível',
        kind: 'select',
        options: [
          { value: 'fast', label: 'Rápido (F)' },
          { value: 'slow', label: 'Retardado (T)' },
        ],
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [16, 0],
        [24, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [24, 0],
      b: [24, 16],
      label: 'Carga',
      params: { resistance: LOADS.normal, watts: 2000 },
      control: {
        param: 'resistance',
        label: 'Carga',
        kind: 'select',
        options: [
          { value: LOADS.normal, label: 'Normal (1,5 A)' },
          { value: LOADS.leve, label: 'Sobrecarga leve (3 A)' },
          { value: LOADS.sobrecarga, label: 'Sobrecarga (4 A)' },
          { value: LOADS.forte, label: 'Sobrecarga forte (8 A)' },
          { value: LOADS.curto, label: 'Curto-circuito' },
        ],
      },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [24, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
  ],
  probes: [{ id: 'IF', kind: 'current', element: 'F1', label: 'Corrente no fusível' }],
  goals: [
    {
      id: 'normal',
      description: 'Com a carga normal, passam 1,5 A e o fusível nem esquenta direito.',
      check: { readout: 'IF', op: 'between', value: [1.48, 1.52] },
    },
    {
      id: 'leve',
      description:
        'Escolha a sobrecarga leve (3 A, 1,5 vez a nominal): o aquecimento do elo para em uns 0,88 e o fusível não rompe.',
      check: { readout: 'F1.heat', op: 'between', value: [0.86, 0.9] },
      at: 5,
      solution: { 'R1.resistance': LOADS.leve },
    },
    {
      id: 'rapido',
      description: 'Faça o fusível rápido romper com a sobrecarga de 4 A.',
      check: { readout: 'F1.blown', op: '==', value: true },
      at: 0.5,
      solution: { 'R1.resistance': LOADS.sobrecarga },
    },
    {
      id: 'retardado',
      description: 'Agora o retardado, com os mesmos 4 A: ele demora bem mais, mas rompe.',
      check: { readout: 'F1.blown', op: '==', value: true },
      at: 8,
      solution: { 'R1.resistance': LOADS.sobrecarga, 'F1.kind': 'slow' },
    },
  ],
});
