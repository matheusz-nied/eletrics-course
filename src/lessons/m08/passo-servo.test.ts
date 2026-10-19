import { describe, expect, it } from 'vitest';
import {
  coilState,
  fieldAngle,
  relativeTorque,
  sequenceIndex,
  servoAngle,
  servoDuty,
  servoMove,
  shaftAngle,
} from './passo-servo';

describe('motor de passo', () => {
  it('turns the field a quarter turn per step in wave mode, and back when reversed', () => {
    expect([0, 1, 2, 3].map((k) => fieldAngle('onda', k))).toEqual([0, 90, 180, 270]);
    expect(fieldAngle('onda', -1)).toBe(270);
    expect(coilState('onda', 4)).toEqual(coilState('onda', 0));
    expect(sequenceIndex('onda', -1)).toBe(3);
  });

  it('sits between the poles with two phases on, with √2 the torque', () => {
    expect(fieldAngle('completo', 0)).toBe(45);
    expect(relativeTorque('completo', 2)).toBeCloseTo(Math.SQRT2, 12);
    expect(relativeTorque('onda', 1)).toBe(1);
  });

  it('takes half steps of 45° in the drawing and 0,9° on a 200-step motor', () => {
    expect([0, 1, 2].map((k) => fieldAngle('meio', k))).toEqual([0, 45, 90]);
    expect(shaftAngle('meio', 200)).toBeCloseTo(180, 9);
    expect(shaftAngle('completo', 200)).toBeCloseTo(360, 9);
    expect(shaftAngle('onda', 1)).toBeCloseTo(1.8, 9);
  });
});

describe('servo', () => {
  it('maps 1 to 2 ms onto 0 to 180°, clamped outside', () => {
    expect(servoAngle(1)).toBe(0);
    expect(servoAngle(1.5)).toBe(90);
    expect(servoAngle(2)).toBe(180);
    expect(servoAngle(0.5)).toBe(0);
    expect(servoAngle(2.6)).toBe(180);
    expect(servoDuty(1.5)).toBeCloseTo(0.075, 12);
  });

  it('moves at its top speed and stops at the target', () => {
    expect(servoMove(0, 90, 0.05)).toBeCloseTo(30, 9);
    expect(servoMove(85, 90, 0.05)).toBe(90);
    expect(servoMove(90, 0, 0.1)).toBeCloseTo(30, 9);
  });
});
