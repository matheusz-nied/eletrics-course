/**
 * PN junction and FET helpers shared by the semiconductor models: the diode
 * equation with safe exponentials, and SPICE's voltage limiting (pnjlim,
 * fetlim, limvds), which keeps Newton-Raphson from jumping to voltages where
 * exp() overflows.
 */

/** Thermal voltage kT/q at 27 °C (V), the nominal temperature of SPICE models. */
export const VT = 0.025864917;

/** Conductance across every junction, as SPICE's gmin (S). */
export const JUNCTION_GMIN = 1e-12;

/** Beyond this argument exp() continues as a straight line, so it never overflows. */
const EXP_LIMIT = 80;
const EXP_AT_LIMIT = Math.exp(EXP_LIMIT);

/** exp(x) that grows linearly past x = 80: value and derivative. */
export function safeExp(x: number): { value: number; slope: number } {
  if (x > EXP_LIMIT) {
    return { value: EXP_AT_LIMIT * (1 + x - EXP_LIMIT), slope: EXP_AT_LIMIT };
  }
  const e = Math.exp(x);
  return { value: e, slope: e };
}

/** Critical voltage of a junction, above which pnjlim limits the step (V). */
export function vcrit(is: number, nvt: number): number {
  return nvt * Math.log(nvt / (Math.SQRT2 * is));
}

/** Result of a limited voltage: the value to linearize at, and whether it was changed. */
export interface Limited {
  value: number;
  limited: boolean;
}

/**
 * SPICE pnjlim: limits a new junction voltage relative to the previous
 * iterate so the exponential grows at most logarithmically per iteration.
 */
export function pnjlim(vnew: number, vold: number, nvt: number, crit: number): Limited {
  if (vnew > crit && Math.abs(vnew - vold) > 2 * nvt) {
    let v: number;
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / nvt;
      v = arg > 0 ? vold + nvt * Math.log(arg) : crit;
    } else {
      v = nvt * Math.log(vnew / nvt);
    }
    return { value: v, limited: true };
  }
  if (vnew < 0) {
    const arg = vold > 0 ? -vold - 1 : 2 * vold - 1;
    if (vnew < arg) return { value: arg, limited: true };
  }
  return { value: vnew, limited: false };
}

/** SPICE fetlim: limits the gate-source voltage step of a MOSFET around its threshold. */
export function fetlim(vnew: number, vold: number, vto: number): number {
  const vtsthi = Math.abs(2 * (vold - vto)) + 2;
  const vtstlo = Math.abs(vold - vto) + 1;
  const vtox = vto + 3.5;
  const delv = vnew - vold;
  if (vold >= vto) {
    if (vold >= vtox) {
      if (delv <= 0) {
        if (vnew >= vtox) {
          if (-delv > vtstlo) return vold - vtstlo;
        } else {
          return Math.max(vnew, vto + 2);
        }
      } else if (delv >= vtsthi) {
        return vold + vtsthi;
      }
    } else {
      return delv <= 0 ? Math.max(vnew, vto - 0.5) : Math.min(vnew, vto + 4);
    }
  } else if (delv <= 0) {
    if (-delv > vtsthi) return vold - vtsthi;
  } else {
    const vtemp = vto + 0.5;
    if (vnew > vtemp) return vtemp;
    if (delv > vtstlo) return vold + vtstlo;
  }
  return vnew;
}

/** SPICE limvds: limits the drain-source voltage step of a MOSFET. */
export function limvds(vnew: number, vold: number): number {
  if (vold >= 3.5) {
    if (vnew > vold) return Math.min(vnew, 3 * vold + 2);
    if (vnew < 3.5) return Math.max(vnew, 2);
    return vnew;
  }
  return vnew > vold ? Math.min(vnew, 4) : Math.max(vnew, -0.5);
}

/** Current and conductance of a junction at one voltage. */
export interface JunctionPoint {
  /** Current in the forward direction (A). */
  i: number;
  /** dI/dV (S). */
  g: number;
}

/**
 * Diode equation I = Is·(e^(V/nVt) − 1), plus the reverse breakdown branch
 * −Is·e^(−(V + xbv)/(nbv·Vt)) when `xbv` is given (see breakdownKnee).
 */
