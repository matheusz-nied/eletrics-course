/**
 * Lesson 10.4: the I×V and P×V curves of a 60-cell photovoltaic module
 * (typical 330 W: Voc 40,6 V, Isc 10,4 A at 1.000 W/m² and 25 °C). Each cell
 * is the single-diode model (photocurrent, diode, series and shunt
 * resistance) with reverse breakdown; the cells form three strings of 20,
 * each with a bypass diode, as in the junction box of a real module. One
 * cell can be shaded. Typical values for teaching, not a datasheet.
 * Unit-tested in solar.test.ts.
 */

const Q = 1.602176634e-19;
const K = 1.380649e-23;
/** Band gap of silicon (eV). */
const EG = 1.12;
const T_REF = 298.15;

export const CELLS = 60;
export const STRINGS = 3;
const PER_STRING = CELLS / STRINGS;

/** Short-circuit current and open-circuit voltage per cell at STC. */
export const ISC_STC = 10.4;
const VOC_CELL_STC = 40.6 / CELLS;
/** Ideality factor, series and shunt resistance per cell (Ω). */
const N = 1.2;
const RS = 0.0025;
const RSH = 15;
/** Current temperature coefficient (1/°C). */
const ALPHA_I = 0.0005;
/** Reverse breakdown of a cell (V) and the resistance past it (Ω). */
const V_BREAK = 15;
const R_BREAK = 0.1;
/** Bypass diode: Schottky, about 0,4 V at 10 A. */
const BYPASS_IS = 1e-5;
const BYPASS_N = 1.4;
/** Light left on a fully shaded cell (diffuse light around a leaf or a shadow). */
const SHADE_LEFT = 0.15;

export interface PanelConditions {
  /** Irradiance (W/m²). */
  irradiance: number;
  /** Cell temperature (°C). */
  temperature: number;
  /** Fraction of one cell that is shaded, 0 to 1. */
  shade: number;
  /** Bypass diodes in the junction box. */
  bypass: boolean;
}

export const STC: PanelConditions = { irradiance: 1000, temperature: 25, shade: 0, bypass: true };

interface Cell {
  iph: number;
  i0: number;
  nvt: number;
}

function thermalVoltage(celsius: number): number {
  return (K * (celsius + 273.15)) / Q;
}

/** Saturation current at STC, from Voc (the shunt is negligible at Voc). */
const I0_STC = ISC_STC / Math.expm1(VOC_CELL_STC / (N * thermalVoltage(25)));

function cellModel(iph: number, celsius: number): Cell {
  const t = celsius + 273.15;
  const nvt = N * thermalVoltage(celsius);
  const i0 = I0_STC * (t / T_REF) ** 3 * Math.exp(((Q * EG) / (N * K)) * (1 / T_REF - 1 / t));
  return { iph, i0, nvt };
}

/** Current of a cell at junction voltage vd (A): decreasing in vd. */
function cellCurrentAt(c: Cell, vd: number): number {
  let i = c.iph - c.i0 * Math.expm1(vd / c.nvt) - vd / RSH;
  if (vd < -V_BREAK) i += (-V_BREAK - vd) / R_BREAK;
  return i;
}

/** Terminal voltage of a cell carrying `current` (V), by bisection on the junction voltage. */
export function cellVoltage(c: Cell, current: number): number {
  let lo = -V_BREAK - 50;
  let hi = c.nvt * Math.log((c.iph + c.i0) / c.i0 + 1) + 0.1;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (cellCurrentAt(c, mid) > current) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2 - current * RS;
}

/** Voltage across a conducting bypass diode carrying `current` (V, positive). */
function bypassDrop(current: number): number {
  if (current <= 0) return 0;
  return BYPASS_N * thermalVoltage(25) * Math.log(current / BYPASS_IS + 1);
}

export interface CurvePoint {
  v: number;
  i: number;
  p: number;
}

export interface PanelCurve {
  points: CurvePoint[];
  voc: number;
  isc: number;
  mpp: CurvePoint;
  /** Local power peaks (the global one included), from low to high voltage. */
  peaks: CurvePoint[];
  /** Strings whose bypass diode conducts at the maximum power point. */
  bypassedAtMpp: number;
  /** Power the shaded cell dissipates at the maximum power point (W; 0 when it generates). */
  shadedCellHeat: number;
}

