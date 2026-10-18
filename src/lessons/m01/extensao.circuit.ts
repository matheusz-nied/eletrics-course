import { defineCircuit } from '../../engine';
import { cordResistance } from './extensao';

/**
 * Lesson 1.4 (Ohm's law), "A extensão que esquenta": a 1.270 W heater
 * (12,7 Ω at 127 V) on a 20 m extension cord. Each wire resistor stands for
 * both conductors of the cord (40 m of copper, ρ = 1,72×10⁻⁸ Ω·m):
 * 0,75 mm² → 0,917 Ω, 2,5 mm² → 0,275 Ω. The mains is modelled as its
 * effective value (127 V DC), which gives the same result for resistive loads.
 */
const wire = (mm2: number) => cordResistance(mm2, 20);

export default defineCircuit({
  id: 'm01/extensao',
  title: 'A extensão que esquenta',
  description:
    'Um aquecedor de 1.270 W, que em 127 V tem 12,7 Ω, ligado à tomada por uma extensão de 20 m. A chave escolhe a extensão: fina, de 0,75 mm², com 0,92 Ω nos dois fios, ou grossa, de 2,5 mm², com 0,28 Ω. Com a fina, os fios ficam com cerca de 8,6 V e transformam quase 80 W em calor; com a grossa, cerca de 2,7 V e 26 W.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 4],
      b: [0, 14],
      label: 'Tomada 127 V',
      params: { voltage: 127 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 4],
        [0, 0],
        [6, 0],
      ],
    },
    {
      id: 'S1',
      type: 'switch-spdt',
      at: [9, 0],
      label: 'Extensão',
      control: { param: 'actuated', label: 'Trocar pela extensão de 2,5 mm²', kind: 'toggle' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, -2],
        [12, -5],
        [16, -5],
      ],
    },
    {
      id: 'RF',
      type: 'resistor',
      a: [16, -5],
      b: [26, -5],
      label: 'Fios 0,75 mm²',
      params: { resistance: wire(0.75), watts: 1000 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [26, -5],
        [30, -5],
        [30, 0],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [12, 2],
        [12, 5],
        [16, 5],
      ],
    },
    {
      id: 'RG',
      type: 'resistor',
      a: [16, 5],
      b: [26, 5],
      label: 'Fios 2,5 mm²',
      params: { resistance: wire(2.5), watts: 1000 },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [26, 5],
        [30, 5],
        [30, 0],
      ],
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [30, 0],
        [36, 0],
      ],
    },
    {
      id: 'RA',
      type: 'resistor',
      a: [36, 0],
      b: [36, 14],
      label: 'Aquecedor',
      params: { resistance: 12.7, watts: 5000 },
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [36, 14],
        [0, 14],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 14] },
  ],
  probes: [
    { id: 'corrente', kind: 'current', element: 'RA', label: 'Corrente no aquecedor' },
    { id: 'aquecedor', kind: 'voltage', plus: 'RA.a', minus: 'RA.b', label: 'Tensão no aquecedor' },
    { id: 'fina', kind: 'power', element: 'RF', label: 'Calor nos fios de 0,75 mm²' },
    { id: 'grossa', kind: 'power', element: 'RG', label: 'Calor nos fios de 2,5 mm²' },
  ],
  goals: [
    {
      id: 'fina',
      description: 'Com a extensão fina, os fios transformam quase 80 W em calor',
      check: { readout: 'RF.power', op: 'between', value: [79, 81] },
    },
    {
      id: 'grossa',
      description:
        'Troque pela extensão de 2,5 mm² e veja o calor nos fios cair para cerca de 26 W',
      check: { readout: 'RG.power', op: 'between', value: [25.8, 26.8] },
      solution: { 'S1.actuated': true },
    },
  ],
});
