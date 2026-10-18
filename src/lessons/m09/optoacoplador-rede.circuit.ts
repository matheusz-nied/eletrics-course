import { defineCircuit } from '../../engine';

/**
 * 9.9: an optocoupler tells a 5 V board which half-cycle the mains is in,
 * with no wire between the two sides. Two 47 kΩ resistors limit the LED
 * current; a diode across the LED takes the negative half-cycles. The
 * board's 0 V only meets the neutral through the isolation of the package,
 * drawn as a 10 GΩ resistor. The values the lesson quotes are checked in
 * ./tiristores.test.ts.
 */
export default defineCircuit({
  id: 'm09/optoacoplador-rede',
  title: 'Optoacoplador lendo a rede',
  description:
    'Do lado da rede, uma tomada de 127 V acende o LED infravermelho de um optoacoplador através de dois resistores de 47 kΩ em série; um diodo em paralelo com o LED, ao contrário, conduz nos semiciclos negativos e protege o LED. Do lado da placa, alimentado por 5 V, o fototransistor do optoacoplador puxa para 0 V a saída, que tem um resistor de 10 kΩ para os 5 V. No semiciclo positivo, o LED acende e a saída vai para perto de 0 V; no negativo, o LED apaga e a saída sobe para 5 V. Os dois lados não têm nenhum fio em comum: o único caminho entre eles é a isolação do componente, de bilhões de ohms.',
  analysis: { kind: 'transient', dt: 2e-5, speed: 0.02 },
  elements: [
    {
      id: 'V1',
      type: 'ac-voltage',
      a: [0, 0],
      b: [0, 16],
      label: 'Tomada 127 V',
      params: { amplitude: 179.6, frequency: 60 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [4, 0],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [4, 0],
      b: [11, 0],
      label: 'R1',
      params: { resistance: 47000 },
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [11, 0],
      b: [18, 0],
      label: 'R2',
      params: { resistance: 47000 },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [18, 0],
        [22, 0],
        [22, 2],
        [22, 7],
        [24, 7],
      ],
    },
    {
      id: 'D1',
      type: 'diode',
      a: [20, 9],
      b: [20, 2],
      label: 'D1',
      params: { model: 'signal' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [20, 2],
        [22, 2],
      ],
    },
    {
      id: 'OK1',
      type: 'optocoupler',
      at: [27, 8],
      label: 'Optoacoplador',
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [24, 9],
        [20, 9],
        [20, 16],
        [0, 16],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 16] },
    {
      id: 'V2',
      type: 'dc-voltage',
      a: [42, 0],
      b: [42, 16],
      label: 'Placa 5 V',
      params: { voltage: 5 },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [42, 0],
        [34, 0],
      ],
    },
    {
      id: 'R3',
      type: 'resistor',
      a: [34, 0],
      b: [34, 7],
      label: 'R3',
      params: { resistance: 10000 },
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [30, 7],
        [34, 7],
        [38, 7],
      ],
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [30, 9],
        [32, 9],
        [32, 16],
        [42, 16],
      ],
    },
    {
      id: 'RISO',
      type: 'resistor',
      a: [20, 16],
      b: [32, 16],
      label: 'Isolação',
      params: { resistance: 1e10 },
    },
  ],
  probes: [
    { id: 'VT', kind: 'voltage', plus: 'V1.a', minus: 'V1.b', label: 'Tensão da tomada' },
    { id: 'VS', kind: 'voltage', plus: 'OK1.c', minus: 'OK1.e', label: 'Saída para a placa' },
    { id: 'ILED', kind: 'current', element: 'R1', label: 'Corrente no LED' },
  ],
});
