/**
 * Shared geometry for wires, cables and jumpers: frames along a path,
 * "lathes along a curve" (insulation sleeves, conductors, strands, ferrules)
 * with exact millimetre UVs, strand layouts and thin sheet-metal sweeps.
 * Pure three.js, no React. Sizes in millimetres.
 */
import {
  BufferGeometry,
  CatmullRomCurve3,
  Curve,
  Float32BufferAttribute,
  Vector2,
  Vector3,
} from 'three';
import { roundedPath } from '../shapes/geometry';
import type { Vec3 } from '../types';

/** A curve given by a function of t ∈ [0, 1]. */
export class FnCurve extends Curve<Vector3> {
  private readonly fn: (t: number, target: Vector3) => Vector3;
  constructor(fn: (t: number, target: Vector3) => Vector3) {
    super();
    this.fn = fn;
  }
  override getPoint(t: number, target = new Vector3()): Vector3 {
    return this.fn(t, target);
  }
}

export interface Frame {
  p: Vector3;
  /** Tangent. */
  t: Vector3;
  /** "Up" normal (points to +Y on horizontal paths). */
  u: Vector3;
  /** Side normal: u × v = t. */
  v: Vector3;
}

export const newFrame = (): Frame => ({
  p: new Vector3(),
  t: new Vector3(),
  u: new Vector3(),
  v: new Vector3(),
});

/**
 * Parallel-transport frames sampled every `step` mm along a curve, with
 * interpolation by arc length. Beyond the ends the path continues straight.
 */
export class PathFrames {
  readonly length: number;
  private readonly n: number;
  private readonly ps: Vector3[] = [];
  private readonly ts: Vector3[] = [];
  private readonly us: Vector3[] = [];
  private readonly vs: Vector3[] = [];
  /** Cumulative turning angle (rad) at each sample. */
  private readonly turn: number[] = [];

  constructor(curve: Curve<Vector3>, step = 0.5) {
    const rough = curve.getLength();
    const n = Math.max(2, Math.min(3000, Math.ceil(rough / step)));
    curve.arcLengthDivisions = Math.max(200, n * 2);
    curve.updateArcLengths();
    this.length = curve.getLength();
    this.n = n;
    const frames = curve.computeFrenetFrames(n, false);
    const flip = frames.normals[0]!.y < -1e-6 ? -1 : 1;
    let total = 0;
    for (let i = 0; i <= n; i++) {
      this.ps.push(curve.getPointAt(i / n));
      const t = frames.tangents[i]!.clone();
      const u = frames.normals[i]!.clone().multiplyScalar(flip);
      this.ts.push(t);
      this.us.push(u);
      this.vs.push(new Vector3().crossVectors(t, u));
      if (i > 0) total += this.ts[i - 1]!.angleTo(t);
      this.turn.push(total);
    }
  }

  /** Frame at arc length `s` (mm). */
  at(s: number, out: Frame = newFrame()): Frame {
    const L = this.length;
    if (s <= 0 || s >= L) {
      const i = s <= 0 ? 0 : this.n;
      out.t.copy(this.ts[i]!);
      out.u.copy(this.us[i]!);
      out.v.copy(this.vs[i]!);
      out.p.copy(this.ps[i]!).addScaledVector(out.t, s <= 0 ? s : s - L);
      return out;
    }
    const x = (s / L) * this.n;
    const i = Math.min(Math.floor(x), this.n - 1);
    const f = x - i;
    out.p.lerpVectors(this.ps[i]!, this.ps[i + 1]!, f);
    out.t.lerpVectors(this.ts[i]!, this.ts[i + 1]!, f).normalize();
    out.u.lerpVectors(this.us[i]!, this.us[i + 1]!, f);
    out.u.addScaledVector(out.t, -out.u.dot(out.t)).normalize();
    out.v.crossVectors(out.t, out.u);
    return out;
  }

  /** Turning angle (rad) of the path between two arc lengths. */
  turning(s0: number, s1: number): number {
    const idx = (s: number) => {
      const x = Math.min(Math.max(s / this.length, 0), 1) * this.n;
      const i = Math.min(Math.floor(x), this.n - 1);
      return this.turn[i]! + (this.turn[i + 1]! - this.turn[i]!) * (x - i);
    };
    return Math.abs(idx(s1) - idx(s0));
  }
}

