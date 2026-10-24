/**
 * Lesson 6.2: peak, average and RMS of common waveforms, and what an
 * average-responding multimeter (the cheap kind, calibrated for sines) shows
 * for each. Pure functions for FormasDeOnda.tsx, tested in formas-de-onda.test.ts.
 *
 * Every wave is symmetric (the negative half mirrors the positive one), so the
 * average over a whole cycle is zero, like the outlet's. The common meter
 * rectifies the signal, takes the average of |v| and multiplies it by the
 * sine's form factor, π / (2√2) ≈ 1,111: right for a sine, wrong for the rest.
 */

export type WaveKind = 'senoide' | 'quadrada' | 'triangular' | 'semi-senoidal' | 'dimmer';

export const WAVES: Record<WaveKind, { label: string; where: string }> = {
  senoide: {
    label: 'Senoide',
    where: 'A tomada, a saída de um transformador, um nobreak senoidal.',
  },
  quadrada: {
    label: 'Quadrada',
    where: 'Sinais digitais e de controle, alguns inversores muito simples.',
  },
  triangular: {
    label: 'Triangular',
    where: 'Geradores de função de bancada, circuitos de PWM por dentro.',
  },
  'semi-senoidal': {
    label: 'Semi-senoidal',
    where: 'Nobreaks e inversores mais baratos, chamados de onda "senoidal modificada".',
  },
  dimmer: {
    label: 'Dimmer',
    where: 'A saída de um dimmer de lâmpada ou de um controle de velocidade de ventilador.',
  },
};

/** Peak used in the widget: the outlet of 127 V (V). */
export const OUTLET_PEAK = 127 * Math.SQRT2;

/** Form factor of a sine (RMS ÷ rectified average): the common meter's calibration. */
export const SINE_FORM_FACTOR = Math.PI / (2 * Math.SQRT2);

/** Fraction of each half cycle at full voltage in the semi-sine (modified sine) wave. */
export const SEMI_SINE_DUTY = 0.5;

/**
 * Value of the wave with peak 1 at `x` (fraction of the cycle, 0 to 1).
 * `alpha` is the dimmer's firing angle (degrees, 0 = full sine).
 */
export function sample(kind: WaveKind, x: number, alpha = 90): number {
  const u = x - Math.floor(x);
  const half = u < 0.5 ? 1 : -1;
  const inHalf = (u % 0.5) / 0.5; // 0 to 1 inside each half cycle
  switch (kind) {
    case 'senoide':
      return Math.sin(2 * Math.PI * u);
    case 'quadrada':
      return half;
    case 'triangular':
      return u < 0.25 ? 4 * u : u < 0.75 ? 2 - 4 * u : 4 * u - 4;
    case 'semi-senoidal': {
      const gap = (1 - SEMI_SINE_DUTY) / 2;
      return inHalf >= gap && inHalf < 1 - gap ? half : 0;
    }
    case 'dimmer':
      return inHalf * 180 >= alpha ? Math.sin(2 * Math.PI * u) : 0;
  }
}

/** RMS and rectified average (mean of |v|) of the wave with peak 1. */
export function shape(kind: WaveKind, alpha = 90): { rms: number; average: number } {
  switch (kind) {
    case 'senoide':
      return { rms: 1 / Math.SQRT2, average: 2 / Math.PI };
    case 'quadrada':
      return { rms: 1, average: 1 };
    case 'triangular':
      return { rms: 1 / Math.sqrt(3), average: 0.5 };
    case 'semi-senoidal':
      return { rms: Math.sqrt(SEMI_SINE_DUTY), average: SEMI_SINE_DUTY };
    case 'dimmer': {
      const a = (Math.min(180, Math.max(0, alpha)) * Math.PI) / 180;
      return {
        rms: Math.sqrt((Math.PI - a + Math.sin(2 * a) / 2) / (2 * Math.PI)),
        average: (1 + Math.cos(a)) / Math.PI,
      };
    }
  }
}

export interface Reading {
  peak: number;
  peakToPeak: number;
  /** Average over a whole cycle: zero for these symmetric waves. */
  mean: number;
  /** Average of |v| (half-cycle average). */
  average: number;
  /** True RMS: what heats a resistor like a DC voltage of the same value. */
  rms: number;
  /** What an average-responding meter shows in V~. */
  meter: number;
  /** Error of that meter relative to the true RMS (fraction: −0,215 = 21,5 % low). */
  error: number;
}

/** Values of the wave `kind` whose full sine (or level) has peak `peak`. */
export function reading(kind: WaveKind, peak = OUTLET_PEAK, alpha = 90): Reading {
  const s = shape(kind, alpha);
  const rms = s.rms * peak;
  const meter = SINE_FORM_FACTOR * s.average * peak;
  // A dimmer firing after 90° cuts the top off: the highest point is where it fires.
  const top = kind === 'dimmer' && alpha > 90 ? peak * Math.sin((alpha * Math.PI) / 180) : peak;
  return {
    peak: top,
    peakToPeak: 2 * top,
    mean: 0,
    average: s.average * peak,
    rms,
    meter,
    error: rms > 0 ? meter / rms - 1 : 0,
  };
}
