/**
 * Geometry shared by the semiconductor parts (diodes, transistors, ICs,
 * displays, sensors): moulded epoxy bodies lofted from outlines (draft,
 * fillets, pin-1 notch), flat stamped leads, gull-wing leads and bond wires.
 * All sizes in millimetres. Private helper (the `_` prefix keeps it out of
 * the part registry).
 */
import {
  BufferGeometry,
  Euler,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  Shape,
  ShapeUtils,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { smoothPath, tube } from '../shapes/geometry';
import type { Vec3 } from '../types';

export type Pt = [number, number];

/** One cross-section of a lofted body: an outline in the XZ plane at height `y`. */
export interface Ring {
  y: number;
  pts: Pt[];
}

export function signedArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]!;
    const [x2, z2] = pts[(i + 1) % pts.length]!;
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

export interface LoftOptions {
  capTop?: boolean;
  capBottom?: boolean;
  /** Put the top cap in its own material group (index 1), for printed markings. */
  topGroup?: boolean;
  /** Bounds [minX, maxX, minZ, maxZ] of the planar UVs of the top cap. */
  topBounds?: [number, number, number, number];
}

/**
 * A closed body lofted through rings that all have the same number of points
 * (side UVs: U along the perimeter, V with height; the top cap gets planar
 * UVs with V = 1 at the back, so text drawn in a canvas reads from the front).
 * Groups: 0 = sides and bottom, 1 = top cap when `topGroup`.
 */