/** Arc-length frames of a polyline with rounded corners or of a spline. */
export function framesFromPoints(points: Vec3[], { smooth = false, bend = 4, step = 0.5 } = {}) {
  return new PathFrames(curveFromPoints(points, smooth, bend), step);
}

export function curveFromPoints(points: Vec3[], smooth: boolean, bend: number): Curve<Vector3> {
  if (smooth && points.length > 2) {
    return new CatmullRomCurve3(
      points.map((p) => new Vector3(...p)),
      false,
      'centripetal',
    );
  }
  return roundedPath(points, bend);
}

/** [s (mm along the path), r (radius factor), optional u override]. */
export type ProfilePoint = [number, number] | [number, number, number];

export interface SweepOptions {
  radial?: number;
  /** Longest ring spacing on straight stretches (mm). */
  maxStep?: number;
  /** Largest turning of the path between rings (rad). */
  maxTurn?: number;
  /** Millimetres per texture repeat along the path (U). */
  uvPeriod?: number;
  /** Centre offset in the frame's (u, v) plane, as a function of s. */
  offset?: (s: number, out: Vector2) => void;
  /** Cross-section radius factor by angle (0 = top, +π/2 = side v). */
  shape?: (angle: number) => number;
}

/**
 * Accumulates indexed triangles; `sweep` adds a lathe profile swept along a
 * path. Many sweeps (all the strands of a cable) end up in one geometry.
 */
export class MeshBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly indices: number[] = [];

  get vertexCount() {
    return this.positions.length / 3;
  }

  vertex(p: Vector3, n: Vector3, u: number, v: number) {
    this.positions.push(p.x, p.y, p.z);
    this.normals.push(n.x, n.y, n.z);
    this.uvs.push(u, v);
    return this.vertexCount - 1;
  }

  triangle(a: number, b: number, c: number) {
    this.indices.push(a, b, c);
  }

  /** Flat quad whose winding is chosen so it faces `normal`. */
  quad(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, normal: Vector3, uv?: number[][]) {
    const e1 = p1.clone().sub(p0);
    const e2 = p2.clone().sub(p0);
    const flip = e1.cross(e2).dot(normal) < 0;
    const base = this.vertexCount;
    const pts = [p0, p1, p2, p3];
    pts.forEach((p, i) => this.vertex(p, normal, uv?.[i]?.[0] ?? 0, uv?.[i]?.[1] ?? 0));
    if (flip) {
      this.triangle(base, base + 2, base + 1);
      this.triangle(base, base + 3, base + 2);
    } else {
      this.triangle(base, base + 1, base + 2);
      this.triangle(base, base + 2, base + 3);
    }
  }

  sweep(frames: PathFrames, profile: ProfilePoint[], options: SweepOptions = {}): this {
    const { radial = 16, maxStep = 20, maxTurn = 0.1, uvPeriod = 100, offset, shape } = options;
    const rings = expandProfile(frames, profile, maxStep, maxTurn);
    if (rings.length < 2) return this;

    // Unit cross-section and its derivative.
    const qx: number[] = [];
    const qy: number[] = [];
    const dqx: number[] = [];
    const dqy: number[] = [];
    for (let j = 0; j <= radial; j++) {
      // Angle from the top (u) towards the side (v); the seam is at the bottom.
      const ang = (2 * Math.PI * j) / radial - Math.PI;
      const f = shape ? shape(ang) : 1;
      const h = 1e-3;
      const f1 = shape ? shape(ang + h) : 1;
      const f0 = shape ? shape(ang - h) : 1;
      const df = (f1 - f0) / (2 * h);
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      qx.push(f * c);
      qy.push(f * s);
      dqx.push(df * c - f * s);
      dqy.push(df * s + f * c);
    }

    const frame = newFrame();
    const off = new Vector2();
    const centre = new Vector3();
    const q = new Vector3();
    const dq = new Vector3();
    const along = new Vector3();
    const normal = new Vector3();
    const position = new Vector3();
    const start = this.vertexCount;
    for (const ring of rings) {
      frames.at(ring.s, frame);
      centre.copy(frame.p);
      if (offset) {
        offset(ring.s, off);
        centre.addScaledVector(frame.u, off.x).addScaledVector(frame.v, off.y);
      }
      const u = ring.u ?? ring.s / uvPeriod;
      for (let j = 0; j <= radial; j++) {
        q.set(0, 0, 0).addScaledVector(frame.u, qx[j]!).addScaledVector(frame.v, qy[j]!);
        dq.set(0, 0, 0).addScaledVector(frame.u, dqx[j]!).addScaledVector(frame.v, dqy[j]!);
        along.copy(frame.t).multiplyScalar(ring.ds).addScaledVector(q, ring.dr);
        normal.crossVectors(dq, along);
        if (normal.lengthSq() < 1e-12) normal.copy(q);
        normal.normalize();
        position.copy(centre).addScaledVector(q, ring.r);
        this.vertex(position, normal, u, 1 - j / radial);
      }
    }
    const stride = radial + 1;
    for (let k = 0; k < rings.length - 1; k++) {
      const r0 = rings[k]!;
      const r1 = rings[k + 1]!;
      if (Math.abs(r0.s - r1.s) < 1e-7 && Math.abs(r0.r - r1.r) < 1e-7) continue;
      for (let j = 0; j < radial; j++) {
        const a = start + k * stride + j;
        const b = a + stride;
        const d = a + 1;
        const c = b + 1;
        this.triangle(a, d, b);
        this.triangle(b, d, c);
      }
    }
    return this;
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2));
    geometry.setIndex(this.indices);
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return geometry;
  }
}

