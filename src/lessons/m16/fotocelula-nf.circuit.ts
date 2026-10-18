import { defineCircuit } from '../../engine';

/**
 * Lesson 16.5: the FOTO input of the CD-1 with an NC photocell contact, the
 * cable to it, and the J1 jumper that shorts the input on old boards.
 */
export default defineCircuit({
  id: 'm16/fotocelula-nf',
  title: 'Entrada da fotocélula com contato NF',
  description:
    'O pino FOTO do microcontrolador tem um resistor de pull-up de 10 kΩ para 5 V e vai, pelo cabo da fotocélula, até o contato NF do receptor, que fecha para o GND enquanto o feixe está livre. Com o feixe livre o pino lê 0 V. Se alguém interrompe o feixe, ou se o cabo se rompe, o contato abre e o pino lê 5 V: nos dois casos a central entende que há alguém no caminho. Um jumper J1 ligado entre FOTO e GND deixa o pino sempre em 0 V, e a central não percebe mais nada.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [0, 0],
      b: [0, 14],
      params: { voltage: 5 },
      label: '5 V da lógica',
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
      b: [10, 6],
      params: { resistance: 10000 },
      label: 'pull-up FOTO',
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [10, 6],
        [16, 6],
      ],
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [16, 6],
        [22, 6],
      ],
    },
    {
      id: 'S1',
      type: 'switch',
      a: [22, 6],
      b: [30, 6],
      params: { closed: true },
      label: 'cabo da fotocélula',
      control: { param: 'closed', label: 'Cabo da fotocélula inteiro', kind: 'toggle' },
    },
    {
      id: 'B1',
      type: 'push-button',
      a: [30, 6],
      b: [30, 14],
      params: { normallyClosed: true, pressed: false },
      label: 'contato NF do receptor',
      control: { param: 'pressed', label: 'Pessoa no feixe', kind: 'toggle' },
    },
    {
      id: 'J1',
      type: 'switch',
      a: [16, 6],
      b: [16, 14],
      params: { closed: false },
      label: 'J1 FOTO',
      control: { param: 'closed', label: 'Jumper J1 colocado', kind: 'toggle' },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [0, 14],
        [16, 14],
      ],
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [16, 14],
        [30, 14],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 14] },
  ],
  probes: [{ id: 'VFOTO', kind: 'voltage', plus: 'R1.b', minus: 'GND', label: 'Pino FOTO' }],
  goals: [
    {
      id: 'feixe-interrompido',
      description: 'Ponha uma pessoa no feixe: o contato NF abre e o pino FOTO vai a 5 V.',
      check: { readout: 'B1.closed', op: '==', value: false },
      solution: { 'B1.pressed': true },
    },
    {
      id: 'cabo-rompido',
      description:
        'Com o feixe livre, rompa o cabo da fotocélula: o pino também vai a 5 V, e a central trata como alguém no caminho.',
      check: { readout: 'S1.closed', op: '==', value: false },
      solution: { 'S1.closed': false },
    },
    {
      id: 'jumper-cego',
      description:
        'Coloque o jumper J1 com uma pessoa no feixe: toda a corrente passa pelo jumper e o pino fica em 0 V. A central não vê a pessoa.',
      check: { readout: 'J1.current', op: 'between', value: [0.00049, 0.00051] },
      solution: { 'J1.closed': true, 'B1.pressed': true },
    },
  ],
});
