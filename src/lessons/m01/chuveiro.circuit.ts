import { defineCircuit } from '../../engine';

/**
 * Lesson 1.5 (power and energy): a 220 V electric shower. The heating wire
 * has a tap: summer uses the whole wire (17,6 Ω, 2.750 W), winter only the
 * first stretch (8,8 Ω, 5.500 W). The pressure switch closes only while the
 * water flows. The supply is AC; for a resistive load a DC source with the
 * RMS value gives the same power (explained in the lesson).
 */

// The heating wire is cooled by the water: no damage model here.
const NO_DAMAGE = 100_000;

export default defineCircuit({
  id: 'm01/chuveiro',
  title: 'O chuveiro elétrico: verão e inverno',
  description:
    'Um chuveiro de 220 V. A chave de pressão só fecha com a água passando. A resistência tem três terminais: na posição verão a corrente atravessa o fio inteiro, de 17,6 Ω; na posição inverno ela passa só pelo primeiro trecho, de 8,8 Ω. Abra a água, troque a posição e compare a corrente e a potência.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 20],
      label: 'Rede 220 V',
      params: { voltage: 220 },
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
      label: 'Chave de pressão',
      params: { closed: false },
      control: { param: 'closed', label: 'Abrir a água', kind: 'toggle' },
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [14, 0],
      b: [24, 0],
      label: 'Trecho 1',
      params: { resistance: 8.8, watts: NO_DAMAGE, tolerance: 0 },
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [24, 0],
      b: [34, 0],
      label: 'Trecho 2',
      params: { resistance: 8.8, watts: NO_DAMAGE, tolerance: 0 },
    },
    {
      // The tap skips the second stretch: the winter path.
      id: 'W2',
      type: 'wire',
      points: [
        [24, 0],
        [24, -6],
        [40, -6],
        [40, 7],
      ],
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [34, 0],
        [36, 0],
        [36, 7],
      ],
    },
    {
      // At rest the common touches NF (summer, whole wire); actuated, NA (winter).
      id: 'S2',
      type: 'switch-spdt',
      at: [38, 10],
      rot: 270,
      label: 'Verão/Inverno',
      params: { actuated: false },
      control: { param: 'actuated', label: 'Posição inverno', kind: 'toggle' },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [38, 13],
        [38, 20],
        [0, 20],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 20] },
  ],
  probes: [
    { id: 'tensao', kind: 'voltage', plus: 'R1.a', minus: 'GND', label: 'Tensão no chuveiro' },
    { id: 'corrente', kind: 'current', element: 'R1', label: 'Corrente do chuveiro' },
  ],
  goals: [
    {
      id: 'verao',
      description: 'Água aberta na posição verão: 12,5 A e 2.750 W',
      check: { readout: 'V1.power', op: 'between', value: [2745, 2755] },
      solution: { 'S1.closed': true },
    },
    {
      id: 'inverno',
      description: 'Água aberta na posição inverno: 25 A e 5.500 W',
      check: { readout: 'V1.power', op: 'between', value: [5490, 5510] },
      solution: { 'S1.closed': true, 'S2.actuated': true },
    },
  ],
});
