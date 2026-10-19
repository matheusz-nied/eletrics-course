import { defineCircuit } from '../../engine';
import type { ParamValue } from '../../engine/contract';

/**
 * 07.8: a 220 V, 7.500 W electric shower on its own circuit. The breaker of
 * the circuit, the pressure switch (diaphragm) that only closes with the
 * water flowing, and the summer/winter switch choosing how much of the
 * heating wire the current crosses. Winter: the first stretch only,
 * 220²/7.500 = 6,45 Ω; summer: the whole wire, twice that (3.750 W).
 * Quasi-static analysis: the mains is solved as a 60 Hz phasor every 50 ms,
 * so the breaker's bimetal can be followed for minutes. The values the
 * lesson quotes are checked in ./chuveiro.test.ts.
 */

const VOLTAGE = 220;
/** Typical shower: 7.500 W in winter, half of it in summer (the tap in the middle). */
export const WINTER_W = 7500;
export const STRETCH_OHMS = VOLTAGE ** 2 / WINTER_W;
/** The heating wire is cooled by the water: no damage model while it is under water. */
export const UNDER_WATER_W = 100_000;
/**
 * A bare wire in air cannot get rid of kilowatts: with this rating the
 * engine burns it in about two seconds, like a stretch of resistance left
 * in an air bubble.
 */
export const IN_AIR_W = 20;
/** A broken stretch: the wire is open. */
export const BROKEN_OHMS = 1e8;

export const BREAKERS: { value: ParamValue; label: string }[] = [
  { value: 40, label: '40 A (para 7.500 W)' },
  { value: 25, label: '25 A (antigo, de 4.400 W)' },
];

export default defineCircuit({
  id: 'm07/chuveiro',
  title: 'O chuveiro de 7.500 W no circuito dele',
  description:
    'A rede de 220 V alimenta o chuveiro por um disjuntor de 40 A. Dentro do chuveiro, o diafragma (a chave de pressão) só fecha quando a água passa. A resistência tem dois trechos iguais de 6,45 Ω: na posição inverno a corrente passa só pelo primeiro, puxa cerca de 34 A e o chuveiro dá cerca de 7.500 W; na posição verão passa pelos dois, cerca de 17 A e 3.750 W. Dá para trocar o disjuntor por um de 25 A, de um circuito antigo, deixar ar na câmara em volta da resistência ou romper o segundo trecho.',
  analysis: { kind: 'quasi-static', frequency: 60, dtMech: 0.05 },
  elements: [
    {
      id: 'REDE',
      type: 'mains',
      at: [0, 10],
      label: 'Rede 220 V',
      // A strong supply and short wires: the shower gets almost all of the 220 V.
      params: { voltage: VOLTAGE, impedance: 0.001 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [2, 8],
        [4, 8],
        [4, 0],
        [6, 0],
      ],
    },
    {
      id: 'Q1',
      type: 'breaker',
      a: [6, 0],
      b: [12, 0],
      label: 'Disjuntor',
      params: { rating: 40, curve: 'C', closed: true },
      control: [
        { param: 'closed', label: 'Disjuntor do chuveiro ligado', kind: 'toggle' },
        { param: 'rating', label: 'Disjuntor do circuito', kind: 'select', options: BREAKERS },
      ],
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 0],
        [14, 0],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [14, 0],
      b: [20, 0],
      label: 'Diafragma',
      params: { closed: false },
      control: {
        param: 'closed',
        label: 'Água aberta (o diafragma fecha os contatos)',
        kind: 'toggle',
      },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [20, 0],
        [22, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [22, 0],
      b: [30, 0],
      label: 'Trecho 1',
      params: { resistance: STRETCH_OHMS, watts: UNDER_WATER_W, tolerance: 0 },
      control: {
        param: 'watts',
        label: 'Em volta da resistência',
        kind: 'select',
        options: [
          { value: UNDER_WATER_W, label: 'Câmara cheia de água' },
          { value: IN_AIR_W, label: 'Ar na câmara (a água ainda não chegou)' },
        ],
      },
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [30, 0],
      b: [38, 0],
      label: 'Trecho 2',
      params: { resistance: STRETCH_OHMS, watts: UNDER_WATER_W, tolerance: 0 },
      control: {
        param: 'resistance',
        label: 'Trecho 2 da resistência',
        kind: 'select',
        options: [
          { value: STRETCH_OHMS, label: 'Inteiro' },
          { value: BROKEN_OHMS, label: 'Rompido' },
        ],
      },
    },
    {
      // The tap skips the second stretch: the winter path.
      id: 'W4',
      type: 'wire',
      points: [
        [30, 0],
        [30, -6],
        [46, -6],
        [46, 7],
      ],
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [38, 0],
        [42, 0],
        [42, 7],
      ],
    },
    {
      // At rest the common touches NF (summer, whole wire); actuated, NA (winter).
      id: 'S2',
      type: 'switch-spdt',
      at: [44, 10],
      rot: 270,
      label: 'Verão/Inverno',
      params: { actuated: false },
      control: { param: 'actuated', label: 'Posição inverno', kind: 'toggle' },
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [44, 13],
        [44, 18],
        [4, 18],
        [4, 10],
        [2, 10],
      ],
    },
  ],
  probes: [
    { id: 'V', kind: 'voltage', plus: 'R1.a', minus: 'S2.com', label: 'Tensão no chuveiro' },
    { id: 'I', kind: 'current', element: 'Q1', label: 'Corrente no disjuntor' },
    { id: 'P', kind: 'power', element: 'REDE', label: 'Potência do chuveiro' },
  ],
  // The quasi-static analysis is not run by the automatic goal check:
  // ./chuveiro.test.ts runs every goal with its solution.
  goals: [
    {
      id: 'verao',
      description: 'Abra a água na posição verão: cerca de 17 A e 3.750 W.',
      check: { readout: 'REDE.power', op: 'between', value: [3730, 3760] },
      solution: { 'S1.closed': true },
    },
    {
      id: 'inverno',
      description: 'Passe para o inverno: cerca de 34 A e 7.500 W.',
      check: { readout: 'REDE.power', op: 'between', value: [7450, 7510] },
      solution: { 'S1.closed': true, 'S2.actuated': true },
    },
    {
      id: 'disjuntor-antigo',
      description:
        'Ponha o disjuntor de 25 A e tome um banho de inverno: ele desarma por sobrecarga em uns 2 minutos e meio.',
      check: { readout: 'Q1.tripped', op: '==', value: true },
      solution: { 'Q1.rating': 25, 'S1.closed': true, 'S2.actuated': true },
      at: 180,
    },
    {
      id: 'so-inverno',
      description: 'Rompa o trecho 2: no verão o chuveiro não esquenta nada.',
      // The whole 220 V across the open stretch: water on, summer, and no current.
      check: { readout: 'R2.voltage', op: '>', value: 200 },
      solution: { 'R2.resistance': BROKEN_OHMS, 'S1.closed': true },
    },
    {
      id: 'a-seco',
      description: 'Ligue com ar na câmara: o trecho fora da água rompe em segundos.',
      check: { readout: 'R1.burned', op: '==', value: true },
      solution: { 'R1.watts': IN_AIR_W, 'S1.closed': true, 'S2.actuated': true },
      at: 10,
    },
  ],
});