interface Ring {
  s: number;
  r: number;
  u?: number;
  /** Direction of the profile at this ring (along s, along r), normalized. */
  ds: number;
  dr: number;
}

function expandProfile(
  frames: PathFrames,
  profile: ProfilePoint[],
  maxStep: number,
  maxTurn: number,
): Ring[] {
  // Subdivide long or curved stretches.
  const pts: ProfilePoint[] = [];
  for (let i = 0; i < profile.length; i++) {
    const p = profile[i]!;
    if (i > 0) {
      const prev = profile[i - 1]!;
      const span = Math.abs(p[0] - prev[0]);
      if (span > 1e-6) {
        const turn = frames.turning(prev[0], p[0]);
        const steps = Math.max(Math.ceil(span / maxStep), Math.ceil(turn / maxTurn), 1);
        for (let k = 1; k < steps; k++) {
          const f = k / steps;
          pts.push([prev[0] + (p[0] - prev[0]) * f, prev[1] + (p[1] - prev[1]) * f]);
        }
      }
    }
    pts.push(p);
  }
  const same = (a: ProfilePoint, b: ProfilePoint) =>
    Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
  const dir = (a: ProfilePoint, b: ProfilePoint): [number, number] => {
    const ds = b[0] - a[0];
    const dr = b[1] - a[1];
    const len = Math.hypot(ds, dr) || 1;
    return [ds / len, dr / len];
  };
  return pts.map((p, i) => {
    const prev = pts[i - 1];
    const next = pts[i + 1];
    let d: [number, number];
    const prevOk = prev && !same(prev, p);
    const nextOk = next && !same(next, p);
    if (prev && same(prev, p)) d = next ? dir(p, next) : [1, 0];
    else if (next && same(next, p)) d = prev ? dir(prev, p) : [1, 0];
    else if (prevOk && nextOk) {
      const a = dir(prev, p);
      const b = dir(p, next);
      const len = Math.hypot(a[0] + b[0], a[1] + b[1]) || 1;
      d = [(a[0] + b[0]) / len, (a[1] + b[1]) / len];
    } else if (nextOk) d = dir(p, next);
    else if (prevOk) d = dir(prev, p);
    else d = [1, 0];
    return { s: p[0], r: p[1], u: p[2], ds: d[0], dr: d[1] };
  });
}

/**
 * Profile of a closed round rod from s0 to s1 (flat ends with a small fillet
 * `f`): conductors, strands, pins.
 */
