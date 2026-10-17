/**
 * LU factorization with partial pivoting for the MNA system, stored dense
 * (the course circuits have at most a few hundred unknowns) but factored
 * sparsely: the first factorization chooses the pivots and records the
 * nonzero pattern of the factors, and later ones (every Newton-Raphson
 * iteration of a nonlinear circuit) reuse that plan, touching only the
 * nonzeros. A plan is dropped when the matrix gains an entry outside it or
 * a reused pivot gets too small; the next factorization pivots afresh.
 */

/** Pivots smaller than this make the system singular. */
const TINY_PIVOT = 1e-30;
/** A reused pivot must be at least this fraction of the largest entry below it (as in KLU). */
const PIVOT_TOLERANCE = 1e-3;

export class SingularMatrixError extends Error {
  constructor(readonly row: number) {
    super(`singular matrix at row ${row}`);
    this.name = 'SingularMatrixError';
  }
}

export class LU {
  readonly n: number;
  /** Row-major factors: unit lower triangle below the diagonal, upper triangle on and above. */
  readonly lu: Float64Array;
  /** `perm[k]` is the original row that ended up in row k. */
  readonly perm: Int32Array;
  /** Factorizations that had to choose pivots (the rest reused a plan). */
  pivotings = 0;
  private readonly work: Float64Array;
  // Nonzero pattern of the factors (row pointers, columns, positions in
  // `lu`, values), so the substitutions cost the number of nonzeros.
  private readonly rowStart: Int32Array;
  private readonly diagStart: Int32Array;
  private cols = new Int32Array(0);
  private vals = new Float64Array(0);
  private valPos = new Int32Array(0);
  // The plan: entries of A seen so far, where each lands in `lu` (−1 when
  // outside the pattern), and for each pivot k the rows below it (as
  // offsets i·n) and the columns right of it.
  private planned = false;
  private readonly seen: Uint8Array;
  private readonly dest: Int32Array;
  private readonly lStart: Int32Array;
  private lRows = new Int32Array(0);
  private readonly uStart: Int32Array;
  private uCols = new Int32Array(0);

  constructor(n: number) {
    this.n = n;
    this.lu = new Float64Array(n * n);
    this.perm = new Int32Array(n);
    this.work = new Float64Array(n);
    this.rowStart = new Int32Array(n + 1);
    this.diagStart = new Int32Array(n);
    this.seen = new Uint8Array(n * n);
    this.dest = new Int32Array(n * n);
    this.lStart = new Int32Array(n + 1);
    this.uStart = new Int32Array(n + 1);
  }

  /** Factors the row-major matrix `a` (n×n). Throws SingularMatrixError. */
  factor(a: Float64Array): void {
    if (this.planned && this.refactor(a)) return;
    this.planned = false;
    this.pivot(a);
    this.plan(a);
  }

  /** Solves A·x = b with the last factorization; writes x into `out` (may alias b). */
  solve(b: Float64Array, out: Float64Array): void {
    const { n, perm, work, cols, vals, rowStart, diagStart } = this;
    for (let i = 0; i < n; i++) work[i] = b[perm[i]];
    for (let i = 0; i < n; i++) {
      let s = work[i];
      for (let p = rowStart[i]; p < diagStart[i]; p++) s -= vals[p] * work[cols[p]];
      work[i] = s;
    }
    for (let i = n - 1; i >= 0; i--) {
      const d = diagStart[i];
      let s = work[i];
      for (let p = d + 1; p < rowStart[i + 1]; p++) s -= vals[p] * work[cols[p]];
      work[i] = s / vals[d];
    }
    out.set(work);
  }

  /** Dense elimination with partial pivoting, in place in `lu`. */
  private pivot(a: Float64Array): void {
    const { n, lu, perm } = this;
    lu.set(a);
    for (let i = 0; i < n; i++) perm[i] = i;
    this.pivotings++;

    for (let k = 0; k < n; k++) {
      let p = k;
      let max = Math.abs(lu[k * n + k]);
      for (let i = k + 1; i < n; i++) {
        const v = Math.abs(lu[i * n + k]);
        if (v > max) {
          max = v;
          p = i;
        }
      }
      if (!(max > TINY_PIVOT)) throw new SingularMatrixError(perm[p]);
      if (p !== k) {
        const rk = k * n;
        const rp = p * n;
        for (let j = 0; j < n; j++) {
          const t = lu[rk + j];
          lu[rk + j] = lu[rp + j];
          lu[rp + j] = t;
        }
        const t = perm[k];
        perm[k] = perm[p];
        perm[p] = t;
      }
      const rk = k * n;
      const pivot = lu[rk + k];
      for (let i = k + 1; i < n; i++) {
        const ri = i * n;
        const f = lu[ri + k] / pivot;
        if (f === 0) continue;
        lu[ri + k] = f;
        for (let j = k + 1; j < n; j++) {
          const u = lu[rk + j];
          if (u !== 0) lu[ri + j] = lu[ri + j] - f * u;
        }
      }
    }
  }

