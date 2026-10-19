/**
 * Helpers shared by the home-installation parts (NBR 14136 outlet, electric
 * shower): closed rounded polygons for moulded outlines, insulated building
 * wire geometry with a cut or stripped end (insulation and copper built
 * separately so a part can merge every copper end into one mesh), and the
 * green-yellow stripe texture of the protective earth conductor. Private to
 * `parts/` (the leading `_` keeps it out of the part registry).
 */
import {
  CylinderGeometry,
  Path,
  Quaternion,
  RingGeometry,
  Shape,
  Vector3,
  type BufferGeometry,
} from 'three';
import { useCanvasTexture } from '../materials/textures';
import { roundedPath, tube } from '../shapes/geometry';
import type { Vec3 } from '../types';
import { mergeAll } from './_em-geometry';

export type Pt = [number, number];

/**
 * Closed polygon with every corner rounded: each corner is replaced by a
 * quadratic curve that starts `t` mm before it and ends `t` mm after it
 * (limited to half of the shorter edge).
 */
export function roundedPolygon(points: Pt[], t: number, steps = 6): Pt[] {
  const n = points.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const [px, py] = points[(i + n - 1) % n]!;
    const [cx, cy] = points[i]!;
    const [nx, ny] = points[(i + 1) % n]!;
    const l1 = Math.hypot(cx - px, cy - py);
    const l2 = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(t, l1 / 2, l2 / 2);
    const ax = cx - ((cx - px) / l1) * r;
    const ay = cy - ((cy - py) / l1) * r;
    const bx = cx + ((nx - cx) / l2) * r;
    const by = cy + ((ny - cy) / l2) * r;
    for (let s = 0; s <= steps; s++) {
      const k = s / steps;
      out.push([
        (1 - k) * (1 - k) * ax + 2 * (1 - k) * k * cx + k * k * bx,
        (1 - k) * (1 - k) * ay + 2 * (1 - k) * k * cy + k * k * by,
      ]);
    }
  }
  return out;
}

/** A shape (or a hole path) through the points. */
export function polygonShape(points: Pt[]): Shape {
  const s = new Shape();
  points.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
}

export function polygonPath(points: Pt[]): Path {
  const p = new Path();
  points.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
  p.closePath();
  return p;
}

/** A circular hole path. */
export function circlePath(x: number, y: number, r: number): Path {
  const p = new Path();
  p.absarc(x, y, r, 0, Math.PI * 2, true);
  return p;
}

const Z = new Vector3(0, 0, 1);
const Y = new Vector3(0, 1, 0);

export interface LeadOptions {
  /** Corner radius of the path. */
  bend?: number;
  /** Conductor radius (mm). */
  conductor?: number;
  /** `cut`: the wire ends cut square (copper face showing); `strip`: a bare tip of `strip` mm. */
  end?: 'cut' | 'strip';
  strip?: number;
  radial?: number;
}

/**
 * Geometry of a single-core building wire along `points`: the insulation
 * (tube plus the annular face where it ends) and the copper (the bare tip or
 * the cut face). Both in the same space, ready to merge with other wires.
 */
export function leadGeometry(
  points: Vec3[],
  radius: number,
  {
    bend = radius * 3,
    conductor = radius * 0.5,
    end = 'cut',
    strip = 6,
    radial = 12,
  }: LeadOptions = {},
): { insulation: BufferGeometry; copper: BufferGeometry } {
  const pts = points.map((p) => new Vector3(...p));
  const last = pts[pts.length - 1]!;
  const before = pts[pts.length - 2]!;
  const dir = last.clone().sub(before).normalize();
  const insulatedEnd = end === 'strip' ? last.clone().addScaledVector(dir, -strip) : last.clone();
  const path: Vec3[] = [...points.slice(0, -1), insulatedEnd.toArray() as Vec3];
  const sleeve = tube(roundedPath(path, bend), radius, { radial });

  const ring = new RingGeometry(conductor, radius, radial, 1);
  ring.applyQuaternion(new Quaternion().setFromUnitVectors(Z, dir));
  ring.translate(insulatedEnd.x, insulatedEnd.y, insulatedEnd.z);

  let copper: BufferGeometry;
  if (end === 'strip') {
    const length = strip + radius;
    copper = new CylinderGeometry(conductor, conductor, length, 10, 1, false);
    copper.applyQuaternion(new Quaternion().setFromUnitVectors(Y, dir));
    const mid = last.clone().addScaledVector(dir, -length / 2);
    copper.translate(mid.x, mid.y, mid.z);
  } else {
    copper = new CylinderGeometry(conductor, conductor, 0.4, 10, 1, false);
    copper.applyQuaternion(new Quaternion().setFromUnitVectors(Y, dir));
    const mid = last.clone().addScaledVector(dir, -0.18);
    copper.translate(mid.x, mid.y, mid.z);
  }
  return { insulation: mergeAll([sleeve, ring]), copper };
}

/**
 * PVC colours of the NBR 5410 conductors used here (sRGB, from catalogue
 * photos; same values as the wire parts).
 */
export const PVC = {
  preto: '#1c1c1e',
  vermelho: '#c21f1b',
  azulClaro: '#2a86d4',
  verde: '#13763a',
  amarelo: '#f2c81a',
} as const;

/**
 * Green-yellow insulation of the protective earth conductor: two
 * longitudinal stripes around the wire (V runs around a tube).
 */
export function useEarthStripeTexture() {
  return useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = PVC.verde;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = PVC.amarelo;
      ctx.fillRect(0, h * 0.08, w, h * 0.34);
      ctx.fillRect(0, h * 0.58, w, h * 0.3);
    },
    'home-earth-stripe',
    { width: 4, height: 64, repeat: true },
  );
}
