import { defineCircuit } from '../../engine';

/**
 * 11.2: the closing condition of a gate central built with gates. The motor
 * closes only if the command asks for it AND nobody is in the photocell beam
 * AND the gate has not reached the closing limit switch. The two sensors are
 * read as the central reads them (16.4, 16.5): a 10 kΩ pull-up to 5 V and a
 * contact to GND, so the photocell input is 1 with someone in the beam and
 * the limit switch input is 0 with the gate shut. Checked in
 * ./portas-logicas.test.ts.
 */
export default defineCircuit({
  id: 'm11/portao-fecha',
  title: 'Quando o portão pode fechar',
  description:
    'Uma fonte de 5 V alimenta três entradas. A chave do comando de fechar liga a entrada FECHAR ao 5 V, com um resistor de 10 kΩ para o GND. A entrada FOTO tem um resistor de 10 kΩ para 5 V e o contato NF do receptor da fotocélula para o GND: com o feixe livre ela fica em 0 V, com uma pessoa no feixe vai a 5 V. A entrada FCF, do fim de curso de fechamento, tem um resistor de 10 kΩ para 5 V e o contato do fim de curso para o GND: com o portão encostado ela vai a 0 V. Uma porta NÃO inverte FOTO; uma porta E junta FECHAR com a saída dela, e uma segunda porta E junta o resultado com FCF. A saída final acende o LED "motor fecha" por 220 Ω.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'V1',
      type: 'dc-voltage',
      a: [-4, 2],
      b: [-4, 12],
      label: 'Fonte',
      params: { voltage: 5 },
    },
    { id: 'G1', type: 'ground', at: [-4, 12] },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [-4, 2],
        [2, 2],
        [2, 10],
        [2, 22],
      ],
    },
    // FECHAR: switch to 5 V, pull-down to GND.
    {
      id: 'S1',
      type: 'switch',
      a: [2, 2],
      b: [9, 2],
      label: 'Comando FECHAR',
      params: { closed: false },
      control: { param: 'closed', label: 'Comando de fechar', kind: 'toggle' },
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [9, 2],
      b: [9, 8],
      label: 'R1',
      params: { resistance: 10000 },
    },
    { id: 'G2', type: 'ground', at: [9, 8] },
    // FOTO: pull-up, NC contact of the receiver to GND.
    {
      id: 'R2',
      type: 'resistor',
      a: [2, 10],
      b: [9, 10],
      label: 'R2',
      params: { resistance: 10000 },
    },
    {
      id: 'B1',
      type: 'push-button',
      a: [9, 10],
      b: [9, 20],
      label: 'Fotocélula',
      params: { normallyClosed: true, pressed: false },
      control: { param: 'pressed', label: 'Pessoa no feixe', kind: 'toggle' },
    },
    { id: 'G3', type: 'ground', at: [9, 20] },
    // FCF: pull-up, limit switch contact to GND.
    {
      id: 'R3',
      type: 'resistor',
      a: [2, 22],
      b: [9, 22],
      label: 'R3',
      params: { resistance: 10000 },
    },
    {
      id: 'S2',
      type: 'switch',
      a: [9, 22],
      b: [9, 32],
      label: 'Fim de curso',
      params: { closed: false },
      control: { param: 'closed', label: 'Portão encostado (ímã no fim de curso)', kind: 'toggle' },
    },
    { id: 'G4', type: 'ground', at: [9, 32] },
    // Logic.
    {
      id: 'W2',
      type: 'wire',
      points: [
        [9, 10],
        [14, 10],
      ],
    },
    { id: 'U1', type: 'not', at: [16, 10], label: 'U1' },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [9, 2],
        [21, 2],
      ],
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [18, 10],
        [19, 10],
        [19, 4],
        [21, 4],
      ],
    },
    { id: 'U2', type: 'and', at: [24, 3], label: 'U2' },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [27, 3],
        [29, 3],
      ],
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [9, 22],
        [26, 22],
        [26, 5],
        [29, 5],
      ],
    },
    { id: 'U3', type: 'and', at: [32, 4], label: 'U3' },
    {
      id: 'R4',
      type: 'resistor',
      a: [35, 4],
      b: [41, 4],
      label: 'R4',
      params: { resistance: 220 },
    },
    {
      id: 'D1',
      type: 'led',
      a: [41, 4],
      b: [41, 12],
      label: 'Motor fecha',
      params: { color: 'green' },
    },
    { id: 'G5', type: 'ground', at: [41, 12] },
  ],
  probes: [
    { id: 'VFECHAR', kind: 'voltage', plus: 'U2.a', minus: 'GND', label: 'Entrada FECHAR' },
    { id: 'VFOTO', kind: 'voltage', plus: 'U1.a', minus: 'GND', label: 'Entrada FOTO' },
    { id: 'VFCF', kind: 'voltage', plus: 'U3.b', minus: 'GND', label: 'Entrada FCF' },
  ],
  goals: [
    {
      id: 'fecha',
      description: 'Dê o comando de fechar: com o feixe livre e o portão aberto, o motor fecha.',
      check: { readout: 'D1.brightness', op: '>', value: 0.3 },
      at: 0.01,
      solution: { 'S1.closed': true },
    },
    {
      id: 'pessoa',
      description:
        'Ponha uma pessoa no feixe: o contato NF abre e a entrada FOTO vai a 5 V. Com ela em 5 V, o motor não fecha.',
      check: { readout: 'VFOTO', op: '>', value: 4.5 },
      at: 0.01,
      solution: { 'S1.closed': true, 'B1.pressed': true },
    },
    {
      id: 'fim',
      description:
        'Encoste o portão no fim de curso: a entrada FCF vai a 0 V. Com ela em 0 V, o motor também não fecha.',
      check: { readout: 'VFCF', op: '<', value: 0.5 },
      at: 0.01,
      solution: { 'S1.closed': true, 'S2.closed': true },
    },
  ],
});
