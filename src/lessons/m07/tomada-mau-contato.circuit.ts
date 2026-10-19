import { defineCircuit } from '../../engine';

/** Contact resistances of the outlet (Ω): illustrative values. */
export const CONTACT = { bom: 0.005, frouxo: 0.1, carbonizado: 0.5 };

/**
 * 07.5: the microwave outlet that melted. A 1.400 W microwave (a resistor
 * of 11 Ω on 127 V, a simplification) is plugged in through the outlet
 * contacts, drawn as a small resistance in series. The breaker sees the same
 * current with a good or a loose contact; the contact turns I²·R into heat
 * in a spot the size of a grain of rice. Checked in ./tomada-mau-contato.test.ts.
 */
export default defineCircuit({
  id: 'm07/tomada-mau-contato',
  title: 'O mau contato na tomada do micro-ondas',
  description:
    'A rede de 127 V alimenta, por um disjuntor de 20 A, uma tomada onde está ligado um micro-ondas de cerca de 1.400 W, representado por um resistor de 11 Ω. Os contatos da tomada aparecem como uma pequena resistência em série, que pode ser escolhida: contato bom (0,005 Ω), frouxo (0,1 Ω) ou carbonizado (0,5 Ω), valores ilustrativos. A corrente fica entre 10,8 A e 11,2 A nos três casos e o disjuntor não desarma. O que muda é o calor no contato: menos de 1 W com o contato bom, cerca de 12 W com o frouxo e quase 60 W com o carbonizado.',
  analysis: { kind: 'quasi-static', frequency: 60, dtMech: 0.01 },
  elements: [
    { id: 'R', type: 'mains', at: [0, 12], label: 'Rede 127 V', params: { voltage: 127 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [2, 10],
        [4, 10],
        [4, 4],
        [6, 4],
      ],
    },
    {
      id: 'DJ',
      type: 'breaker',
      a: [6, 4],
      b: [14, 4],
      label: 'Disjuntor 20 A',
      params: { rating: 20, curve: 'C' },
    },
    {
      id: 'RC',
      type: 'resistor',
      a: [18, 4],
      b: [26, 4],
      label: 'Contato da tomada',
      params: { resistance: CONTACT.bom, watts: 200 },
      control: {
        param: 'resistance',
        label: 'Contato da tomada',
        kind: 'select',
        options: [
          { value: CONTACT.bom, label: 'Bom, bem apertado (0,005 Ω)' },
          { value: CONTACT.frouxo, label: 'Frouxo (0,1 Ω)' },
          { value: CONTACT.carbonizado, label: 'Carbonizado (0,5 Ω)' },
        ],
      },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [14, 4],
        [18, 4],
      ],
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [26, 4],
        [32, 4],
      ],
    },
    {
      id: 'M1',
      type: 'resistor',
      a: [32, 4],
      b: [32, 12],
      label: 'Micro-ondas 1.400 W',
      params: { resistance: 11, watts: 2000 },
    },
    {
      id: 'WN',
      type: 'wire',
      points: [
        [2, 12],
        [32, 12],
      ],
    },
  ],
  probes: [
    { id: 'I', kind: 'current', element: 'M1', label: 'Corrente do micro-ondas' },
    { id: 'PC', kind: 'power', element: 'RC', label: 'Calor no contato' },
    { id: 'PM', kind: 'power', element: 'M1', label: 'Potência do micro-ondas' },
  ],
  goals: [
    {
      id: 'contato-bom',
      description:
        'Com o contato bom, o micro-ondas puxa perto de 11 A e o contato aquece menos de 1 W.',
      check: { readout: 'RC.power', op: '<', value: 1 },
    },
    {
      id: 'contato-frouxo',
      description: 'Escolha o contato frouxo: cerca de 12 W viram calor num ponto minúsculo.',
      check: { readout: 'RC.power', op: 'between', value: [11.5, 13] },
      solution: { 'RC.resistance': CONTACT.frouxo },
    },
    {
      id: 'disjuntor-nao-ve',
      description: 'Mesmo com o contato carbonizado, o disjuntor de 20 A continua ligado.',
      check: { readout: 'DJ.closed', op: '==', value: true },
      solution: { 'RC.resistance': CONTACT.carbonizado },
    },
  ],
});
