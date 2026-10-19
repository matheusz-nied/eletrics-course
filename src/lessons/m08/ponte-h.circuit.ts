import { defineCircuit } from '../../engine';

/**
 * 8.2: an H bridge made of four switches, so the student finds by hand which
 * pairs turn the motor each way, which one brakes it and which one shorts
 * the battery (and blows the fuse). The motor is a small 12 V hobby motor:
 * 4 Ω winding (3 A locked), about 5.600 rpm unloaded. SMALL_MOTOR is
 * shared with the PWM circuit.
 */
export const SMALL_MOTOR = {
  resistance: 4,
  inductance: 0.002,
  ke: 0.02,
  kt: 0.02,
  inertia: 2e-5,
  friction: 2e-6,
  ratedCurrent: 1,
};

const leg = (x: number, high: string, low: string, side: string) => [
  {
    id: high,
    type: 'switch',
    a: [x, 0] as [number, number],
    b: [x, 10] as [number, number],
    label: high,
    params: { closed: false },
    control: { param: 'closed', label: `${high} (em cima, ${side})`, kind: 'toggle' as const },
  },
  {
    id: `W${high}`,
    type: 'wire',
    points: [
      [x, 10],
      [x, 12],
      [x, 14],
    ] as [number, number][],
  },
  {
    id: low,
    type: 'switch',
    a: [x, 14] as [number, number],
    b: [x, 24] as [number, number],
    label: low,
    params: { closed: false },
    control: { param: 'closed', label: `${low} (embaixo, ${side})`, kind: 'toggle' as const },
  },
];

export default defineCircuit({
  id: 'm08/ponte-h',
  title: 'Ponte H com quatro chaves',
  description:
    'Uma bateria de 12 V alimenta, por um fusível de 5 A, uma ponte H de quatro chaves: S1 e S2 formam o lado esquerdo, S3 e S4 o direito, cada lado com uma chave ligada ao positivo, em cima, e outra ao negativo, embaixo. O motor fica no meio, entre os dois lados, como o traço do H. Com S1 e S4 fechadas, a corrente atravessa o motor da esquerda para a direita e ele gira para um lado; com S3 e S2, atravessa ao contrário e ele gira para o outro. Com S2 e S4 fechadas, os dois terminais do motor ficam ligados ao negativo e ele freia. Fechar as duas chaves do mesmo lado, S1 com S2 ou S3 com S4, põe a bateria em curto e o fusível queima.',
  analysis: { kind: 'transient', dt: 2e-4, speed: 1 },
  elements: [
    {
      id: 'B1',
      type: 'battery',
      a: [0, 8],
      b: [0, 20],
      label: 'Bateria',
      params: { voltage: 12, resistance: 0.05 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 8],
        [0, 0],
        [3, 0],
      ],
    },
    {
      id: 'F1',
      type: 'fuse',
      a: [3, 0],
      b: [9, 0],
      label: 'F1',
      params: { rating: 5 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [9, 0],
        [14, 0],
        [34, 0],
      ],
    },
    ...leg(14, 'S1', 'S2', 'esquerda'),
    ...leg(34, 'S3', 'S4', 'direita'),
    {
      id: 'W3',
      type: 'wire',
      points: [
        [14, 12],
        [18, 12],
      ],
    },
    {
      id: 'M1',
      type: 'dc-motor',
      a: [18, 12],
      b: [30, 12],
      label: 'Motor',
      params: { ...SMALL_MOTOR },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [30, 12],
        [34, 12],
      ],
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [0, 20],
        [0, 24],
        [14, 24],
        [34, 24],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 24] },
  ],
  probes: [
    { id: 'IM', kind: 'current', element: 'M1', label: 'Corrente no motor' },
    { id: 'VM', kind: 'voltage', plus: 'M1.a', minus: 'M1.b', label: 'Tensão no motor' },
  ],
  goals: [
    {
      id: 'frente',
      description: 'Feche S1 e S4: o motor gira para um lado.',
      check: { readout: 'M1.rpm', op: '>', value: 5000 },
      solution: { 'S1.closed': true, 'S4.closed': true },
      at: 2,
    },
    {
      id: 'tras',
      description: 'Feche S3 e S2: o motor gira para o outro lado.',
      check: { readout: 'M1.rpm', op: '<', value: -5000 },
      solution: { 'S3.closed': true, 'S2.closed': true },
      at: 2,
    },
    {
      id: 'curto',
      description: 'Feche S1 e S2 juntas: a bateria entra em curto e o fusível queima.',
      check: { readout: 'F1.blown', op: '==', value: true },
      solution: { 'S1.closed': true, 'S2.closed': true },
      at: 0.1,
    },
  ],
});
