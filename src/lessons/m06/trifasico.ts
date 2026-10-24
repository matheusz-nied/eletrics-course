/**
 * Lesson 6.7: the three phases of a star-connected supply as phasors and as
 * waves, and the voltage between two phases (pure functions, tested in
 * trifasico.test.ts).
 *
 * Phase k (L1, L2, L3) lags L1 by k·120°: v_k(θ) = Vp·sin(θ − k·120°).
 * The voltage between two phases is the difference of two such sines, a sine
 * √3 times bigger, shifted by 30°.
 */

export type PhaseId = 'L1' | 'L2' | 'L3';
export const PHASES: PhaseId[] = ['L1', 'L2', 'L3'];

/** Supply systems used in Brazil: phase-to-neutral / phase-to-phase (nominal, RMS). */
export const SYSTEMS = {
  '127/220': { phase: 127, line: 220 },
  '220/380': { phase: 220, line: 380 },
} as const;
export type SystemId = keyof typeof SYSTEMS;

export type PairId = 'L1-L2' | 'L2-L3' | 'L3-L1';
export const PAIRS: Record<PairId, [PhaseId, PhaseId]> = {
  'L1-L2': ['L1', 'L2'],
  'L2-L3': ['L2', 'L3'],
  'L3-L1': ['L3', 'L1'],
};

const DEG = Math.PI / 180;

/** How far each phase lags L1 (radians). */
export function lag(phase: PhaseId): number {
  return PHASES.indexOf(phase) * 120 * DEG;
}

/** Instantaneous voltage of a phase (V) at angle θ (radians) for an RMS value. */
export function phaseVoltage(phase: PhaseId, theta: number, rms: number): number {
  return rms * Math.SQRT2 * Math.sin(theta - lag(phase));
}

/** Instantaneous voltage between two phases, a − b (V). */
export function lineVoltage(pair: PairId, theta: number, rms: number): number {
  const [a, b] = PAIRS[pair];
  return phaseVoltage(a, theta, rms) - phaseVoltage(b, theta, rms);
}

/**
 * Tip of a phasor in the diagram at angle θ: the phasor of phase k turns
 * counter-clockwise and its projection on the vertical axis is the
 * instantaneous value. Returns [x, y] with y up, length `scale`.
 */
export function phasorTip(phase: PhaseId, theta: number, scale = 1): [number, number] {
  const a = theta - lag(phase);
  return [scale * Math.cos(a), scale * Math.sin(a)];
}

/** RMS of the voltage between two phases of a star supply: √3 times the phase voltage. */
export function lineRms(phaseRms: number): number {
  return phaseRms * Math.sqrt(3);
}

/** RMS of a sampled waveform over whole cycles (for tests). */
export function rmsOf(f: (theta: number) => number, samples = 3600): number {
  let sum = 0;
  for (let i = 0; i < samples; i++) sum += f((2 * Math.PI * i) / samples) ** 2;
  return Math.sqrt(sum / samples);
}

/** Sum of the three phase voltages at θ: always zero in a balanced supply. */
export function sumOfPhases(theta: number, rms: number): number {
  return PHASES.reduce((s, p) => s + phaseVoltage(p, theta, rms), 0);
}
