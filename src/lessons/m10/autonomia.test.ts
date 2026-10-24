import { describe, expect, it } from 'vitest';
import { BATTERIES, effectiveCurrent, gateAutonomy, motorDuty, upsAutonomy } from './autonomia';

const b7 = BATTERIES.find((b) => b.id === '7ah')!;

/** The numbers lesson 10.3 quotes. */
describe('10.3 battery autonomy', () => {
  it('counts no Peukert loss at or below the 20 h current', () => {
    expect(effectiveCurrent(0.35, 7)).toBeCloseTo(0.35, 6);
    expect(effectiveCurrent(0.06, 7)).toBeCloseTo(0.06, 6);
  });

  it('5 A from a 7 Ah battery drains it like about 7,5 A', () => {
    expect(effectiveCurrent(5, 7)).toBeCloseTo(7.45, 2);
  });

  it('the gate example: 60 mA standby, 5 A for 15 s four times an hour', () => {
    const load = { standby: 0.06, motor: 5, seconds: 15, perHour: 4 };
    expect(motorDuty(load)).toBeCloseTo(1 / 60, 6);
    const a = gateAutonomy(b7, load, 0.5);
    expect(a.average).toBeCloseTo(0.142, 3);
    expect(a.naive).toBeCloseTo(49.2, 1);
    expect(a.hours).toBeCloseTo(19.1, 1);
  });

  it('standby alone: 7 Ah at 60 mA, half the charge, lasts about 58 h', () => {
    const a = gateAutonomy(b7, { standby: 0.06, motor: 5, seconds: 15, perHour: 0 }, 0.5);
    expect(a.hours).toBeCloseTo(58.3, 1);
  });

  it('a nobreak with one 7 Ah battery and 120 W at 85 %: 11,8 A, about 17 minutes to 80 %', () => {
    const a = upsAutonomy(b7, 120, 0.85, 0.8);
    expect(a.current).toBeCloseTo(11.8, 1);
    expect(a.naive * 60).toBeCloseTo(42, 0);
    expect(a.hours * 60).toBeCloseTo(16.9, 1);
  });
});
