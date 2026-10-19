import { defineCircuit } from '../../engine';

/**
 * 8.1: the motor of a car's power window on 12 V, without its gearbox. The
 * student sets the battery voltage and the load the glass puts on the motor
 * shaft, and reads speed and current. Teaching values close to a window
 * motor: 0,5 Ω winding (24 A locked at 12 V), Ke = Kt = 0,02 (about
 * 5.100 rpm and 2,7 A unloaded). Quoted values are goals; WINDOW_MOTOR is
 * shared with the start-up plot.
 */
export const WINDOW_MOTOR = {
  resistance: 0.5,
  inductance: 0.001,
  ke: 0.02,
  kt: 0.02,
  inertia: 2e-4,
  friction: 1e-4,
  ratedCurrent: 10,
};

export default defineCircuit({
  id: 'm08/motor-cc',
  title: 'Motor do vidro elétrico',
  description:
    'Uma bateria de 12 V, com a tensão ajustável, liga um motor de corrente contínua por um botão. O motor é o do vidro elétrico de um carro, sem o redutor: enrolamento de 0,5 Ω. Um controle ajusta o torque que o vidro faz contra o eixo do motor. Sem carga, o motor gira a cerca de 5.100 rpm e puxa 2,7 A; quanto mais carga, mais devagar ele gira e mais corrente puxa. Com o vidro travado no alto, o motor para e puxa 24 A, limitado só pela resistência do enrolamento, e esquenta.',
  analysis: { kind: 'transient', dt: 2e-4, speed: 1 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 16],
      label: 'Bateria',
      params: { voltage: 12 },
      control: {
        param: 'voltage',
        label: 'Tensão da bateria',
        kind: 'slider',
        min: 0,
        max: 14,
        step: 0.5,
        unit: 'V',
      },
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
      id: 'S1',
      type: 'switch',
      a: [6, 0],
      b: [14, 0],
      label: 'Botão',
      params: { closed: false },
      control: { param: 'closed', label: 'Botão do vidro apertado', kind: 'toggle' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [14, 0],
        [22, 0],
      ],
    },
    {
      id: 'M1',
      type: 'dc-motor',
      a: [22, 0],
      b: [22, 16],
      label: 'Motor',
      params: { ...WINDOW_MOTOR, load: 0 },
      control: {
        param: 'load',
        label: 'Carga no eixo (força do vidro)',
        kind: 'slider',
        min: 0,
        max: 0.6,
        step: 0.01,
        unit: 'N·m',
      },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [22, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
  ],
  probes: [
    { id: 'IM', kind: 'current', element: 'M1', label: 'Corrente no motor' },
    { id: 'VM', kind: 'voltage', plus: 'M1.a', minus: 'M1.b', label: 'Tensão no motor' },
  ],
  goals: [
    {
      id: 'vazio',
      description: 'Aperte o botão sem carga: o motor gira a cerca de 5.100 rpm.',
      check: { readout: 'M1.rpm', op: 'between', value: [5050, 5130] },
      solution: { 'S1.closed': true },
      at: 2,
    },
    {
      id: 'vazio-corrente',
      description: 'Sem carga, o motor puxa só uns 2,7 A.',
      check: { readout: 'M1.current', op: 'between', value: [2.6, 2.75] },
      solution: { 'S1.closed': true },
      at: 2,
    },
    {
      id: 'meia-tensao',
      description: 'Com 6 V, a rotação cai pela metade: uns 2.550 rpm.',
      check: { readout: 'M1.rpm', op: 'between', value: [2510, 2580] },
      solution: { 'S1.closed': true, 'V1.voltage': 6 },
      at: 2,
    },
    {
      id: 'subindo',
      description: 'Com 0,15 N·m de carga, o motor cai para uns 3.500 rpm e puxa cerca de 9,3 A.',
      check: { readout: 'M1.current', op: 'between', value: [9.2, 9.45] },
      solution: { 'S1.closed': true, 'M1.load': 0.15 },
      at: 2,
    },
    {
      id: 'subindo-rpm',
      description: 'Com 0,15 N·m de carga, o motor gira a uns 3.500 rpm.',
      check: { readout: 'M1.rpm', op: 'between', value: [3460, 3540] },
      solution: { 'S1.closed': true, 'M1.load': 0.15 },
      at: 2,
    },
    {
      id: 'travado',
      description: 'Trave o vidro (carga acima de 0,48 N·m): o motor para e puxa 24 A.',
      check: { readout: 'M1.current', op: 'between', value: [23.8, 24.05] },
      solution: { 'S1.closed': true, 'M1.load': 0.6 },
      at: 1,
    },
  ],
});