export function diodeCurrent(
  v: number,
  is: number,
  nvt: number,
  xbv?: number,
  nbvt = nvt,
): JunctionPoint {
  const e = safeExp(v / nvt);
  let i = is * (e.value - 1);
  let g = (is * e.slope) / nvt;
  if (xbv !== undefined) {
    const r = safeExp(-(v + xbv) / nbvt);
    i -= is * r.value;
    g += (is * r.slope) / nbvt;
  }
  return { i, g };
}

/**
 * Voltage of the breakdown exponential so that the reverse current at −BV is
 * Ibv (as ngspice computes it).
 */
export function breakdownKnee(bv: number, ibv: number, is: number, nbvt: number): number {
  return bv - nbvt * Math.log(ibv / is + 1);
}

/**
 * Limiting for a junction that can also break down (zener): forward steps
 * with pnjlim, and steps deep into breakdown with pnjlim on the mirrored
 * voltage, as ngspice does.
 */
export function limitJunction(
  vnew: number,
  vold: number,
  nvt: number,
  crit: number,
  xbv?: number,
): Limited {
  if (xbv !== undefined && vnew < Math.min(0, -xbv + 10 * nvt)) {
    const mirrored = pnjlim(-(vnew + xbv), -(vold + xbv), nvt, crit);
    return { value: -(mirrored.value + xbv), limited: mirrored.limited };
  }
  return pnjlim(vnew, vold, nvt, crit);
}

/** Parameters of a junction (SPICE diode model, without capacitance). */
export interface JunctionSpec {
  /** Saturation current (A). */
  is: number;
  /** Emission coefficient. */
  n: number;
  /** Reverse breakdown voltage (V), if the junction breaks down within the model. */
  bv?: number;
  /** Reverse current at −bv (A). */
  ibv?: number;
  /** Emission coefficient of the breakdown branch (default: n). */
  nbv?: number;
}

/**
 * One PN junction inside a device: evaluates the diode equation, limits each
 * Newton iterate against the previous one (pnjlim) and remembers the voltage
 * of the last accepted step so a retried step starts from it.
 */
export class Junction {
  is = 1e-14;
  nvt = VT;
  crit = vcrit(1e-14, VT);
  xbv: number | undefined;
  nbvt = VT;
  private last = 0;
  private committed = 0;

  constructor(spec?: JunctionSpec) {
    if (spec) this.configure(spec);
  }

  configure(spec: JunctionSpec): void {
    this.is = spec.is;
    this.nvt = spec.n * VT;
    this.nbvt = (spec.nbv ?? spec.n) * VT;
    this.crit = vcrit(spec.is, this.nvt);
    this.xbv =
      spec.bv && spec.bv > 0
        ? breakdownKnee(spec.bv, spec.ibv ?? 1e-3, spec.is, this.nbvt)
        : undefined;
  }

  /**
   * Linearization point for this Newton iteration: the voltage after
   * limiting (flags `nl.limited`), and the current and conductance there,
   * including the gmin conductance across the junction.
   */
  linearize(
    v: number,
    nl: { limited: boolean; gmin: number; initJunctions: boolean },
  ): { v: number; i: number; g: number } {
    let vd: number;
    if (nl.initJunctions) {
      vd = this.crit;
    } else {
      const l = limitJunction(v, this.last, this.nvt, this.crit, this.xbv);
      if (l.limited) nl.limited = true;
      vd = l.value;
    }
    this.last = vd;
    const p = diodeCurrent(vd, this.is, this.nvt, this.xbv, this.nbvt);
    const g = JUNCTION_GMIN + nl.gmin;
    return { v: vd, i: p.i + g * vd, g: p.g + g };
  }

  /** Current and conductance at a solved voltage (no limiting). */
  at(v: number): JunctionPoint {
    const p = diodeCurrent(v, this.is, this.nvt, this.xbv, this.nbvt);
    return { i: p.i + JUNCTION_GMIN * v, g: p.g + JUNCTION_GMIN };
  }

  /** Before a solve attempt: limit against the last accepted voltage. */
  begin(): void {
    this.last = this.committed;
  }

  /** The step with junction voltage `v` was accepted. */
  commit(v: number): void {
    this.committed = v;
  }

  reset(): void {
    this.last = this.committed = 0;
  }
}
