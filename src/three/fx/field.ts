/**
 * Magnetic field of simple sources and the field lines through it, computed
 * (not drawn by hand): bar magnets (two magnetic poles), point dipoles,
 * circular loops (exact, with elliptic integrals), solenoids (stacks of
 * loops) and straight wire segments (Biot–Savart). Units: millimetres,
 * amperes, with μ0/4π = 1, so only directions and ratios are meaningful.
 * Pure functions, unit-tested.
 */
import type { Vec3 } from '../types';

export type FieldSource =
  /** Bar magnet: north pole at +axis·length/2. */
  | { kind: 'bar'; position?: Vec3; axis?: Vec3; length: number; strength?: number }
  | { kind: 'dipole'; position?: Vec3; moment: Vec3 }
  /** Current loop; positive current circulates counter-clockwise seen from +axis. */
  | { kind: 'loop'; position?: Vec3; axis?: Vec3; radius: number; current?: number }
  | {
      kind: 'solenoid';
      position?: Vec3;
      axis?: Vec3;
      radius: number;
      length: number;
      turns?: number;
      current?: number;
    }
  /** Straight wire; positive current flows from `start` to `end`. */
  | { kind: 'wire'; start: Vec3; end: Vec3; current?: number };

type V = [number, number, number];

const sub = (a: V | Vec3, b: V | Vec3): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V | Vec3, b: V | Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V | Vec3, b: V | Vec3): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a: V | Vec3) => Math.hypot(a[0], a[1], a[2]);
const scale = (a: V | Vec3, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const add = (a: V | Vec3, b: V | Vec3): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const unit = (a: V | Vec3): V => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Complete elliptic integrals K(m) and E(m), parameter m = k², by the AGM. */
export function ellipticKE(m: number): [number, number] {
  let a = 1;
  let b = Math.sqrt(Math.max(1 - m, 1e-300));
  let sum = m / 2;
  let pow = 0.5;
  for (let i = 0; i < 40; i++) {
    const c = (a - b) / 2;
    const an = (a + b) / 2;
    b = Math.sqrt(a * b);
    a = an;
    pow *= 2;
    sum += pow * c * c;
    if (Math.abs(c) < 1e-15) break;
  }
  const K = Math.PI / (2 * a);
  return [K, K * (1 - sum)];
}

/**
 * Field of a circular loop of radius `a` and current `I` at cylindrical
 * coordinates (ρ, z) around its axis: [Bρ, Bz]. Simpson et al. (2001),
 * "Simple analytic expressions for the magnetic field of a circular current
 * loop", with μ0 = 4π.
 */
export function loopField(a: number, I: number, rho: number, z: number): [number, number] {
  const r2 = a * a + rho * rho + z * z;
  const alpha2 = Math.max(r2 - 2 * a * rho, 1e-12);
  const beta2 = r2 + 2 * a * rho;
  const beta = Math.sqrt(beta2);
  const m = 1 - alpha2 / beta2;
  const [K, E] = ellipticKE(m);
  const C = 4 * I;
  const bz = (C / (2 * alpha2 * beta)) * ((a * a - rho * rho - z * z) * E + alpha2 * K);
  const brho = rho < 1e-9 ? 0 : ((C * z) / (2 * alpha2 * beta * rho)) * (r2 * E - alpha2 * K);
  return [brho, bz];
}

function addLoop(out: V, p: Vec3, center: Vec3, axis: V, radius: number, I: number) {
  const d = sub(p, center);
  const z = dot(d, axis);
  const radial = sub(d, scale(axis, z));
  const rho = len(radial);
  const [brho, bz] = loopField(radius, I, rho, z);
  out[0] += axis[0] * bz;
  out[1] += axis[1] * bz;
  out[2] += axis[2] * bz;
  if (rho > 1e-9) {
    out[0] += (radial[0] / rho) * brho;
    out[1] += (radial[1] / rho) * brho;
    out[2] += (radial[2] / rho) * brho;
  }
}

/** Loops used to model a solenoid (enough for the shape of the field). */
const solenoidLoops = (turns: number) => Math.max(2, Math.min(Math.round(turns), 16));

/** Magnetic field at `p` (arbitrary units, μ0/4π = 1). */
export function fieldAt(sources: FieldSource[], p: Vec3): V {
  const out: V = [0, 0, 0];
  for (const s of sources) {
    if (s.kind === 'bar') {
      const c = s.position ?? [0, 0, 0];
      const axis = unit(s.axis ?? [1, 0, 0]);
      const q = s.strength ?? 100;
      const north = add(c, scale(axis, s.length / 2));
      const south = add(c, scale(axis, -s.length / 2));
      const dn = sub(p, north);
      const ds = sub(p, south);
      const rn = Math.max(len(dn), 1e-6) ** 3;
      const rs = Math.max(len(ds), 1e-6) ** 3;
      for (let i = 0; i < 3; i++) out[i]! += q * (dn[i]! / rn - ds[i]! / rs);
    } else if (s.kind === 'dipole') {
      const r = sub(p, s.position ?? [0, 0, 0]);
      const d = Math.max(len(r), 1e-6);
      const n = scale(r, 1 / d);
      const mn = dot(s.moment, n);
      for (let i = 0; i < 3; i++) out[i]! += (3 * mn * n[i]! - s.moment[i]!) / d ** 3;
    } else if (s.kind === 'loop') {
      addLoop(out, p, s.position ?? [0, 0, 0], unit(s.axis ?? [0, 1, 0]), s.radius, s.current ?? 1);
    } else if (s.kind === 'solenoid') {
      const c = s.position ?? [0, 0, 0];
      const axis = unit(s.axis ?? [0, 1, 0]);
      const turns = s.turns ?? 50;
      const n = solenoidLoops(turns);
      const I = ((s.current ?? 1) * turns) / n;
      for (let k = 0; k < n; k++) {
        const t = n === 1 ? 0 : (k / (n - 1) - 0.5) * s.length;
        addLoop(out, p, add(c, scale(axis, t)), axis, s.radius, I);
      }
    } else {
      // Finite straight segment: B = I/(4πd)·(cos α1 − cos α2), around the wire.
      const I = s.current ?? 1;
      const ab = sub(s.end, s.start);
      const L = len(ab);
      if (L < 1e-9) continue;
      const u = scale(ab, 1 / L);
      const ap = sub(p, s.start);
      const along = dot(ap, u);
      const perp = sub(ap, scale(u, along));
      const d = len(perp);
      if (d < 1e-6) continue;
      const bp = sub(p, s.end);
      const cos1 = along / Math.max(len(ap), 1e-9);
      const cos2 = dot(bp, u) / Math.max(len(bp), 1e-9);
      const b = (I / d) * (cos1 - cos2);
      const dir = cross(u, scale(perp, 1 / d));
      for (let i = 0; i < 3; i++) out[i]! += dir[i]! * b;
    }
  }
  return out;
}

export interface TraceOptions {
  /** Integration step (mm). */
  step: number;
  maxSteps?: number;
  /** Stop when farther than this from `center`. */
  extent: number;
  center?: Vec3;
  /** Stop when this returns true (near a pole or a wire). */
  stop?: (p: Vec3) => boolean;
}

/**
 * Follows the field from `seed` (direction +1 along B, −1 against it) with a
 * fourth-order Runge–Kutta on the unit field. Closed lines (around wires and
 * loops) stop when they come back to the seed.
 */
export function traceLine(
  sources: FieldSource[],
  seed: Vec3,
  direction: 1 | -1,
  { step, maxSteps = 1500, extent, center = [0, 0, 0], stop }: TraceOptions,
): { points: Vec3[]; closed: boolean } {
  const dirAt = (p: Vec3): V | null => {
    const b = fieldAt(sources, p);
    const l = len(b);
    if (!(l > 1e-12) || !Number.isFinite(l)) return null;
    return scale(b, direction / l);
  };
  const points: Vec3[] = [[...seed]];
  let p: Vec3 = [...seed];
  let travelled = 0;
  for (let i = 0; i < maxSteps; i++) {
    const k1 = dirAt(p);
    if (!k1) break;
    const k2 = dirAt(add(p, scale(k1, step / 2)));
    if (!k2) break;
    const k3 = dirAt(add(p, scale(k2, step / 2)));
    if (!k3) break;
    const k4 = dirAt(add(p, scale(k3, step)));
    if (!k4) break;
    const d = scale(add(add(k1, scale(k2, 2)), add(scale(k3, 2), k4)), step / 6);
    p = add(p, d);
    travelled += step;
    points.push([...p]);
    if (travelled > step * 6 && len(sub(p, seed)) < step * 0.75) {
      points.push([...seed]);
      return { points, closed: true };
    }
    if (len(sub(p, center)) > extent) break;
    if (stop?.(p)) break;
  }
  return { points, closed: false };
}

export interface FieldLinesOptions {
  /** Lines per source. */
  count?: number;
  /** Lines in one plane through each source ('plano') or all around it ('3d'). */
  layout?: 'plano' | '3d';
  /** Normal of the plane of the lines for 'plano'. */
  planeNormal?: Vec3;
  /** Radius of the region where lines are drawn (mm). */
  extent?: number;
  center?: Vec3;
}

/** Any vector perpendicular to `a`, preferring one in the plane with normal `n`. */
function perpendicular(a: V, n: V): V {
  const inPlane = cross(n, a);
  if (len(inPlane) > 1e-6) return unit(inPlane);
  const other: V = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
  return unit(cross(a, other));
}

/** Directions on a circle (plane) or a sphere (3D) around `axis`, avoiding the axis itself. */
function fan(axis: V, side: V, count: number, layout: 'plano' | '3d', half: boolean): V[] {
  const out: V[] = [];
  if (layout === 'plano') {
    for (let i = 0; i < count; i++) {
      const a = half
        ? -Math.PI / 2 + (Math.PI * (i + 0.5)) / count
        : (Math.PI * 2 * (i + 0.5)) / count;
      out.push(add(scale(axis, Math.cos(a)), scale(side, Math.sin(a))));
    }
    return out;
  }
  const third = unit(cross(axis, side));
  for (let i = 0; i < count; i++) {
    // Fibonacci points on the (half) sphere.
    const y = half ? 1 - (i + 0.5) / count : 1 - (2 * (i + 0.5)) / count;
    const r = Math.sqrt(Math.max(1 - y * y, 0));
    const phi = i * 2.399963;
    out.push(
      add(scale(axis, y), add(scale(side, Math.cos(phi) * r), scale(third, Math.sin(phi) * r))),
    );
  }
  return out;
}

/** Field lines of the sources, as polylines (mm). */
export function fieldLines(sources: FieldSource[], options: FieldLinesOptions = {}): Vec3[][] {
  const { count = 12, layout = 'plano', planeNormal = [0, 0, 1], center = [0, 0, 0] } = options;
  const normal = unit(planeNormal);
  const size = Math.max(
    ...sources.map((s) =>
      s.kind === 'bar'
        ? s.length
        : s.kind === 'dipole'
          ? 20
          : s.kind === 'loop'
            ? s.radius * 2
            : s.kind === 'solenoid'
              ? Math.max(s.length, s.radius * 2)
              : len(sub(s.end, s.start)),
    ),
    1,
  );
  const extent = options.extent ?? size * 2.2;
  const step = size / 120;
  const lines: Vec3[][] = [];

  // Stop near poles and wires, where the field is singular.
  const poles: { at: V; r: number; sink: boolean }[] = [];
  for (const s of sources) {
    if (s.kind === 'bar') {
      const c = s.position ?? [0, 0, 0];
      const axis = unit(s.axis ?? [1, 0, 0]);
      poles.push({ at: add(c, scale(axis, -s.length / 2)), r: step * 1.5, sink: true });
      poles.push({ at: add(c, scale(axis, s.length / 2)), r: step * 1.5, sink: false });
    }
  }
  const stopAtSink = (forward: boolean) => (p: Vec3) =>
    poles.some((pole) => pole.sink === forward && len(sub(p, pole.at)) < pole.r);
  const trace = (seed: Vec3, both: boolean, stop?: (dir: 1 | -1) => (p: Vec3) => boolean) => {
    const opts = { step, extent, center };
    const fwd = traceLine(sources, seed, 1, { ...opts, stop: stop?.(1) });
    if (fwd.closed || !both) return fwd.points;
    const back = traceLine(sources, seed, -1, { ...opts, stop: stop?.(-1) });
    return [...back.points.slice(1).reverse(), ...fwd.points];
  };

  for (const s of sources) {
    if (s.kind === 'bar') {
      const c = s.position ?? [0, 0, 0];
      const axis = unit(s.axis ?? [1, 0, 0]);
      const north = add(c, scale(axis, s.length / 2));
      const side = perpendicular(axis, normal);
      // Seeds just outside the north pole; each line runs to the south pole.
      const south = add(c, scale(axis, -s.length / 2));
      for (const d of fan(axis, side, count, layout, false)) {
        const seed = add(north, scale(d, step * 2));
        const line = trace(seed, false, (dir) => stopAtSink(dir === 1));
        lines.push(line);
        const end = line[line.length - 1]!;
        if (poles.some((pole) => pole.sink && len(sub(end, pole.at)) < step * 3)) continue;
        // The line leaves the region: draw its mirror image arriving at the south pole.
        const mirror = sub(d, scale(axis, 2 * dot(d, axis)));
        const back = traceLine(sources, add(south, scale(mirror, step * 2)), -1, {
          step,
          extent,
          center,
          stop: stopAtSink(false),
        });
        lines.push(back.points.reverse());
      }
    } else if (s.kind === 'dipole') {
      const c = s.position ?? [0, 0, 0];
      const axis = unit(s.moment);
      const side = perpendicular(axis, normal);
      const r0 = size * 0.15;
      for (const d of fan(axis, side, count, layout, true)) {
        lines.push(trace(add(c, scale(d, r0)), true, () => (p) => len(sub(p, c)) < r0 * 0.9));
      }
    } else if (s.kind === 'loop' || s.kind === 'solenoid') {
      const c = s.position ?? [0, 0, 0];
      const axis = unit(s.axis ?? [0, 1, 0]);
      const side = perpendicular(axis, normal);
      const ring =
        layout === 'plano' ? [side, scale(side, -1)] : fan(side, axis, 4, 'plano', false);
      const perSide = Math.max(1, Math.round(count / ring.length));
      for (const dir of ring) {
        for (let i = 0; i < perSide; i++) {
          // Seeds across the opening, from the axis towards the winding.
          const r = s.radius * (0.08 + (0.84 * (i + 0.5)) / perSide);
          lines.push(trace(add(c, scale(dir, r)), true));
        }
      }
    } else {
      const mid = scale(add(s.start, s.end), 0.5);
      const u = unit(sub(s.end, s.start));
      const side = perpendicular(u, normal);
      for (let i = 0; i < count; i++) {
        const r = size * 0.05 * Math.pow(1.35, i);
        if (r > extent * 0.9) break;
        lines.push(trace(add(mid, scale(side, r)), true));
      }
    }
  }
  return lines.filter((l) => l.length > 2);
}
