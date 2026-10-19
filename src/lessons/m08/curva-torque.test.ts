import { describe, expect, it } from 'vitest';
import { lineCurrent, motorTorque, TORQUE_CURVES } from './curva-torque';

describe('curva de torque do motor de 1 CV', () => {
  it('starts with about 2,9 times the rated torque in delta and a third of it in star', () => {
    expect(motorTorque(220, 1)).toBeGreaterThan(11.5);
    expect(motorTorque(220, 1)).toBeLessThan(12.5);
    expect(motorTorque(127, 1) / motorTorque(220, 1)).toBeCloseTo((127 / 220) ** 2, 6);
    expect(motorTorque(127, 1)).toBeLessThan(4.15);
  });

  it('peaks near 15 N·m and gives the rated torque near 1.720 rpm', () => {
    const delta = TORQUE_CURVES[0]!.points.map((p) => p[1]);
    const peak = Math.max(...delta);
    expect(peak).toBeGreaterThan(14.5);
    expect(peak).toBeLessThan(16.5);
    const s = 1 - 1720 / 1800;
    expect(motorTorque(220, s)).toBeGreaterThan(3.8);
    expect(motorTorque(220, s)).toBeLessThan(4.6);
    expect(motorTorque(220, 1e-6)).toBeLessThan(0.01);
  });

  it('draws six to seven times the full-load current to start', () => {
    expect(lineCurrent(220, 1, true)).toBeGreaterThan(18.5);
    expect(lineCurrent(220, 1, true)).toBeLessThan(20);
    expect(lineCurrent(127, 1, false)).toBeCloseTo(lineCurrent(220, 1, true) / 3, 1);
  });
});
