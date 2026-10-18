import { defineCircuit } from '../../engine';

/**
 * 04.5: a relay coil switched by a push-button. Releasing the button opens the
 * contact while the coil carries 30 mA: the current has nowhere to go and the
 * voltage across the contact jumps to hundreds of volts. The 1 nF capacitor
 * stands for the capacitance of the winding and the wiring, which is what
 * limits the peak in this model. A freewheeling diode clamps it.
 * ./pico-bobina-abertura.circuit.ts runs the same circuit from the instant
 * the contact opens, for the static chart and the checked peak values.
 */
export default defineCircuit({
  id: 'm04/pico-bobina',
  title: 'Pico de tensão ao desligar uma bobina',
  description:
    'Uma fonte de 12 V alimenta a bobina de um relé (0,15 H, 400 Ω) através de um botão. Com o botão apertado, passam 30 mA pela bobina. Ao soltar o botão, a corrente da bobina não pode parar de uma vez: sem o diodo, a tensão entre os contatos do botão salta para cerca de 350 V e oscila até sumir. A capacitância do enrolamento (1 nF) é o que limita o pico neste modelo. Com o diodo de roda livre ligado em paralelo com a bobina, a corrente continua circulando pelo diodo e a tensão no contato não passa de cerca de 12,7 V.',
  analysis: { kind: 'transient', dt: 4e-6, speed: 0.01 },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 20],
      label: 'Fonte 12 V',
      params: { voltage: 12 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [10, 0],
      ],
    },
    {
      id: 'S1',
      type: 'push-button',
      a: [10, 0],
      b: [10, 6],
      label: 'Botão',
      control: { param: 'pressed', label: 'Apertar o botão (ligar a bobina)', kind: 'momentary' },
    },
    {
      id: 'L1',
      type: 'inductor',
      a: [10, 6],
      b: [10, 20],
      label: 'Bobina do relé',
      params: { inductance: 0.15, resistance: 400 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [10, 6],
        [20, 6],
        [30, 6],
      ],
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [20, 6],
      b: [20, 20],
      label: 'Capacitância do enrolamento',
      params: { capacitance: 1e-9, voltage: 10000 },
    },
    {
      id: 'S2',
      type: 'switch',
      a: [30, 6],
      b: [30, 12],
      label: 'Liga o diodo',
      params: { closed: false },
      control: { param: 'closed', label: 'Diodo de roda livre ligado', kind: 'toggle' },
    },
    {
      id: 'D1',
      type: 'diode',
      a: [30, 20],
      b: [30, 12],
      label: 'Diodo',
      params: { model: 'rectifier' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [30, 20],
        [20, 20],
        [10, 20],
        [0, 20],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 20] },
  ],
  probes: [
    { id: 'VS', kind: 'voltage', plus: 'S1.a', minus: 'S1.b', label: 'Tensão entre os contatos' },
    { id: 'IL', kind: 'current', element: 'L1', label: 'Corrente na bobina' },
  ],
  goals: [
    {
      id: 'ligada',
      description: 'Segure o botão: a bobina passa a conduzir 30 mA.',
      check: { readout: 'IL', op: 'between', value: [0.0295, 0.0301] },
      at: 0.005,
      solution: { 'S1.pressed': true },
    },
    {
      id: 'contato-fechado',
      description: 'Com o botão apertado, o contato fechado não tem tensão entre os terminais.',
      check: { readout: 'VS', op: '<', value: 0.01 },
      at: 0.005,
      solution: { 'S1.pressed': true },
    },
  ],
});
