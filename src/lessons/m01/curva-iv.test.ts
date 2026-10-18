import { describe, expect, it } from 'vitest';
import { Simulator } from '../../engine/analysis/simulator';
import lamp from './lampada-nao-ohmica.circuit';
import { lampCurrent, ohmCurrent } from './curva-iv';

/** At low voltage the cool filament takes seconds to settle, so run long. */
function simulatedLampCurrent(volts: number): number {
  const sim = new Simulator(lamp);
  sim.setParam('V1', 'voltage', volts);
  sim.refresh();
  while (sim.t < 30) sim.step();
  return sim.frame().readouts['L1.current'] as number;
}

describe('curva I×V', () => {
  it('follows Ohm’s law for the resistor', () => {
    expect(ohmCurrent(9, 100)).toBeCloseTo(0.09);
    expect(ohmCurrent(6, 30)).toBeCloseTo(0.2);
  });

  it('draws the lamp with the engine’s filament model', () => {
    expect(lampCurrent(0)).toBe(0);
    expect(lampCurrent(12)).toBeCloseTo(5 / 12, 4);
    for (const volts of [1, 3, 6, 9]) {
      expect(lampCurrent(volts)).toBeCloseTo(simulatedLampCurrent(volts), 3);
    }
  });

  it('gives the filament resistances quoted in the lesson', () => {
    expect(12 / lampCurrent(12)).toBeCloseTo(28.8, 1);
    expect(6 / lampCurrent(6)).toBeCloseTo(20.9, 1);
    expect(1 / lampCurrent(1)).toBeGreaterThan(8.5);
    expect(1 / lampCurrent(1)).toBeLessThan(9.5);
  });

  it('shows that half the voltage gives much more than half the current', () => {
    expect(lampCurrent(6) / lampCurrent(12)).toBeGreaterThan(0.65);
  });
});
