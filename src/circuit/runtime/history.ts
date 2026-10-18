/**
 * Ring buffer of simulated samples for the instruments: one time column and
 * one column per tracked channel ("probe:V1", "R1.current"…).
 */
export class History {
  readonly capacity: number;
  private t: Float64Array;
  private cols = new Map<string, Float64Array>();
  private head = 0; // next write position
  private size = 0;

  constructor(capacity = 1 << 16) {
    this.capacity = capacity;
    this.t = new Float64Array(capacity);
  }

  get length() {
    return this.size;
  }

  channels(): string[] {
    return [...this.cols.keys()];
  }

  has(key: string) {
    return this.cols.has(key);
  }

  /** Starts recording a channel (earlier samples read as NaN). */
  track(key: string) {
    if (!this.cols.has(key)) this.cols.set(key, new Float64Array(this.capacity).fill(Number.NaN));
  }

  clear() {
    this.head = 0;
    this.size = 0;
    for (const c of this.cols.values()) c.fill(Number.NaN);
  }

  push(t: number, values: (key: string) => number) {
    // Time went backwards (reset or a new run): start over.
    if (this.size > 0 && t < this.lastT()) this.clear();
    this.t[this.head] = t;
    for (const [key, col] of this.cols) col[this.head] = values(key);
    this.head = (this.head + 1) % this.capacity;
    this.size = Math.min(this.size + 1, this.capacity);
  }

  private idx(i: number) {
    return (this.head - this.size + i + this.capacity) % this.capacity;
  }

  firstT(): number {
    return this.size ? this.t[this.idx(0)]! : Number.NaN;
  }

  lastT(): number {
    return this.size ? this.t[this.idx(this.size - 1)]! : Number.NaN;
  }

  /** Index (0…length) of the first sample with time ≥ t. */
  lowerBound(t: number): number {
    let lo = 0;
    let hi = this.size;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.t[this.idx(mid)]! < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  timeAt(i: number): number {
    return this.t[this.idx(i)]!;
  }

  valueAt(key: string, i: number): number {
    const col = this.cols.get(key);
    return col ? col[this.idx(i)]! : Number.NaN;
  }

  /**
   * Samples with t0 ≤ t ≤ t1. Above `maxPoints`, each bucket keeps the first
   * and last sample times with the bucket's extremes of each channel, so peaks
   * survive decimation (no aliasing on the oscilloscope).
   */
  window(
    t0: number,
    t1: number,
    keys: string[],
    maxPoints = 2000,
  ): { t: number[]; values: number[][] } {
    const start = this.lowerBound(t0);
    const end = this.lowerBound(t1 + 1e-15);
    const n = end - start;
    const t: number[] = [];
    const values: number[][] = keys.map(() => []);
    if (n <= 0) return { t, values };
    const cols = keys.map((k) => this.cols.get(k));
    if (n <= maxPoints) {
      for (let i = start; i < end; i++) {
        const j = this.idx(i);
        t.push(this.t[j]!);
        cols.forEach((c, k) => values[k]!.push(c ? c[j]! : Number.NaN));
      }
      return { t, values };
    }
    const buckets = Math.max(1, Math.floor(maxPoints / 2));
    const size = n / buckets;
    for (let b = 0; b < buckets; b++) {
      const i0 = start + Math.floor(b * size);
      const i1 = Math.min(end, start + Math.floor((b + 1) * size));
      if (i1 <= i0) continue;
      t.push(this.t[this.idx(i0)]!, this.t[this.idx(i1 - 1)]!);
      cols.forEach((c, k) => {
        if (!c) {
          values[k]!.push(Number.NaN, Number.NaN);
          return;
        }
        let lo = Number.POSITIVE_INFINITY;
        let hi = Number.NEGATIVE_INFINITY;
        let loAt = i0;
        let hiAt = i0;
        for (let i = i0; i < i1; i++) {
          const v = c[this.idx(i)]!;
          if (v < lo) {
            lo = v;
            loAt = i;
          }
          if (v > hi) {
            hi = v;
            hiAt = i;
          }
        }
        if (lo > hi) values[k]!.push(Number.NaN, Number.NaN);
        else if (loAt <= hiAt) values[k]!.push(lo, hi);
        else values[k]!.push(hi, lo);
      });
    }
    return { t, values };
  }
}
