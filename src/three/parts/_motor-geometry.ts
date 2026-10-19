/**
 * Geometry helpers of the motors with toothed laminations (stepper,
 * brushless outrunner, servo gear train): outlines drawn in polar
 * coordinates, extrusions along Y, spur gears, toothed rings and coils wound
 * around a tooth. Private to `parts/` (the leading `_` keeps it out of the
 * part registry).
 *
 * Angles follow `rotation.y`: a point at angle `a` sits at world
 * (r cos a, ·, −r sin a), the place where `rotation.y = a` turns the +X axis.
 */
import { ExtrudeGeometry, LatheGeometry, Path, Shape, Vector2, type BufferGeometry } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { roundedRectShell, scaleUv } from './_power-shared';

export type Pt = [number, number];

export const deg = (d: number) => (d * Math.PI) / 180;

/** Point of an outline at radius `r` and angle `a` (shape coordinates). */
export const polar = (r: number, a: number): Pt => [r * Math.cos(a), r * Math.sin(a)];

/** Points of an arc of radius `r` from `a0` to `a1` (both included). */
export function arc(r: number, a0: number, a1: number, steps: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) out.push(polar(r, a0 + ((a1 - a0) * i) / steps));
  return out;
}

/** Appends a closed polygon to a shape or a hole path. */
export function polygon<T extends Path>(path: T, points: Pt[]): T {
  points.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  path.closePath();
  return path;
}

/** A round hole (or disc outline) of radius `r` centred at (cx, cy). */
export function circle<T extends Path>(path: T, r: number, cx = 0, cy = 0, steps = 32): T {
  return polygon(
    path,
    Array.from({ length: steps }, (_, i) => {
      const a = (i / steps) * Math.PI * 2;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
    }),
  );
}

/** Square with chamfered corners (`c` along each edge), centred, half size `h`. */
export function chamferedSquare(h: number, c: number): Pt[] {
  return [
    [h, -h + c],
    [h, h - c],
    [h - c, h],
    [-h + c, h],
    [-h, h - c],
    [-h, -h + c],
    [-h + c, -h],
    [h - c, -h],
  ];
}

/**
 * Extrudes a shape upwards from y0 to y1 (shape x → x, shape y → −z), with
 * an optional bevel that keeps the outline exact.
 */
export function extrudeY(
  shape: Shape | Shape[],
  y0: number,
  y1: number,
  { bevel = 0, curveSegments = 12 }: { bevel?: number; curveSegments?: number } = {},
): ExtrudeGeometry {
  const b = Math.max(Math.min(bevel, (y1 - y0) / 2 - 1e-3), 0);
  const geometry = new ExtrudeGeometry(shape, {
    depth: Math.max(y1 - y0 - 2 * b, 1e-3),
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: 2,
    curveSegments,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y0 + b, 0);
  return geometry;
}

/** Smooth shading on curved extruded sides, hard edges at corners. */
export const creased = (geometry: BufferGeometry, angle = Math.PI / 7) =>
  toCreasedNormals(geometry, angle);

/**
 * Outline of a toothed circle: `teeth` trapezoid teeth from `rRoot` to
 * `rTip`, the first centred at `phase`. `top` and `base` are the widths of a
 * tooth at its tip and at its root, as fractions of the pitch.
 */
export function teethOutline(
  teeth: number,
  rTip: number,
  rRoot: number,
  { phase = 0, top = 0.3, base = 0.55 }: { phase?: number; top?: number; base?: number } = {},
): Pt[] {
  const pitch = (Math.PI * 2) / teeth;
  const out: Pt[] = [];
  for (let i = 0; i < teeth; i++) {
    const c = phase + i * pitch;
    out.push(
      polar(rRoot, c - (base * pitch) / 2),
      polar(rTip, c - (top * pitch) / 2),
      polar(rTip, c + (top * pitch) / 2),
      polar(rRoot, c + (base * pitch) / 2),
    );
  }
  return out;
}

/** A spur gear (module `m`, `teeth` teeth) with a round bore, from y0 to y1. */
export function spurGear(
  teeth: number,
  m: number,
  y0: number,
  y1: number,
  { bore = 0, phase = 0 }: { bore?: number; phase?: number } = {},
): BufferGeometry {
  const r = (m * teeth) / 2;
  const shape = polygon(new Shape(), teethOutline(teeth, r + m, r - 1.25 * m, { phase }));
  if (bore > 0) shape.holes.push(circle(new Path(), bore, 0, 0, 20));
  return creased(extrudeY(shape, y0, y1, { curveSegments: 4 }), Math.PI / 5);
}

/** Pitch radius of a gear. */
export const pitchRadius = (teeth: number, m: number) => (m * teeth) / 2;

/** A lathe around Y from [radius, y] points (no hard-edge handling). */
export function revolve(profile: Pt[], segments = 32, phiStart = 0, phiLength = Math.PI * 2) {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(Math.max(r, 0), y)),
    segments,
    phiStart,
    phiLength,
  );
}

/** A curved block (arc magnet, ring sector) between radii and angles, from y0 to y1. */
export function ringSector(
  rIn: number,
  rOut: number,
  center: number,
  span: number,
  y0: number,
  y1: number,
  steps = 6,
): BufferGeometry {
  const a0 = center - span / 2;
  const a1 = center + span / 2;
  const shape = polygon(new Shape(), [...arc(rOut, a0, a1, steps), ...arc(rIn, a1, a0, steps)]);
  return creased(extrudeY(shape, y0, y1, { curveSegments: 2 }));
}

export interface CoilOptions {
  /** Inside of the coil (the tooth with its insulation): width across the tooth and length along Y. */
  width: number;
  length: number;
  /** Winding thickness next to the tooth root. */
  build: number;
  /** Radial extent (from the axis). */
  r0: number;
  r1: number;
  /** Direction of the tooth (radians, as `rotation.y`). */
  angle: number;
  /** Height of the coil's centre. */
  y: number;
  /** The sides grow thicker outwards (wedge-shaped slots): build × taper at r1. */
  taper?: number;
  /** Diameter of the wire (for the turns texture). */
  wire?: number;
}

/**
 * A coil wound around a radial tooth: a rounded rectangular ring whose axis
 * points along the tooth. UV V runs along the tooth so the turns texture
 * draws one turn every `wire` mm.
 */
export function toothCoil({
  width,
  length,
  build,
  r0,
  r1,
  angle,
  y,
  taper = 1,
  wire = 0.3,
}: CoilOptions): BufferGeometry {
  const g = roundedRectShell(width + 2 * build, length + 2 * build, build * 0.95, r0, r1, build, 5);
  if (taper !== 1) {
    const position = g.attributes.position!;
    const half = width / 2;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const k = 1 + ((taper - 1) * (position.getY(i) - r0)) / (r1 - r0);
      if (Math.abs(x) > half + 1e-4)
        position.setX(i, Math.sign(x) * (half + (Math.abs(x) - half) * k));
    }
    g.computeVertexNormals();
  }
  scaleUv(g, 1, (r1 - r0) / (wire * 8));
  // Shell axis (Y) → radial, its depth (Z) → world Y.
  g.rotateX(Math.PI / 2);
  g.rotateY(angle + Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}
