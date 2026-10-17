import type { SolutionView, StepInfo } from '../device';
import type { ComplexMna } from '../solver/complex';
import type { MnaSystem } from '../solver/mna';

/**
 * A coil (inductance in series with its wire resistance) as a branch current
 * between two nodes, integrated like the inductor device: trapezoidal rule,
 * backward Euler after discontinuities, a resistance in DC. Used by relays.
 */
export class Winding {
  /** Current from `a` to `b` at the last solution (A). */
  current = 0;
  private iPrev = 0;
  private vPrev = 0;

  constructor(
    private readonly br: number,
    private readonly a: number,
    private readonly b: number,
  ) {}

  stamp(m: MnaSystem, step: StepInfo, l: number, r: number): void {
    const { br, a, b } = this;
    if (step.mode === 'dc') {
      m.branch(br, a, b, 0, r);
      return;
    }
    const dt = step.dt > 0 ? step.dt : 1e-9;
    if (step.method === 'be') {
      m.branch(br, a, b, -(l / dt) * this.iPrev, r + l / dt);
    } else {
      m.branch(br, a, b, -this.vPrev + (r - (2 * l) / dt) * this.iPrev, r + (2 * l) / dt);
    }
  }

  stampAc(m: ComplexMna, omega: number, l: number, r: number): void {
    m.branch(this.br, this.a, this.b, 0, 0, r, omega * l);
  }

  update(x: SolutionView, commit: boolean): void {
    this.current = x.x[this.br];
    if (commit) {
      this.iPrev = this.current;
      this.vPrev = x.v(this.a) - x.v(this.b);
    }
  }

  reset(): void {
    this.current = this.iPrev = this.vPrev = 0;
  }
}
