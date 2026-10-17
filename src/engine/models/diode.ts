import type { NewtonState, SolutionView } from '../device';
import type { ComplexMna } from '../solver/complex';
import type { MnaSystem } from '../solver/mna';
import { R_OPEN } from './constants';
import { Junction, type JunctionSpec } from './junction';

/** Resistance of a junction that failed short (Ω). */
export const R_FAILED_SHORT = 0.5;
/** Series resistance used when a model has none, so the internal node is always defined (Ω). */
const RS_MIN = 1e-6;

export interface DiodeSpec extends JunctionSpec {
  /** Series resistance (Ω). */
  rs: number;
}

/**
 * A diode from `a` (anode) to `k` (cathode): series resistance to an internal
 * node, then the junction. Shared by diode, led, zener and the parts that
 * contain one (optocoupler, thyristors, buzzer). A failed junction is a short
 * or an open circuit.
 */
export class DiodeCore {
  readonly junction = new Junction();
  readonly mid: number;
  failure: 'short' | 'open' | undefined;
  /** Blocking in normal operation (a thyristor that is off): an open circuit. */
  off = false;
  /** Current from anode to cathode at the last solution (A). */
  current = 0;
  /** Voltage from anode to cathode at the last solution (V). */
  voltage = 0;
  private rs = RS_MIN;

  constructor(
    private readonly a: number,
    private readonly k: number,
    node: () => number,
  ) {
    this.mid = node();
  }

  configure(spec: DiodeSpec): void {
    this.junction.configure(spec);
    this.rs = Math.max(spec.rs, RS_MIN);
  }

  /** True when the junction is replaced by a fixed resistance (failed, or off). */
  private get bypassed(): boolean {
    return this.failure !== undefined || this.off;
  }

  private bypassConductance(): number {
    return 1 / (this.failure === 'short' ? R_FAILED_SHORT : R_OPEN);
  }

  /** Stamps the diode; returns the junction's linearization point (none when bypassed). */
  stamp(
    m: MnaSystem,
    nl: NewtonState,
    x: SolutionView,
  ): { v: number; i: number; g: number } | undefined {
    m.conductance(this.a, this.mid, 1 / this.rs);
    if (this.bypassed) {
      m.conductance(this.mid, this.k, this.bypassConductance());
      return undefined;
    }
    const p = this.junction.linearize(x.v(this.mid) - x.v(this.k), nl);
    m.linearized(this.mid, this.k, p.v, p.i, p.g);
    return p;
  }

  /** Small-signal admittance at the operating point. */
  stampAc(m: ComplexMna, op: SolutionView): void {
    m.admittance(this.a, this.mid, 1 / this.rs);
    const g = this.bypassed
      ? this.bypassConductance()
      : this.junction.at(op.v(this.mid) - op.v(this.k)).g;
    m.admittance(this.mid, this.k, g);
  }

  /** Current and voltage from a solution; on commit, remembers the junction voltage. */
  update(x: SolutionView, commit: boolean): void {
    const vj = x.v(this.mid) - x.v(this.k);
    this.current = this.bypassed ? vj * this.bypassConductance() : this.junction.at(vj).i;
    this.voltage = x.v(this.a) - x.v(this.k);
    if (commit) this.junction.commit(vj);
  }

  begin(): void {
    this.junction.begin();
  }

  reset(): void {
    this.junction.reset();
    this.failure = undefined;
    this.off = false;
    this.current = this.voltage = 0;
  }
}
