/**
 * Lesson 5.5: the field of a small magnet at a sensor in front of it, and
 * how a reed switch and two kinds of Hall sensor answer to it. Pure, unit
 * tested in ima-sensor.test.ts.
 *
 * The magnet is a disc (Ø 10 × 5 mm) magnetized along its axis, with the
 * sensor on that axis. On the axis of a uniformly magnetized cylinder the
 * field is exact: B(z) = (Br/2)·[(z + L)/√(R² + (z + L)²) − z/√(R² + z²)],
 * z measured from the face. Far away it falls like 1/z³.
 */

export type MagnetId = 'ferrite' | 'neodimio';
export type Pole = 'sul' | 'norte';

export interface Magnet {
  label: string;
  /** Remanence (T). */
  br: number;
}

/** Disc radius and thickness (mm). */
export const MAGNET_RADIUS = 5;
export const MAGNET_LENGTH = 5;

/** Typical remanence of each material (T). */
export const MAGNETS: Record<MagnetId, Magnet> = {
  ferrite: { label: 'Ferrite (o ímã preto de geladeira e de sensor de porta)', br: 0.38 },
  neodimio: { label: 'Neodímio (o ímã prateado, bem mais forte)', br: 1.2 },
};

/** Reed switch of the example: closes at 3 mT and opens again below 2 mT (typical). */
export const REED = { closeMt: 3, openMt: 2 };

/** Unipolar Hall switch of the example: on at 10 mT of a south pole, off below 7 mT (typical). */
export const HALL_SWITCH = { operateMt: 10, releaseMt: 7 };

/** Linear Hall sensor of the example, on 5 V: 2,5 V at zero field, 14 mV/mT, 0,9 V to 4,1 V. */
export const HALL_LINEAR = { zeroV: 2.5, mvPerMt: 14, minV: 0.9, maxV: 4.1 };

/**
 * Field at the sensor (mT), `distance` mm from the magnet face. Positive when
 * the south pole faces the sensor (the sign convention of Hall sensor
 * datasheets), negative for the north pole.
 */
export function fieldAt(distance: number, magnet: MagnetId, pole: Pole = 'sul'): number {
  const z = Math.max(0, distance);
  const r2 = MAGNET_RADIUS ** 2;
  const far = z + MAGNET_LENGTH;
  const b =
    (MAGNETS[magnet].br / 2) * (far / Math.sqrt(r2 + far * far) - z / Math.sqrt(r2 + z * z));
  return (pole === 'sul' ? 1 : -1) * b * 1000;
}

/** Reed switch with hysteresis: either pole closes it. */
export function reedNext(closed: boolean, fieldMt: number): boolean {
  const b = Math.abs(fieldMt);
  if (b >= REED.closeMt) return true;
  if (b <= REED.openMt) return false;
  return closed;
}

/** Unipolar Hall switch with hysteresis: only a south pole turns it on. */
export function hallSwitchNext(on: boolean, fieldMt: number): boolean {
  if (fieldMt >= HALL_SWITCH.operateMt) return true;
  if (fieldMt <= HALL_SWITCH.releaseMt) return false;
  return on;
}

/** Output of the linear Hall sensor (V). */
export function hallLinear(fieldMt: number): number {
  const v = HALL_LINEAR.zeroV + (HALL_LINEAR.mvPerMt / 1000) * fieldMt;
  return Math.min(HALL_LINEAR.maxV, Math.max(HALL_LINEAR.minV, v));
}

/** Distance (mm) at which the field of `magnet` falls to `fieldMt`, by bisection. */
export function distanceFor(fieldMt: number, magnet: MagnetId): number {
  let lo = 0;
  let hi = 1000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (fieldAt(mid, magnet) > fieldMt) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
