/**
 * Result of an AC sweep. Both engines answer `runUntil` on an 'ac-sweep'
 * circuit with a single frame that carries the whole sweep in `frame.sweep`.
 */
import type { SimFrame } from '../../engine/contract';

export interface Sweep {
  /** Frequencies (Hz), increasing. */
  f: number[];
  /** Gain of each voltage probe relative to the swept source (V/V, linear). */
  magnitude: Record<string, number[]>;
  /** Phase of each voltage probe (degrees, unwrapped). */
  phase: Record<string, number[]>;
}

export type SweepFrame = SimFrame & { sweep?: Sweep };

/** The sweep carried by the frames of an 'ac-sweep' run, or null. */
export function sweepOf(frames: readonly SimFrame[]): Sweep | null {
  for (const frame of frames) {
    const sweep = (frame as SweepFrame).sweep;
    if (sweep) return sweep;
  }
  return null;
}

/** Removes the ±360° jumps of a phase series (degrees). */
export function unwrapDegrees(phase: number[]): number[] {
  const out: number[] = [];
  let offset = 0;
  for (let i = 0; i < phase.length; i++) {
    const p = phase[i]!;
    if (i > 0) {
      const step = p + offset - out[i - 1]!;
      if (step > 180) offset -= 360;
      else if (step < -180) offset += 360;
    }
    out.push(p + offset);
  }
  return out;
}
