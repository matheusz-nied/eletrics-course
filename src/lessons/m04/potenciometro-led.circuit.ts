import { defineCircuit } from '../../engine';

/**
 * 04.2: a potentiometer used as a rheostat (terminal A and the wiper) sets
 * the brightness of an LED. The fixed 470 Ω resistor keeps the current safe
 * at the end of the track; the switch S1 bypasses it, and the LED burns.
 */
export default defineCircuit({
  id: 'm04/potenciometro-led',
  title: 'Potenciômetro controlando um LED',
  description:
    'Uma bateria de 9 V acende um LED vermelho através de um resistor fixo de 470 Ω e de um potenciômetro de 10 kΩ ligado como reostato: só o terminal A e o cursor são usados, e o terminal B fica ligado ao cursor. Com o cursor encostado em A, o potenciômetro não tem resistência e só o resistor fixo limita a corrente, em cerca de 15 mA. Com o cursor encostado em B, a corrente cai para menos de 1 mA. A chave S1, em paralelo com o resistor fixo, tira o resistor do circuito: com o cursor em A, o LED queima.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'battery',
      a: [0, 0],
      b: [0, 16],
      label: 'Bateria 9 V',
      params: { voltage: 9, resistance: 0.5 },
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
      id: 'R1',
      type: 'resistor',
      a: [6, 0],
      b: [14, 0],
      label: 'Proteção',
      params: { resistance: 470 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [6, 0],
        [6, -7],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [6, -7],
      b: [14, -7],
      label: 'Sem proteção',
      control: { param: 'closed', label: 'S1: tirar o resistor de proteção', kind: 'toggle' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [14, -7],
        [14, 0],
        [18, 0],
      ],
    },
    {
      id: 'P1',
      type: 'potentiometer',
      at: [22, 0],
      params: { resistance: 10000, position: 0.5, watts: 0.5 },
      control: {
        param: 'position',
        label: 'Cursor de P1 (0 = encostado em A, 1 = em B)',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
      },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [22, -3],
        [30, -3],
        [30, 0],
      ],
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [26, 0],
        [30, 0],
        [36, 0],
      ],
    },
    {
      id: 'D1',
      type: 'led',
      a: [36, 0],
      b: [36, 16],
      params: { color: 'red', imax: 0.02 },
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [36, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
  ],
  probes: [{ id: 'ID', kind: 'current', element: 'D1', label: 'Corrente no LED' }],
  goals: [
    {
      id: 'meio',
      description: 'Com o cursor no meio, o LED recebe só cerca de 1,3 mA: brilho fraco.',
      check: { readout: 'ID', op: 'between', value: [0.0012, 0.0014] },
    },
    {
      id: 'em-a',
      description:
        'Leve o cursor até A (0): a corrente sobe para cerca de 15 mA, sem passar do limite.',
      check: { readout: 'ID', op: 'between', value: [0.0145, 0.0155] },
      solution: { 'P1.position': 0 },
    },
    {
      id: 'em-b',
      description: 'Leve o cursor até B (1): a corrente cai para menos de 1 mA.',
      check: { readout: 'ID', op: '<', value: 0.001 },
      solution: { 'P1.position': 1 },
    },
    {
      id: 'queima',
      description: 'Feche S1 e leve o cursor até A: sem o resistor de proteção, o LED queima.',
      check: { readout: 'D1.burned', op: '==', value: true },
      solution: { 'S1.closed': true, 'P1.position': 0 },
    },
  ],
});
