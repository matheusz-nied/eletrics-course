import { describe, expect, it } from 'vitest';
import type { CircuitDoc } from '../../engine/contract';
import { engineFor } from '../engine';
import { buildSchematicModel, wireCurrents } from './model';

/** Battery feeding two resistors in parallel through one wire. */
const doc: CircuitDoc = {
  id: 'test/paralelo',
  title: 'Paralelo',
  description: 'Dois resistores em paralelo',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'B1', type: 'battery', a: [0, 0], b: [0, 10], params: { voltage: 10, resistance: 0 } },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [10, 0],
        [20, 0],
      ],
    },
    { id: 'R1', type: 'resistor', a: [10, 0], b: [10, 10], params: { resistance: 100 } },
    { id: 'R2', type: 'resistor', a: [20, 0], b: [20, 10], params: { resistance: 100 } },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [20, 10],
        [10, 10],
        [0, 10],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 10] },
  ],
};

describe('schematic model', () => {
  const engine = engineFor(doc);
  const model = buildSchematicModel(doc.elements, engine.buildNetlist(doc), doc.view);

  it('puts junction dots where three or more conductors meet', () => {
    expect(model.junctions).toContainEqual([100, 0]);
    expect(model.junctions).toContainEqual([100, 100]);
  });

  it('splits the current along the wires (KCL)', async () => {
    const sim = engine.createSimulation({ worker: false });
    await sim.load(doc);
    const frame = (await sim.runUntil(0.002)).at(-1);
    const pin = (el: string, p: string) => {
      const v = frame!.readouts[`${el}.pin.${p}`];
      return typeof v === 'number' ? v : Number.NaN;
    };
    const out = new Float64Array(model.segments.length);
    wireCurrents(model, pin, out);
    const along = (from: [number, number], to: [number, number]) => {
      const i = model.segments.findIndex(
        (s) =>
          s.from[0] === from[0] && s.from[1] === from[1] && s.to[0] === to[0] && s.to[1] === to[1],
      );
      return out[i]!;
    };
    // 10 V over 50 Ω: 0,2 A leaves the battery, 0,1 A goes on to R2.
    expect(along([0, 0], [100, 0])).toBeCloseTo(0.2, 6);
    expect(along([100, 0], [200, 0])).toBeCloseTo(0.1, 6);
    expect(along([100, 100], [0, 100])).toBeCloseTo(0.2, 6);
  });
});
