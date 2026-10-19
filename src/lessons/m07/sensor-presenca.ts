/**
 * Lesson 7.7: the logic of a presence sensor (PIR) in a hallway, used by
 * SensorPresenca.tsx. Pure, unit-tested in sensor-presenca.test.ts.
 *
 * - The PIR sees movement of something warm, not presence: a person who
 *   stops stops being seen.
 * - Every movement it sees restarts the timer (TIME): the light goes off
 *   TIME seconds after the last movement.
 * - The LUX setting only matters to turn the light on: with the light off
 *   and the ambient light above the setting, movement is ignored. With the
 *   light already on, movement keeps it on (the sensor does not read its own
 *   lamp as daylight).
 */

export interface Settings {
  /** TIME: how long the light stays on after the last movement (s). */
  time: number;
  /** LUX: turns on only below this ambient light (lx). Infinity = always. */
  luxLimit: number;
}

export interface Lamp {
  on: boolean;
  /** Simulated time at which the light goes off, if nothing moves (s). */
  offAt: number;
}

export type MotionOutcome = 'acendeu' | 'renovou' | 'claro-demais';

export const OFF: Lamp = { on: false, offAt: 0 };

/** TIME knob positions of the example (s). Real sensors go from seconds to minutes (typical). */
export const TIMES = [10, 30, 60, 180];

/** LUX knob positions of the example. */
export const LUX_LIMITS: { id: string; limit: number; label: string }[] = [
  { id: 'sol', limit: Infinity, label: 'No sol: acende sempre' },
  { id: 'meio', limit: 50, label: 'No meio: abaixo de 50 lx' },
  { id: 'lua', limit: 5, label: 'Na lua: abaixo de 5 lx' },
];

/** Ambient light in the hallway (lx, typical). */
export const AMBIENTS: { id: string; lux: number; label: string }[] = [
  { id: 'dia', lux: 300, label: 'Dia claro (300 lx)' },
  { id: 'tarde', lux: 30, label: 'Fim de tarde (30 lx)' },
  { id: 'noite', lux: 1, label: 'Noite (1 lx)' },
];

/** How long a person takes to walk through the field of view (simulated s). */
export const WALK_S = 6;

/** The sensor saw movement at time t. */
export function onMotion(
  lamp: Lamp,
  t: number,
  ambientLux: number,
  settings: Settings,
): { lamp: Lamp; outcome: MotionOutcome } {
  const on = isOn(lamp, t);
  if (!on && ambientLux >= settings.luxLimit) return { lamp: OFF, outcome: 'claro-demais' };
  return { lamp: { on: true, offAt: t + settings.time }, outcome: on ? 'renovou' : 'acendeu' };
}

/** Is the light on at time t? */
export function isOn(lamp: Lamp, t: number): boolean {
  return lamp.on && t < lamp.offAt;
}

/** The lamp after the time passes to t (off once the timer runs out). */
export function tick(lamp: Lamp, t: number): Lamp {
  return isOn(lamp, t) ? lamp : OFF;
}

/** Seconds left until the light goes off (0 when off). */
export function remaining(lamp: Lamp, t: number): number {
  return isOn(lamp, t) ? lamp.offAt - t : 0;
}

/**
 * Intervals with the light on, for a list of moments with movement (sorted),
 * all with the same ambient light. Used to check the numbers of the lesson.
 */
export function lightIntervals(
  motions: number[],
  ambientLux: number,
  settings: Settings,
): [number, number][] {
  const out: [number, number][] = [];
  let lamp = OFF;
  for (const t of motions) {
    const wasOn = isOn(lamp, t);
    lamp = onMotion(lamp, t, ambientLux, settings).lamp;
    if (!lamp.on) continue;
    const last = out[out.length - 1];
    if (wasOn && last) last[1] = lamp.offAt;
    else out.push([t, lamp.offAt]);
  }
  return out;
}

/** Moments with movement while a person walks through, sampled every `step` s. */
export function walkMotions(start: number, step = 0.1, duration = WALK_S): number[] {
  const n = Math.round(duration / step);
  return Array.from({ length: n + 1 }, (_, k) => start + k * step);
}
