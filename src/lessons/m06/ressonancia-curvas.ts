/**
 * Lesson 6.6 (resonance and filters): the formulas the lesson uses and the
 * reactance curves of its series RLC (10 mH, 10 µF, 10 Ω) for <Plot>.
 * Unit-tested in filtros.test.ts.
 */

export interface CurveSeries {
  label: string;
  unit: string;
  points: [number, number][];
}

/** Inductive reactance X_L = 2πfL (Ω). */
export const inductiveReactance = (f: number, henries: number) => 2 * Math.PI * f * henries;

/** Capacitive reactance X_C = 1/(2πfC) (Ω). */
export const capacitiveReactance = (f: number, farads: number) => 1 / (2 * Math.PI * f * farads);

/** Resonance frequency of L and C: f0 = 1/(2π√(LC)) (Hz). */
export const resonance = (henries: number, farads: number) =>
  1 / (2 * Math.PI * Math.sqrt(henries * farads));

/** Cut-off frequency of an RC (or RL, with τ = L/R) filter: 1/(2πτ) (Hz). */
export const cutoffRC = (ohms: number, farads: number) => 1 / (2 * Math.PI * ohms * farads);
export const cutoffRL = (henries: number, ohms: number) => ohms / (2 * Math.PI * henries);

/** Quality factor of a series RLC: Q = (1/R)·√(L/C). */
export const qualityFactor = (ohms: number, henries: number, farads: number) =>
  Math.sqrt(henries / farads) / ohms;

/** A gain (V/V) in decibels: 20·log₁₀(gain). */
export const toDb = (gain: number) => 20 * Math.log10(gain);

/** Gain of a first-order low-pass RC filter at f: 1/√(1 + (f/fc)²). */
export const lowPassGain = (f: number, fc: number) => 1 / Math.sqrt(1 + (f / fc) ** 2);

export const RLC = { r: 10, l: 0.01, c: 10e-6 } as const;

const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);

/** X_L, X_C and |Z| of the lesson's RLC from 100 Hz to 1 kHz. */
export const REACTANCE_CURVES: CurveSeries[] = (() => {
  const fs = range(100, 1000, 10);
  const xl = (f: number) => inductiveReactance(f, RLC.l);
  const xc = (f: number) => capacitiveReactance(f, RLC.c);
  return [
    { label: 'Reatância do indutor (XL)', unit: 'Ω', points: fs.map((f) => [f, xl(f)]) },
    { label: 'Reatância do capacitor (XC)', unit: 'Ω', points: fs.map((f) => [f, xc(f)]) },
    {
      label: 'Impedância do conjunto |Z|',
      unit: 'Ω',
      points: fs.map((f) => [f, Math.hypot(RLC.r, xl(f) - xc(f))]),
    },
  ];
})();