export function rodProfile(
  s0: number,
  s1: number,
  r: number,
  f = 0,
  capU?: number,
): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  const cap = (s: number, rr: number): ProfilePoint =>
    capU === undefined ? [s, rr] : [s, rr, capU];
  out.push(cap(s0, 0), cap(s0, Math.max(r - f, 0)));
  if (f > 0) {
    for (let i = 1; i <= 3; i++) {
      const a = (Math.PI / 2) * (i / 3);
      out.push([s0 + f - Math.cos(a) * f, r - f + Math.sin(a) * f]);
    }
    for (let i = 0; i < 3; i++) {
      const a = (Math.PI / 2) * (i / 3);
      out.push([s1 - f + Math.sin(a) * f, r - f + Math.cos(a) * f]);
    }
  } else {
    out.push([s0, r], [s1, r]);
  }
  out.push(cap(s1, Math.max(r - f, 0)), cap(s1, 0));
  return out;
}

/**
 * Profile of an insulation sleeve from s0 to s1: end faces (annuli from
 * `inner` to `outer`) with a small fillet, and a short bore at each end closed
 * deeper inside, so looking into a cut end shows a hollow.
 */
export function sleeveProfile(
  s0: number,
  s1: number,
  outer: number,
  inner: number,
  { fillet = 0.15, bore = 2.5, start = true, end = true, capU = 0 } = {},
): ProfilePoint[] {
  const f = Math.min(fillet, (outer - inner) * 0.6);
  const out: ProfilePoint[] = [];
  const b = Math.min(bore, (s1 - s0) / 3);
  if (start) {
    out.push([s0 + b, 0, capU], [s0 + b, inner, capU], [s0 + b, inner, capU]);
    out.push([s0, inner, capU], [s0, inner, capU], [s0, outer - f, capU]);
    for (let i = 1; i <= 2; i++) {
      const a = (Math.PI / 2) * (i / 2);
      out.push([s0 + f - Math.cos(a) * f, outer - f + Math.sin(a) * f, capU]);
    }
    // Same point twice: the texture starts here (the end face stays plain).
    out.push([s0 + f, outer]);
  } else {
    out.push([s0, outer]);
  }
  if (end) {
    out.push([s1 - f, outer]);
    for (let i = 0; i < 2; i++) {
      const a = (Math.PI / 2) * (i / 2);
      out.push([s1 - f + Math.sin(a) * f, outer - f + Math.cos(a) * f, capU]);
    }
    out.push([s1, outer - f, capU], [s1, inner, capU], [s1, inner, capU]);
    out.push([s1 - b, inner, capU], [s1 - b, inner, capU], [s1 - b, 0, capU]);
  } else {
    out.push([s1, outer]);
  }
  return out;
}

/** Deterministic pseudo-random numbers (same look on every page). */
export function seeded(seed: number) {
  let state = (seed * 16807 + 11) % 2147483647 || 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

/**
 * Positions of `count` strands of radius `strandR` packed in rings inside a
 * bundle of radius `bundleR` (bunched class 5 conductors look like this in a
 * cross-section).
 */
export function strandLayout(
  count: number,
  strandR: number,
  bundleR: number,
  seed = 7,
): [number, number][] {
  const random = seeded(seed);
  if (count <= 1) return [[0, 0]];
  // Rings needed (capacity of ring k ≈ π k strands).
  let rings = 0;
  let capacity = 1;
  while (capacity < count) {
    rings++;
    capacity += Math.max(6, Math.floor(Math.PI * rings * 1.9));
  }
  const outerR = Math.max(bundleR - strandR, strandR * 1.9);
  const firstR = Math.min(strandR * 1.95, outerR);
  const radii = Array.from({ length: rings }, (_, k) =>
    rings === 1 ? outerR : firstR + ((outerR - firstR) * k) / (rings - 1),
  );
  const weights = radii;
  const total = weights.reduce((a, b) => a + b, 0);
  const left = count - 1;
  const perRing = weights.map((w) => Math.floor((left * w) / total));
  let assigned = perRing.reduce((a, b) => a + b, 0);
  for (let k = rings - 1; assigned < left; k = (k - 1 + rings) % rings) {
    perRing[k]!++;
    assigned++;
  }
  const out: [number, number][] = [[0, 0]];
  perRing.forEach((n, k) => {
    const rr = radii[k]!;
    const phase = random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = phase + (2 * Math.PI * i) / n + (random() - 0.5) * 0.08;
      const jr = rr + (random() - 0.5) * strandR * 0.18;
      out.push([jr * Math.cos(a), jr * Math.sin(a)]);
    }
  });
  return out;
}

