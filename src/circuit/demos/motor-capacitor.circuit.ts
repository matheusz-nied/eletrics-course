import { defineCircuit } from '../engine';

/** A capacitor-start motor on the mains: the meter reads its line current. */
export default defineCircuit({
  id: 'demo/motor-capacitor',
  title: 'Motor com capacitor em CA',
  description:
    'Um motor monofásico de 250 W com capacitor permanente, ligado a 127 V eficazes (60 Hz) por um fusível. O multímetro em CA mostra a corrente que o motor puxa pelo comum e a mesma corrente passando pelo fusível.',
  analysis: { kind: 'quasi-static', frequency: 60, dtMech: 0.01 },
  elements: [
    // 127 V eficazes, 60 Hz
    {
      id: 'V1',
      type: 'ac-voltage',
      a: [2, 7],
      b: [2, 13],
      params: { amplitude: 179.6, frequency: 60 },
    },
    { id: 'F1', type: 'fuse', a: [2, 7], b: [8, 7], params: { rating: 5 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [8, 7],
        [12, 7],
      ],
    },
    // w1 (12,7), w2 (16,7), common (14,13)
    { id: 'M1', type: 'ac-motor-1ph-cap', at: [14, 10] },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 7],
        [12, 3],
      ],
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [12, 3],
      b: [16, 3],
      params: { capacitance: 16e-6, voltage: 250, acRated: true },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [16, 3],
        [16, 7],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [14, 13],
        [14, 15],
        [2, 15],
        [2, 13],
      ],
    },
    { id: 'G', type: 'ground', at: [2, 15] },
  ],
  probes: [
    { id: 'IM', kind: 'current', element: 'M1', label: 'Corrente no comum do motor' },
    { id: 'IF', kind: 'current', element: 'F1', label: 'Corrente no fusível' },
  ],
});
