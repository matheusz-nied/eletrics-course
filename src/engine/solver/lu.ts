/**
 * Dense LU factorization with partial pivoting, in place, for the MNA system.
 * The course circuits have at most a few hundred unknowns, so a dense
 * factorization is simpler and fast enough; zero multipliers are skipped,
 * which keeps the typical (very sparse) MNA matrix cheap.
 */

/** Pivots smaller than this make the system singular. */
const TINY_PIVOT = 1e-30;

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
  private readonly work: Float64Array;
  // Nonzero pattern of the factors (row pointers, columns, values), so the
  // substitutions cost the number of nonzeros instead of n².
  private readonly rowStart: Int32Array;
  private readonly diagStart: Int32Array;
  private cols: Int32Array;
  private vals: Float64Array;

  constructor(n: number) {
    this.n = n;
    this.lu = new Float64Array(n * n);
    this.perm = new Int32Array(n);
    this.work = new Float64Array(n);
    this.rowStart = new Int32Array(n + 1);
    this.diagStart = new Int32Array(n);
    this.cols = new Int32Array(0);
    this.vals = new Float64Array(0);
  }

  /** Factors the row-major matrix `a` (n×n). Throws SingularMatrixError. */
  factor(a: Float64Array): void {
    const { n, lu, perm } = this;
    lu.set(a);
    for (let i = 0; i < n; i++) perm[i] = i;

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
    this.compress();
  }

  /** Row i of the factors as: L entries (j < i), then the diagonal, then U entries (j > i). */
  private compress(): void {
    const { n, lu } = this;
    let nnz = 0;
    for (let k = 0; k < n * n; k++) if (lu[k] !== 0) nnz++;
    if (this.cols.length < nnz + n) {
      this.cols = new Int32Array(nnz + n);
      this.vals = new Float64Array(nnz + n);
    }
    const { cols, vals, rowStart, diagStart } = this;
    let p = 0;
    for (let i = 0; i < n; i++) {
      rowStart[i] = p;
      const ri = i * n;
      for (let j = 0; j < i; j++) {
        const v = lu[ri + j];
        if (v !== 0) {
          cols[p] = j;
          vals[p++] = v;
        }
      }
      diagStart[i] = p;
      cols[p] = i;
      vals[p++] = lu[ri + i];
      for (let j = i + 1; j < n; j++) {
        const v = lu[ri + j];
        if (v !== 0) {
          cols[p] = j;
          vals[p++] = v;
        }
      }
    }
    rowStart[n] = p;
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
}
