import { describe, expect, it } from 'vitest';
import type { SimFrame } from '../contract';
import { netlist, runFor } from './utils';

const r = (frame: SimFrame, key: string) => frame.readouts[key] as number;

/**
 * Two sources and two loads on a two-pole changeover switch: at rest each
 * common touches its NF contact, actuated its NA contact, both poles together.
 */
function bench(actuated: boolean) {
  return runFor(
    netlist('dpdt', [
      { id: 'V1', type: 'dc-voltage', nodes: ['1', '0'], params: { voltage: 10 } },
      { id: 'V2', type: 'dc-voltage', nodes: ['2', '0'], params: { voltage: 20 } },
      {
        id: 'S1',
        type: 'switch-dpdt',
        nodes: { com1: '3', nc1: '1', no1: '2', com2: '4', nc2: '2', no2: '1' },
        params: { actuated },
      },
      { id: 'R1', type: 'resistor', nodes: ['3', '0'], params: { resistance: 100 } },
      { id: 'R2', type: 'resistor', nodes: ['4', '0'], params: { resistance: 100 } },
    ]),
  ).frame;
}

describe('switch-dpdt', () => {
  it('connects both commons to their NF contacts at rest', () => {
    const frame = bench(false);
    expect(r(frame, 'v3')).toBeCloseTo(10, 3);
    expect(r(frame, 'v4')).toBeCloseTo(20, 3);
    expect(frame.readouts['S1.actuated']).toBe(false);
  });

  it('moves both poles to their NA contacts together when actuated', () => {
    const frame = bench(true);
    expect(r(frame, 'v3')).toBeCloseTo(20, 3);
    expect(r(frame, 'v4')).toBeCloseTo(10, 3);
    expect(Math.abs(r(frame, 'R1.current'))).toBeCloseTo(0.2, 3);
    expect(frame.readouts['S1.actuated']).toBe(true);
  });
});
