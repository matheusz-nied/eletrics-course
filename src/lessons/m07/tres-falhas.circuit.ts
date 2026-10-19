import { defineCircuit } from '../../engine';

/**
 * 07.3: the three faults and who trips. A 127 V supply feeds a circuit of
 * outlets through a 30 mA DR and a 10 A breaker (curve B or C). Switches add
 * appliances (overload: thermal trip after seconds), a short circuit
 * (magnetic trip at once), a person touching the phase with the feet on the
 * floor, which is at the potential of the protective earth (leak: the DR
 * trips, the breaker does not notice), and the starting current of a motor,
 * about 6 × In while the button is held (curve B trips, curve C holds). The
 * times and currents the lesson quotes are checked in ./tres-falhas.test.ts.
 */

const V = 127;
/** Resistance of an appliance of `watts` at 127 V (Ω). */
const load = (watts: number) => V ** 2 / watts;

/** Rating of the breaker (A). */
export const RATING = 10;
/** The motor draws about 6 × In while it starts (Ω, with the 0,3 Ω of the supply). */
export const MOTOR_START = Math.round((V / (6 * RATING) - 0.3) * 1000) / 1000;
/** Two bare wires touching (Ω). */
export const SHORT = 0.02;

export default defineCircuit({
  id: 'm07/tres-falhas',
  title: 'Sobrecarga, curto e fuga: quem desarma',
  description:
    'Uma rede de 127 V alimenta um circuito de tomadas por um DR de 30 mA e por um disjuntor de 10 A, que pode ser de curva B ou C. Na linha já estão ligadas a geladeira e as lâmpadas (300 W). Chaves ligam um aquecedor de 1.000 W e um forno elétrico de 2.000 W, fecham um curto-circuito entre os fios ou fazem uma pessoa encostar num fio da fase com os pés no chão; um botão simula a partida de um motor, que puxa cerca de 60 A enquanto fica apertado. Com o aquecedor e o forno juntos, cerca de 25 A, o disjuntor desarma por sobrecarga em cerca de 20 segundos. No curto, mais de 300 A, ele desarma na hora pelo disparo magnético. Na fuga pela pessoa, cerca de 0,1 A, o disjuntor não percebe nada e o DR desarma. Na partida do motor, a curva B desarma na hora e a curva C aguenta.',
  analysis: { kind: 'quasi-static', frequency: 60, dtMech: 0.005 },
  elements: [
    { id: 'REDE', type: 'mains', at: [0, 8], label: 'Rede 127 V', params: { voltage: V } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [2, 6],
        [5, 6],
      ],
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [2, 8],
        [5, 8],
      ],
    },
    {
      id: 'DR',
      type: 'rcd',
      at: [8, 7],
      label: 'DR',
      params: { sensitivity: 0.03 },
      control: { param: 'closed', label: 'DR ligado', kind: 'toggle' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [11, 6],
        [12, 6],
        [12, 2],
        [14, 2],
      ],
    },
    {
      id: 'DJ',
      type: 'breaker',
      a: [14, 2],
      b: [20, 2],
      label: 'Disjuntor 10 A',
      params: { rating: RATING, curve: 'C' },
      control: [
        { param: 'closed', label: 'Disjuntor ligado', kind: 'toggle' },
        {
          param: 'curve',
          label: 'Curva do disjuntor',
          kind: 'select',
          options: [
            { value: 'B', label: 'B (desarma de 3 a 5 × In)' },
            { value: 'C', label: 'C (desarma de 5 a 10 × In)' },
          ],
        },
      ],
    },
    // Phase bus along the top, neutral bus along the bottom.
    {
      id: 'W4',
      type: 'wire',
      points: [
        [20, 2],
        [24, 2],
        [30, 2],
        [36, 2],
        [42, 2],
        [48, 2],
        [54, 2],
      ],
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [11, 8],
        [13, 8],
        [13, 14],
        [24, 14],
        [30, 14],
        [36, 14],
        [42, 14],
        [48, 14],
      ],
    },
    {
      id: 'BASE',
      type: 'resistor',
      a: [24, 2],
      b: [24, 14],
      label: 'Geladeira e lâmpadas (300 W)',
      params: { resistance: load(300), watts: 1e6 },
    },
    {
      id: 'SAQ',
      type: 'switch',
      a: [30, 2],
      b: [30, 6],
      label: 'Aquecedor',
      control: { param: 'closed', label: 'Aquecedor (1.000 W)', kind: 'toggle' },
    },
    {
      id: 'RAQ',
      type: 'resistor',
      a: [30, 6],
      b: [30, 14],
      label: '1.000 W',
      params: { resistance: load(1000), watts: 1e6 },
    },
    {
      id: 'SFO',
      type: 'switch',
      a: [36, 2],
      b: [36, 6],
      label: 'Forno',
      control: { param: 'closed', label: 'Forno elétrico (2.000 W)', kind: 'toggle' },
    },
    {
      id: 'RFO',
      type: 'resistor',
      a: [36, 6],
      b: [36, 14],
      label: '2.000 W',
      params: { resistance: load(2000), watts: 1e6 },
    },
    {
      id: 'BM',
      type: 'push-button',
      a: [42, 2],
      b: [42, 6],
      label: 'Partida',
      control: { param: 'pressed', label: 'Partida do motor (segure)', kind: 'momentary' },
    },
    {
      id: 'RM',
      type: 'resistor',
      a: [42, 6],
      b: [42, 14],
      label: 'Motor partindo',
      params: { resistance: MOTOR_START, watts: 1e6 },
    },
    {
      id: 'SCC',
      type: 'switch',
      a: [48, 2],
      b: [48, 6],
      label: 'Curto',
      control: { param: 'closed', label: 'Curto-circuito (fios encostados)', kind: 'toggle' },
    },
    {
      id: 'RCC',
      type: 'resistor',
      a: [48, 6],
      b: [48, 14],
      label: 'Fios encostados',
      params: { resistance: SHORT, watts: 1e6 },
    },
    {
      id: 'SP',
      type: 'switch',
      a: [54, 2],
      b: [54, 7],
      label: 'Toque',
      control: { param: 'closed', label: 'Pessoa encosta num fio da fase', kind: 'toggle' },
    },
    {
      id: 'P',
      type: 'human-body',
      a: [54, 7],
      b: [54, 16],
      label: 'Pessoa (mão na fase, pés no chão)',
      params: { skin: 'dry', path: 'hand-feet' },
    },
    // Protective earth: the floor, the person's feet and the earth bar.
    {
      id: 'W6',
      type: 'wire',
      points: [
        [2, 10],
        [2, 18],
        [54, 18],
        [54, 16],
      ],
    },
  ],
  probes: [
    { id: 'IDJ', kind: 'current', element: 'DJ', label: 'Corrente no disjuntor' },
    { id: 'IP', kind: 'current', element: 'P', label: 'Corrente pela pessoa' },
    { id: 'VT', kind: 'voltage', plus: 'BASE.a', minus: 'BASE.b', label: 'Tensão nas tomadas' },
  ],
  goals: [
    {
      id: 'sobrecarga',
      description:
        'Ligue o aquecedor e o forno juntos: o disjuntor desarma por sobrecarga depois de alguns segundos',
      check: { readout: 'DJ.tripped', op: '==', value: true },
      at: 30,
      solution: { 'SAQ.closed': true, 'SFO.closed': true },
    },
    {
      id: 'curto',
      description: 'Feche o curto-circuito: o disjuntor desarma na hora',
      check: { readout: 'DJ.tripped', op: '==', value: true },
      at: 0.05,
      solution: { 'SCC.closed': true },
    },
    {
      id: 'fuga',
      description: 'Faça a pessoa encostar na fase: quem desarma é o DR',
      check: { readout: 'DR.tripped', op: '==', value: true },
      at: 0.05,
      solution: { 'SP.closed': true },
    },
    {
      id: 'curva-b',
      description: 'Com a curva B, a partida do motor derruba o disjuntor',
      check: { readout: 'DJ.tripped', op: '==', value: true },
      at: 0.05,
      solution: { 'DJ.curve': 'B', 'BM.pressed': true },
    },
  ],
});
