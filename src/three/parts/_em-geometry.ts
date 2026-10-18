/**
 * Geometry helpers shared by the electromechanical parts (relay, fuses,
 * switches, terminal blocks, headers, connectors, reed switch). All sizes in
 * millimetres, Y up. Private to `parts/` (the leading `_` keeps it out of the
 * part registry).
 */
import {
  BufferGeometry,
  Curve,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
  ShapeGeometry,
  Vector3,
  type ExtrudeGeometryOptions,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** A rounded rectangle centred on the origin (2D, in the shape's XY plane). */
export function roundedRectShape(w: number, h: number, r: number): Shape {
  const shape = new Shape();
  addRoundedRect(shape, w, h, r);
  return shape;
}

/** Appends a closed rounded rectangle to a shape or a hole path (counter-clockwise). */
export function addRoundedRect(
  path: Path,
  w: number,
  h: number,
  r: number,
  cx = 0,
  cy = 0,
  clockwise = false,
) {
  const rr = Math.max(Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4), 1e-4);
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  const x1 = cx + w / 2;
  const y1 = cy + h / 2;
  if (!clockwise) {
    path.moveTo(x0 + rr, y0);
    path.lineTo(x1 - rr, y0);
    path.absarc(x1 - rr, y0 + rr, rr, -Math.PI / 2, 0, false);
    path.lineTo(x1, y1 - rr);
    path.absarc(x1 - rr, y1 - rr, rr, 0, Math.PI / 2, false);
    path.lineTo(x0 + rr, y1);
    path.absarc(x0 + rr, y1 - rr, rr, Math.PI / 2, Math.PI, false);
    path.lineTo(x0, y0 + rr);
    path.absarc(x0 + rr, y0 + rr, rr, Math.PI, Math.PI * 1.5, false);
  } else {
    path.moveTo(x0 + rr, y0);
    path.absarc(x0 + rr, y0 + rr, rr, Math.PI * 1.5, Math.PI, true);
    path.lineTo(x0, y1 - rr);
    path.absarc(x0 + rr, y1 - rr, rr, Math.PI, Math.PI / 2, true);
    path.lineTo(x1 - rr, y1);
    path.absarc(x1 - rr, y1 - rr, rr, Math.PI / 2, 0, true);
    path.lineTo(x1, y0 + rr);
    path.absarc(x1 - rr, y0 + rr, rr, 0, -Math.PI / 2, true);
  }
  path.closePath();
}

/**
 * Extrudes a shape (drawn in X and Y) upwards along +Y, from y = 0 to y = h,
 * with a rounded bevel that keeps the outline exact. The shape's Y becomes
 * −Z, so draw shapes symmetric or mirrored accordingly.
 */
export function extrudeUp(
  shape: Shape | Shape[],
  h: number,
  bevel = 0,
  options: Partial<ExtrudeGeometryOptions> = {},
): ExtrudeGeometry {
  const b = Math.min(bevel, h / 2 - 1e-3);
  const geometry = new ExtrudeGeometry(shape, {
    depth: Math.max(h - 2 * Math.max(b, 0), 1e-3),
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: 3,
    curveSegments: 8,
    ...options,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, Math.max(b, 0), 0);
  return geometry;
}

/**
 * Extrudes a side profile along +X (length `length`, centred on x = 0). The
 * profile is drawn with the shape's X as −Z (front of the part at negative
 * shape X → positive Z) and the shape's Y as Y.
 */
export function extrudeAlongX(
  shape: Shape | Shape[],
  length: number,
  bevel = 0,
  options: Partial<ExtrudeGeometryOptions> = {},
): ExtrudeGeometry {
  const b = Math.min(bevel, length / 2 - 1e-3);
  const geometry = new ExtrudeGeometry(shape, {
    depth: Math.max(length - 2 * Math.max(b, 0), 1e-3),
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: 2,
    curveSegments: 8,
    ...options,
  });
  // (x, y, z) → (z, y, −x): extrusion along +X, shape X towards −Z.
  geometry.rotateY(Math.PI / 2);
  geometry.translate(-length / 2 + Math.max(b, 0), 0, 0);
  return geometry;
}

/** Same as `extrudeAlongX`, but extruded along +Z (shape X → X). Centred on z = 0. */
export function extrudeAlongZ(
  shape: Shape | Shape[],
  length: number,
  bevel = 0,
  options: Partial<ExtrudeGeometryOptions> = {},
): ExtrudeGeometry {
  const b = Math.min(bevel, length / 2 - 1e-3);
  const geometry = new ExtrudeGeometry(shape, {
    depth: Math.max(length - 2 * Math.max(b, 0), 1e-3),
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: 2,
    curveSegments: 8,
    ...options,
  });
  geometry.translate(0, 0, -length / 2 + Math.max(b, 0));
  return geometry;
}

/** A box with rounded vertical edges and bevelled top and bottom edges, from y = 0 to h. */
export function roundedBox(
  w: number,
  h: number,
  d: number,
  r: number,
  bevel = Math.min(r, 0.4),
): ExtrudeGeometry {
  return extrudeUp(roundedRectShape(w, d, r), h, bevel);
}

/** Points around a rounded rectangle (half sizes hw, hd), angle increasing from +X towards +Z. */
function roundedRectRing(hw: number, hd: number, r: number, cornerSegments: number) {
  const rr = Math.max(Math.min(r, hw - 1e-4, hd - 1e-4), 1e-4);
  const out: [number, number][] = [];
  const centres: [number, number, number][] = [
    [hw - rr, hd - rr, 0],
    [-(hw - rr), hd - rr, Math.PI / 2],
    [-(hw - rr), -(hd - rr), Math.PI],
    [hw - rr, -(hd - rr), Math.PI * 1.5],
  ];
  for (const [cx, cz, a0] of centres) {
    for (let i = 0; i <= cornerSegments; i++) {
      const a = a0 + (Math.PI / 2) * (i / cornerSegments);
      out.push([cx + rr * Math.cos(a), cz + rr * Math.sin(a)]);
    }
  }
  return out;
}

export type SweepPoint = [offset: number, y: number] | null;

/**
 * Like a lathe, but around a rounded rectangle (w × d, corner radius r): each
 * profile point is [outward offset, y]. A profile walked up the outside and
 * inwards over the top faces outwards; walking down an inner wall faces the
 * cavity. `null` starts a new strip (a sharp crease).
 */
export function roundedRectSweep(
  w: number,
  d: number,
  r: number,
  profile: SweepPoint[],
  cornerSegments = 6,
): BufferGeometry {
  const strips: [number, number][][] = [[]];
  for (const point of profile) {
    if (point === null) {
      const last = strips[strips.length - 1]!;
      const prev = last[last.length - 1];
      strips.push(prev ? [prev] : []);
    } else strips[strips.length - 1]!.push(point);
  }
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const strip of strips) {
    if (strip.length < 2) continue;
    let along = 0;
    const base = positions.length / 3;
    let count = 0;
    strip.forEach(([offset, y], j) => {
      if (j > 0) {
        const [o0, y0] = strip[j - 1]!;
        along += Math.hypot(offset - o0, y - y0);
      }
      const ring = roundedRectRing(w / 2 + offset, d / 2 + offset, r + offset, cornerSegments);
      count = ring.length;
      ring.forEach(([x, z], i) => {
        positions.push(x, y, z);
        uvs.push(i / ring.length, along);
      });
    });
    const rings = strip.length;
    for (let j = 0; j < rings - 1; j++) {
      for (let i = 0; i < count; i++) {
        const a0 = base + j * count + i;
        const a1 = base + j * count + ((i + 1) % count);
        const b0 = a0 + count;
        const b1 = a1 + count;
        indices.push(a0, b0, a1, a1, b0, b1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A flat rounded-rectangle cap at height y, facing up or down. UVs span 0..1
 * over the cap (u along +X, v along −Z), so a label drawn on a canvas reads
 * from the front (+Z) when it faces up.
 */
export function roundedRectCap(
  w: number,
  d: number,
  r: number,
  y: number,
  up = true,
): BufferGeometry {
  const geometry = new ShapeGeometry(roundedRectShape(w, d, r), 6);
  const uv = geometry.attributes.uv!;
  const pos = geometry.attributes.position!;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + d / 2) / d);
  }
  geometry.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
  if (!up) {
    // Facing down flips the shape's Y to +Z; keep v along −Z.
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  }
  geometry.translate(0, y, 0);
  return geometry;
}

/**
 * Hollow shell open at the bottom (relay covers, switch housings): outer wall
 * with a fillet `f` on the top edges, wall thickness `wall`, inner ceiling at
 * h − top. Inner faces look into the cavity, so the cutaway shows the inside.
 */
export function shellGeometry(
  w: number,
  h: number,
  d: number,
  r: number,
  f: number,
  wall: number,
  top = wall,
  closedBottom = false,
): BufferGeometry {
  const steps = 5;
  const outer: SweepPoint[] = [[0, 0]];
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI / 2) * (i / steps);
    outer.push([-f + Math.cos(a) * f, h - f + Math.sin(a) * f]);
  }
  const parts: BufferGeometry[] = [
    roundedRectSweep(w, d, r, outer),
    roundedRectCap(w - 2 * f, d - 2 * f, Math.max(r - f, 0.01), h, true),
  ];
  if (!closedBottom) {
    // Bottom rim (faces down), inner wall and ceiling (face the cavity).
    parts.push(
      roundedRectSweep(w, d, r, [
        [-wall, 0],
        [0, 0],
      ]),
      invertGeometry(
        roundedRectSweep(w, d, r, [
          [-wall, 0],
          [-wall, h - top],
        ]),
      ),
      roundedRectCap(w - 2 * wall, d - 2 * wall, Math.max(r - wall, 0.01), h - top, false),
    );
  } else {
    parts.push(roundedRectCap(w, d, r, 0, false));
  }
  return mergeAll(parts);
}

/** Flips the faces of a geometry (normals and winding). */
export function invertGeometry(geometry: BufferGeometry): BufferGeometry {
  const index = geometry.index;
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, a);
    }
    index.needsUpdate = true;
  }
  const normal = geometry.attributes.normal;
  if (normal) {
    for (let i = 0; i < normal.count; i++)
      normal.setXYZ(i, -normal.getX(i), -normal.getY(i), -normal.getZ(i));
    normal.needsUpdate = true;
  }
  return geometry;
}

