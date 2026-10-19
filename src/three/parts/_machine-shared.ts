/**
 * Private helpers of the rotating machines (induction motor, worm gear
 * reducer): viewable rotation speed, lathes and extrusions along the X axis,
 * ball bearings, parallel keys and involute spur gear outlines. Sizes in
 * millimetres. The leading `_` keeps this file out of the part registry.
 */
import { type BufferGeometry, ExtrudeGeometry, Path, Shape, SphereGeometry } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { extrudeUp, roundedRectShape } from './_em-geometry';
import { lathe, merge, scaleUv } from './_power-shared';

/**
 * Viewable turns per second for a shaft at `rpm`: the true speed up to
 * 60 rpm, then slowly growing, so fast machines do not strobe.
 */
export function visualRps(rpm: number): number {
  const r = Math.abs(rpm);
  if (r <= 60) return r / 60;
  return 1 + 0.9 * Math.log10(r / 60);
}

/**
 * A lathe around the X axis from [radius, x] points. Trace the outline
 * counter-clockwise in the (radius → right, x → up) plane for outward faces.
 */
export function latheX(profile: [number, number][], segments = 48): BufferGeometry {
  return lathe(profile, segments).rotateZ(-Math.PI / 2);
}

/** Mirrors an [r, x] profile to the other side of x = 0 (keeping its orientation). */
export function mirrorProfile(profile: [number, number][]): [number, number][] {
  return profile.map(([r, x]) => [r, -x] as [number, number]).reverse();
}

/**
 * Extrusion of a section drawn in (−z, y) along +X, from x0 to x1, with
 * creased normals (round parts smooth, edges sharp) and UVs in units of
 * `uv` mm (for noise maps).
 */
export function extrudeX(
  shape: Shape | Shape[],
  x0: number,
  x1: number,
  { crease = Math.PI / 7, uv = 40, curveSegments = 12 } = {},
): BufferGeometry {
  const g = new ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments });
  g.rotateY(Math.PI / 2);
  g.translate(x0, 0, 0);
  scaleUv(g, 1 / uv, 1 / uv);
  // Extrusions are not indexed: the normals are rewritten in place.
  return toCreasedNormals(g, crease);
}

/** A polygon (shape) from [x, y] points. */
export function polygonShape(points: [number, number][]): Shape {
  const shape = new Shape();
  points.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  return shape;
}

/** A closed polygonal path (for holes) from [x, y] points. */
export function polygonPath(points: [number, number][]): Path {
  const path = new Path();
  points.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  path.closePath();
  return path;
}

/** Points of a circle of radius r (shape coordinates). */
export function circlePoints(r: number, steps = 64, cx = 0, cy = 0): [number, number][] {
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  });
}

/**
 * Deep-groove ball bearing (bore, outside diameter, width, as in the 62xx
 * tables) along Y and centred on y = 0: outer ring, inner ring and the balls
 * between them, without shields so the balls show. One geometry.
 */
export function ballBearingGeometry(
  bore: number,
  outside: number,
  width: number,
  { balls, segments = 40 }: { balls?: number; segments?: number } = {},
): BufferGeometry {
  const ri = bore / 2;
  const ro = outside / 2;
  const rp = (ri + ro) / 2;
  const rb = 0.3 * (ro - ri);
  const h = width / 2;
  const c = Math.min(0.6, width * 0.05);
  const rio = rp - rb * 0.72;
  const roi = rp + rb * 0.72;
  const ring = (a: number, b: number) =>
    lathe(
      [
        [a, -h + c],
        [a + c, -h],
        [b - c, -h],
        [b, -h + c],
        [b, h - c],
        [b - c, h],
        [a + c, h],
        [a, h - c],
        [a, -h + c],
      ],
      segments,
    );
  const n = balls ?? Math.max(6, Math.floor((2 * Math.PI * rp) / (2 * rb * 1.45)));
  const parts: BufferGeometry[] = [ring(ri, rio), ring(roi, ro)];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    parts.push(new SphereGeometry(rb, 12, 8).translate(rp * Math.cos(a), 0, rp * Math.sin(a)));
  }
  return merge(parts);
}

/** Parallel key with round ends (DIN 6885 form A), along X, centred, from y = 0 up to `height`. */
export function keyGeometry(length: number, width: number, height: number): BufferGeometry {
  const g = extrudeUp(roundedRectShape(length, width, width / 2 - 0.01), height, 0.3, {
    curveSegments: 6,
  });
  scaleUv(g, 1 / 20, 1 / 20);
  return g;
}

/** Involute function. */
const inv = (a: number) => Math.tan(a) - a;

/**
 * Outline of an involute spur gear (20° pressure angle, addendum 1 m,
 * dedendum 1,25 m) in the shape's XY plane, centred, with a round bore.
 * Tooth k is centred on the angle `phase + k · 2π / teeth`.
 */
export function spurGearShape(
  teeth: number,
  module: number,
  bore: number,
  { phase = 0, steps = 5 }: { phase?: number; steps?: number } = {},
): Shape {
  const rp = (module * teeth) / 2;
  const alpha = (20 * Math.PI) / 180;
  const rb = rp * Math.cos(alpha);
  const ra = rp + module;
  const rf = rp - 1.25 * module;
  const r0 = Math.max(rb, rf);
  const half = (r: number) =>
    Math.PI / (2 * teeth) + inv(alpha) - inv(Math.acos(Math.min(rb / r, 1)));
  const pts: [number, number][] = [];
  const P = (r: number, a: number) => pts.push([r * Math.cos(a), r * Math.sin(a)]);
  const pitch = (2 * Math.PI) / teeth;
  for (let k = 0; k < teeth; k++) {
    const c = phase + k * pitch;
    // Root to the first flank, up the flank, across the tip, down the other flank.
    if (rf < rb) P(rf, c - half(rb));
    for (let i = 0; i <= steps; i++) {
      const r = r0 + ((ra - r0) * i) / steps;
      P(r, c - half(r));
    }
    for (let i = steps; i >= 0; i--) {
      const r = r0 + ((ra - r0) * i) / steps;
      P(r, c + half(r));
    }
    if (rf < rb) P(rf, c + half(rb));
    // Root arc to the next tooth.
    const a0 = c + half(r0);
    const a1 = c + pitch - half(r0);
    for (let i = 1; i < 3; i++) P(rf, a0 + ((a1 - a0) * i) / 3);
  }
  const shape = polygonShape(pts);
  if (bore > 0) shape.holes.push(polygonPath(circlePoints(bore / 2, 32).reverse()));
  return shape;
}
