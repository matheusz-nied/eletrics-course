import { defineCircuit } from '../../engine';
import type { ElementDoc } from '../../engine/contract';

/**
 * 11.4: the D flip-flop. Two inputs of 0 V or 5 V, D and the clock, feed a
 * D flip-flop whose Q lights an LED. The same clock feeds a second flip-flop
 * with Q̄ back to D: it toggles on every rising edge, a divider by 2.
 * Checked in ./flip-flops.test.ts.
 */
const input = (id: string, x: number, top: number, label: string): ElementDoc => ({
  id,
  type: 'dc-voltage',
  a: [x, top],
  b: [x, 16],
  label,
  params: { voltage: 0 },
  control: {
    param: 'voltage',
    label,
    kind: 'select',
    options: [
      { value: 0, label: '0 (0 V)' },
      { value: 5, label: '1 (5 V)' },
    ],
  },
});

export default defineCircuit({
  id: 'm11/flip-flop-d',
  title: 'Flip-flop tipo D',
  description:
    'Duas fontes de 0 V ou 5 V são as entradas: D e o clock. Elas alimentam um flip-flop tipo D, cuja saída Q acende um LED verde por 220 Ω. O mesmo clock vai a um segundo flip-flop D, com a saída Q barrado ligada de volta à própria entrada D: ele inverte a saída a cada subida do clock, e a sua saída Q acende um LED amarelo por 220 Ω.',
  analysis: { kind: 'dc' },
  elements: [
    input('VD', 4, 4, 'Dado D'),
    input('VC', 12, 8, 'Clock'),
    {
      id: 'WG',
      type: 'wire',
      points: [
        [4, 16],
        [12, 16],
      ],
    },
    { id: 'G1', type: 'ground', at: [4, 16] },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [4, 4],
        [18, 4],
        [18, 8],
        [20, 8],
      ],
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 8],
        [16, 8],
        [16, 12],
        [20, 12],
      ],
    },
    { id: 'U1', type: 'd-flip-flop', at: [24, 10], label: 'U1' },
    {
      id: 'R1',
      type: 'resistor',
      a: [28, 8],
      b: [34, 8],
      label: 'R1',
      params: { resistance: 220 },
    },
    {
      id: 'D1',
      type: 'led',
      a: [34, 8],
      b: [34, 16],
      label: 'Q',
      params: { color: 'green' },
    },
    { id: 'G2', type: 'ground', at: [34, 16] },
    // Divider by 2: the same clock, Q̄ back to D.
    {
      id: 'W3',
      type: 'wire',
      points: [
        [16, 12],
        [16, 26],
        [20, 26],
      ],
    },
    { id: 'U2', type: 'd-flip-flop', at: [24, 24], label: 'U2' },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [28, 26],
        [30, 26],
        [30, 30],
        [18, 30],
        [18, 22],
        [20, 22],
      ],
    },
    {
      id: 'R2',
      type: 'resistor',
      a: [28, 22],
      b: [34, 22],
      label: 'R2',
      params: { resistance: 220 },
    },
    {
      id: 'D2',
      type: 'led',
      a: [34, 22],
      b: [34, 30],
      label: 'Divisor',
      params: { color: 'yellow' },
    },
    { id: 'G3', type: 'ground', at: [34, 30] },
  ],
  probes: [
    { id: 'VDADO', kind: 'voltage', plus: 'U1.d', minus: 'GND', label: 'D' },
    { id: 'VCLK', kind: 'voltage', plus: 'U1.clk', minus: 'GND', label: 'Clock' },
    { id: 'VQ', kind: 'voltage', plus: 'U1.q', minus: 'GND', label: 'Q' },
  ],
});