/**
 * Thin sheet bent to a 2D profile (x, y) and extruded along local Z over the
 * given ranges: spring clips, crimp wings. Smooth normals on the faces, flat
 * on the edges and ends.
 */
export function addSheet(
  builder: MeshBuilder,
  centre: [number, number][],
  thickness: number,
  ranges: [number, number][],
) {
  const n = centre.length;
  const normals2: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = centre[Math.max(i - 1, 0)]!;
    const b = centre[Math.min(i + 1, n - 1)]!;
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    // Miter: keep the thickness at the bends.
    let nx = -ty / len;
    let ny = tx / len;
    if (i > 0 && i < n - 1) {
      const p = centre[i]!;
      const d1x = p[0] - a[0];
      const d1y = p[1] - a[1];
      const l1 = Math.hypot(d1x, d1y) || 1;
      const cos = (nx * -d1y) / l1 + (ny * d1x) / l1;
      const scale = 1 / Math.max(Math.abs(cos), 0.5);
      nx *= scale;
      ny *= scale;
    }
    normals2.push([nx, ny]);
  }
  const h = thickness / 2;
  const outer = centre.map(
    (p, i) => new Vector2(p[0] + normals2[i]![0] * h, p[1] + normals2[i]![1] * h),
  );
  const inner = centre.map(
    (p, i) => new Vector2(p[0] - normals2[i]![0] * h, p[1] - normals2[i]![1] * h),
  );
  const v3 = (p: Vector2, z: number) => new Vector3(p.x, p.y, z);
  for (const [z0, z1] of ranges) {
    for (const [side, sign] of [
      [outer, 1],
      [inner, -1],
    ] as const) {
      const base = builder.vertexCount;
      for (let i = 0; i < n; i++) {
        const nn = new Vector3(normals2[i]![0] * sign, normals2[i]![1] * sign, 0).normalize();
        builder.vertex(v3(side[i]!, z0), nn, 0, 0);
        builder.vertex(v3(side[i]!, z1), nn, 0, 0);
      }
      for (let i = 0; i < n - 1; i++) {
        const a = base + i * 2;
        const b = a + 1;
        const c = a + 3;
        const d = a + 2;
        // Winding so the face points along nn.
        const pa = v3(side[i]!, z0);
        const pb = v3(side[i]!, z1);
        const pd = v3(side[i + 1]!, z0);
        const face = pb.clone().sub(pa).cross(pd.clone().sub(pa));
        const want = new Vector3(normals2[i]![0] * sign, normals2[i]![1] * sign, 0);
        if (face.dot(want) >= 0) {
          builder.triangle(a, b, d);
          builder.triangle(b, c, d);
        } else {
          builder.triangle(a, d, b);
          builder.triangle(b, d, c);
        }
      }
    }
    // Edges at both ends of the profile.
    for (const i of [0, n - 1]) {
      const other = i === 0 ? 1 : n - 2;
      const dir = new Vector3(
        centre[i]![0] - centre[other]![0],
        centre[i]![1] - centre[other]![1],
        0,
      ).normalize();
      builder.quad(v3(outer[i]!, z0), v3(outer[i]!, z1), v3(inner[i]!, z1), v3(inner[i]!, z0), dir);
    }
    // End caps.
    for (const [z, nz] of [
      [z0, -1],
      [z1, 1],
    ] as const) {
      const normal = new Vector3(0, 0, nz);
      for (let i = 0; i < n - 1; i++) {
        builder.quad(
          v3(outer[i]!, z),
          v3(outer[i + 1]!, z),
          v3(inner[i + 1]!, z),
          v3(inner[i]!, z),
          normal,
        );
      }
    }
  }
}

export const smoothstep = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};
