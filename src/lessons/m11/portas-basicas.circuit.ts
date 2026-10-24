import { defineCircuit } from '../../engine';
import type { ElementDoc, Vec2 } from '../../engine/contract';

/**
 * 11.2: five logic gates fed by the same two inputs. A and B are 0 V or
 * 5 V; the gates are an AND, an OR, an XOR, a NAND and a NOT (of A), each
 * lighting an LED through 220 Ω. Flipping A and B walks through the truth
 * tables. Checked in ./digital.test.ts.
 */

/** Gate rows: the y of each gate's output, its type and name. */
const ROWS: { y: number; type: string; id: string; label: string; led: string }[] = [
  { y: 2, type: 'and', id: 'U1', label: 'E (AND)', led: 'D1' },
  { y: 9, type: 'or', id: 'U2', label: 'OU (OR)', led: 'D2' },
  { y: 16, type: 'xor', id: 'U3', label: 'OU exclusivo (XOR)', led: 'D3' },
  { y: 23, type: 'nand', id: 'U4', label: 'NÃO-E (NAND)', led: 'D4' },
  { y: 30, type: 'not', id: 'U5', label: 'NÃO (NOT) de A', led: 'D5' },
];
const BUS_A = 8;
const BUS_B = 14;
const GATE_X = 24;
const SRC_TOP = 35;
const GND_Y = 44;
const RAIL_X = 44;

const input = (id: string, x: number, label: string): ElementDoc => ({
  id,
  type: 'dc-voltage',
  a: [x, SRC_TOP],
  b: [x, GND_Y],
  label,
  params: { voltage: 0 },
  control: {
    param: 'voltage',
    label: `Entrada ${label}`,
    kind: 'select',
    options: [
      { value: 0, label: '0 (0 V)' },
      { value: 5, label: '1 (5 V)' },
    ],
  },
});

const two = ROWS.filter((r) => r.type !== 'not');
const notRow = ROWS.find((r) => r.type === 'not')!;

const elements: ElementDoc[] = [
  input('VA', BUS_A, 'A'),
  input('VB', BUS_B, 'B'),
  // Bus A: a vertex at every tap, from the top gate down to the source.
  {
    id: 'WA',
    type: 'wire',
    points: [...two.map((r): Vec2 => [BUS_A, r.y - 1]), [BUS_A, notRow.y], [BUS_A, SRC_TOP]],
  },
  {
    id: 'WB',
    type: 'wire',
    points: [...two.map((r): Vec2 => [BUS_B, r.y + 1]), [BUS_B, SRC_TOP]],
  },
  {
    id: 'WG',
    type: 'wire',
    points: [
      [BUS_A, GND_Y],
      [BUS_B, GND_Y],
      [RAIL_X, GND_Y],
      ...[...ROWS].reverse().map((r): Vec2 => [RAIL_X, r.y]),
    ],
  },
  { id: 'G', type: 'ground', at: [BUS_A, GND_Y] },
];

for (const r of ROWS) {
  const n = r.id.slice(1);
  if (r.type === 'not') {
    elements.push(
      {
        id: `WA${n}`,
        type: 'wire',
        points: [
          [BUS_A, r.y],
          [GATE_X - 2, r.y],
        ],
      },
      { id: r.id, type: r.type, at: [GATE_X, r.y], label: r.label },
      {
        id: `WY${n}`,
        type: 'wire',
        points: [
          [GATE_X + 2, r.y],
          [GATE_X + 3, r.y],
        ],
      },
    );
  } else {
    elements.push(
      {
        id: `WA${n}`,
        type: 'wire',
        points: [
          [BUS_A, r.y - 1],
          [GATE_X - 3, r.y - 1],
        ],
      },
      {
        id: `WB${n}`,
        type: 'wire',
        points: [
          [BUS_B, r.y + 1],
          [GATE_X - 3, r.y + 1],
        ],
      },
      { id: r.id, type: r.type, at: [GATE_X, r.y], label: r.label },
    );
  }
  elements.push(
    {
      id: `R${n}`,
      type: 'resistor',
      a: [GATE_X + 3, r.y],
      b: [GATE_X + 10, r.y],
      params: { resistance: 220 },
    },
    {
      id: r.led,
      type: 'led',
      a: [GATE_X + 10, r.y],
      b: [GATE_X + 16, r.y],
      params: { color: 'red' },
    },
    {
      id: `WL${n}`,
      type: 'wire',
      points: [
        [GATE_X + 16, r.y],
        [RAIL_X, r.y],
      ],
    },
  );
}

export default defineCircuit({
  id: 'm11/portas-basicas',
  title: 'Cinco portas lógicas',
  description:
    'Duas entradas, A e B, que valem 0 (0 V) ou 1 (5 V), alimentam ao mesmo tempo uma porta E, uma porta OU, uma porta OU exclusivo e uma porta NÃO-E; uma porta NÃO recebe só a entrada A. A saída de cada porta acende um LED por um resistor de 220 Ω. Com A e B em 0, só os LEDs da NÃO-E e da NÃO acendem.',
  analysis: { kind: 'dc' },
  elements,
  goals: [
    {
      id: 'repouso',
      description: 'Com A e B em 0, acendem só os LEDs das portas NÃO-E e NÃO.',
      check: { readout: 'D4.brightness', op: '>', value: 0.3 },
      at: 0.01,
    },
    {
      id: 'so-xor',
      description: 'Deixe a porta E apagada e a OU exclusivo acesa.',
      check: { readout: 'D3.brightness', op: '>', value: 0.3 },
      at: 0.01,
      solution: { 'VA.voltage': 5 },
    },
    {
      id: 'nand-apaga',
      description: 'Apague o LED da porta NÃO-E.',
      check: { readout: 'D4.brightness', op: '<', value: 0.01 },
      at: 0.01,
      solution: { 'VA.voltage': 5, 'VB.voltage': 5 },
    },
  ],
});