/** Merges geometries (converting all to non-indexed when needed) and disposes the inputs. */
export function mergeAll(parts: BufferGeometry[]): BufferGeometry {
  const prepared = parts.map((g) => {
    const out = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(out.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') out.deleteAttribute(name);
    }
    if (!out.attributes.uv) {
      out.setAttribute(
        'uv',
        new Float32BufferAttribute(new Float32Array(out.attributes.position!.count * 2), 2),
      );
    }
    if (!out.attributes.normal) out.computeVertexNormals();
    return out;
  });
  const merged = mergeGeometries(prepared, false) ?? new BufferGeometry();
  for (const g of parts) g.dispose();
  for (const g of prepared) g.dispose();
  return merged;
}

/** Helix along +Y (springs, coil windings, slow-blow fuse elements). */
export class HelixCurve extends Curve<Vector3> {
  constructor(
    public radius: number,
    public length: number,
    public turns: number,
    /** Straight lead-in at each end (mm). */
    public lead = 0,
  ) {
    super();
  }

  override getPoint(t: number, target = new Vector3()): Vector3 {
    const total = this.length + 2 * this.lead;
    const s = t * total;
    if (this.lead > 0 && s < this.lead) {
      return target.set(this.radius * (s / this.lead), s - this.lead, 0);
    }
    if (this.lead > 0 && s > this.lead + this.length) {
      const end = this.turns * Math.PI * 2;
      const k = 1 - (s - this.lead - this.length) / this.lead;
      return target.set(
        this.radius * Math.cos(end) * k,
        s - this.lead,
        this.radius * Math.sin(end) * k,
      );
    }
    const u = (s - this.lead) / this.length;
    const a = u * this.turns * Math.PI * 2;
    return target.set(this.radius * Math.cos(a), u * this.length, this.radius * Math.sin(a));
  }
}