  /**
   * Records the plan for the pivot order just chosen: the symbolic
   * factorization of every entry of A seen so far (so an entry that happens
   * to be zero this time keeps its place), then the compressed rows.
   */
  private plan(a: Float64Array): void {
    const { n, perm, seen, dest } = this;
    const nn = n * n;
    for (let k = 0; k < nn; k++) if (a[k] !== 0) seen[k] = 1;
    const rowOf = new Int32Array(n);
    for (let r = 0; r < n; r++) rowOf[perm[r]] = r;
    const s = new Uint8Array(nn);
    for (let i = 0; i < n; i++) {
      const src = i * n;
      const dst = rowOf[i] * n;
      for (let j = 0; j < n; j++) {
        if (seen[src + j]) {
          s[dst + j] = 1;
          dest[src + j] = dst + j;
        } else {
          dest[src + j] = -1;
        }
      }
    }
    for (let k = 0; k < n; k++) {
      s[k * n + k] = 1;
      const rk = k * n;
      for (let i = k + 1; i < n; i++) {
        const ri = i * n;
        if (!s[ri + k]) continue;
        for (let j = k + 1; j < n; j++) if (s[rk + j]) s[ri + j] = 1;
      }
    }

    let nnz = 0;
    for (let k = 0; k < nn; k++) nnz += s[k];
    this.lRows = new Int32Array(nnz);
    this.uCols = new Int32Array(nnz);
    this.cols = new Int32Array(nnz);
    this.vals = new Float64Array(nnz);
    this.valPos = new Int32Array(nnz);
    const { lRows, uCols, cols, vals, valPos, lStart, uStart, rowStart, diagStart, lu } = this;
    let l = 0;
    let u = 0;
    let p = 0;
    for (let k = 0; k < n; k++) {
      const rk = k * n;
      lStart[k] = l;
      for (let i = k + 1; i < n; i++) if (s[i * n + k]) lRows[l++] = i * n;
      uStart[k] = u;
      for (let j = k + 1; j < n; j++) if (s[rk + j]) uCols[u++] = j;
      rowStart[k] = p;
      for (let j = 0; j < n; j++) {
        if (!s[rk + j]) continue;
        if (j === k) diagStart[k] = p;
        cols[p] = j;
        valPos[p] = rk + j;
        vals[p++] = lu[rk + j];
      }
    }
    lStart[n] = l;
    uStart[n] = u;
    rowStart[n] = p;
    this.planned = true;
  }

  /** Factorization along the plan; false when the plan does not fit this matrix. */
  private refactor(a: Float64Array): boolean {
    const { n, lu, dest, lStart, lRows, uStart, uCols, vals, valPos } = this;
    for (let q = 0; q < valPos.length; q++) lu[valPos[q]] = 0;
    const nn = n * n;
    for (let k = 0; k < nn; k++) {
      const v = a[k];
      if (v === 0) continue;
      const d = dest[k];
      if (d < 0) return false;
      lu[d] = v;
    }
    for (let k = 0; k < n; k++) {
      const rk = k * n;
      const pivot = lu[rk + k];
      const size = Math.abs(pivot);
      let below = 0;
      for (let q = lStart[k]; q < lStart[k + 1]; q++) {
        below = Math.max(below, Math.abs(lu[lRows[q] + k]));
      }
      if (!(size > TINY_PIVOT) || size < PIVOT_TOLERANCE * below) return false;
      for (let q = lStart[k]; q < lStart[k + 1]; q++) {
        const ri = lRows[q];
        const f = lu[ri + k] / pivot;
        lu[ri + k] = f;
        if (f === 0) continue;
        for (let w = uStart[k]; w < uStart[k + 1]; w++) {
          const j = uCols[w];
          lu[ri + j] -= f * lu[rk + j];
        }
      }
    }
    for (let q = 0; q < vals.length; q++) vals[q] = lu[valPos[q]];
    return true;
  }
}
