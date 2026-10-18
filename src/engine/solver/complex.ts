import { SingularMatrixError } from './lu';

/** Entries one device stamped, to work out the currents through its pins afterwards. */
export class StampLog {
  rows: number[] = [];
  cols: number[] = [];
  re: number[] = [];
  im: number[] = [];
  rhsRows: number[] = [];
  rhsRe: number[] = [];
  rhsIm: number[] = [];

  clear(): void {
    this.rows.length = this.cols.length = this.re.length = this.im.length = 0;
    this.rhsRows.length = this.rhsRe.length = this.rhsIm.length = 0;
  }

  /**
   * Current (phasor) entering the device through each pin: the device's own
   * terms in the KCL row of the pin's node, applied to the solution. A pin on
   * ground gets what the others leave (the device's currents add up to zero).
   */
  pinCurrents(
    pins: readonly number[],
    xRe: Float64Array,
    xIm: Float64Array,
    outRe: Float64Array,
    outIm: Float64Array,
  ): void {
    outRe.fill(0);
    outIm.fill(0);
    let grounded = 0;
    for (let k = 0; k < pins.length; k++) {
      const node = pins[k];
      if (node < 0) {
        grounded++;
        continue;
      }
      // The first pin on a node takes the whole row (pins sharing a node cannot be told apart).
      if (pins.indexOf(node) !== k) continue;
      let re = 0;
      let im = 0;
      for (let e = 0; e < this.rows.length; e++) {
        if (this.rows[e] !== node) continue;
        const c = this.cols[e];
        re += this.re[e] * xRe[c] - this.im[e] * xIm[c];
        im += this.re[e] * xIm[c] + this.im[e] * xRe[c];
      }
      for (let e = 0; e < this.rhsRows.length; e++) {
        if (this.rhsRows[e] !== node) continue;
        re -= this.rhsRe[e];
        im -= this.rhsIm[e];
      }
      outRe[k] = re;
      outIm[k] = im;
    }
    if (grounded === 0) return;
    let re = 0;
    let im = 0;
    for (let k = 0; k < pins.length; k++) {
      re += outRe[k];
      im += outIm[k];
    }
    for (let k = 0; k < pins.length; k++) {
      if (pins[k] >= 0) continue;
      outRe[k] = -re / grounded;
      outIm[k] = -im / grounded;
    }
  }
}

/**
 * Complex MNA system for the AC sweep and the quasi-static phasor solve:
 * same layout as MnaSystem, with separate real and imaginary arrays and a
 * dense LU with partial pivoting. While `log` is set, stamps are also
 * recorded there.
 */
export class ComplexMna {
  readonly size: number;
  readonly re: Float64Array;
  readonly im: Float64Array;
  readonly bRe: Float64Array;
  readonly bIm: Float64Array;
  readonly xRe: Float64Array;
  readonly xIm: Float64Array;
  private readonly perm: Int32Array;
  log: StampLog | undefined;

  constructor(size: number) {
    this.size = size;
    this.re = new Float64Array(size * size);
    this.im = new Float64Array(size * size);
    this.bRe = new Float64Array(size);
    this.bIm = new Float64Array(size);
    this.xRe = new Float64Array(size);
    this.xIm = new Float64Array(size);
    this.perm = new Int32Array(size);
  }

  clear(): void {
    this.re.fill(0);
    this.im.fill(0);
    this.bRe.fill(0);
    this.bIm.fill(0);
  }

  add(row: number, col: number, re: number, im = 0): void {
    if (row < 0 || col < 0) return;
    const k = row * this.size + col;
    this.re[k] += re;
    this.im[k] += im;
    const log = this.log;
    if (log) {
      log.rows.push(row);
      log.cols.push(col);
      log.re.push(re);
      log.im.push(im);
    }
  }

  addRhs(row: number, re: number, im = 0): void {
    if (row < 0) return;
    this.bRe[row] += re;
    this.bIm[row] += im;
    const log = this.log;
    if (log) {
      log.rhsRows.push(row);
      log.rhsRe.push(re);
      log.rhsIm.push(im);
    }
  }

