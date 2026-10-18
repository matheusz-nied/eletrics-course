/**
 * Lesson 1.5 (power and energy): energy and cost of an appliance, used by
 * CustoEnergia.tsx. Pure, unit-tested in energia.test.ts.
 */

export interface Appliance {
  id: string;
  label: string;
  /** Typical power (W). */
  watts: number;
  /** Typical use per day. */
  amount: number;
  unit: 'min' | 'h';
}

/** Typical values, to start from; the student edits them. */
export const APPLIANCES: Appliance[] = [
  { id: 'chuveiro', label: 'Chuveiro no inverno', watts: 5500, amount: 32, unit: 'min' },
  { id: 'chuveiro-verao', label: 'Chuveiro no verão', watts: 2750, amount: 32, unit: 'min' },
  { id: 'lampada', label: 'Lâmpada LED', watts: 9, amount: 6, unit: 'h' },
  { id: 'ferro', label: 'Ferro de passar', watts: 1000, amount: 20, unit: 'min' },
  { id: 'micro-ondas', label: 'Micro-ondas', watts: 1200, amount: 10, unit: 'min' },
  { id: 'tv', label: 'TV', watts: 100, amount: 5, unit: 'h' },
  { id: 'celular', label: 'Carregador de celular', watts: 10, amount: 2, unit: 'h' },
];

/** Example tariff (R$ per kWh, taxes included). Not a real tariff: each bill has its own. */
export const EXAMPLE_TARIFF = 0.9;

/** Hours per day from an amount in minutes or hours. */
export function hoursPerDay(amount: number, unit: 'min' | 'h'): number {
  return unit === 'min' ? amount / 60 : amount;
}

/** Energy in kWh: E = P × t, with P in watts and t in hours. */
export function energyKWh(watts: number, hours: number): number {
  return (watts / 1000) * hours;
}

export interface MonthlyUse {
  hoursPerDay: number;
  kWhPerDay: number;
  kWhPerMonth: number;
  cost: number;
}

export function monthlyUse(
  watts: number,
  amount: number,
  unit: 'min' | 'h',
  days: number,
  tariff: number,
): MonthlyUse {
  const hours = hoursPerDay(amount, unit);
  const kWhPerDay = energyKWh(watts, hours);
  const kWhPerMonth = kWhPerDay * days;
  return { hoursPerDay: hours, kWhPerDay, kWhPerMonth, cost: kWhPerMonth * tariff };
}
