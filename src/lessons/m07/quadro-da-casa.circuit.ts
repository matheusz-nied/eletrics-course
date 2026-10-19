import { defineCircuit } from '../../engine';

/** Supply of the example house: 220 V between phase and neutral (typical of 220/380 V regions). */
export const SUPPLY = 220;

/** Resistance that draws `watts` at the supply voltage (Ω). */
const load = (watts: number) => Math.round((SUPPLY ** 2 / watts) * 1000) / 1000;

/** Equivalent resistive loads of the house (typical ratings). */
export const LOADS = {
  /** Each of the two lamps of the lighting circuit (W). */
  lamp: 100,
  /** The appliances on the general-purpose outlets circuit (Ω). */
  tvGeladeira: load(440),
  ferroMicro: load(2640),
  tudoJunto: load(6600),
  /** Shower, winter position (Ω). */
  chuveiro: load(5500),
};

const ALL_ON = { 'S1.closed': true, 'S2.closed': true, 'S3.closed': true };

/**
 * 07.1: the distribution board of a small house. The mains (220 V, typical)
 * feeds a 63 A main breaker and the phase busbar; three circuit breakers
 * (lighting 10 A, outlets 20 A, shower 32 A) each feed their own load, and
 * every load returns by the neutral busbar. The current in the main breaker
 * is the sum of the circuits; an overload on the outlets trips only their
 * breaker; switching the main breaker off turns everything off. The values
 * the lesson quotes are checked in ./quadro-da-casa.test.ts.
 */