export type ScrewDrive = 'fenda' | 'cruz' | 'combinada';

/**
 * Cheese-head screw head (radius r, height h, along +Y from y = 0) with a
 * real recess: slot, cross or combined slot and cross. The recess is cut to
 * `depth`; the floor shows below it.
 */
export function screwHeadGeometry(
  r: number,
  h: number,
  drive: ScrewDrive,
  { slot = r * 0.32, depth = h * 0.55, bevel = Math.min(r * 0.12, h * 0.2) } = {},
): BufferGeometry {
  const floorH = h - depth;
  const parts: BufferGeometry[] = [];
  const lower = new Shape();
  lower.absarc(0, 0, r, 0, Math.PI * 2, false);
  parts.push(extrudeUp(lower, floorH, 0, { curveSegments: 24 }));

  const crossW = slot * 1.15;
  const crossL = r * 0.72;
  const upper: Shape[] = [];
  if (drive === 'cruz') {
    const s = new Shape();
    s.absarc(0, 0, r, 0, Math.PI * 2, false);
    const hole = new Path();
    const a = crossW / 2;
    const b = crossL;
    hole.moveTo(a, a);
    hole.lineTo(a, b);
    hole.lineTo(-a, b);
    hole.lineTo(-a, a);
    hole.lineTo(-b, a);
    hole.lineTo(-b, -a);
    hole.lineTo(-a, -a);
    hole.lineTo(-a, -b);
    hole.lineTo(a, -b);
    hole.lineTo(a, -a);
    hole.lineTo(b, -a);
    hole.lineTo(b, a);
    hole.closePath();
    s.holes.push(hole);
    upper.push(s);
  } else {
    // Two halves either side of the slot (the slot runs along the shape's Y).
    const half = slot / 2;
    const zc = Math.sqrt(Math.max(r * r - half * half, 0));
    for (const side of [1, -1]) {
      const s = new Shape();
      const a0 = Math.asin(zc / r);
      s.moveTo(side * half, -zc);
      // Arc around the outer edge.
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const a = -a0 + ((2 * a0) / steps) * i;
        s.lineTo(side * r * Math.cos(a), r * Math.sin(a));
      }
      s.lineTo(side * half, zc);
      if (drive === 'combinada') {
        s.lineTo(side * half, crossW / 2);
        s.lineTo(side * crossL, crossW / 2);
        s.lineTo(side * crossL, -crossW / 2);
        s.lineTo(side * half, -crossW / 2);
      }
      s.closePath();
      upper.push(s);
    }
  }
  // The lower bevel of the upper part is buried in the floor disc (no groove).
  const top = extrudeUp(upper, depth + bevel, bevel, { curveSegments: 6, bevelSegments: 2 });
  top.translate(0, floorH - bevel, 0);
  parts.push(top);
  return mergeAll(parts);
}

