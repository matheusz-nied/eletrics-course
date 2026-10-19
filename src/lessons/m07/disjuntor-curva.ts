/**
 * Time–current curve of the simulator's miniature breaker
 * (src/engine/devices/breaker.ts), for the chart of lesson 7.3. The bimetal
 * heats towards (I/In)² with a 60 s time constant and trips at 1,3² (so it
 * never trips below 1,3 × In); the magnetic release trips at once above 4, 7,5
 * or 15 × In for curves B, C and D. ./tres-falhas.test.ts checks these
 * formulas against the engine itself.
 */

export type Curve = 'B' | 'C' | 'D';

/** Thermal time constant of the bimetal (s). */
export const THERMAL_TAU = 60;
/** Multiple of In where the bimetal trips, given enough time. */
export const K_THERMAL = 1.3;
/** Magnetic trip, as a multiple of In. */
export const MAGNETIC: Record<Curve, number> = { B: 4, C: 7.5, D: 15 };
/** The bands of IEC 60898 for the magnetic trip (multiples of In). */
export const BANDS: Record<Curve, [number, number]> = { B: [3, 5], C: [5, 10], D: [10, 20] };

/** Time for the bimetal to trip, from cold, with `multiple` × In (s); Infinity if it never does. */
export function thermalTripTime(multiple: number): number {
  const ratio = (K_THERMAL / multiple) ** 2;
  return ratio >= 1 ? Infinity : -THERMAL_TAU * Math.log(1 - ratio);
}

/** Whether the magnetic release trips at once with `multiple` × In. */
export function tripsInstantly(multiple: number, curve: Curve): boolean {
  return multiple >= MAGNETIC[curve];
}
