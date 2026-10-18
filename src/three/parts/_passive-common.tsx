/**
 * Shared pieces of the passive parts (potentiometers, capacitors, inductors):
 * the flat section face drawn at the cutaway plane, groups that only appear
 * in the exploded view, unrolled film ribbons, dipped-epoxy "blob" bodies
 * with conforming printed decals, threads and hex nuts.
 */
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
  Vector3,
  type Group,
  type Texture,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { easeInOut } from '../core/motion';
import { useView } from '../core/view';
import { Material, type MaterialProps } from '../materials/Material';
import type { Vec3 } from '../types';

/**
 * A flat face just behind the cutaway plane (z = 0), shown only while the cut
 * is on. It paints what the cut reveals inside a clipped solid (the layers of
 * a wound element), which a flat `cutColor` cannot show.
 */
export function SectionFace({
  width,
  height,
  center,
  map,
  material,
}: {
  width: number;
  height: number;
  /** Centre of the face (x, y); z is fixed at the cut plane. */
  center: [number, number];
  map: Texture;
  material?: MaterialProps;
}) {
  const { cutaway } = useView();
  if (!cutaway) return null;
  return (
    <mesh position={[center[0], center[1], -0.012]}>
      <planeGeometry args={[width, height]} />
      <Material color="#ffffff" map={map} roughness={0.55} metalness={0} {...material} />
    </mesh>
  );
}

/**
 * Children that grow in only in the exploded view (unrolled films, loose
 * windings). They scale from the group origin along `axis` once the
 * explode factor passes `from`.
 */
export function ExplodeReveal({
  children,
  from = 0.35,
  axis = 'x',
  position,
  rotation,
}: {
  children: ReactNode;
  from?: number;
  axis?: 'x' | 'y' | 'z' | 'all';
  position?: Vec3;
  rotation?: Vec3;
}) {
  const ref = useRef<Group>(null);
  const { explode } = useView();
  const apply = (group: Group) => {
    const f = explode.current ?? 0;
    const t = easeInOut((f - from) / (1 - from));
    group.visible = t > 0.002;
    const s = Math.max(t, 0.002);
    if (axis === 'all') group.scale.setScalar(s);
    else group.scale.set(axis === 'x' ? s : 1, axis === 'y' ? s : 1, axis === 'z' ? s : 1);
  };
  useLayoutEffect(() => {
    if (ref.current) apply(ref.current);
  });
  useFrame(() => {
    if (ref.current) apply(ref.current);
  });
  return (
    <group position={position} rotation={rotation}>
      <group ref={ref}>{children}</group>
    </group>
  );
}

/**
 * A thin strip (film, foil, paper) along a curve in the XZ plane, from
 * `y0` to `y1`. UV: u along the strip, v across it (0 at y0).
 */
export function ribbonGeometry(path: [number, number][], y0: number, y1: number): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const lengths = [0];
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1]!;
    const [bx, bz] = path[i]!;
    lengths.push(lengths[i - 1]! + Math.hypot(bx - ax, bz - az));
  }
  const total = lengths[lengths.length - 1] || 1;
  path.forEach(([x, z], i) => {
    const [px, pz] = path[Math.max(i - 1, 0)]!;
    const [nx, nz] = path[Math.min(i + 1, path.length - 1)]!;
    const tx = nx - px;
    const tz = nz - pz;
    const l = Math.hypot(tx, tz) || 1;
    for (const y of [y0, y1]) {
      positions.push(x, y, z);
      normals.push(tz / l, 0, -tx / l);
      uvs.push(lengths[i]! / total, y === y0 ? 0 : 1);
    }
  });
  const index: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = i * 2;
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  return geometry;
}

/**
 * Path of a strip peeling off a roll of radius `r` (axis Y, at the origin):
 * it follows the roll from angle `start` for `wrap` radians, then leaves
 * tangentially and runs `run` mm with a gentle curl.
 */
export function peelPath(r: number, start: number, wrap: number, run: number): [number, number][] {
  const out: [number, number][] = [];
  const steps = 24;
  // Angle measured like a lathe: x = r sin(a), z = r cos(a).
  for (let i = 0; i <= steps; i++) {
    const a = start + (wrap * i) / steps;
    out.push([r * Math.sin(a), r * Math.cos(a)]);
  }
  const end = start + wrap;
  const tx = Math.cos(end);
  const tz = -Math.sin(end);
  const [x0, z0] = out[out.length - 1]!;
  const nx = Math.sin(end);
  const nz = Math.cos(end);
  for (let i = 1; i <= 20; i++) {
    const s = (run * i) / 20;
    const curl = 0.012 * s * s;
    out.push([x0 + tx * s + nx * curl, z0 + tz * s + nz * curl]);
  }
  return out;
}