/** A hexagonal nut (across flats `af`, thickness t, hole radius) along +Y from y = 0. */
export function hexNutGeometry(af: number, t: number, hole: number, chamfer = 0.3): BufferGeometry {
  const shape = new Shape();
  const R = af / Math.sqrt(3);
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    if (i === 0) shape.moveTo(R * Math.cos(a), R * Math.sin(a));
    else shape.lineTo(R * Math.cos(a), R * Math.sin(a));
  }
  shape.closePath();
  const h = new Path();
  h.absarc(0, 0, hole, 0, Math.PI * 2, true);
  shape.holes.push(h);
  return extrudeUp(shape, t, chamfer, { curveSegments: 24, bevelSegments: 1 });
}

/** A flat washer (outer radius, inner radius, thickness) along +Y from y = 0. */
export function washerGeometry(outer: number, inner: number, t: number): BufferGeometry {
  const shape = new Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const h = new Path();
  h.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(h);
  return extrudeUp(shape, t, Math.min(t * 0.3, 0.15), { curveSegments: 32, bevelSegments: 1 });
}

/**
 * External thread as a lathe with a sawtooth helix baked into the radius
 * (looks threaded from any angle): cylinder along +Y from 0 to length.
 */
export function threadedRodGeometry(
  major: number,
  pitch: number,
  length: number,
  radial = 48,
): BufferGeometry {
  const minor = major - pitch * 0.6;
  const rows = Math.max(Math.ceil((length / pitch) * 6), 2);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= rows; j++) {
    const y = (length * j) / rows;
    for (let i = 0; i <= radial; i++) {
      const a = (i / radial) * Math.PI * 2;
      // Phase of the helix at this angle and height.
      const phase = (((y / pitch - a / (Math.PI * 2)) % 1) + 1) % 1;
      const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2;
      const crest = Math.min(1, Math.max(0, (tri - 0.15) / 0.7));
      // Chamfered ends.
      const endFade = Math.min(1, y / (pitch * 0.6), (length - y) / (pitch * 0.6));
      const rad = (minor + (major - minor) * crest * Math.max(endFade, 0)) / 2;
      positions.push(Math.cos(a) * rad, y, -Math.sin(a) * rad);
      uvs.push(i / radial, y / length);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < radial; i++) {
      const a = j * (radial + 1) + i;
      const b = a + radial + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
