/**
 * Maths of the phasor widget of lesson 6.3 (Fasores.tsx): two sine waves of
 * the same frequency, each drawn as an arrow that turns once per cycle. The
 * height of the arrow tip is the value of the wave at that instant. Phases in
 * degrees; a positive phase leads (the wave peaks earlier).
 */

export interface Phasor {
  /** Peak value (any unit; the widget uses % of the reference wave). */
  amplitude: number;
  /** Phase in degrees, positive = leading. */
  phase: number;
}

const RAD = Math.PI / 180;

/** Phase brought to (−180°, 180°]. */
export function wrapDegrees(deg: number): number {
  let d = deg % 360;
  if (d <= -180) d += 360;
  if (d > 180) d -= 360;
  return d;
}

/** Value of the wave at the angle `theta` (degrees) of the cycle: A·sin(θ + φ). */
export function instant(p: Phasor, theta: number): number {
  return p.amplitude * Math.sin((theta + p.phase) * RAD);
}

/** Tip of the arrow at the angle `theta` of the cycle: x to the right, y up. */
export function tip(p: Phasor, theta: number): { x: number; y: number } {
  const a = (theta + p.phase) * RAD;
  return { x: p.amplitude * Math.cos(a), y: p.amplitude * Math.sin(a) };
}

/**
 * Sum of two waves of the same frequency: another sine of the same
 * frequency, whose arrow is the two arrows put tip to tail.
 */
export function sum(a: Phasor, b: Phasor): Phasor {
  const x = a.amplitude * Math.cos(a.phase * RAD) + b.amplitude * Math.cos(b.phase * RAD);
  const y = a.amplitude * Math.sin(a.phase * RAD) + b.amplitude * Math.sin(b.phase * RAD);
  const amplitude = Math.hypot(x, y);
  return { amplitude, phase: amplitude < 1e-9 ? 0 : wrapDegrees(Math.atan2(y, x) / RAD) };
}

/** A phase shift as time: degrees → milliseconds at `frequency` (60 Hz by default). */
export function degreesToMs(deg: number, frequency = 60): number {
  return (deg / 360) * (1000 / frequency);
}

/** How the second wave sits relative to the first, in words. */
export function shiftWords(deg: number): 'em fase' | 'adiantada' | 'atrasada' | 'em oposição' {
  const d = wrapDegrees(deg);
  if (Math.abs(d) < 1e-9) return 'em fase';
  if (Math.abs(Math.abs(d) - 180) < 1e-9) return 'em oposição';
  return d > 0 ? 'adiantada' : 'atrasada';
}
