import { defineCircuit } from '../../engine';
import { BODY, EXIT, HAND, VOLTAGES } from './choque-dados';

// Teaching model: the body is not a resistor that burns, so the power rating is high.
const NO_DAMAGE = 10_000;

/**
 * Lesson 0.2 (safety): the body as three resistances in series (hand contact,
 * inside the body, way out through the feet or the other hand) on a touch
 * voltage. The outlet is AC; for resistances, a DC source with the RMS value
 * gives the same current (explained in the lesson and in module 6).
 */
export default defineCircuit({
  id: 'm00/choque',
  title: 'O corpo humano no circuito',
  description:
    'Uma tensão de toque de 127 V aplicada a uma pessoa: a corrente passa pelo contato da mão, pelo interior do corpo e sai pelos pés até o chão. Escolha a tensão, a condição da mão e por onde a corrente sai, e veja a corrente que atravessa o corpo.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 20],
      label: 'Tensão de toque',
      params: { voltage: 127 },
      control: { param: 'voltage', label: 'Tensão de toque', kind: 'select', options: VOLTAGES },
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
      id: 'R1',
      type: 'resistor',
      a: [10, 0],
      b: [20, 0],
      label: 'Contato da mão',
      params: { resistance: HAND[0]!.value, watts: NO_DAMAGE },
      control: { param: 'resistance', label: 'Mão que encosta', kind: 'select', options: HAND },
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [20, 0],
      b: [30, 0],
      label: 'Interior do corpo',
      params: { resistance: BODY, watts: NO_DAMAGE },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [30, 0],
        [40, 0],
      ],
    },
    {
      id: 'R3',
      type: 'resistor',
      a: [40, 0],
      b: [40, 20],
      label: 'Saída da corrente',
      params: { resistance: EXIT[0]!.value, watts: NO_DAMAGE },
      control: {
        param: 'resistance',
        label: 'Por onde a corrente sai',
        kind: 'select',
        options: EXIT.map(({ value, label }) => ({ value, label })),
      },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [40, 20],
        [0, 20],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 20] },
  ],
  probes: [{ id: 'corpo', kind: 'current', element: 'R2', label: 'Corrente pelo corpo' }],
  goals: [
    {
      id: 'mao-seca',
      description: 'Mão seca, descalço no piso molhado, 127 V: cerca de 1,3 mA',
      check: { readout: 'R2.current', op: 'between', value: [0.00124, 0.00128] },
    },
    {
      id: 'mao-molhada',
      description: 'Molhe a mão: a corrente passa de 75 mA',
      check: { readout: 'R2.current', op: '>', value: 0.075 },
      solution: { 'R1.resistance': 1_000 },
    },
    {
      id: 'chinelo',
      description:
        'Mão molhada, mas de chinelo de borracha seco: a corrente cai para perto de 0,1 mA',
      check: { readout: 'R2.current', op: 'between', value: [0.00012, 0.00013] },
      solution: { 'R1.resistance': 1_000, 'R3.resistance': 1_000_000 },
    },
    {
      id: '220',
      description: 'Mão molhada, descalço no piso molhado, 220 V: mais de 130 mA',
      check: { readout: 'R2.current', op: '>', value: 0.13 },
      solution: { 'R1.resistance': 1_000, 'V1.voltage': 220 },
    },
  ],
});
