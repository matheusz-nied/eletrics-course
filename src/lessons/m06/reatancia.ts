/**
 * Reactance and impedance for lesson 6.4: the formulas and the curves of the
 * chart (10 µF and 100 mH, the parts of the simulation).
 */

/** Reactance of a capacitor (Ω): X_C = 1 / (2πfC). */
export function capacitiveReactance(frequency: number, capacitance: number): number {
  return 1 / (2 * Math.PI * frequency * capacitance);
}

/** Reactance of a coil (Ω): X_L = 2πfL. */
export function inductiveReactance(frequency: number, inductance: number): number {
  return 2 * Math.PI * frequency * inductance;
}

/**
 * Series impedance of a resistance and a net reactance X = X_L − X_C (Ω),
 * and the angle of the current behind the voltage (degrees; negative = ahead).
 */
export function seriesImpedance(resistance: number, reactance: number) {
  return {
    z: Math.hypot(resistance, reactance),
    phase: (Math.atan2(reactance, resistance) * 180) / Math.PI,
  };
}

/** The frequency where a coil and a capacitor have the same reactance (Hz). */
export function equalReactanceFrequency(inductance: number, capacitance: number): number {
  return 1 / (2 * Math.PI * Math.sqrt(inductance * capacitance));
}

/** Points of the chart: X_C of 10 µF and X_L of 100 mH from 20 Hz to 1.000 Hz. */
export function reactanceCurves(): { label: string; unit: string; points: [number, number][] }[] {
  const f = Array.from({ length: 99 }, (_, i) => 20 + i * 10);
  return [
    {
      label: 'Capacitor de 10 µF',
      unit: 'Ω',
      points: f.map((x) => [x, capacitiveReactance(x, 10e-6)]),
    },
    {
      label: 'Bobina de 100 mH',
      unit: 'Ω',
      points: f.map((x) => [x, inductiveReactance(x, 0.1)]),
    },
  ];
}
