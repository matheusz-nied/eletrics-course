import { defineCircuit } from '../../engine';

/**
 * 04.6: a small 12 V DC motor behind a 2 A fuse. The motor runs at about
 * 1 A, but while it spins up it pulls up to about 7,5 A for a fraction of a
 * second: enough to blow a fast fuse, not a time-lag one. With the shaft
 * locked, the time-lag fuse blows after about a second. The values the
 * lesson quotes are checked in ./fusiveis.test.ts.
 */
export const LOCKED = 1;
export const NORMAL_LOAD = 0.05;

export default defineCircuit({
  id: 'm04/fusivel-motor',
  title: 'Partida de um motor com fusível rápido ou retardado',
  description:
    'Uma bateria de 12 V alimenta um pequeno motor CC através de um fusível de 2 A e de uma chave. Girando, o motor puxa cerca de 1 A. Na partida, parado, ele puxa até cerca de 7,5 A; a corrente cai à medida que ele ganha velocidade, fica abaixo de 2 A em cerca de 0,6 s e se acomoda perto de 1 A. O fusível rápido (F) rompe durante a partida; o retardado (T) aguenta. Com o eixo travado, o motor puxa cerca de 7,6 A sem parar e o fusível retardado rompe em pouco mais de 1 s.',
  analysis: { kind: 'transient', dt: 1e-3, speed: 0.25 },
  elements: [
    {
      id: 'B1',
      type: 'battery',
      a: [0, 0],
      b: [0, 16],
      label: 'Bateria 12 V',
      params: { voltage: 12, resistance: 0.02 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [4, 0],
      ],
    },
    {
      id: 'F1',
      type: 'fuse',
      a: [4, 0],
      b: [14, 0],
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
      id: 'S1',
      type: 'switch',
      a: [14, 0],
      b: [24, 0],
      label: 'Chave',
      control: { param: 'closed', label: 'Ligar o motor', kind: 'toggle' },
    },
    {
      id: 'M1',
      type: 'dc-motor',
      a: [24, 0],
      b: [24, 16],
      label: 'Motor 12 V',
      params: {
        resistance: 1.5,
        inductance: 0.002,
        ke: 0.05,
        kt: 0.05,
        inertia: 5e-4,
        friction: 1e-5,
        load: NORMAL_LOAD,
        ratedCurrent: 1.5,
      },
      control: {
        param: 'load',
        label: 'Eixo do motor',
        kind: 'select',
        options: [
          { value: NORMAL_LOAD, label: 'Livre, com a carga normal' },
          { value: LOCKED, label: 'Travado' },
        ],
      },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [24, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
  ],
  probes: [{ id: 'IM', kind: 'current', element: 'M1', label: 'Corrente no motor' }],
  goals: [
    {
      id: 'rapido-rompe',
      description: 'Ligue o motor com o fusível rápido: ele rompe durante a partida.',
      check: { readout: 'F1.blown', op: '==', value: true },
      at: 0.5,
      solution: { 'S1.closed': true },
    },
    {
      id: 'pico',
      description: 'Com o retardado, veja a corrente da partida passar de 6 A por um instante.',
      check: { readout: 'IM', op: '>', value: 6 },
      at: 0.01,
      solution: { 'S1.closed': true, 'F1.kind': 'slow' },
    },
    {
      id: 'girando',
      description: 'Com o retardado, o motor parte e passa a puxar só 1 A.',
      check: { readout: 'IM', op: 'between', value: [1, 1.1] },
      at: 2,
      solution: { 'S1.closed': true, 'F1.kind': 'slow' },
    },
    {
      id: 'travado',
      description: 'Trave o eixo com o retardado: agora o excesso não passa, e ele rompe.',
      check: { readout: 'F1.blown', op: '==', value: true },
      at: 2,
      solution: { 'S1.closed': true, 'F1.kind': 'slow', 'M1.load': LOCKED },
    },
  ],
});
