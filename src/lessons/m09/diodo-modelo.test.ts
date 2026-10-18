import { describe, expect, it } from 'vitest';
import type { CircuitDoc } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';
import {
  DIODES,
  depletionWidth,
  diodeCurrent,
  diodeVoltage,
  ledParams,
  operatingPoint,
  WIDTH_AT_ZERO,
} from './diodo-modelo';

/** A source, a resistor and a diode (or LED) in series, solved by the engine. */
function engine(source: number, ohms: number, type: 'diode' | 'led', params: Record<string, string>) {
  const doc: CircuitDoc = {
    id: 'teste/serie',
    title: 'série',
    description: 'série',
    analysis: { kind: 'dc' },
    elements: [
      { id: 'V1', type: 'dc-voltage', a: [0, 0], b: [0, 10], params: { voltage: source } },
      { id: 'R1', type: 'resistor', a: [0, 0], b: [10, 0], params: { resistance: ohms, watts: 100 } },
      { id: 'D1', type, a: [10, 0], b: [10, 10], params: { ...params, ...(type === 'led' ? { imax: 10 } : { power: 100 }) } },
      { id: 'W1', type: 'wire', points: [[10, 10], [0, 10]] },
      { id: 'G', type: 'ground', at: [0, 10] },
    ],
  };
  const sim = new Simulator(doc);
  sim.refresh();
  const r = sim.frame().readouts;
  return { current: r['D1.current'] as number, voltage: r['D1.voltage'] as number };
}

describe('diode model of the module 9 figures', () => {
  it('voltage and current are inverse functions', () => {
    for (const d of Object.values(DIODES)) {
      for (const i of [1e-6, 1e-3, 0.1, 1]) {
        expect(diodeCurrent(diodeVoltage(i, d), d)).toBeCloseTo(i, 9);
      }
    }
  });

  it('matches the engine for a source, a resistor and a diode', () => {
    for (const kind of ['signal', 'rectifier', 'schottky'] as const) {
      for (const [v, r] of [
        [5, 1000],
        [12, 100],
        [1, 10],
      ] as const) {
        const ours = operatingPoint(v, r, DIODES[kind]);
        const sim = engine(v, r, 'diode', { model: kind });
        expect(ours.current).toBeCloseTo(sim.current, 6);
        expect(ours.voltage).toBeCloseTo(sim.voltage, 3);
      }
    }
  });

  it('matches the engine for red and blue LEDs', () => {
    for (const color of ['red', 'blue'] as const) {
      const ours = operatingPoint(9, 330, ledParams(color));
      const sim = engine(9, 330, 'led', { color });
      expect(ours.current).toBeCloseTo(sim.current, 6);
    }
    // 20 mA gives the rated forward voltage.
    expect(diodeVoltage(0.02, ledParams('red'))).toBeCloseTo(2.0, 6);
  });

  it('reverse: only the saturation current flows', () => {
    expect(diodeCurrent(-5, DIODES.signal)).toBeCloseTo(-2.52e-9, 12);
  });

  it('the depletion region widens in reverse and narrows forward', () => {
    expect(depletionWidth(0)).toBe(WIDTH_AT_ZERO);
    expect(depletionWidth(-10)).toBeCloseTo(1.67, 2);
    expect(depletionWidth(0.6)).toBeCloseTo(0.17, 2);
    expect(depletionWidth(0.75)).toBe(depletionWidth(0.6));
  });
});
