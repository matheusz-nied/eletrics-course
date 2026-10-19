/**
 * Lesson 8.3: the rotating field of three coils 120° apart. Each coil makes
 * a field along its own axis, proportional to its current; the sum of the
 * three is the stator field. With three balanced currents the sum has a
 * constant size (1,5 times one coil's peak) and turns once per cycle; with
 * two phases swapped it turns the other way; with one line open the two
 * coils left are in series, carry the same current and the sum only pulses
 * back and forth along a fixed line. Pure, unit-tested in campo-girante.test.ts.
 */

/** How the coils are fed. */
export type Feed = 'normal' | 'invertida' | 'falta-fase';

export const PHASES = ['L1', 'L2', 'L3'] as const;

/** Axis of each coil (degrees, counterclockwise from the right): L1 on top. */
export const COIL_AXES = [90, 210, 330] as const;

const DEG = Math.PI / 180;

export interface Vector {
  x: number;
  y: number;
}

/**
 * Current in each coil (peak of one coil = 1) at the electrical angle
 * `theta` (degrees) of L1's wave.
 */
export function coilCurrents(theta: number, feed: Feed): [number, number, number] {
  const a = Math.cos(theta * DEG);
  const b = Math.cos((theta - 120) * DEG);
  const c = Math.cos((theta + 120) * DEG);
  if (feed === 'invertida') return [a, c, b];
  if (feed === 'falta-fase') {
    // L3 open: coils 1 and 2 in series across L1–L2, half of that voltage each.
    const i = (a - b) / 2;
    return [i, -i, 0];
  }
  return [a, b, c];
}

/** Field of one coil: its current along its axis. */
export function coilField(current: number, k: 0 | 1 | 2): Vector {
  const axis = COIL_AXES[k] * DEG;
  return { x: current * Math.cos(axis), y: current * Math.sin(axis) };
}

/** The stator field: the sum of the three coils' fields. */
export function statorField(theta: number, feed: Feed): Vector {
  const i = coilCurrents(theta, feed);
  const f = [coilField(i[0], 0), coilField(i[1], 1), coilField(i[2], 2)];
  return { x: f[0]!.x + f[1]!.x + f[2]!.x, y: f[0]!.y + f[1]!.y + f[2]!.y };
}

export const magnitude = (v: Vector) => Math.hypot(v.x, v.y);

/** Direction of a vector in degrees, 0 to 360, counterclockwise from the right. */
export function direction(v: Vector): number {
  const d = Math.atan2(v.y, v.x) / DEG;
  return ((d % 360) + 360) % 360;
}

/**
 * Which way the field turns: +1 counterclockwise, −1 clockwise, 0 when it
 * only pulses along a line (the motor hums and does not start).
 */
export function rotation(feed: Feed): 1 | -1 | 0 {
  if (feed === 'falta-fase') return 0;
  return feed === 'invertida' ? -1 : 1;
}

/** Points of the field tip over one cycle: a circle, or a line when it pulses. */
export function fieldLocus(feed: Feed, steps = 72): Vector[] {
  return Array.from({ length: steps + 1 }, (_, k) => statorField((360 * k) / steps, feed));
}