export default defineCircuit({
  id: 'm07/quadro-da-casa',
  title: 'O quadro de distribuição de uma casa',
  description:
    'A rede de 220 V chega ao disjuntor geral de 63 A e, dele, ao barramento de fase, que alimenta três disjuntores: iluminação (10 A) com duas lâmpadas de 100 W, tomadas de uso geral (20 A) com os aparelhos ligados nelas e o chuveiro de 5.500 W (32 A). Todos voltam pelo barramento de neutro. Com as lâmpadas, a TV e a geladeira (440 W) e o chuveiro ligados, os circuitos puxam cerca de 0,91 A, 2 A e 24,9 A, e o disjuntor geral conduz a soma, cerca de 27,8 A. Com aquecedor, ferro, micro-ondas e air fryer juntos nas tomadas (6.600 W, 30 A), o disjuntor de 20 A das tomadas desarma depois de pouco mais de um minuto, e as luzes e o chuveiro continuam ligados. Desligando o disjuntor geral, tudo apaga.',
  analysis: { kind: 'quasi-static', frequency: 60, dtMech: 0.02, speed: 10 },
  elements: [
    {
      id: 'REDE',
      type: 'mains',
      at: [0, 10],
      label: 'Rede 220 V',
      params: { voltage: SUPPLY, impedance: 0.01 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [2, 8],
        [6, 8],
      ],
    },
    {
      id: 'DJG',
      type: 'breaker',
      a: [6, 8],
      b: [14, 8],
      label: 'Geral',
      params: { rating: 63, curve: 'C', closed: true },
      control: { param: 'closed', label: 'Disjuntor geral (63 A)', kind: 'toggle' },
    },
    {
      id: 'WF',
      type: 'wire',
      points: [
        [14, 8],
        [20, 8],
        [34, 8],
        [44, 8],
      ],
    },
    // Lighting circuit.
    {
      id: 'DJ1',
      type: 'breaker',
      a: [20, 8],
      b: [20, 16],
      label: 'Iluminação',
      params: { rating: 10, curve: 'C', closed: true },
      control: { param: 'closed', label: 'Disjuntor da iluminação (10 A)', kind: 'toggle' },
    },
    {
      id: 'S1',
      type: 'switch',
      a: [20, 16],
      b: [20, 22],
      label: 'Interruptor',
      params: { closed: false },
      control: { param: 'closed', label: 'Luzes acesas', kind: 'toggle' },
    },
    {
      id: 'L1',
      type: 'lamp',
      a: [20, 22],
      b: [20, 30],
      label: 'Sala',
      params: { voltage: SUPPLY, power: LOADS.lamp },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [20, 22],
        [26, 22],
      ],
    },
    {
      id: 'L2',
      type: 'lamp',
      a: [26, 22],
      b: [26, 30],
      label: 'Quarto',
      params: { voltage: SUPPLY, power: LOADS.lamp },
    },
    // General-purpose outlets.
    {
      id: 'DJ2',
      type: 'breaker',
      a: [34, 8],
      b: [34, 16],
      label: 'Tomadas',
      params: { rating: 20, curve: 'C', closed: true },
      control: { param: 'closed', label: 'Disjuntor das tomadas (20 A)', kind: 'toggle' },
    },
    {
      id: 'S2',
      type: 'switch',
      a: [34, 16],
      b: [34, 22],
      label: 'Plugues',
      params: { closed: false },
      control: { param: 'closed', label: 'Aparelhos ligados nas tomadas', kind: 'toggle' },
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [34, 22],
      b: [34, 30],
      label: 'Aparelhos',
      params: { resistance: LOADS.tvGeladeira, watts: 10_000 },
      control: {
        param: 'resistance',
        label: 'O que está ligado nas tomadas',
        kind: 'select',
        options: [
          { value: LOADS.tvGeladeira, label: 'TV e geladeira (440 W)' },
          { value: LOADS.ferroMicro, label: 'Ferro e micro-ondas (2.640 W)' },
          {
            value: LOADS.tudoJunto,
            label: 'Tudo junto (6.600 W)',
          },
        ],
      },
    },
    // Shower.
    {
      id: 'DJ3',
      type: 'breaker',
      a: [44, 8],
      b: [44, 16],
      label: 'Chuveiro',
      params: { rating: 32, curve: 'C', closed: true },
      control: { param: 'closed', label: 'Disjuntor do chuveiro (32 A)', kind: 'toggle' },
    },
    {
      id: 'S3',
      type: 'switch',
      a: [44, 16],
      b: [44, 22],
      label: 'Registro',
      params: { closed: false },
      control: { param: 'closed', label: 'Chuveiro ligado (inverno)', kind: 'toggle' },
    },
    {
      id: 'R3',
      type: 'resistor',
      a: [44, 22],
      b: [44, 30],
      label: 'Chuveiro',
      params: { resistance: LOADS.chuveiro, watts: 10_000 },
    },
    // Neutral busbar back to the mains.
    {
      id: 'WN',
      type: 'wire',
      points: [
        [2, 10],
        [4, 10],
        [4, 30],
        [20, 30],
        [26, 30],
        [34, 30],
        [44, 30],
      ],
    },
  ],
  probes: [
    { id: 'IG', kind: 'current', element: 'DJG', label: 'Corrente no disjuntor geral' },
    { id: 'I1', kind: 'current', element: 'DJ1', label: 'Corrente na iluminação' },
    { id: 'I2', kind: 'current', element: 'DJ2', label: 'Corrente nas tomadas' },
    { id: 'I3', kind: 'current', element: 'DJ3', label: 'Corrente no chuveiro' },
  ],
  // Quasi-static goals are not run by lessons.test.ts: ./quadro-da-casa.test.ts checks them.
  goals: [
    {
      id: 'soma',
      description:
        'Acenda as luzes, ligue a TV e a geladeira nas tomadas e ligue o chuveiro: o disjuntor geral conduz a soma dos três circuitos, cerca de 27,8 A.',
      check: { readout: 'IG', op: 'between', value: [27.6, 28.1] },
      at: 2,
      solution: ALL_ON,
    },
    {
      id: 'sobrecarga',
      description:
        'Ligue tudo junto nas tomadas (6.600 W): o disjuntor de 20 A das tomadas desarma depois de pouco mais de um minuto.',
      check: { readout: 'DJ2.tripped', op: '==', value: true },
      at: 100,
      solution: { ...ALL_ON, 'R2.resistance': LOADS.tudoJunto },
    },
    {
      id: 'so-o-circuito',
      description:
        'Depois que o disjuntor das tomadas desarma, as luzes e o chuveiro continuam ligados: o geral fica com cerca de 25,8 A.',
      check: { readout: 'IG', op: 'between', value: [25.6, 26.1] },
      at: 100,
      solution: { ...ALL_ON, 'R2.resistance': LOADS.tudoJunto },
    },
    {
      id: 'geral',
      description: 'Desligue o disjuntor geral: tudo apaga.',
      check: { readout: 'IG', op: '<', value: 0.001 },
      at: 2,
      solution: { ...ALL_ON, 'DJG.closed': false },
    },
  ],
});
