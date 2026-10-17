import type { CircuitDoc, ElementDoc, SimFrame } from '../contract';
import { getPinPositions } from '../index';
import { Simulator } from '../analysis/simulator';

/**
 * Helpers for engine tests: circuits written as a chain of two-terminal
 * elements on a grid, and a quick way to run them.
 */

/** Runs a circuit for `seconds` (or one refresh for t = 0) and returns the last frame. */
export function runFor(doc: CircuitDoc, seconds = 0): { sim: Simulator; frame: SimFrame } {
  const sim = new Simulator(doc);
  sim.refresh();
  const steps = Math.round(seconds / sim.dt);
  for (let i = 0; i < steps; i++) sim.step();
  return { sim, frame: sim.frame() };
}

/**
 * A loop of two-terminal elements placed on a rectangle: the first element
 * (usually the source) on the left side going up, the others along the top,
 * and a ground wire back along the bottom. Elements get ids from `parts`.
 */
export function loop(
  id: string,
  parts: Omit<ElementDoc, 'a' | 'b'>[],
  analysis: CircuitDoc['analysis'] = { kind: 'dc' },
  extra: Partial<CircuitDoc> = {},
): CircuitDoc {
  const elements: ElementDoc[] = [];
  const [first, ...rest] = parts;
  elements.push({ ...first, a: [0, 0], b: [0, 10] });
  let x = 0;
  for (const part of rest) {
    elements.push({ ...part, a: [x, 0], b: [x + 10, 0] });
    x += 10;
  }
  elements.push({
    id: 'Wret',
    type: 'wire',
    points: [
      [x, 0],
      [x, 10],
      [0, 10],
    ],
  });
  elements.push({ id: 'G', type: 'ground', at: [0, 10] });
  return {
    id: `teste/${id}`,
    title: id,
    description: id,
    elements,
    analysis,
    ...extra,
  };
}

export interface NetPart {
  id: string;
  type: string;
  /** Two-terminal: [a, b] node names ("0" is ground). N-terminal: pin → node. */
  nodes: [string, string] | Record<string, string>;
  params?: ElementDoc['params'];
}

/**
 * A circuit from a SPICE-like node list, with a voltage probe `v<node>` per
 * node. Two-terminal parts are drawn between node points on one line (they
 * only connect at their ends); N-terminal parts sit below and reach their
 * nodes by wires.
 */
export function netlist(
  id: string,
  parts: NetPart[],
  analysis: CircuitDoc['analysis'] = { kind: 'dc' },
): CircuitDoc {
  const names = new Map<string, number>([['0', 0]]);
  const point = (node: string): [number, number] => {
    if (!names.has(node)) names.set(node, names.size);
    return [names.get(node)! * 10, 0];
  };
  const firstPin = new Map<string, string>();
  const elements: ElementDoc[] = [{ id: 'GND0', type: 'ground', at: [0, 0] }];
  parts.forEach((part, k) => {
    if (Array.isArray(part.nodes)) {
      const [na, nb] = part.nodes;
      elements.push({
        id: part.id,
        type: part.type,
        a: point(na),
        b: point(nb),
        params: part.params,
      });
      if (!firstPin.has(na)) firstPin.set(na, `${part.id}.a`);
      if (!firstPin.has(nb)) firstPin.set(nb, `${part.id}.b`);
      return;
    }
    const at: [number, number] = [0, 100 + 20 * k];
    const el: ElementDoc = { id: part.id, type: part.type, at, params: part.params };
    elements.push(el);
    for (const [pin, node] of Object.entries(part.nodes)) {
      const pinAt = getPinPositions(el)[pin];
      elements.push({ id: `W_${part.id}_${pin}`, type: 'wire', points: [pinAt, point(node)] });
      if (!firstPin.has(node)) firstPin.set(node, `${part.id}.${pin}`);
    }
  });
  const probes: CircuitDoc['probes'] = [...firstPin]
    .filter(([node]) => node !== '0')
    .map(([node, pin]) => ({ id: `v${node}`, kind: 'voltage', plus: pin, minus: 'GND' }));
  return { id: `teste/${id}`, title: id, description: id, elements, probes, analysis };
}
