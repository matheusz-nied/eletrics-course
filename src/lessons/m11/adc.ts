/**
 * Analog-to-digital conversion (lesson 11.6): sampling a signal at a fixed
 * rate and rounding each sample down to one of 2ⁿ codes, as the ADC of a
 * microcontroller does.
 */

/** Size of one step (V): the reference divided into 2ⁿ parts. */
export const stepOf = (vref: number, bits: number) => vref / 2 ** bits;

/** Code (0 to 2ⁿ − 1) for a voltage, as most ADCs give it: rounded down, clamped. */
export function toCode(v: number, vref: number, bits: number): number {
  const max = 2 ** bits - 1;
  return Math.min(max, Math.max(0, Math.floor(v / stepOf(vref, bits))));
}

/** The voltage a code stands for (V). */
export const fromCode = (code: number, vref: number, bits: number) => code * stepOf(vref, bits);

/** The signal of the widget: a 1 Hz sine between 0,5 V and 4,5 V. */
export const signalAt = (t: number) => 2.5 + 2 * Math.sin(2 * Math.PI * t);

/** Samples of `signal` over `duration` s at `rate` per second, each with its code. */
export function sample(
  signal: (t: number) => number,
  rate: number,
  duration: number,
  vref: number,
  bits: number,
) {
  const n = Math.floor(duration * rate + 1e-9);
  return Array.from({ length: n + 1 }, (_, k) => {
    const t = k / rate;
    const code = toCode(signal(t), vref, bits);
    return { t, v: signal(t), code, back: fromCode(code, vref, bits) };
  });
}

/** Sampling fast enough for a sine of `f` Hz (Nyquist: more than twice per period). */
export const nyquistOk = (rate: number, f: number) => rate > 2 * f;
