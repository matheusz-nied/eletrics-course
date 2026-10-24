import { defineCircuit } from '../../engine';
import type { ElementDoc } from '../../engine/contract';

/**
 * 11.6: a 4-bit R-2R digital-to-analog converter. Each bit is a source of
 * 0 V or 5 V behind a 20 kΩ resistor; 10 kΩ resistors join the nodes, and a
 * 20 kΩ resistor ends the ladder at the least significant bit. The output,
 * with no load, is 5 V · code / 16. Checked in ./conversao.test.ts.
 */
const COLUMNS = [
  { bit: 0, x: 10 },
  { bit: 1, x: 20 },
  { bit: 2, x: 30 },
  { bit: 3, x: 40 },
];
const NODE_Y = 4;
const SRC_Y = 14;
const GND_Y = 24;

const column = ({ bit, x }: (typeof COLUMNS)[number]): ElementDoc[] => [
  {
    id: `R${bit + 1}`,
    type: 'resistor',
    a: [x, NODE_Y],
    b: [x, SRC_Y],
    label: `R${bit + 1}`,
    params: { resistance: 20000 },
  },
  {
    id: `V${bit}`,
    type: 'dc-voltage',
    a: [x, SRC_Y],
    b: [x, GND_Y],
    label: `Bit ${bit}`,
    params: { voltage: 0 },
    control: {
      param: 'voltage',
      label: `Bit ${bit} (vale ${2 ** bit})`,
      kind: 'select',
      options: [
        { value: 0, label: '0 (0 V)' },
        { value: 5, label: '1 (5 V)' },
      ],
    },
  },
  { id: `G${bit + 1}`, type: 'ground', at: [x, GND_Y] },
];

export default defineCircuit({
  id: 'm11/dac-r2r',
  title: 'Conversor DA R-2R de 4 bits',
  description:
    'Quatro fontes de 0 V ou 5 V são os bits de um número, do bit 0 (vale 1) ao bit 3 (vale 8). Cada uma liga, por um resistor de 20 kΩ, a um ponto de uma escada de resistores de 10 kΩ. Na ponta do bit 0, um resistor de 20 kΩ fecha a escada para o GND. A saída é o ponto do bit 3: a tensão nele é 5 V vezes o número dividido por 16.',
  analysis: { kind: 'dc' },
  elements: [
    {
      id: 'RT',
      type: 'resistor',
      a: [2, NODE_Y],
      b: [2, SRC_Y],
      label: 'RT',
      params: { resistance: 20000 },
    },
    { id: 'G0', type: 'ground', at: [2, SRC_Y] },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [2, NODE_Y],
        [10, NODE_Y],
      ],
    },
    ...COLUMNS.flatMap(column),
    ...COLUMNS.slice(1).map(({ bit, x }): ElementDoc => ({
      id: `RS${bit}`,
      type: 'resistor',
      a: [x - 10, NODE_Y],
      b: [x, NODE_Y],
      label: `RS${bit}`,
      params: { resistance: 10000 },
    })),
    {
      id: 'W2',
      type: 'wire',
      points: [
        [40, NODE_Y],
        [46, NODE_Y],
      ],
    },
  ],
  probes: [{ id: 'VOUT', kind: 'voltage', plus: 'RS3.b', minus: 'GND', label: 'Saída' }],
});
