import { LU } from './lu';

/**
 * Modified Nodal Analysis system A·x = b. Unknowns are node voltages
 * (index 0…nodes-1) followed by branch currents (voltage sources, inductors).
 * Index -1 is the ground node: stamps on it are dropped.
 *
 * The matrix is rebuilt for every solve; the LU factorization is reused when
 * the assembled matrix is identical to the previous one (linear circuits with
 * a fixed step only change the right-hand side), which turns most steps into
 * a forward/back substitution.
 */
export class MnaSystem {
  readonly size: number;
  readonly a: Float64Array;
  readonly b: Float64Array;
  readonly x: Float64Array;
  private readonly lu: LU;
  private readonly factored: Float64Array;
  private hasFactor = false;
  /** Number of LU factorizations so far (for tests and benchmarks). */
  factorizations = 0;

  constructor(size: number) {
    this.size = size;
    this.a = new Float64Array(size * size);
    this.b = new Float64Array(size);
    this.x = new Float64Array(size);
    this.lu = new LU(size);
    this.factored = new Float64Array(size * size);
  }

  clear(): void {
    this.a.fill(0);
    this.b.fill(0);
  }

  /** Raw matrix entry. */
  add(row: number, col: number, value: number): void {
    if (row < 0 || col < 0) return;
    this.a[row * this.size + col] += value;
  }

  /** Raw right-hand side entry. */
  addRhs(row: number, value: number): void {
    if (row < 0) return;
    this.b[row] += value;
  }

  /** Conductance g between nodes i and j. */
  conductance(i: number, j: number, g: number): void {
    const n = this.size;
    const a = this.a;
    if (i >= 0) a[i * n + i] += g;
    if (j >= 0) a[j * n + j] += g;
    if (i >= 0 && j >= 0) {
      a[i * n + j] -= g;
      a[j * n + i] -= g;
    }
  }

  /** Independent current `current` flowing from node i to node j through the source. */
  current(i: number, j: number, current: number): void {
    if (i >= 0) this.b[i] -= current;
    if (j >= 0) this.b[j] += current;
  }

  /**
   * Branch equation V(plus) − V(minus) − r·I = v, where I (unknown `branch`)
   * flows from plus to minus through the element. Also adds I to the KCL rows.
   */
  branch(branch: number, plus: number, minus: number, v: number, r = 0): void {
    this.add(plus, branch, 1);
    this.add(minus, branch, -1);
    this.add(branch, plus, 1);
    this.add(branch, minus, -1);
    if (r !== 0) this.add(branch, branch, -r);
    this.b[branch] += v;
  }

  /**
   * Linearized controlled current g·(V(cp) − V(cn)) flowing from node i to
   * node j (a transconductance, as in transistor models).
   */
  transconductance(i: number, j: number, cp: number, cn: number, g: number): void {
    this.add(i, cp, g);
    this.add(i, cn, -g);
    this.add(j, cp, -g);
    this.add(j, cn, g);
  }

  /**
   * Nonlinear current i(v) from node i to node j, linearized at v0 where it is
   * i0 with slope g: i ≈ i0 + g·(v − v0), as a conductance plus a source.
   */
  linearized(i: number, j: number, v0: number, i0: number, g: number): void {
    this.conductance(i, j, g);
    this.current(i, j, i0 - g * v0);
  }

  /** Solves the assembled system into `x`. Throws SingularMatrixError. */
  solve(): Float64Array {
    const { a, factored } = this;
    let same = this.hasFactor;
    if (same) {
      for (let k = 0; k < a.length; k++) {
        if (a[k] !== factored[k]) {
          same = false;
          break;
        }
      }
    }
    if (!same) {
      this.hasFactor = false;
      this.lu.factor(a);
      factored.set(a);
      this.hasFactor = true;
      this.factorizations++;
    }
    this.lu.solve(this.b, this.x);
    return this.x;
  }
}
