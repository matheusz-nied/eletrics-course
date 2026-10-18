import type { ElementDoc } from '../../engine/contract';

/**
 * 02.5: the two-source circuit shared by the node-law and loop-law
 * simulations. V1 = 12 V and V2 = 9 V feed node A through R1 = 100 Ω and
 * R2 = 100 Ω; R3 = 1 kΩ goes from A to ground. A = 10 V, I1 = 20 mA,
 * I2 = 10 mA (into V2) and I3 = 10 mA.
 */
export const KIRCHHOFF_ELEMENTS: ElementDoc[] = [
  { id: 'V1', type: 'dc-voltage', a: [0, 0], b: [0, 14], params: { voltage: 12 } },
  {
    id: 'W1',
    type: 'wire',
    points: [
      [0, 0],
      [4, 0],
    ],
  },
  { id: 'R1', type: 'resistor', a: [4, 0], b: [12, 0], params: { resistance: 100 } },
  {
    id: 'W2',
    type: 'wire',
    points: [
      [12, 0],
      [16, 0],
    ],
  },
  { id: 'R3', type: 'resistor', a: [16, 0], b: [16, 14], params: { resistance: 1000 } },
  {
    id: 'W3',
    type: 'wire',
    points: [
      [16, 0],
      [20, 0],
    ],
  },
  { id: 'R2', type: 'resistor', a: [20, 0], b: [28, 0], params: { resistance: 100 } },
  {
    id: 'W4',
    type: 'wire',
    points: [
      [28, 0],
      [32, 0],
    ],
  },
  {
    id: 'V2',
    type: 'dc-voltage',
    a: [32, 0],
    b: [32, 14],
    params: { voltage: 9 },
    control: {
      param: 'voltage',
      label: 'Tensão da fonte V2',
      kind: 'slider',
      min: 0,
      max: 15,
      step: 0.5,
      unit: 'V',
    },
  },
  {
    id: 'W5',
    type: 'wire',
    points: [
      [32, 14],
      [16, 14],
      [0, 14],
    ],
  },
  { id: 'G', type: 'ground', at: [0, 14] },
];
