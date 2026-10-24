import { describe, expect, it } from 'vitest';
import portas from './portas-basicas.circuit';
import portao from './portao-fecha.circuit';
import { num, runTo, start } from './sim';

/** Values lesson 11.2 quotes from its circuits. */

describe('11.2 five gates', () => {
  const lit = (a: number, b: number) => {
    const r = runTo(start(portas, { 'VA.voltage': a, 'VB.voltage': b }), 0.01);
    return ['D1', 'D2', 'D3', 'D4', 'D5'].map((d) => num(r, `${d}.brightness`) > 0.3);
  };
  it('walks through the truth tables of AND, OR, XOR, NAND and NOT A', () => {
    expect(lit(0, 0)).toEqual([false, false, false, true, true]);
    expect(lit(0, 5)).toEqual([false, true, true, true, true]);
    expect(lit(5, 0)).toEqual([false, true, true, true, false]);
    expect(lit(5, 5)).toEqual([true, true, false, false, false]);
  });
});

describe('11.2 when the gate may close', () => {
  const motor = (params: Record<string, boolean>) =>
    num(runTo(start(portao, params), 0.01), 'D1.brightness') > 0.3;
  it('closes only with the command, the beam clear and the gate not shut', () => {
    expect(motor({})).toBe(false);
    expect(motor({ 'S1.closed': true })).toBe(true);
    expect(motor({ 'S1.closed': true, 'B1.pressed': true })).toBe(false);
    expect(motor({ 'S1.closed': true, 'S2.closed': true })).toBe(false);
    expect(motor({ 'B1.pressed': true })).toBe(false);
  });

  it('reads the sensors as the central does: 0 V with the beam clear, 5 V with someone in it', () => {
    expect(num(runTo(start(portao), 0.01), 'VFOTO')).toBeCloseTo(0, 2);
    expect(num(runTo(start(portao, { 'B1.pressed': true }), 0.01), 'VFOTO')).toBeCloseTo(5, 2);
    expect(num(runTo(start(portao), 0.01), 'VFCF')).toBeCloseTo(5, 2);
    expect(num(runTo(start(portao, { 'S2.closed': true }), 0.01), 'VFCF')).toBeCloseTo(0, 2);
  });
});
