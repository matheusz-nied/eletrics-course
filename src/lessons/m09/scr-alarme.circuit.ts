import { defineCircuit } from '../../engine';

/**
 * 9.9: the SCR latch of a simple alarm. A pulse on the gate fires the SCR
 * and the siren keeps sounding after the sensor opens again, until the
 * reset button (NC) cuts the current. The sequence the lesson describes is
 * checked in ./tiristores.test.ts.
 */
export default defineCircuit({
  id: 'm09/scr-alarme',
  title: 'Alarme com SCR',
  description:
    'Uma bateria de 12 V alimenta uma sirene (um buzzer de 12 V) ligada em série com um SCR e com o botão de rearme, que é normalmente fechado. O sensor da porta é um contato normalmente aberto que leva corrente ao gatilho do SCR por um resistor de 1 kΩ. Em repouso, o SCR bloqueia e a sirene fica muda. Um toque no sensor dispara o SCR, e a sirene continua tocando mesmo depois que o sensor abre de novo. Só o botão de rearme, que interrompe a corrente da sirene, desliga o SCR.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'B1',
      type: 'battery',
      a: [0, 0],
      b: [0, 18],
      label: 'Bateria 12 V',
      params: { voltage: 12, resistance: 0.05 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [5, 0],
      ],
    },
    {
      id: 'S2',
      type: 'push-button',
      a: [5, 0],
      b: [11, 0],
      label: 'Rearme (NF)',
      params: { normallyClosed: true },
      control: { param: 'pressed', label: 'Rearme', kind: 'momentary' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [11, 0],
        [15, 0],
        [30, 0],
      ],
    },
    {
      id: 'SR1',
      type: 'buzzer',
      a: [30, 0],
      b: [30, 8],
      label: 'Sirene',
      params: { voltage: 12, current: 0.03 },
    },
    {
      id: 'X1',
      type: 'scr',
      at: [30, 10],
      rot: 90,
      label: 'SCR',
    },
    {
      id: 'S1',
      type: 'push-button',
      a: [15, 0],
      b: [15, 5],
      label: 'Sensor da porta',
      control: { param: 'pressed', label: 'Sensor da porta', kind: 'momentary' },
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [15, 5],
      b: [15, 11],
      label: 'R1',
      params: { resistance: 1000 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [15, 11],
        [28, 11],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [30, 12],
        [30, 18],
        [0, 18],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 18] },
  ],
  probes: [
    { id: 'IS', kind: 'current', element: 'SR1', label: 'Corrente na sirene' },
    {
      id: 'VAK',
      kind: 'voltage',
      plus: 'X1.a',
      minus: 'X1.k',
      label: 'Tensão no SCR (ânodo − cátodo)',
    },
    { id: 'IG', kind: 'current', element: 'R1', label: 'Corrente no gatilho' },
  ],
  goals: [
    {
      id: 'dispara',
      description: 'Aperte o sensor da porta: a corrente no gatilho dispara o SCR e a sirene toca.',
      check: { readout: 'SR1.sounding', op: '==', value: true },
      solution: { 'S1.pressed': true },
    },
  ],
});
