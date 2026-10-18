/**
 * Geometry helpers for parametric parts: rounded wire paths, lathe bodies
 * with axial UVs (so painted bands land at exact positions), helpers for
 * rounded profiles. All sizes in millimetres.
 */
import {
  CatmullRomCurve3,
  CurvePath,
  LatheGeometry,
  LineCurve3,
  QuadraticBezierCurve3,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Curve,
} from 'three';
import type { Vec3 } from '../types';

/**
 * A polyline with every corner rounded by `bendRadius`: the path of a bent
 * component lead or a wire laid along a board.
 */
export function roundedPath(points: Vec3[], bendRadius = 1): CurvePath<Vector3> {
  const path = new CurvePath<Vector3>();
  const p = points.map((v) => new Vector3(...v));
  if (p.length < 2) return path;
  let start = p[0]!.clone();
  for (let i = 1; i < p.length - 1; i++) {
    const corner = p[i]!;
    const before = p[i - 1]!;
    const after = p[i + 1]!;
    const inDir = corner.clone().sub(before);
    const outDir = after.clone().sub(corner);
    const r = Math.min(bendRadius, inDir.length() / 2, outDir.length() / 2);
    inDir.normalize();
    outDir.normalize();
    const a = corner.clone().addScaledVector(inDir, -r);
    const b = corner.clone().addScaledVector(outDir, r);
    if (a.distanceTo(start) > 1e-6) path.add(new LineCurve3(start, a));
    path.add(new QuadraticBezierCurve3(a, corner.clone(), b));
    start = b;
  }
  path.add(new LineCurve3(start, p[p.length - 1]!.clone()));
  return path;
}

/** Tube along a curve. `segments` scales with the length if not given. */
export function tube(
  curve: Curve<Vector3>,
  radius: number,
  { radial = 12, segments }: { radial?: number; segments?: number } = {},
): TubeGeometry {
  const length = curve.getLength();
  const tubular = segments ?? Math.max(8, Math.ceil(length / Math.max(radius * 1.5, 0.25)));
  return new TubeGeometry(curve, Math.min(tubular, 400), radius, radial, false);
}

/** Smooth curve through points (cables hanging, coils). */
export function smoothPath(points: Vec3[], tension = 0.5): CatmullRomCurve3 {
  return new CatmullRomCurve3(
    points.map((v) => new Vector3(...v)),
    false,
    'catmullrom',
    tension,
  );
}

/**
 * Lathe around the Y axis from a profile of [radius, y] points, with the V
 * texture coordinate proportional to height (not to the point index), so a
 * texture can paint bands at exact positions along the axis.
 */
export function axialLathe(profile: [number, number][], segments = 48): LatheGeometry {
  const geometry = new LatheGeometry(
    profile.map(([r, y]) => new Vector2(Math.max(r, 0), y)),
    segments,
  );
  const ys = profile.map(([, y]) => y);
  const min = Math.min(...ys);
  const span = Math.max(...ys) - min || 1;
  const position = geometry.attributes.position!;
  const uv = geometry.attributes.uv!;
  for (let i = 0; i < position.count; i++) uv.setY(i, (position.getY(i) - min) / span);
  uv.needsUpdate = true;
  return geometry;
}

/**
 * Profile of a cylinder with rounded ends (radius `r`, from `y0` to `y1`,
 * fillet `f`), for lathes: cans, caps, bodies.
 */
export function roundedCylinderProfile(
  r: number,
  y0: number,
  y1: number,
  f: number,
  steps = 6,
): [number, number][] {
  const out: [number, number][] = [[0, y0]];
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI / 2) * (i / steps);
    out.push([r - f + Math.sin(a) * f, y0 + f - Math.cos(a) * f]);
  }
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI / 2) * (i / steps);
    out.push([r - f + Math.cos(a) * f, y1 - f + Math.sin(a) * f]);
  }
  out.push([0, y1]);
  return out;
}

/** Disposes geometries created with useMemo when the component unmounts. */
export function disposeAll(...items: (BufferGeometry | undefined | null)[]) {
  for (const item of items) item?.dispose();
}
