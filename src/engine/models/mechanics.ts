/**
 * Mechanical couplings between devices: a motor's shaft and the gate it
 * drives, the gate's position and the limit switches that watch it. A device
 * offers these through `DeviceModel.exposes`; another finds it by element id
 * in `couple()`.
 */

export interface Shaft {
  /** Rotor speed (rad/s); positive is the motor's forward direction. */
  speed: number;
  /** Rotor inertia (kg·m²). */
  readonly inertia: number;
  /**
   * Electromagnetic torque at rotor speed `w` (N·m), with the winding
   * voltages of the last solve held: what the load needs to integrate the
   * drive train implicitly over a mechanical step.
   */
  torqueAt(w: number): number;
  /** Bearing friction (N·m, opposing the motion). */
  readonly coulomb: number;
  /** Fan and viscous losses per rad/s (N·m·s). */
  readonly viscous: number;
  /** True while a load (the gate) integrates the speed; the motor then leaves it alone. */
  driven: boolean;
}

export interface Track {
  /** Position of the moving part along its travel (m from the closed end). */
  readonly position: number;
}

export interface Exposed {
  shaft?: Shaft;
  track?: Track;
}

/**
 * Speed after one implicit (backward Euler) step of m·dv/dt = f(v) − c·sgn(v),
 * where f is the driving force (decreasing enough with v that the step is
 * monotonic) and c ≥ 0 the Coulomb friction, which also holds the part still
 * while |f(0)| ≤ c. Solved by bisection on [−vMax, vMax].
 */
export function implicitStep(
  v0: number,
  mass: number,
  dt: number,
  drive: (v: number) => number,
  coulomb: (v: number) => number,
  vMax: number,
): number {
  const k = mass / dt;
  const g = (v: number) => k * (v - v0) - drive(v) + Math.sign(v) * coulomb(v);
  // Sticking: the residual changes sign across zero.
  const below = k * -v0 - drive(0) - coulomb(0);
  const above = k * -v0 - drive(0) + coulomb(0);
  if (below <= 0 && above >= 0) return 0;
  let lo: number;
  let hi: number;
  if (above < 0) {
    lo = 0;
    hi = Math.max(vMax, Math.abs(v0)) * 2;
    while (g(hi) < 0 && hi < 1e6) hi *= 2;
  } else {
    hi = 0;
    lo = -Math.max(vMax, Math.abs(v0)) * 2;
    while (g(lo) > 0 && lo > -1e6) lo *= 2;
  }
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (mid === lo || mid === hi) break;
    if (g(mid) > 0) hi = mid;
    else lo = mid;
  }
  return 0.5 * (lo + hi);
}
