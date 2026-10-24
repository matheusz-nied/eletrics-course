/**
 * 555 timing (lesson 11.5): the capacitor charges and discharges between
 * 1/3 and 2/3 of the supply, and ln 2 ≈ 0,693 of a time constant takes it
 * from one to the other (ln 3 ≈ 1,1 from 0 to 2/3).
 */
const LN2 = Math.log(2);
const LN3 = Math.log(3);

/** Astable: high while charging through R1 + R2, low while discharging through R2. */
export function astable(r1: number, r2: number, c: number) {
  const high = LN2 * (r1 + r2) * c;
  const low = LN2 * r2 * c;
  const period = high + low;
  return { high, low, period, frequency: 1 / period, duty: high / period };
}

/** Monostable: high while the capacitor charges from 0 to 2/3 of the supply through R. */
export function monostable(r: number, c: number) {
  return LN3 * r * c;
}
