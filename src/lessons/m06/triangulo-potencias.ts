/**
 * Lesson 6.5 (AC power and power factor): the power triangle of a load and
 * the correction with a capacitor in parallel. Sine waves only, so the power
 * factor is cos φ. Pure, unit-tested in triangulo-potencias.test.ts.
 */

export interface PowerTriangle {
  /** Active power (W). */
  p: number;
  /** Reactive power (var): positive inductive, negative capacitive. */
  q: number;
  /** Apparent power (VA). */
  s: number;
  /** Power factor, P/S (0…1). */
  pf: number;
  /** Angle between voltage and current (degrees), positive when the current lags. */
  phi: number;
  /** Current drawn from the mains (A, RMS). */
  current: number;
}

function triangle(p: number, q: number, volts: number): PowerTriangle {
  const s = Math.hypot(p, q);
  return {
    p,
    q,
    s,
    pf: s > 0 ? p / s : 1,
    phi: (Math.atan2(q, p) * 180) / Math.PI,
    current: s / volts,
  };
}

/** A load of active power `p` (W) and inductive power factor `pf` on `volts` (RMS). */
export function loadTriangle(p: number, pf: number, volts: number): PowerTriangle {
  const q = p * Math.tan(Math.acos(pf));
  return triangle(p, q, volts);
}

/** Reactive power a capacitor of `farads` gives back on `volts` at `hz` (var): ωCV². */
export function capacitorVar(farads: number, volts: number, hz = 60): number {
  return 2 * Math.PI * hz * farads * volts * volts;
}

/** The same load with a capacitor of `farads` in parallel. */
export function corrected(
  p: number,
  pf: number,
  volts: number,
  farads: number,
  hz = 60,
): PowerTriangle {
  const load = loadTriangle(p, pf, volts);
  return triangle(p, load.q - capacitorVar(farads, volts, hz), volts);
}

/**
 * Capacitance (F) that raises the power factor of a load from `pf` to
 * `target` (both inductive): C = P·(tan φ₁ − tan φ₂) / (ω·V²). Zero when
 * the load is already at or above the target.
 */
export function capacitorFor(p: number, pf: number, target: number, volts: number, hz = 60) {
  if (pf >= target) return 0;
  const dq = p * (Math.tan(Math.acos(pf)) - Math.tan(Math.acos(target)));
  return dq / (2 * Math.PI * hz * volts * volts);
}

/** Loads the widget starts from: typical values, not a manufacturer's spec. */
export const LOADS = [
  { id: 'bomba', label: 'Bomba d’água de 1/2 cv', p: 500, pf: 0.71 },
  { id: 'ventilador', label: 'Ventilador de teto', p: 100, pf: 0.8 },
  { id: 'reator', label: 'Lâmpada fluorescente com reator simples', p: 40, pf: 0.5 },
  { id: 'chuveiro', label: 'Chuveiro', p: 5500, pf: 1 },
] as const;