  /** Admittance y = g + jb between nodes i and j. */
  admittance(i: number, j: number, g: number, b = 0): void {
    this.add(i, i, g, b);
    this.add(j, j, g, b);
    this.add(i, j, -g, -b);
    this.add(j, i, -g, -b);
  }

  /** Current (phasor) from node i to node j through a source. */
  current(i: number, j: number, re: number, im = 0): void {
    this.addRhs(i, -re, -im);
    this.addRhs(j, re, im);
  }

  /** Branch equation V(plus) − V(minus) − z·I = v, with z = r + jx. */
  branch(branch: number, plus: number, minus: number, vRe: number, vIm = 0, r = 0, x = 0): void {
    this.add(plus, branch, 1);
    this.add(minus, branch, -1);
    this.add(branch, plus, 1);
    this.add(branch, minus, -1);
    if (r !== 0 || x !== 0) this.add(branch, branch, -r, -x);
    this.addRhs(branch, vRe, vIm);
  }

  /** Transconductance: current g·(V(cp) − V(cn)) flowing from node i to node j. */
  transconductance(i: number, j: number, cp: number, cn: number, g: number, b = 0): void {
    this.add(i, cp, g, b);
    this.add(i, cn, -g, -b);
    this.add(j, cp, -g, -b);
    this.add(j, cn, g, b);
  }

  /** Solves in place (the matrix is destroyed). Throws SingularMatrixError. */
  solve(): void {
    const { size: n, re, im, bRe, bIm, xRe, xIm, perm } = this;
    for (let i = 0; i < n; i++) perm[i] = i;
    for (let k = 0; k < n; k++) {
      let p = k;
      let max = re[k * n + k] ** 2 + im[k * n + k] ** 2;
      for (let i = k + 1; i < n; i++) {
        const v = re[i * n + k] ** 2 + im[i * n + k] ** 2;
        if (v > max) {
          max = v;
          p = i;
        }
      }
      if (!(max > 1e-60)) throw new SingularMatrixError(perm[p]);
      if (p !== k) {
        for (let j = 0; j < n; j++) {
          const a = k * n + j;
          const b = p * n + j;
          let t = re[a];
          re[a] = re[b];
          re[b] = t;
          t = im[a];
          im[a] = im[b];
          im[b] = t;
        }
        let t = bRe[k];
        bRe[k] = bRe[p];
        bRe[p] = t;
        t = bIm[k];
        bIm[k] = bIm[p];
        bIm[p] = t;
        const tp = perm[k];
        perm[k] = perm[p];
        perm[p] = tp;
      }
      const pr = re[k * n + k];
      const pi = im[k * n + k];
      const den = pr * pr + pi * pi;
      for (let i = k + 1; i < n; i++) {
        const ar = re[i * n + k];
        const ai = im[i * n + k];
        if (ar === 0 && ai === 0) continue;
        // f = a / pivot
        const fr = (ar * pr + ai * pi) / den;
        const fi = (ai * pr - ar * pi) / den;
        for (let j = k + 1; j < n; j++) {
          const ur = re[k * n + j];
          const ui = im[k * n + j];
          if (ur === 0 && ui === 0) continue;
          re[i * n + j] -= fr * ur - fi * ui;
          im[i * n + j] -= fr * ui + fi * ur;
        }
        bRe[i] -= fr * bRe[k] - fi * bIm[k];
        bIm[i] -= fr * bIm[k] + fi * bRe[k];
      }
    }
    for (let i = n - 1; i >= 0; i--) {
      let sr = bRe[i];
      let si = bIm[i];
      for (let j = i + 1; j < n; j++) {
        const ar = re[i * n + j];
        const ai = im[i * n + j];
        sr -= ar * xRe[j] - ai * xIm[j];
        si -= ar * xIm[j] + ai * xRe[j];
      }
      const pr = re[i * n + i];
      const pi = im[i * n + i];
      const den = pr * pr + pi * pi;
      xRe[i] = (sr * pr + si * pi) / den;
      xIm[i] = (si * pr - sr * pi) / den;
    }
  }
}