/** Canvas drawing of the axial section of a wound element (layers as stripes). */
export function drawWoundSection(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  {
    layers,
    colors,
    weights,
    core,
    coreColor = '#2a2522',
    margin = 0,
    marginColor,
  }: {
    /** Repeats of the layer pattern on each side of the core. */
    layers: number;
    /** Colours of one repeat, from the core outwards. */
    colors: string[];
    /** Relative thickness of each colour band (default: equal). */
    weights?: number[];
    /** Core width as a fraction of the face width. */
    core: number;
    coreColor?: string;
    /** Top and bottom bands (fraction of the height) where only `marginColor` shows. */
    margin?: number;
    marginColor?: string;
  },
) {
  ctx.fillStyle = marginColor ?? colors[colors.length - 1]!;
  ctx.fillRect(0, 0, w, h);
  const half = w / 2;
  const coreHalf = (core * w) / 2;
  const span = half - coreHalf;
  const pitch = span / layers;
  const w8 = weights ?? colors.map(() => 1);
  const sum = w8.reduce((a, b) => a + b, 0);
  const top = margin * h;
  for (const side of [-1, 1]) {
    for (let i = 0; i < layers; i++) {
      let from = coreHalf + i * pitch;
      colors.forEach((color, k) => {
        const band = (pitch * w8[k]!) / sum;
        const x = side === 1 ? half + from : half - from - band;
        ctx.fillStyle = color;
        const isMargin = marginColor !== undefined && color !== marginColor;
        ctx.fillRect(x, isMargin ? top : 0, band + 0.6, isMargin ? h - 2 * top : h);
        from += band;
      });
    }
  }
  ctx.fillStyle = coreColor;
  ctx.fillRect(half - coreHalf, 0, coreHalf * 2, h);
  // Soft shading so the face does not look painted on.
  const shade = ctx.createLinearGradient(0, 0, w, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.25)');
  shade.addColorStop(0.5, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
}

/* ------------------------------------------------------------------ */
/* Dipped-epoxy bodies (ceramic and polyester capacitors).            */
/* ------------------------------------------------------------------ */

export interface BlobShape {
  /** Half width (x), half height (y), half thickness (z), mm. */
  a: number;
  b: number;
  c: number;
  /** Squareness across the thickness: 1 = ellipse, smaller = flatter faces. */
  e1: number;
  /** Squareness of the outline (XY): 1 = ellipse, smaller = rounded rectangle. */
  e2: number;
  /** Extra length at the bottom where the coating drips down the leads (× b). */
  drip?: number;
  /** Extra thickness at the bottom (× c). */
  bottom?: number;
  /** Narrowing of the bottom (× a), for the teardrop shape. */
  taper?: number;
}

const spow = (v: number, e: number) => Math.sign(v) * Math.abs(v) ** e;

/** Point of the blob at latitude `eta` (across the thickness) and angle `omega` (outline). */
export function blobPoint(s: BlobShape, eta: number, omega: number, target = new Vector3()) {
  const ce = spow(Math.cos(eta), s.e1);
  let x = s.a * ce * spow(Math.cos(omega), s.e2);
  let y = s.b * ce * spow(Math.sin(omega), s.e2);
  let z = s.c * spow(Math.sin(eta), s.e1);
  const ny = y / s.b;
  if (ny < 0) {
    const t = (-ny) ** 2.2;
    y -= (s.drip ?? 0) * s.b * t;
    z *= 1 + (s.bottom ?? 0) * t;
    x *= 1 - (s.taper ?? 0) * t;
  }
  return target.set(x, y, z);
}

/** Lowest point of the blob (y), for placing the leads. */
export const blobBottom = (s: BlobShape) => -s.b * (1 + (s.drip ?? 0));

function gridGeometry(
  s: BlobShape,
  eta0: number,
  eta1: number,
  rows: number,
  cols: number,
  uv?: (p: Vector3) => [number, number],
): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const p = new Vector3();
  for (let i = 0; i <= rows; i++) {
    const eta = eta0 + ((eta1 - eta0) * i) / rows;
    for (let j = 0; j <= cols; j++) {
      const omega = -Math.PI + (2 * Math.PI * j) / cols;
      blobPoint(s, eta, omega, p);
      positions.push(p.x, p.y, p.z);
      if (uv) uvs.push(...uv(p));
    }
  }
  const index: number[] = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j;
      const b = a + cols + 1;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  if (uv) geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  return geometry;
}

