import { defineCircuit } from '../../engine';

/**
 * 04.5: the circuit of ./pico-bobina.circuit.ts from the instant the button
 * opens, twice: without and with the freewheeling diode. Each coil starts
 * with the 30 mA it had (and its winding capacitance with the 12 V it had),
 * so the static chart of the lesson shows the first fractions of a
 * millisecond, and the goals check the peak the text quotes.
 */
export default defineCircuit({
  id: 'm04/pico-bobina-abertura',
  title: 'O instante em que o contato abre',
  description:
    'Duas cópias do circuito da bobina do relé, logo depois de o botão abrir, com a bobina ainda conduzindo 30 mA. À esquerda, sem diodo: a tensão entre os contatos sobe até cerca de 370 V em 20 µs e oscila, diminuindo aos poucos. À direita, com o diodo de roda livre: a tensão entre os contatos para em cerca de 12,7 V, a tensão da fonte mais a queda do diodo.',
  analysis: { kind: 'transient', dt: 5e-7, tStop: 4e-4, speed: 0.0005 },
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
      label: 'Botão solto',
    },
    {
      id: 'L1',
      type: 'inductor',
      a: [10, 6],
      b: [10, 20],
      label: 'Bobina',
      params: { inductance: 0.15, resistance: 400, ic: 0.03 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [10, 6],
        [18, 6],
      ],
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [18, 6],
      b: [18, 20],
      label: '1 nF',
      params: { capacitance: 1e-9, voltage: 10000, ic: 12 },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [18, 20],
        [10, 20],
        [0, 20],
      ],
    },
    { id: 'G1', type: 'ground', at: [0, 20] },
    {
      id: 'V2',
      type: 'dc-voltage',
      a: [30, 0],
      b: [30, 20],
      label: 'Fonte 12 V',
      params: { voltage: 12 },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [30, 0],
        [40, 0],
      ],
    },
    {
      id: 'S2',
      type: 'push-button',
      a: [40, 0],
      b: [40, 6],
      label: 'Botão solto',
    },
    {
      id: 'L2',
      type: 'inductor',
      a: [40, 6],
      b: [40, 20],
      label: 'Bobina',
      params: { inductance: 0.15, resistance: 400, ic: 0.03 },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [40, 6],
        [48, 6],
        [56, 6],
      ],
    },
    {
      id: 'C2',
      type: 'capacitor',
      a: [48, 6],
      b: [48, 20],
      label: '1 nF',
      params: { capacitance: 1e-9, voltage: 10000, ic: 12 },
    },
    {
      id: 'D2',
      type: 'diode',
      a: [56, 20],
      b: [56, 6],
      label: 'Diodo',
      params: { model: 'rectifier' },
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [56, 20],
        [48, 20],
        [40, 20],
        [30, 20],
      ],
    },
    { id: 'G2', type: 'ground', at: [30, 20] },
  ],
  probes: [
    { id: 'VA', kind: 'voltage', plus: 'S1.a', minus: 'S1.b', label: 'Contato, sem diodo' },
    { id: 'VB', kind: 'voltage', plus: 'S2.a', minus: 'S2.b', label: 'Contato, com diodo' },
  ],
  goals: [
    {
      id: 'pico-sem-diodo',
      description: 'Sem o diodo, 20 µs depois de abrir, o contato tem uns 370 V.',
      check: { readout: 'VA', op: 'between', value: [350, 375] },
      at: 2e-5,
    },
    {
      id: 'pico-com-diodo',
      description: 'Com o diodo, o contato não passa de uns 12,7 V.',
      check: { readout: 'VB', op: 'between', value: [12.4, 12.9] },
      at: 2e-5,
    },
    {
      id: 'corrente-no-diodo',
      description: 'Com o diodo, a corrente da bobina continua circulando por ele.',
      check: { readout: 'L2.current', op: 'between', value: [0.028, 0.0301] },
      at: 2e-5,
    },
    {
      id: 'corrente-cai',
      description: 'Com o diodo, a corrente da bobina cai de 30 mA para uns 9 mA em 0,4 ms.',
      check: { readout: 'L2.current', op: 'between', value: [0.0085, 0.0098] },
      at: 4e-4,
    },
  ],
});
