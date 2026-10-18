/**
 * 05.3: a magnet passing along the axis of a short coil. The magnet is a
 * dipole of moment m (A·m²); the flux through one turn of radius a with the
 * magnet at distance z on the axis is
 *
 *   Φ(z) = μ0·m·a² / (2·(a² + z²)^{3/2})
 *
 * and Faraday's law gives the voltage of N turns, v = −N·dΦ/dt = −N·(dΦ/dz)·u,
 * where u = dz/dt is the speed of the magnet. Pure, tested in inducao.test.ts.
 *
 * Sign convention: z grows from left to right; m > 0 when the north pole
 * points to +z. The induced field inside the coil points against dΦ/dt.
 */

export const MU0 = 4e-7 * Math.PI;

/** Radius of the coil (m): a coil wound on a 2 cm tube. */
export const COIL_RADIUS = 0.01;

export const TURNS = [100, 500, 1000] as const;

/**
 * Two magnets of the same size (a cylinder Ø 10 × 10 mm): ferrite with a
 * remanence of about 0,4 T and neodymium with about 1,2 T (typical), so the
 * neodymium one is three times stronger. m = Br·volume/μ0.
 */
export const MAGNETS = {
  ferrite: { label: 'Ferrite', moment: 0.25 },
  neodimio: { label: 'Neodímio', moment: 0.75 },
} as const;
export type MagnetKind = keyof typeof MAGNETS;

/** Flux (Wb) through one turn, with the magnet at z (m) on the axis. */
export function fluxPerTurn(z: number, moment: number, a = COIL_RADIUS): number {
  return (MU0 * moment * a * a) / (2 * (a * a + z * z) ** 1.5);
}

/** dΦ/dz (Wb/m) for one turn. */
export function fluxSlope(z: number, moment: number, a = COIL_RADIUS): number {
  return (-3 * MU0 * moment * a * a * z) / (2 * (a * a + z * z) ** 2.5);
}

/** Induced voltage (V) of N turns, magnet at z (m) moving at u (m/s). */
export function emf(turns: number, z: number, u: number, moment: number, a = COIL_RADIUS): number {
  const v = -turns * fluxSlope(z, moment, a) * u;
  return v === 0 ? 0 : v; // no −0
}

/** Largest |v| of a pass at constant speed: it happens at z = ±a/2. */
export function peakEmf(turns: number, u: number, moment: number, a = COIL_RADIUS): number {
  return Math.abs(emf(turns, a / 2, u, moment, a));
}

export interface TracePoint {
  /** Time (s) from the instant the magnet is at the centre of the coil. */
  t: number;
  /** Magnet position (m). */
  z: number;
  /** Induced voltage (V). */
  v: number;
}

/**
 * A pass at constant speed u (m/s, positive: left to right), sampled over the
 * time window [−window, +window] around the centre of the coil.
 */
export function passTrace(
  turns: number,
  u: number,
  moment: number,
  window: number,
  points = 600,
  a = COIL_RADIUS,
): TracePoint[] {
  const out: TracePoint[] = [];
  for (let k = 0; k <= points; k++) {
    const t = -window + (2 * window * k) / points;
    const z = u * t;
    out.push({ t, z, v: emf(turns, z, u, moment, a) });
  }
  return out;
}

/**
 * Which way the induced current makes the coil a magnet: the pole on its
 * left face (the right face has the other one). Lenz: it opposes the change
 * of the flux. Undefined while nothing changes.
 */
export function leftFacePole(
  z: number,
  u: number,
  moment: number,
  a = COIL_RADIUS,
): 'N' | 'S' | undefined {
  const dPhi = fluxSlope(z, moment, a) * u;
  if (dPhi === 0) return undefined;
  // Induced field against dΦ/dt: pointing to −z leaves the coil by the left face (north).
  return dPhi > 0 ? 'N' : 'S';
}

/** Volts per division of a scope (1-2-5 steps) so that `peak` fits in `divisions`. */
export function voltsPerDivision(peak: number, divisions = 4): number {
  const target = Math.max(Math.abs(peak), 1e-6) / divisions;
  const decade = 10 ** Math.floor(Math.log10(target));
  for (const step of [1, 2, 5, 10]) {
    if (step * decade >= target * 0.999) return step * decade;
  }
  return 10 * decade;
}