/** Closed smooth body of a dipped component. */
export function blobGeometry(s: BlobShape, rows = 36, cols = 72): BufferGeometry {
  const raw = gridGeometry(s, -Math.PI / 2, Math.PI / 2, rows, cols);
  const merged = mergeVertices(raw, 1e-5);
  raw.dispose();
  merged.computeVertexNormals();
  // Planar UVs (front view): u across the width, v up the height, so colour
  // bands can be painted on the body.
  const position = merged.attributes.position!;
  const bottom = blobBottom(s);
  const uvs: number[] = [];
  for (let i = 0; i < position.count; i++) {
    uvs.push(0.5 + position.getX(i) / (2 * s.a), (position.getY(i) - bottom) / (s.b - bottom));
  }
  merged.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  return merged;
}

/**
 * Patch of the front face (+z) of a blob, lifted a hair off the surface, with
 * planar UVs: the canvas covers `[-uw/2, uw/2] × [cy - uh/2, cy + uh/2]`.
 * `side = -1` makes the patch on the back face, mirrored to read correctly.
 */
export function blobDecalGeometry(
  s: BlobShape,
  {
    uw,
    uh,
    cy = 0,
    side = 1,
    reach = 0.85,
  }: {
    uw: number;
    uh: number;
    cy?: number;
    side?: 1 | -1;
    reach?: number;
  },
): BufferGeometry {
  // Latitude where the outline reaches `reach` of the full size.
  const eta0 = Math.acos(reach ** (1 / s.e1));
  const geometry = gridGeometry(
    s,
    side === 1 ? eta0 : -Math.PI / 2 + 1e-4,
    side === 1 ? Math.PI / 2 - 1e-4 : -eta0,
    10,
    72,
    (p) => [(side * p.x) / uw + 0.5, (p.y - cy) / uh + 0.5],
  );
  geometry.computeVertexNormals();
  const position = geometry.attributes.position!;
  const normal = geometry.attributes.normal!;
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(
      i,
      position.getX(i) + normal.getX(i) * 0.004,
      position.getY(i) + normal.getY(i) * 0.004,
      position.getZ(i) + normal.getZ(i) * 0.004,
    );
  }
  return geometry;
}

/* ------------------------------------------------------------------ */
/* Threads and nuts.                                                  */
/* ------------------------------------------------------------------ */

/**
 * Lathe profile of a threaded cylinder (rings, which read as threads at this
 * scale): major radius `r`, thread depth `depth`, pitch `pitch`, from y0 to y1.
 */
export function threadProfile(
  r: number,
  depth: number,
  pitch: number,
  y0: number,
  y1: number,
  closed = true,
): [number, number][] {
  const out: [number, number][] = closed ? [[0, y0]] : [];
  out.push([r - depth, y0]);
  const turns = Math.floor((y1 - y0) / pitch);
  const start = y0 + (y1 - y0 - turns * pitch) / 2;
  out.push([r - depth, start]);
  for (let i = 0; i < turns; i++) {
    const y = start + i * pitch;
    out.push([r - depth * 0.15, y + pitch * 0.35]);
    out.push([r, y + pitch * 0.45]);
    out.push([r, y + pitch * 0.55]);
    out.push([r - depth * 0.15, y + pitch * 0.65]);
    out.push([r - depth, y + pitch]);
  }
  out.push([r - depth, y1]);
  if (closed) out.push([0, y1]);
  return out;
}

