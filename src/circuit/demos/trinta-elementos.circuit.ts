import type { ElementDoc, Vec2 } from '../../engine/contract';
import { defineCircuit } from '../engine';

/** Ten parallel branches (switch, resistor, lamp): 32 parts, for performance checks. */
const BRANCHES = 10;
const xs = Array.from({ length: BRANCHES }, (_, i) => 6 + 9 * i);
const elements: ElementDoc[] = [
  { id: 'B1', type: 'battery', a: [0, 0], b: [0, 16], params: { voltage: 12, resistance: 0.05 } },
  { id: 'WT', type: 'wire', points: [[0, 0], ...xs.map((x): Vec2 => [x, 0])] },
  { id: 'WB', type: 'wire', points: [[0, 16], ...xs.map((x): Vec2 => [x, 16])] },
  { id: 'G', type: 'ground', at: [0, 16] },
];
xs.forEach((x, i) => {
  const n = i + 1;
  elements.push(
    {
      id: `S${n}`,
      type: 'switch',
      a: [x, 0],
      b: [x, 4],
      params: { closed: n % 3 !== 0 },
      control: { param: 'closed', label: `Chave S${n}`, kind: 'toggle' },
    },
    {
      id: `R${n}`,
      type: 'resistor',
      a: [x, 4],
      b: [x, 9],
      params: { resistance: 2 * n, watts: 5 },
    },
    { id: `L${n}`, type: 'lamp', a: [x, 9], b: [x, 16], params: { voltage: 12, power: 5 } },
  );
});

export default defineCircuit({
  id: 'demo/trinta-elementos',
  title: 'Dez lâmpadas em paralelo',
  description:
    'Uma bateria de 12 V alimenta dez ramos em paralelo, cada um com chave, resistor e lâmpada. Serve para conferir o desempenho do esquemático com 30 componentes.',
  analysis: { kind: 'dc' },
  elements,
  probes: [{ id: 'IB', kind: 'current', element: 'B1', label: 'Corrente da bateria' }],
});
