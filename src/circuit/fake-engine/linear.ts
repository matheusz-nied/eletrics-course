/**
 * Dense complex linear system for Modified Nodal Analysis. Index -1 is the
 * reference node and is skipped. Real analyses leave the imaginary part at zero.
 */
export class System {
  readonly re: Float64Array;
  readonly im: Float64Array;
  readonly bRe: Float64Array;
  readonly bIm: Float64Array;

  constructor(readonly n: number) {
    this.re = new Float64Array(n * n);
    this.im = new Float64Array(n * n);
    this.bRe = new Float64Array(n);
    this.bIm = new Float64Array(n);
  }

  clear() {
    this.re.fill(0);
    this.im.fill(0);
    this.bRe.fill(0);
    this.bIm.fill(0);
  }

  add(i: number, j: number, re: number, im = 0) {
    if (i < 0 || j < 0) return;
    this.re[i * this.n + j]! += re;
    if (im) this.im[i * this.n + j]! += im;
  }

  addRhs(i: number, re: number, im = 0) {
    if (i < 0) return;
    this.bRe[i]! += re;
    if (im) this.bIm[i]! += im;
  }

  /** Solves in place with partial pivoting. Returns false when singular. */
  solve(xRe: Float64Array, xIm?: Float64Array): boolean {
    const n = this.n;
    const a = this.re.slice();
    const ai = this.im.slice();
    const b = this.bRe.slice();
    const bi = this.bIm.slice();
    const complex = !!xIm;
    for (let k = 0; k < n; k++) {
      let piv = k;
      let best = Math.hypot(a[k * n + k]!, ai[k * n + k]!);
      for (let r = k + 1; r < n; r++) {
        const m = Math.hypot(a[r * n + k]!, ai[r * n + k]!);
        if (m > best) {
          best = m;
          piv = r;
        }
      }
      if (best < 1e-300) return false;
      if (piv !== k) {
        for (let c = 0; c < n; c++) {
          swap(a, k * n + c, piv * n + c);
          swap(ai, k * n + c, piv * n + c);
        }
        swap(b, k, piv);
        swap(bi, k, piv);
      }
      const pr = a[k * n + k]!;
      const pi = ai[k * n + k]!;
      const den = pr * pr + pi * pi;
      for (let r = k + 1; r < n; r++) {
        const er = a[r * n + k]!;
        const ei = ai[r * n + k]!;
        if (er === 0 && ei === 0) continue;
        // factor = e / p
        const fr = (er * pr + ei * pi) / den;
        const fi = complex ? (ei * pr - er * pi) / den : 0;
        for (let c = k; c < n; c++) {
          const vr = a[k * n + c]!;
          const vi = ai[k * n + c]!;
          a[r * n + c]! -= fr * vr - fi * vi;
          if (complex) ai[r * n + c]! -= fr * vi + fi * vr;
        }
        b[r]! -= fr * b[k]! - fi * bi[k]!;
        if (complex) bi[r]! -= fr * bi[k]! + fi * b[k]!;
      }
    }
    for (let r = n - 1; r >= 0; r--) {
      let sr = b[r]!;
      let si = bi[r]!;
      for (let c = r + 1; c < n; c++) {
        const vr = a[r * n + c]!;
        const vi = ai[r * n + c]!;
        const xr = xRe[c]!;
        const xi = xIm ? xIm[c]! : 0;
        sr -= vr * xr - vi * xi;
        si -= vr * xi + vi * xr;
      }
      const pr = a[r * n + r]!;
      const pi = ai[r * n + r]!;
      const den = pr * pr + pi * pi;
      xRe[r] = (sr * pr + si * pi) / den;
      if (xIm) xIm[r] = (si * pr - sr * pi) / den;
    }
    for (let i = 0; i < n; i++) if (!Number.isFinite(xRe[i]!)) return false;
    return true;
  }
}

function swap(arr: Float64Array, i: number, j: number) {
  const t = arr[i]!;
  arr[i] = arr[j]!;
  arr[j] = t;
}

/**
 * Where a device writes its equations. The same device code stamps the global
 * system or a recorder (to compute the current through each of its pins).
 */
export interface Stamper {
  /** Conductance between nodes a and b. */
  g(a: number, b: number, re: number, im?: number): void;
  /** Current `i` flowing from a to b through the device. */
  i(a: number, b: number, re: number, im?: number): void;
  /** Raw matrix entry and right-hand side (voltage sources, controlled sources). */
  m(row: number, col: number, re: number, im?: number): void;
  rhs(row: number, re: number, im?: number): void;
  /** Ideal voltage source V(a) − V(b) = v with branch unknown k (current a→b). */
  v(a: number, b: number, k: number, re: number, im?: number): void;
}

export function systemStamper(sys: System): Stamper {
  const st: Stamper = {
    g(a, b, re, im = 0) {
      sys.add(a, a, re, im);
      sys.add(b, b, re, im);
      sys.add(a, b, -re, -im);
      sys.add(b, a, -re, -im);
    },
    i(a, b, re, im = 0) {
      sys.addRhs(a, -re, -im);
      sys.addRhs(b, re, im);
    },
    m: (r, c, re, im = 0) => sys.add(r, c, re, im),
    rhs: (r, re, im = 0) => sys.addRhs(r, re, im),
    v(a, b, k, re, im = 0) {
      sys.add(a, k, 1);
      sys.add(b, k, -1);
      sys.add(k, a, 1);
      sys.add(k, b, -1);
      sys.addRhs(k, re, im);
    },
  };
  return st;
}

/** Records a device's stamp to compute the current leaving each node into it. */
export class Recorder implements Stamper {
  private rows = new Map<number, { cols: [number, number][]; rhs: number }>();

  private row(r: number) {
    let e = this.rows.get(r);
    if (!e) {
      e = { cols: [], rhs: 0 };
      this.rows.set(r, e);
    }
    return e;
  }

  g(a: number, b: number, re: number) {
    this.m(a, a, re);
    this.m(b, b, re);
    this.m(a, b, -re);
    this.m(b, a, -re);
  }

  i(a: number, b: number, re: number) {
    this.rhs(a, -re);
    this.rhs(b, re);
  }

  m(r: number, c: number, re: number) {
    if (r < 0) return;
    this.row(r).cols.push([c, re]);
  }

  rhs(r: number, re: number) {
    if (r < 0) return;
    this.row(r).rhs += re;
  }

  v(a: number, b: number, k: number) {
    this.m(a, k, 1);
    this.m(b, k, -1);
  }

  /** Current entering the device from node `r` (positive into the device). */
  currentFrom(r: number, x: Float64Array): number {
    const e = this.rows.get(r);
    if (!e) return 0;
    let s = -e.rhs;
    // indices past the unknowns stand for the reference node (0 V)
    for (const [c, val] of e.cols) if (c >= 0 && c < x.length) s += val * x[c]!;
    return s;
  }
}
