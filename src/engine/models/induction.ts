/**
 * Induction machine in the phasor domain, by the double revolving field
 * theory: a field rotating forward sees the rotor at slip s, one rotating
 * backward at slip 2 − s, and each winding is the per-phase equivalent
 * circuit R1 + jX1 + (jXm ∥ (R2/s + jX2)).
 */

export interface Complex {
  re: number;
  im: number;
}

/** Per-phase equivalent circuit at the operating frequency (Ω). */
export interface EquivalentCircuit {
  r1: number;
  x1: number;
  xm: number;
  r2: number;
  x2: number;
}

/** Air-gap impedance jXm ∥ (R2/s + jX2), written with admittances so s = 0 is fine. */
export function gapImpedance(eq: EquivalentCircuit, s: number): Complex {
  // Y = 1/(jXm) + s/(R2 + j·s·X2)
  const dr = eq.r2;
  const di = s * eq.x2;
  const d = dr * dr + di * di;
  const yr = (s * dr) / d;
  const yi = -1 / eq.xm - (s * di) / d;
  const y = yr * yr + yi * yi;
  return { re: yr / y, im: -yi / y };
}

/**
 * Two identical windings a and b in space quadrature, forward meaning the
 * current in b leads the one in a by 90°. Their voltages and currents are
 * related by [Va; Vb] = [zs, −j·zd; j·zd, zs]·[Ia; Ib], with zs and zd the
 * half sum and half difference of the forward and backward impedances.
 */
export interface TwoPhase {
  zs: Complex;
  zd: Complex;
  /** Re of the air-gap impedance forward and backward (Ω), for the torque. */
  gf: number;
  gb: number;
}

export function twoPhase(eq: EquivalentCircuit, s: number): TwoPhase {
  const f = gapImpedance(eq, s);
  const b = gapImpedance(eq, 2 - s);
  return {
    zs: { re: eq.r1 + (f.re + b.re) / 2, im: eq.x1 + (f.im + b.im) / 2 },
    zd: { re: (f.re - b.re) / 2, im: (f.im - b.im) / 2 },
    gf: f.re,
    gb: b.re,
  };
}

/** Winding currents for given winding voltages. */
export function twoPhaseCurrents(m: TwoPhase, va: Complex, vb: Complex): [Complex, Complex] {
  const { zs, zd } = m;
  // det = zs² − zd²
  const dr = zs.re * zs.re - zs.im * zs.im - (zd.re * zd.re - zd.im * zd.im);
  const di = 2 * zs.re * zs.im - 2 * zd.re * zd.im;
  const d = dr * dr + di * di;
  if (!(d > 0)) return [{ re: 0, im: 0 }, { re: 0, im: 0 }];
  // Ia = (zs·Va + j·zd·Vb)/det, Ib = (zs·Vb − j·zd·Va)/det
  const jzdVbRe = -(zd.re * vb.im + zd.im * vb.re);
  const jzdVbIm = zd.re * vb.re - zd.im * vb.im;
  const jzdVaRe = -(zd.re * va.im + zd.im * va.re);
  const jzdVaIm = zd.re * va.re - zd.im * va.im;
  const naRe = zs.re * va.re - zs.im * va.im + jzdVbRe;
  const naIm = zs.re * va.im + zs.im * va.re + jzdVbIm;
  const nbRe = zs.re * vb.re - zs.im * vb.im - jzdVaRe;
  const nbIm = zs.re * vb.im + zs.im * vb.re - jzdVaIm;
  return [
    { re: (naRe * dr + naIm * di) / d, im: (naIm * dr - naRe * di) / d },
    { re: (nbRe * dr + nbIm * di) / d, im: (nbIm * dr - nbRe * di) / d },
  ];
}

/**
 * Electromagnetic torque (N·m) of the two windings carrying ia and ib (RMS
 * phasors): forward field minus backward field, over the synchronous speed.
 */
export function twoPhaseTorque(m: TwoPhase, ia: Complex, ib: Complex, omegaSync: number): number {
  // If = (Ia − j·Ib)/2, Ib' = (Ia + j·Ib)/2
  const fRe = (ia.re + ib.im) / 2;
  const fIm = (ia.im - ib.re) / 2;
  const bRe = (ia.re - ib.im) / 2;
  const bIm = (ia.im + ib.re) / 2;
  return (2 / omegaSync) * ((fRe * fRe + fIm * fIm) * m.gf - (bRe * bRe + bIm * bIm) * m.gb);
}
