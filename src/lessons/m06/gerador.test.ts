import { describe, expect, it } from 'vitest';
import {
  SCOPE_VDIV,
  SPEED,
  angle,
  cyclesOnScreen,
  peak,
  period,
  rpm,
  rpmWithPoles,
  trace,
  voltage,
  voltageAtAngle,
} from './gerador';

describe('o gerador da aula 6.1', () => {
  it('gives 60 Hz at 60 turns per second: period 16,7 ms, 3.600 rpm, 3 cycles on the screen', () => {
    expect(period(60) * 1000).toBeCloseTo(16.67, 2);
    expect(rpm(60)).toBe(3600);
    expect(cyclesOnScreen(60)).toBeCloseTo(3, 10);
    expect(peak(60)).toBeCloseTo(12, 10);
  });

  it('gives 50 Hz with a period of 20 ms and 2,5 cycles on the screen', () => {
    expect(period(50) * 1000).toBeCloseTo(20, 10);
    expect(cyclesOnScreen(50)).toBeCloseTo(2.5, 10);
    expect(rpm(50)).toBe(3000);
  });

  it('turns slower with more poles: 40 poles give 60 Hz at 180 rpm', () => {
    expect(rpmWithPoles(60, 2)).toBe(3600);
    expect(rpmWithPoles(60, 4)).toBe(1800);
    expect(rpmWithPoles(60, 40)).toBe(180);
  });

  it('has zero voltage facing the field and the peak lying along it', () => {
    expect(voltageAtAngle(60, 0)).toBeCloseTo(0, 10);
    expect(voltageAtAngle(60, 90)).toBeCloseTo(12, 10);
    expect(voltageAtAngle(60, 180)).toBeCloseTo(0, 10);
    expect(voltageAtAngle(60, 270)).toBeCloseTo(-12, 10);
  });

  it('keeps the angle and the voltage in step', () => {
    const f = 60;
    for (const t of [0.001, 0.004, 0.0123, 0.031]) {
      expect(voltageAtAngle(f, angle(f, t))).toBeCloseTo(voltage(f, t), 9);
    }
  });

  it('crosses zero twice per cycle: 120 times per second at 60 Hz', () => {
    const pts = trace(60, 1, 120000);
    let crossings = 0;
    for (let i = 1; i < pts.length; i++) {
      if (Math.sign(pts[i]!.v) !== Math.sign(pts[i - 1]!.v) && pts[i]!.v !== 0) crossings++;
    }
    // The trace is clipped to the 50 ms of the screen: 6 crossings there, 120 in a second.
    expect(crossings / 0.05).toBeCloseTo(120, -1);
  });

  it('fits the fastest speed inside the screen on its fixed scale', () => {
    expect(peak(SPEED.max)).toBeLessThanOrEqual(4 * SCOPE_VDIV);
  });
});