/** Hex nut (axis Y, from y = 0 to `height`) with a round hole and bevelled faces. */
export function hexNutGeometry(acrossFlats: number, height: number, hole: number) {
  const r = acrossFlats / Math.sqrt(3);
  const bevel = Math.min(height * 0.12, 0.3);
  const shape = new Shape();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const x = (r - bevel) * Math.cos(a);
    const y = (r - bevel) * Math.sin(a);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const bore = new Path();
  bore.absarc(0, 0, hole / 2 + bevel, 0, Math.PI * 2, true);
  shape.holes.push(bore);
  const geometry = new ExtrudeGeometry(shape, {
    depth: height - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 24,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bevel, 0);
  return geometry;
}

/** Flat washer (axis Y, from y = 0 to `thickness`). */
export function washerGeometry(outer: number, inner: number, thickness: number) {
  const shape = new Shape();
  shape.absarc(0, 0, outer / 2, 0, Math.PI * 2, false);
  const bore = new Path();
  bore.absarc(0, 0, inner / 2, 0, Math.PI * 2, true);
  shape.holes.push(bore);
  const geometry = new ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 48,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/**
 * Disc facing +Y (radius `r`) with planar UVs and rings, following a dome
 * `height(r)`: the scored top of a can, the potting of a motor capacitor.
 */
export function domedDiscGeometry(
  r: number,
  segments: number,
  rings: number,
  height: (r: number) => number,
): BufferGeometry {
  const positions: number[] = [0, height(0), 0];
  const uvs: number[] = [0.5, 0.5];
  const index: number[] = [];
  for (let i = 1; i <= rings; i++) {
    const rr = (r * i) / rings;
    const y = height(rr);
    for (let j = 0; j < segments; j++) {
      const a = (2 * Math.PI * j) / segments;
      const x = rr * Math.cos(a);
      const z = rr * Math.sin(a);
      positions.push(x, y, z);
      uvs.push(0.5 + x / (2 * r), 0.5 - z / (2 * r));
    }
  }
  for (let j = 0; j < segments; j++) index.push(0, 1 + ((j + 1) % segments), 1 + j);
  for (let i = 1; i < rings; i++) {
    const row = 1 + (i - 1) * segments;
    const next = row + segments;
    for (let j = 0; j < segments; j++) {
      const a = row + j;
      const b = row + ((j + 1) % segments);
      const c = next + j;
      const d = next + ((j + 1) % segments);
      index.push(a, b, c, b, d, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/* ------------------------------------------------------------------ */
/* Lathe profiles.                                                    */
/* ------------------------------------------------------------------ */

/** Profile points [r, y] for lathes. */
export type Path2 = [number, number][];

/** Closed loop around a centre line, `t` thick: a solid thin shell for lathes. */
export function thicken(path: Path2, t: number): Path2 {
  const outer: Path2 = [];
  const inner: Path2 = [];
  path.forEach(([r, y], i) => {
    const [r0, y0] = path[Math.max(i - 1, 0)]!;
    const [r1, y1] = path[Math.min(i + 1, path.length - 1)]!;
    const dr = r1 - r0;
    const dy = y1 - y0;
    const l = Math.hypot(dr, dy) || 1;
    const nr = dy / l;
    const ny = -dr / l;
    outer.push([Math.max(r + (nr * t) / 2, 0), y + (ny * t) / 2]);
    inner.push([Math.max(r - (nr * t) / 2, 0), y - (ny * t) / 2]);
  });
  const loop = [...outer, ...inner.reverse()];
  loop.push(loop[0]!);
  return loop;
}

export function arc(
  cr: number,
  cy: number,
  radius: number,
  a0: number,
  a1: number,
  steps = 6,
): Path2 {
  const out: Path2 = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([cr + radius * Math.cos(a), cy + radius * Math.sin(a)]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Small shapes.                                                      */
/* ------------------------------------------------------------------ */

/** Rounded rectangle shape (centred), for extrusions. */
export function roundedRectShape(w: number, h: number, r: number): Shape {
  const shape = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  shape.moveTo(x + rr, y);
  shape.lineTo(x + w - rr, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + rr);
  shape.lineTo(x + w, y + h - rr);
  shape.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  shape.lineTo(x + rr, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - rr);
  shape.lineTo(x, y + rr);
  shape.quadraticCurveTo(x, y, x + rr, y);
  return shape;
}

/**
 * Box `w × h × d` (x, y, z) centred on the origin, with edges rounded by
 * `bevel` and vertical corners by `corner`.
 */
export function roundedBoxGeometry(
  w: number,
  h: number,
  d: number,
  bevel: number,
  corner = bevel,
): BufferGeometry {
  const b = Math.min(bevel, w / 3, h / 3, d / 3);
  const shape = roundedRectShape(w - 2 * b, d - 2 * b, Math.max(corner - b, 0.001));
  const geometry = new ExtrudeGeometry(shape, {
    depth: h - 2 * b,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments: 6,
  });
  // Extruded along +z: turn it so the extrusion is the height (y).
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -(h - 2 * b) / 2, 0);
  return geometry;
}

/** Small deterministic random generator (same "random" detail on every page). */
export function seeded(seed: number) {
  let state = (seed * 16807) % 2147483647 || 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}
