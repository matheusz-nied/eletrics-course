/** Small numeric helpers shared by device models. */

/** Exact first-order response over `dt` towards `target` with time constant `tau`. */
export function relax(value: number, target: number, dt: number, tau: number): number {
  if (dt <= 0) return value;
  if (tau <= 0) return target;
  return target + (value - target) * Math.exp(-dt / tau);
}

/**
 * Running RMS estimate (exponential mean of the square). With τ = 10 ms it
 * settles within a few cycles of 60 Hz and reads DC exactly, which is what
 * event messages need ("tensão de 220 V").
 */
export class RmsMeter {
  private meanSquare = 0;
  constructor(private readonly tau = 0.01) {}
  update(value: number, dt: number): void {
    this.meanSquare = relax(this.meanSquare, value * value, dt, this.tau);
  }
  get value(): number {
    return Math.sqrt(this.meanSquare);
  }
  reset(): void {
    this.meanSquare = 0;
  }
}

/** Exponential average (for power). */
export class Average {
  private mean = 0;
  constructor(private readonly tau = 0.01) {}
  update(value: number, dt: number): void {
    this.mean = relax(this.mean, value, dt, this.tau);
  }
  get value(): number {
    return this.mean;
  }
  reset(): void {
    this.mean = 0;
  }
}
