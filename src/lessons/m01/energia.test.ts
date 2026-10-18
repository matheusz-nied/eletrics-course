import { describe, expect, it } from 'vitest';
import { APPLIANCES, EXAMPLE_TARIFF, energyKWh, hoursPerDay, monthlyUse } from './energia';

describe('energy and cost', () => {
  it('converts minutes to hours', () => {
    expect(hoursPerDay(30, 'min')).toBe(0.5);
    expect(hoursPerDay(2, 'h')).toBe(2);
  });

  it('computes kWh from watts and hours', () => {
    expect(energyKWh(1000, 1)).toBe(1);
    expect(energyKWh(9, 6)).toBeCloseTo(0.054, 10);
  });

  it('matches the family shower of the lesson: 88 kWh and R$ 79,20 a month', () => {
    const use = monthlyUse(5500, 32, 'min', 30, EXAMPLE_TARIFF);
    expect(use.kWhPerDay).toBeCloseTo(2.9333, 3);
    expect(use.kWhPerMonth).toBeCloseTo(88, 6);
    expect(use.cost).toBeCloseTo(79.2, 6);
  });

  it('summer halves the cost', () => {
    const use = monthlyUse(2750, 32, 'min', 30, EXAMPLE_TARIFF);
    expect(use.kWhPerMonth).toBeCloseTo(44, 6);
    expect(use.cost).toBeCloseTo(39.6, 6);
  });

  it('a 9 W LED bulb, 6 h a day, uses 1,62 kWh a month', () => {
    expect(monthlyUse(9, 6, 'h', 30, EXAMPLE_TARIFF).kWhPerMonth).toBeCloseTo(1.62, 6);
  });

  it('has unique appliance ids', () => {
    const ids = APPLIANCES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