export function loft(rings: Ring[], options: LoftOptions = {}): BufferGeometry {
  const { capTop = true, capBottom = true, topGroup = false } = options;
  const n = rings[0]!.pts.length;
  // Outward normals need the outline clockwise in the (x, z) plane.
  const mid = rings[Math.floor(rings.length / 2)]!;
  const flip = signedArea(mid.pts) > 0;
  const outlines = rings.map((r) => (flip ? [...r.pts].reverse() : r.pts));
  const yMin = rings[0]!.y;
  const ySpan = rings[rings.length - 1]!.y - yMin || 1;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  rings.forEach((ring, j) => {
    const pts = outlines[j]!;
    let perimeter = 0;
    const lengths = [0];
    for (let i = 1; i <= n; i++) {
      const [x1, z1] = pts[i - 1]!;
      const [x2, z2] = pts[i % n]!;
      perimeter += Math.hypot(x2 - x1, z2 - z1);
      lengths.push(perimeter);
    }
    for (let i = 0; i <= n; i++) {
      const [x, z] = pts[i % n]!;
      positions.push(x, ring.y, z);
      uvs.push(lengths[i]! / (perimeter || 1), (ring.y - yMin) / ySpan);
    }
  });
  const row = n + 1;
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const sideCount = indices.length;

  const cap = (j: number, up: boolean) => {
    const pts = outlines[j]!;
    const y = rings[j]!.y;
    // Collapsed points (a notch of radius 0) would confuse the triangulation.
    const unique: Pt[] = [];
    for (const p of pts) {
      const last = unique[unique.length - 1];
      if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 1e-5) unique.push(p);
    }
    if (unique.length > 2) {
      const first = unique[0]!;
      const last = unique[unique.length - 1]!;
      if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-5) unique.pop();
    }
    const contour = unique.map(([x, z]) => new Vector2(x, z));
    const triangles = ShapeUtils.triangulateShape(contour, []);
    const base = positions.length / 3;
    const [minX, maxX, minZ, maxZ] = options.topBounds ?? boundsOf(unique);
    for (const [x, z] of unique) {
      positions.push(x, y, z);
      uvs.push((x - minX) / (maxX - minX || 1), (maxZ - z) / (maxZ - minZ || 1));
    }
    for (const [a, b, c] of triangles) {
      const pa = unique[a]!;
      const pb = unique[b]!;
      const pc = unique[c]!;
      // Normal Y of (b - a) × (c - a) in (x, y, z) with y constant.
      const ny = (pb[1] - pa[1]) * (pc[0] - pa[0]) - (pb[0] - pa[0]) * (pc[1] - pa[1]);
      if (ny > 0 === up) indices.push(base + a, base + b, base + c);
      else indices.push(base + a, base + c, base + b);
    }
  };

  if (capBottom) cap(0, false);
  const bottomEnd = indices.length;
  if (capTop) cap(rings.length - 1, true);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  if (topGroup) {
    geometry.addGroup(0, bottomEnd, 0);
    geometry.addGroup(bottomEnd, indices.length - bottomEnd, 1);
  } else {
    geometry.addGroup(0, Math.max(indices.length, sideCount), 0);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function boundsOf(pts: Pt[]): [number, number, number, number] {
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
}

/** Arc points around (cx, cz) from angle a0 to a1 (radians), `steps` segments. */
function arc(cx: number, cz: number, r: number, a0: number, a1: number, steps: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return out;
}

export interface RectInsets {
  px?: number;
  nx?: number;
  pz?: number;
  nz?: number;
}

/**
 * Rounded rectangle `w` × `d` centred on the origin, counter-clockwise from
 * the middle of the +X side. Per-side insets move single sides (chamfers);
 * `notch` (radius, possibly 0) cuts a half-circle into the -X side, so rings
 * with and without the notch keep the same number of points.
 */
export function roundedRect(
  w: number,
  d: number,
  r: number,
  {
    segments = 5,
    notch,
    notchSegments = 14,
    insets = {},
  }: { segments?: number; notch?: number; notchSegments?: number; insets?: RectInsets } = {},
): Pt[] {
  const x0 = -w / 2 + (insets.nx ?? 0);
  const x1 = w / 2 - (insets.px ?? 0);
  const z0 = -d / 2 + (insets.nz ?? 0);
  const z1 = d / 2 - (insets.pz ?? 0);
  const rr = Math.max(Math.min(r, (x1 - x0) / 2 - 1e-3, (z1 - z0) / 2 - 1e-3), 0.01);
  const zc = (z0 + z1) / 2;
  const out: Pt[] = [[x1, zc]];
  out.push(...arc(x1 - rr, z1 - rr, rr, 0, Math.PI / 2, segments));
  out.push(...arc(x0 + rr, z1 - rr, rr, Math.PI / 2, Math.PI, segments));
  if (notch !== undefined) {
    const rn = Math.min(Math.max(notch, 0), (z1 - z0) / 2 - rr - 0.01);
    out.push(...arc(x0, zc, rn, Math.PI / 2, -Math.PI / 2, notchSegments));
  }
  out.push(...arc(x0 + rr, z0 + rr, rr, Math.PI, (Math.PI * 3) / 2, segments));
  out.push(...arc(x1 - rr, z0 + rr, rr, (Math.PI * 3) / 2, Math.PI * 2, segments));
  return out;
}

/** Inset of a quarter-round fillet of radius `f` at distance `t` (0..f) from the edge. */
export function filletInset(f: number, t: number): number {
  if (f <= 0) return 0;
  const u = Math.min(Math.max(t, 0), f);
  return f - Math.sqrt(Math.max(f * f - (f - u) * (f - u), 0));
}

export interface MoldedBlockOptions {
  /** Size at the parting line (X, Z) and total height (Y from 0). */
  width: number;
  depth: number;
  height: number;
  /** Radius of the vertical edges (top view). */
  corner?: number;
  /** Fillet of the top and bottom edges. */
  fillet?: number;
  bottomFillet?: number;
  /** Inset per mm away from the parting line (tangent of the draft angle). */
  draft?: number;
  /** Height of the parting line (default: middle). */
  parting?: number;
  /** Half-round pin-1 notch in the -X end, from the top. */
  notch?: { radius: number; depth: number };
  /** 45° chamfer of the top edge on the +Z side (SOIC pin-1 bevel). */
  chamferFront?: number;
  segments?: number;
}

/**
 * Moulded package body (DIP, SOIC, QFP, TO-220 epoxy): a rounded block with
 * draft on both halves, filleted edges and an optional pin-1 notch. The top
 * cap is group 1 with planar UVs over the parting-line footprint.
 */
export function moldedBlock(o: MoldedBlockOptions): BufferGeometry {
  const {
    width: w,
    depth: d,
    height: h,
    corner = 0.3,
    fillet = 0.2,
    bottomFillet = fillet,
    draft = 0.08,
    parting = h / 2,
    notch,
    chamferFront = 0,
    segments = 5,
  } = o;
  const heights = new Set<number>([0, parting, h]);
  const steps = 5;
  for (let i = 1; i < steps; i++) {
    heights.add((bottomFillet * i) / steps);
    heights.add(h - fillet + (fillet * i) / steps);
  }
  heights.add(bottomFillet);
  heights.add(h - fillet);
  if (notch) {
    for (let i = 0; i <= 8; i++) heights.add(h - notch.depth * Math.cos((Math.PI / 2) * (i / 8)));
  }
  if (chamferFront > 0) heights.add(h - chamferFront);
  const ys = [...heights].filter((y) => y >= 0 && y <= h).sort((a, b) => a - b);
  const rings = ys.map((y) => {
    const inset =
      draft * Math.abs(y - parting) +
      (y < bottomFillet ? filletInset(bottomFillet, y) : 0) +
      (y > h - fillet ? filletInset(fillet, h - y) : 0);
    let rn: number | undefined;
    if (notch) {
      const t = (y - (h - notch.depth)) / notch.depth;
      rn = t <= 0 ? 0 : notch.radius * Math.sqrt(Math.max(1 - (1 - t) * (1 - t), 0));
    }
    const bevel = chamferFront > 0 ? Math.max(y - (h - chamferFront), 0) : 0;
    return {
      y,
      pts: roundedRect(w - 2 * inset, d - 2 * inset, corner - inset * 0.5, {
        segments,
        notch: rn,
        insets: { pz: bevel },
      }),
    };
  });
  return loft(rings, { topGroup: true, topBounds: [-w / 2, w / 2, -d / 2, d / 2] });
}

/** Rounds the corners of a 2D polyline (like `roundedPath`, sampled). */
export function roundCorners(points: Pt[], radius: number, steps = 6): Pt[] {
  if (points.length < 3 || radius <= 0) return points;
  const out: Pt[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1]!;
    const [cx, cy] = points[i]!;
    const [nx, ny] = points[i + 1]!;
    const l1 = Math.hypot(cx - px, cy - py);
    const l2 = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const ax = cx - ((cx - px) / l1) * r;
    const ay = cy - ((cy - py) / l1) * r;
    const bx = cx + ((nx - cx) / l2) * r;
    const by = cy + ((ny - cy) / l2) * r;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx;
      const y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by;
      out.push([x, y]);
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

/**
 * Closed outline of a strip of `width` around a centre line (miter joins);
 * `width` may vary per point.
 */
export function stripOutline(center: Pt[], width: number | number[]): Pt[] {
  const left: Pt[] = [];
  const right: Pt[] = [];
  const n = center.length;
  for (let i = 0; i < n; i++) {
    const [x, y] = center[i]!;
    const prev = center[Math.max(i - 1, 0)]!;
    const next = center[Math.min(i + 1, n - 1)]!;
    const d1 = norm2(i > 0 ? [x - prev[0], y - prev[1]] : [next[0] - x, next[1] - y]);
    const d2 = norm2(i < n - 1 ? [next[0] - x, next[1] - y] : [x - prev[0], y - prev[1]]);
    const n1: Pt = [-d1[1], d1[0]];
    const avg = norm2([n1[0] - d2[1], n1[1] + d2[0]]);
    const half = (Array.isArray(width) ? width[i]! : width) / 2;
    const scale = half / Math.max(avg[0] * n1[0] + avg[1] * n1[1], 0.3);
    left.push([x + avg[0] * scale, y + avg[1] * scale]);
    right.push([x - avg[0] * scale, y - avg[1] * scale]);
  }
  return [...left, ...right.reverse()];
}

function norm2([x, y]: Pt): Pt {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

/**
 * A flat polygon in the XY plane extruded `depth` along Z, centred on z = 0,
 * with a small bevel so the edges catch light.
 */
export function extrudeOutline(outline: Pt[], depth: number, bevel = 0): BufferGeometry {
  const shape = new Shape(outline.map(([x, y]) => new Vector2(x, y)));
  const b = Math.min(bevel, depth / 3);
  const geometry = new ExtrudeGeometry(shape, {
    depth: Math.max(depth - 2 * b, 1e-3),
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: 1,
    curveSegments: 4,
  });
  geometry.translate(0, 0, -depth / 2 + b);
  return geometry;
}

/** A bent sheet-metal strip: centre line in XY, `thickness` across it, `depth` along Z. */
export function bentStrip(
  center: Pt[],
  thickness: number,
  depth: number,
  bend = thickness * 1.5,
): BufferGeometry {
  return extrudeOutline(stripOutline(roundCorners(center, bend), thickness), depth);
}

/** Copies of `geometry` placed by each matrix, merged into one geometry. */
export function mergeAt(geometry: BufferGeometry, matrices: Matrix4[]): BufferGeometry {
  const parts = matrices.map((m) => {
    const g = geometry.clone();
    g.applyMatrix4(m);
    return g;
  });
  const merged = mergeGeometries(parts, false) ?? new BufferGeometry();
  parts.forEach((g) => g.dispose());
  return merged;
}

/** Merges different geometries (same attributes) and disposes the inputs. */
export function mergeAll(parts: BufferGeometry[]): BufferGeometry {
  const usable = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const cleaned = usable.map((g) => {
    const out = new BufferGeometry();
    out.setAttribute('position', g.getAttribute('position'));
    out.setAttribute('normal', g.getAttribute('normal'));
    return out;
  });
  const merged = mergeGeometries(cleaned, false) ?? new BufferGeometry();
  parts.forEach((g) => g.dispose());
  usable.forEach((g) => g.dispose());
  return merged;
}

export interface BondWireSpec {
  from: Vec3;
  to: Vec3;
  /** Loop height above `from` (mm). */
  loop?: number;
}

/**
 * Bond wires: up from the ball bond on the die, an arched loop, then down
 * at a shallow angle onto the stitch bond. `up` is the die's normal.
 */
export function bondWires(
  wires: BondWireSpec[],
  radius: number,
  up: Vec3 = [0, 1, 0],
  { radial = 6, segments = 28 }: { radial?: number; segments?: number } = {},
) {
  const u = new Vector3(...up).normalize();
  const tubes = wires.map(({ from, to, loop = 0.5 }) => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const at = (t: number, lift: number) => a.clone().lerp(b, t).addScaledVector(u, lift);
    const rise = a.clone().addScaledVector(u, loop * 0.75);
    const points: Vec3[] = [
      a,
      rise,
      at(0.18, loop * 1.02),
      at(0.5, loop * 0.86),
      at(0.82, loop * 0.42),
      b.clone().addScaledVector(u, radius),
    ].map((v) => [v.x, v.y, v.z]);
    return tube(smoothPath(points, 0.5), radius, { radial, segments });
  });
  return mergeAll(tubes);
}

/** Matrix helper: translation, Euler rotation (XYZ) and scale. */
export function placed(position: Vec3, rotation: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) {
  return new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromEuler(new Euler(...rotation)),
    new Vector3(...scale),
  );
}