/** Module voltage at `current`, and how many strings are bypassed. */
function moduleVoltage(
  current: number,
  sunny: Cell,
  shaded: Cell,
  bypass: boolean,
): { v: number; bypassed: number } {
  const vSunny = cellVoltage(sunny, current);
  let v = 0;
  let bypassed = 0;
  for (let s = 0; s < STRINGS; s++) {
    let vs =
      s === 0 ? (PER_STRING - 1) * vSunny + cellVoltage(shaded, current) : PER_STRING * vSunny;
    if (bypass && vs < -bypassDrop(current)) {
      vs = -bypassDrop(current);
      bypassed++;
    }
    v += vs;
  }
  return { v, bypassed };
}

/** The module's curve under the given conditions, from short circuit to open circuit. */
export function panelCurve(conditions: PanelConditions, samples = 400): PanelCurve {
  const { irradiance, temperature, shade, bypass } = conditions;
  const iph = ISC_STC * (irradiance / 1000) * (1 + ALPHA_I * (temperature - 25));
  const sunny = cellModel(iph, temperature);
  const shaded = cellModel(
    iph * (1 - (1 - SHADE_LEFT) * Math.min(1, Math.max(0, shade))),
    temperature,
  );

  const points: CurvePoint[] = [];
  const bypassedAt: number[] = [];
  // Current from just above the short-circuit current down to zero.
  const iTop = iph * 1.02;
  for (let k = 0; k <= samples; k++) {
    const i = iTop * (1 - k / samples);
    const m = moduleVoltage(i, sunny, shaded, bypass);
    if (m.v < 0) continue;
    points.push({ v: m.v, i, p: m.v * i });
    bypassedAt.push(m.bypassed);
  }
  // Short circuit: the current at V = 0, by bisection on the current.
  let lo = 0;
  let hi = iTop;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (moduleVoltage(mid, sunny, shaded, bypass).v > 0) lo = mid;
    else hi = mid;
  }
  const isc = (lo + hi) / 2;
  points.unshift({ v: 0, i: isc, p: 0 });
  bypassedAt.unshift(bypassedAt[0] ?? 0);

  let best = 0;
  for (let k = 1; k < points.length; k++) if (points[k]!.p > points[best]!.p) best = k;
  const peaks: CurvePoint[] = [];
  for (let k = 1; k < points.length - 1; k++) {
    const p = points[k]!;
    if (p.p >= points[k - 1]!.p && p.p > points[k + 1]!.p && p.p > 0.05 * points[best]!.p) {
      // Ignore ripples: a peak must stand at least 2 % above the valley before it.
      const prev = peaks[peaks.length - 1];
      if (prev) {
        let valley = prev.p;
        for (const q of points) if (q.v > prev.v && q.v < p.v) valley = Math.min(valley, q.p);
        if (p.p < valley * 1.02 || prev.p < valley * 1.02) {
          if (p.p > prev.p) peaks[peaks.length - 1] = p;
          continue;
        }
      }
      peaks.push(p);
    }
  }
  const mpp = points[best]!;
  // Current through the shaded string: all of it, unless its bypass diode
  // conducts; then the string's own current is the one that puts it at the
  // diode's voltage, and the diode carries the rest.
  let iString = mpp.i;
  if ((bypassedAt[best] ?? 0) > 0) {
    const target = -bypassDrop(mpp.i);
    const stringV = (i: number) =>
      (PER_STRING - 1) * cellVoltage(sunny, i) + cellVoltage(shaded, i);
    let a = 0;
    let b = mpp.i;
    for (let k = 0; k < 60; k++) {
      const m = (a + b) / 2;
      if (stringV(m) > target) a = m;
      else b = m;
    }
    iString = (a + b) / 2;
  }
  const vShaded = cellVoltage(shaded, iString);
  return {
    points,
    voc: points[points.length - 1]!.v,
    isc,
    mpp,
    peaks,
    bypassedAtMpp: bypassedAt[best] ?? 0,
    shadedCellHeat: vShaded < 0 ? -vShaded * iString : 0,
  };
}
