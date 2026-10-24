/**
 * Lesson 6.1: a bench generator, a loop turning between two magnet poles.
 * Pure functions for GeradorOsciloscopio.tsx, tested in gerador.test.ts.
 *
 * Angle convention (as in figure 5.3 RotatingLoop): at 0° the loop faces the
 * field (most flux, not changing), so v = 0; at 90° it lies along the field
 * and the voltage is at its positive peak. v = Vp · sin θ.
 *
 * With fixed magnets the peak grows with the speed (Faraday: the flux changes
 * faster), so the peak is proportional to the frequency.
 */

/** Peak voltage per hertz of this bench generator (V/Hz): 12 V at 60 Hz. */
export const PEAK_PER_HZ = 0.2;

/** The speed range of the widget, in turns per second (= Hz with two poles). */
export const SPEED = { min: 5, max: 90, step: 1, initial: 60 };

/** Time shown on the scope (s): 10 divisions of 5 ms. */
export const SCOPE_WINDOW = 0.05;
export const SCOPE_DIV = 0.005;

/** Fixed vertical scale (V/div), so the peak visibly grows with the speed. */
export const SCOPE_VDIV = 5;

/** On the screen, 50 ms of the generator take 5 s: slow motion of 100×. */
export const SLOW_MOTION = 100;

/** Peak voltage at `f` hertz (V). */
export function peak(f: number): number {
  return PEAK_PER_HZ * f;
}

/** Period of one turn, one cycle (s). */
export function period(f: number): number {
  return 1 / f;
}

/** Shaft speed in rpm of a two-pole generator giving `f` hertz. */
export function rpm(f: number): number {
  return 60 * f;
}

/** Shaft speed in rpm of a generator with `poles` poles giving `f` hertz: n = 120·f / p. */
export function rpmWithPoles(f: number, poles: number): number {
  return (120 * f) / poles;
}

/** Angle of the loop (degrees, 0 to 360) at time t. */
export function angle(f: number, t: number): number {
  const turns = f * t;
  return (turns - Math.floor(turns)) * 360;
}

/** Instantaneous voltage at time t (V). */
export function voltage(f: number, t: number): number {
  return peak(f) * Math.sin(2 * Math.PI * f * t);
}

/** Voltage with the loop at `deg` degrees (V). */
export function voltageAtAngle(f: number, deg: number): number {
  return peak(f) * Math.sin((deg * Math.PI) / 180);
}

/** How many whole and partial cycles fit in the scope window. */
export function cyclesOnScreen(f: number): number {
  return f * SCOPE_WINDOW;
}

/** Points (t, v) of the trace from 0 to `until` seconds. */
export function trace(f: number, until: number, n = 600): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = [];
  const end = Math.min(until, SCOPE_WINDOW);
  const count = Math.max(2, Math.round((n * end) / SCOPE_WINDOW));
  for (let i = 0; i <= count; i++) {
    const t = (end * i) / count;
    out.push({ t, v: voltage(f, t) });
  }
  return out;
}
