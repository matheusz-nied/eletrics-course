import { Children, isValidElement, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { defineCircuit } from '../../engine';
import { Simulator } from '../../engine/analysis/simulator';
import { Arrow, type SymbolCtx } from './_kit';
import { getSymbol } from './index';

interface ArrowProps {
  x1: number;
  x2: number;
}

describe('dc-current symbol', () => {
  it('points the arrow at the pin the engine pushes the current out of', () => {
    // Engine side: with a resistor across the source and pin b grounded, the
    // current leaves through pin a, so pin a is the positive end of the resistor.
    const doc = defineCircuit({
      id: 'test/dc-current-direction',
      title: 'Sentido da fonte de corrente',
      description: 'Fonte de corrente de 1 mA num resistor de 1 kΩ.',
      analysis: { kind: 'dc' },
      elements: [
        { id: 'I1', type: 'dc-current', a: [0, 0], b: [0, 10], params: { current: 0.001 } },
        {
          id: 'W1',
          type: 'wire',
          points: [
            [0, 0],
            [10, 0],
          ],
        },
        { id: 'R1', type: 'resistor', a: [10, 0], b: [10, 10], params: { resistance: 1000 } },
        {
          id: 'W2',
          type: 'wire',
          points: [
            [10, 10],
            [0, 10],
          ],
        },
        { id: 'G', type: 'ground', at: [0, 10] },
      ],
      probes: [{ id: 'VA', kind: 'voltage', plus: 'I1.a', minus: 'GND' }],
    });
    const sim = new Simulator(doc);
    sim.refresh();
    expect(sim.frame().readouts.VA).toBeCloseTo(1, 3);

    // Drawing side: two-terminal bodies run along +x from pin a (left) to pin b
    // (right), so an arrow towards pin a goes from +x to −x.
    const tree = getSymbol('dc-current').draw({} as SymbolCtx) as ReactElement<{
      children: unknown;
    }>;
    const arrow = Children.toArray(tree.props.children as never).find(
      (c): c is ReactElement<ArrowProps> => isValidElement(c) && c.type === Arrow,
    );
    expect(arrow).toBeDefined();
    expect(arrow!.props.x2).toBeLessThan(arrow!.props.x1);
  });
});
