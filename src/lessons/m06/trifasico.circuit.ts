import { defineCircuit } from '../../engine';
import type { ElementDoc } from '../../engine/contract';

/** Peak of a 127 V (RMS) phase: 127·√2 ≈ 179,6 V. */
const PEAK = 127 * Math.SQRT2;

/**
 * The three phases of a 127/220 V supply: L1 at 0°, L2 120° behind it, L3
 * 240° behind (120° ahead). Each line rises from its source to its own height
 * and runs right to its lamp; L3's lamp is the nearest, so no lines cross.
 */
const PHASES = [
  { id: 'V1', label: 'L1', x: 2, y: 2, phase: 0, end: 32 },
  { id: 'V2', label: 'L2', x: 6, y: 5, phase: -120, end: 26 },
  { id: 'V3', label: 'L3', x: 10, y: 8, phase: 120, end: 16 },
];

const sources: ElementDoc[] = PHASES.flatMap((p): ElementDoc[] => [
  {
    id: p.id,
    type: 'ac-voltage',
    a: [p.x, 14],
    b: [p.x, 20],
    label: p.label,
    params: { amplitude: PEAK, frequency: 60, phase: p.phase },
  },
  {
    id: `W${p.label}`,
    type: 'wire',
    points: [
      [p.x, 14],
      [p.x, p.y],
      [p.end, p.y],
    ],
  },
]);

const lamp = (id: string, a: [number, number], b: [number, number]): ElementDoc => ({
  id,
  type: 'lamp',
  a,
  b,
  label: '100 W',
  params: { voltage: 127, power: 100 },
});

/**
 * 06.7: a 127/220 V three-phase supply (three 127 V sines 120° apart, joined
 * at the neutral) feeding three 100 W lamps in star. Balanced, the neutral
 * carries almost nothing; switching lamps off unbalances it.
 * The RMS values the lesson quotes are checked in trifasico.test.ts.
 */
export default defineCircuit({
  id: 'm06/trifasico',
  title: 'Três fases e um neutro',
  description:
    'Três fontes de 127 V eficazes e 60 Hz, defasadas de 120° (as fases L1, L2 e L3), têm uma ponta em comum, o neutro. Cada fase alimenta uma lâmpada de 127 V e 100 W ligada entre a fase e o neutro; as lâmpadas das fases L2 e L3 têm chave. O multímetro mostra 127 V entre uma fase e o neutro e 220 V entre duas fases. Com as três lâmpadas acesas, a corrente no neutro fica perto de zero; com uma ou duas apagadas, o neutro passa a levar corrente.',
  analysis: { kind: 'transient', dt: 1e-4, speed: 0.05 },
  elements: [
    ...sources,
    {
      id: 'S3',
      type: 'switch',
      a: [16, 8],
      b: [20, 8],
      label: 'S3',
      params: { closed: true },
      control: { param: 'closed', label: 'Lâmpada da fase L3 ligada', kind: 'toggle' },
    },
    {
      id: 'S2',
      type: 'switch',
      a: [26, 5],
      b: [26, 9],
      label: 'S2',
      params: { closed: true },
      control: { param: 'closed', label: 'Lâmpada da fase L2 ligada', kind: 'toggle' },
    },
    lamp('L3', [20, 8], [20, 14]),
    lamp('L2', [26, 9], [26, 14]),
    lamp('L1', [32, 2], [32, 14]),
    {
      id: 'WC',
      type: 'wire',
      points: [
        [16, 14],
        [20, 14],
        [26, 14],
        [32, 14],
      ],
    },
    {
      id: 'WN',
      type: 'wire',
      label: 'N',
      points: [
        [16, 14],
        [16, 20],
        [10, 20],
        [6, 20],
        [2, 20],
      ],
    },
    { id: 'G', type: 'ground', at: [2, 20] },
  ],
  probes: [
    { id: 'V1N', kind: 'voltage', plus: 'V1.a', minus: 'GND', label: 'Entre L1 e neutro' },
    { id: 'V12', kind: 'voltage', plus: 'V1.a', minus: 'V2.a', label: 'Entre L1 e L2' },
    { id: 'IN', kind: 'current', element: 'WN', label: 'Corrente no neutro' },
    { id: 'I1', kind: 'current', element: 'L1', label: 'Corrente na fase L1' },
    { id: 'V2N', kind: 'voltage', plus: 'V2.a', minus: 'GND', label: 'Entre L2 e neutro' },
    { id: 'V3N', kind: 'voltage', plus: 'V3.a', minus: 'GND', label: 'Entre L3 e neutro' },
  ],
});
