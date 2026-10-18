/**
 * Private helpers of the power, lighting and magnetism parts (transformer,
 * cells, batteries, lamps, magnets, coils, motor, buzzer): lathes with hard
 * edges, thin shells, helices, insulated flying leads, winding and
 * lamination textures, and cut-face decals that show wire cross-sections.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  BufferGeometry,
  Curve,
  ExtrudeGeometry,
  Float32BufferAttribute,
  FrontSide,
  type Group,
  LatheGeometry,
  PlaneGeometry,
  Quaternion,
  Shape,
  Vector2,
  Vector3,
  type ColorRepresentation,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { damp, easeInOut, transitionStep, useReducedMotion } from '../core/motion';
import { useQuality } from '../core/quality';
import { useView } from '../core/view';
import { Material, type MaterialProps } from '../materials/Material';
import { PRESETS, type MaterialPreset, type PresetName } from '../materials/presets';
import { useCanvasTexture } from '../materials/textures';
import { FieldLines } from '../fx/FieldLines';
import type { FieldSource } from '../fx/field';
import { roundedPath, tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { Vec3 } from '../types';

/** Deterministic pseudo-random numbers (same look on every page). */
export function seeded(seed = 1): () => number {
  let s = Math.max(1, Math.floor(seed)) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Repeats a profile point where the outline turns by more than `angle`, so the lathe keeps a hard edge there. */
export function sharpenProfile(profile: [number, number][], angle = 32): [number, number][] {
  const limit = Math.cos((angle * Math.PI) / 180);
  const out: [number, number][] = [];
  profile.forEach((p, i) => {
    out.push(p);
    const prev = profile[i - 1];
    const next = profile[i + 1];
    if (!prev || !next) return;
    const ax = p[0] - prev[0];
    const ay = p[1] - prev[1];
    const bx = next[0] - p[0];
    const by = next[1] - p[1];
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (la < 1e-6 || lb < 1e-6) return;
    if ((ax * bx + ay * by) / (la * lb) < limit) out.push([p[0], p[1]]);
  });
  return out;
}

/**
 * Lathe around Y from [radius, y] points with hard edges at sharp corners and
 * V proportional to height (painted bands land where they should). `seam`
 * turns the geometry so the U seam sits at that angle.
 */
export function lathe(
  profile: [number, number][],
  segments = 48,
  { angle = 32, seam = 0 }: { angle?: number; seam?: number } = {},
): LatheGeometry {
  const points = sharpenProfile(profile, angle);
  const geometry = new LatheGeometry(
    points.map(([r, y]) => new Vector2(Math.max(r, 0), y)),
    segments,
  );
  const ys = points.map(([, y]) => y);
  const min = Math.min(...ys);
  const span = Math.max(...ys) - min || 1;
  const position = geometry.attributes.position!;
  const uv = geometry.attributes.uv!;
  for (let i = 0; i < position.count; i++) uv.setY(i, (position.getY(i) - min) / span);
  uv.needsUpdate = true;
  if (seam) geometry.rotateY(seam);
  return geometry;
}

/**
 * A thin shell from an outer profile (traced bottom to top, outward normals):
 * the outer surface, then the same outline offset inwards by `thickness` and
 * traced back. Lathed, it is a closed solid, so the cutaway shows its wall.
 */
export function shellProfile(outer: [number, number][], thickness: number): [number, number][] {
  const normals = outer.map((p, i) => {
    const a = outer[Math.max(i - 1, 0)]!;
    const b = outer[Math.min(i + 1, outer.length - 1)]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [dy / l, -dx / l] as const;
  });
  const inner = outer.map((p, i) => {
    const [nx, ny] = normals[i]!;
    const r = p[0] < 1e-6 ? 0 : Math.max(p[0] - nx * thickness, 0);
    return [r, p[1] - ny * thickness] as [number, number];
  });
  return [...outer, ...inner.reverse()];
}

/** Averages the normals on the U seam of a lathe after its vertices were moved. */
export function fixLatheSeam(geometry: BufferGeometry, pointCount: number, segments: number) {
  const normal = geometry.attributes.normal!;
  const last = segments * pointCount;
  for (let j = 0; j < pointCount; j++) {
    const a = j;
    const b = last + j;
    const x = normal.getX(a) + normal.getX(b);
    const y = normal.getY(a) + normal.getY(b);
    const z = normal.getZ(a) + normal.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    normal.setXYZ(a, x / l, y / l, z / l);
    normal.setXYZ(b, x / l, y / l, z / l);
  }
  normal.needsUpdate = true;
}

/** Multiplies the texture coordinates (to tile textures in millimetres). */
export function scaleUv<T extends BufferGeometry>(geometry: T, su: number, sv: number): T {
  const uv = geometry.attributes.uv;
  if (!uv) return geometry;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return geometry;
}

/** Merges geometries (same attributes) and disposes the inputs. */
export function merge(geometries: BufferGeometry[]): BufferGeometry {
  const prepared = geometries.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(prepared, false) ?? new BufferGeometry();
  geometries.forEach((g) => g.dispose());
  prepared.forEach((g) => g.dispose());
  return merged;
}

/** A helix around +Y from y = 0: `turns` turns of `radius`, rising `pitch` per turn. */
export class HelixCurve extends Curve<Vector3> {
  constructor(
    public radius: number,
    public pitch: number,
    public turns: number,
    public phase = 0,
    public direction: 1 | -1 = 1,
  ) {
    super();
  }

  override getPoint(t: number, target = new Vector3()): Vector3 {
    const a = this.phase + this.direction * t * this.turns * Math.PI * 2;
    return target.set(
      Math.cos(a) * this.radius,
      t * this.turns * this.pitch,
      Math.sin(a) * this.radius,
    );
  }
}

/** Points of a helix (for paths that continue into straight lead-outs). */
export function helixPoints(
  radius: number,
  pitch: number,
  turns: number,
  { phase = 0, steps = 16 }: { phase?: number; steps?: number } = {},
): Vec3[] {
  const out: Vec3[] = [];
  const n = Math.max(2, Math.ceil(turns * steps));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = phase + t * turns * Math.PI * 2;
    out.push([Math.cos(a) * radius, t * turns * pitch, Math.sin(a) * radius]);
  }
  return out;
}

const UP = new Vector3(0, 1, 0);

export interface LeadProps {
  /** Corners of the wire path (mm); the last segment ends in the stripped tip. */
  points: Vec3[];
  /** Outer radius of the insulation (mm). */
  radius: number;
  color: ColorRepresentation;
  /** Stripped length at the end (mm); 0 = no bare tip. */
  strip?: number;
  /** Conductor radius (mm). */
  conductor?: number;
  bend?: number;
  clip?: boolean;
  /** Bare tip: tinned (solder) or plain copper. */
  tip?: 'estanhado' | 'cobre';
  material?: Partial<MaterialProps>;
}

/** An insulated flying lead (PVC) with a stripped, tinned tip. */
export function Lead({
  points,
  radius,
  color,
  strip = 5,
  conductor = radius * 0.5,
  bend = radius * 3,
  clip = false,
  tip = 'estanhado',
  material,
}: LeadProps) {
  const geometry = useDisposable(() => {
    const pts = points.map((p) => new Vector3(...p));
    const end = pts[pts.length - 1]!;
    const before = pts[pts.length - 2] ?? end.clone().add(new Vector3(0, -1, 0));
    const dir = end.clone().sub(before).normalize();
    const cut = end.clone().addScaledVector(dir, -strip);
    const insulated: Vec3[] = [...points.slice(0, -1), [cut.x, cut.y, cut.z]];
    return tube(roundedPath(insulated, bend), radius, { radial: 12 });
  }, [points, radius, strip, bend]);
  const bare = useDisposable(() => {
    const pts = points.map((p) => new Vector3(...p));
    const end = pts[pts.length - 1]!;
    const before = pts[pts.length - 2] ?? end.clone().add(new Vector3(0, -1, 0));
    const dir = end.clone().sub(before).normalize();
    const start = end.clone().addScaledVector(dir, -strip - radius);
    return tube(
      roundedPath(
        [
          [start.x, start.y, start.z],
          [end.x, end.y, end.z],
        ],
        1,
      ),
      conductor,
      { radial: 8 },
    );
  }, [points, strip, conductor, radius]);
  const capPose = useMemo(() => {
    const pts = points.map((p) => new Vector3(...p));
    const end = pts[pts.length - 1]!;
    const before = pts[pts.length - 2] ?? end.clone().add(new Vector3(0, -1, 0));
    const dir = end.clone().sub(before).normalize();
    const at = end.clone().addScaledVector(dir, -strip);
    const q = new Quaternion().setFromUnitVectors(UP, dir);
    return {
      position: at.toArray() as Vec3,
      quaternion: q.toArray() as [number, number, number, number],
    };
  }, [points, strip]);
  return (
    <group>
      <mesh geometry={geometry}>
        <Material preset="pvc" color={color} clip={clip} {...material} />
      </mesh>
      {strip > 0 && (
        <>
          <mesh position={capPose.position} quaternion={capPose.quaternion}>
            <cylinderGeometry args={[radius * 0.97, radius, 0.12, 14]} />
            <Material preset="pvc" color={color} roughness={0.6} clip={clip} />
          </mesh>
          <mesh geometry={bare}>
            <Material
              preset={tip === 'cobre' ? 'copper' : 'solder'}
              roughness={tip === 'cobre' ? 0.3 : 0.25}
              clip={clip}
            />
          </mesh>
        </>
      )}
    </group>
  );
}

/**
 * Turns of enamelled wire on the surface of a winding: one tile holds eight
 * turns stacked along V. Tile V so one tile spans eight wire diameters.
 */
export function useTurnsTexture(kind: 'color' | 'bump', tint = '#b4582c') {
  return useCanvasTexture(
    (ctx, w, h) => {
      const rows = 8;
      const rh = h / rows;
      const random = seeded(7);
      for (let i = 0; i < rows; i++) {
        const y = i * rh;
        const g = ctx.createLinearGradient(0, y, 0, y + rh);
        if (kind === 'bump') {
          g.addColorStop(0, '#000000');
          g.addColorStop(0.5, '#ffffff');
          g.addColorStop(1, '#000000');
        } else {
          const shade = 0.85 + random() * 0.25;
          const mid = scale(tint, 1.25 * shade);
          g.addColorStop(0, scale(tint, 0.45));
          g.addColorStop(0.32, scale(tint, shade));
          g.addColorStop(0.5, mid);
          g.addColorStop(0.68, scale(tint, shade));
          g.addColorStop(1, scale(tint, 0.45));
        }
        ctx.fillStyle = g;
        ctx.fillRect(0, y, w, rh);
      }
    },
    `turns|${kind}|${tint}`,
    { width: 8, height: 128, color: kind === 'color', repeat: true },
  );
}

/** Lamination edges of a transformer core: eight 0,5 mm sheets per tile along V. */
export function useLaminationTexture(kind: 'color' | 'rough') {
  return useCanvasTexture(
    (ctx, w, h) => {
      const rows = 8;
      const rh = h / rows;
      const random = seeded(11);
      for (let i = 0; i < rows; i++) {
        const v = random();
        if (kind === 'color') {
          const l = Math.round(104 + v * 30);
          ctx.fillStyle = `rgb(${l},${l + 3},${l + 8})`;
        } else {
          const l = Math.round(90 + v * 60);
          ctx.fillStyle = `rgb(${l},${l},${l})`;
        }
        ctx.fillRect(0, i * rh, w, rh);
        // Insulating oxide between sheets.
        ctx.fillStyle = kind === 'color' ? 'rgba(30,32,36,0.85)' : 'rgb(235,235,235)';
        ctx.fillRect(0, i * rh, w, Math.max(1, rh * 0.14));
      }
    },
    `lam|${kind}`,
    { width: 8, height: 128, color: kind === 'color', repeat: true },
  );
}

/** sRGB hex scaled in brightness. */
export function scale(hex: string, k: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(v * k))),
  );
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export interface WireSectionProps {
  /** Size of the section (mm): width along X, height along Y. */
  width: number;
  height: number;
  /** Wire diameter (mm). */
  wire: number;
  position?: Vec3;
  rotation?: Vec3;
  /** Copper tint of the conductors. */
  tint?: string;
  /** Show only during the cutaway (the default). */
  cutOnly?: boolean;
}

/**
 * Cross-section of a winding on the cut plane: rows of round copper
 * conductors in red enamel, as seen when a coil is sawn in half.
 */
export function WireSection({
  width,
  height,
  wire,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  tint = '#d9844f',
  cutOnly = true,
}: WireSectionProps) {
  const { cutaway } = useView();
  const map = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#3b1d10';
      ctx.fillRect(0, 0, w, h);
      const r = w / 2;
      const enamel = ctx.createRadialGradient(r, r, r * 0.7, r, r, r);
      enamel.addColorStop(0, '#8a3416');
      enamel.addColorStop(1, '#5a210c');
      ctx.fillStyle = enamel;
      ctx.beginPath();
      ctx.arc(r, r, r * 0.97, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(r * 0.8, r * 0.75, 0, r, r, r * 0.84);
      g.addColorStop(0, scale(tint, 1.25));
      g.addColorStop(0.6, tint);
      g.addColorStop(1, scale(tint, 0.7));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(r, r, r * 0.84, 0, Math.PI * 2);
      ctx.fill();
    },
    `section|${tint}`,
    { width: 64, height: 64, repeat: true },
  );
  const geometry = useDisposable(
    () => scaleUv(new PlaneGeometry(width, height), width / wire, height / wire),
    [width, height, wire],
  );
  if (cutOnly && !cutaway) return null;
  return (
    <mesh geometry={geometry} position={position} rotation={rotation}>
      <Material color="#ffffff" map={map} metalness={0.6} roughness={0.35} />
    </mesh>
  );
}

/** A flat cut-face decal (any drawing) shown only during the cutaway. */
export function CutDecal({
  width,
  height,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  map,
  roughness = 0.7,
  metalness = 0,
}: {
  width: number;
  height: number;
  position?: Vec3;
  rotation?: Vec3;
  map: MaterialProps['map'];
  roughness?: number;
  metalness?: number;
}) {
  const { cutaway } = useView();
  if (!cutaway) return null;
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <Material color="#ffffff" map={map} roughness={roughness} metalness={metalness} />
    </mesh>
  );
}

/** Material preset of a plain conductor finish. */
export type MetalFinish = Extract<PresetName, 'brass' | 'aluminum' | 'nickel' | 'tin'>;

/**
 * Thin clear glass that the cutaway opens without painting the far wall as a
 * cut face (a bulb wall is too thin to show one): front faces only, clipped
 * by the moving cut plane. Falls back to plain blending on the lowest quality.
 */
export function ClearGlass(overrides: MaterialPreset) {
  const { cutaway, cutPlanes } = useView();
  const low = useQuality((s) => s.level === 'baixa');
  const params: MaterialPreset = { ...PRESETS.glass, ...overrides };
  if (low && params.transmission) {
    params.opacity = 1 - params.transmission * 0.85;
    params.transmission = 0;
    params.transparent = true;
    params.depthWrite = false;
  }
  return (
    <meshPhysicalMaterial
      {...params}
      side={FrontSide}
      clippingPlanes={cutaway ? cutPlanes : null}
    />
  );
}

/** Outline of a rounded rectangle in XZ with outward normals, starting at the back centre (−Z) and running −X → +Z → +X. */
export function roundedRectOutline(
  w: number,
  d: number,
  r: number,
  seg = 6,
): { x: number; z: number; nx: number; nz: number }[] {
  const rr = Math.min(r, w / 2, d / 2);
  const cx = w / 2 - rr;
  const cz = d / 2 - rr;
  const corners: [number, number, number][] = [
    [-cx, -cz, -90],
    [-cx, cz, -180],
    [cx, cz, -270],
    [cx, -cz, -360],
  ];
  const out = [{ x: 0, z: -d / 2, nx: 0, nz: -1 }];
  for (const [x0, z0, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = ((a0 - (90 * i) / seg) * Math.PI) / 180;
      out.push({
        x: x0 + Math.cos(a) * rr,
        z: z0 + Math.sin(a) * rr,
        nx: Math.cos(a),
        nz: Math.sin(a),
      });
    }
  }
  out.push({ x: 0, z: -d / 2, nx: 0, nz: -1 });
  return out;
}

/**
 * Closed wall of a rounded-rectangle tube (a can, a label sleeve, a battery
 * box): outer wall, inner wall and the two rims, so the cutaway shows its
 * thickness. U runs around the outer wall (0,5 = front, +Z), V up.
 */
export function roundedRectShell(
  w: number,
  d: number,
  r: number,
  y0: number,
  y1: number,
  thickness: number,
  seg = 6,
): BufferGeometry {
  const outline = roundedRectOutline(w, d, r, seg);
  const lengths = [0];
  for (let i = 1; i < outline.length; i++) {
    const a = outline[i - 1]!;
    const b = outline[i]!;
    lengths.push(lengths[i - 1]! + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const total = lengths[lengths.length - 1]!;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const v = new Vector3();
  const e1 = new Vector3();
  const e2 = new Vector3();
  const add = (
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    u: number,
    vv: number,
  ) => {
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    uvs.push(u, vv);
    return positions.length / 3 - 1;
  };
  const quad = (a: number, b: number, c: number, dd: number, n: [number, number, number]) => {
    const p = (i: number) =>
      new Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    e1.copy(p(b)).sub(p(a));
    e2.copy(p(c)).sub(p(a));
    v.crossVectors(e1, e2);
    if (v.x * n[0] + v.y * n[1] + v.z * n[2] >= 0) indices.push(a, b, c, a, c, dd);
    else indices.push(a, c, b, a, dd, c);
  };
  const strip = (
    pick: (o: (typeof outline)[number]) => [number, number, number, number, number, number],
    u0: number,
    u1: number,
  ) => {
    const start = positions.length / 3;
    outline.forEach((o, i) => {
      const [xa, ya, za, xb, yb, zb] = pick(o);
      const u = lengths[i]! / total;
      add(xa, ya, za, 0, 0, 0, u, u0);
      add(xb, yb, zb, 0, 0, 0, u, u1);
    });
    return start;
  };
  const t = thickness;
  // Outer wall.
  const outer = strip((o) => [o.x, y0, o.z, o.x, y1, o.z], 0, 1);
  // Inner wall.
  const inner = strip(
    (o) => [o.x - o.nx * t, y0, o.z - o.nz * t, o.x - o.nx * t, y1, o.z - o.nz * t],
    0,
    1,
  );
  // Top and bottom rims.
  const top = strip((o) => [o.x, y1, o.z, o.x - o.nx * t, y1, o.z - o.nz * t], 0, 1);
  const bottom = strip((o) => [o.x, y0, o.z, o.x - o.nx * t, y0, o.z - o.nz * t], 0, 1);
  const n = outline.length;
  for (let i = 0; i < n - 1; i++) {
    const o = outline[i]!;
    const q = outline[i + 1]!;
    const mx = (o.nx + q.nx) / 2;
    const mz = (o.nz + q.nz) / 2;
    const k = (s: number, j: number, side: 0 | 1) => s + j * 2 + side;
    quad(k(outer, i, 0), k(outer, i + 1, 0), k(outer, i + 1, 1), k(outer, i, 1), [mx, 0, mz]);
    quad(k(inner, i, 0), k(inner, i + 1, 0), k(inner, i + 1, 1), k(inner, i, 1), [-mx, 0, -mz]);
    quad(k(top, i, 0), k(top, i + 1, 0), k(top, i + 1, 1), k(top, i, 1), [0, 1, 0]);
    quad(k(bottom, i, 0), k(bottom, i + 1, 0), k(bottom, i + 1, 1), k(bottom, i, 1), [0, -1, 0]);
  }
  // Normals: walls follow the outline, rims point up or down.
  outline.forEach((o, i) => {
    for (const side of [0, 1]) {
      const set = (s: number, nx: number, ny: number, nz: number) => {
        const idx = (s + i * 2 + side) * 3;
        normals[idx] = nx;
        normals[idx + 1] = ny;
        normals[idx + 2] = nz;
      };
      set(outer, o.nx, 0, o.nz);
      set(inner, -o.nx, 0, -o.nz);
      set(top, 0, 1, 0);
      set(bottom, 0, -1, 0);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

/** A flat plate with a rounded-rectangle outline (XZ), from y0 to y1, with bevelled edges. */
export function roundedRectSlab(
  w: number,
  d: number,
  r: number,
  y0: number,
  y1: number,
  bevel = 0,
): BufferGeometry {
  const shape = new Shape();
  const rr = Math.min(r, w / 2, d / 2);
  const x = w / 2 - bevel;
  const z = d / 2 - bevel;
  const rb = Math.max(rr - bevel, 0.01);
  shape.moveTo(-x + rb, -z);
  shape.lineTo(x - rb, -z);
  shape.quadraticCurveTo(x, -z, x, -z + rb);
  shape.lineTo(x, z - rb);
  shape.quadraticCurveTo(x, z, x - rb, z);
  shape.lineTo(-x + rb, z);
  shape.quadraticCurveTo(-x, z, -x, z - rb);
  shape.lineTo(-x, -z + rb);
  shape.quadraticCurveTo(-x, -z, -x + rb, -z);
  const depth = Math.max(y1 - y0 - bevel * 2, 0.01);
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, y1 - bevel, 0);
  return geometry;
}

/** Like `useDisposable`, for a named set of geometries built together. */
export function useGeometrySet<T extends Record<string, BufferGeometry>>(
  factory: () => T,
  deps: unknown[],
): T {
  const key = JSON.stringify(deps);
  // `key` stands for the dependency values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => factory(), [key]);
  useEffect(() => () => Object.values(value).forEach((g) => g.dispose()), [value]);
  return value;
}

/**
 * Copy of a geometry without the triangles `drop` selects (given the three
 * corners). Used to open an extrusion where a separate face is drawn.
 */
export function dropTriangles(
  geometry: BufferGeometry,
  drop: (a: Vector3, b: Vector3, c: Vector3) => boolean,
): BufferGeometry {
  const src = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = src.attributes.position!;
  const keep: number[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let i = 0; i + 2 < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    if (!drop(a, b, c)) keep.push(i, i + 1, i + 2);
  }
  const out = new BufferGeometry();
  for (const name of ['position', 'normal', 'uv'] as const) {
    const attr = src.attributes[name];
    if (!attr) continue;
    const size = attr.itemSize;
    const array = new Float32Array(keep.length * size);
    keep.forEach((v, j) => {
      for (let k = 0; k < size; k++) array[j * size + k] = attr.array[v * size + k]!;
    });
    out.setAttribute(name, new Float32BufferAttribute(array, size));
  }
  if (src !== geometry) src.dispose();
  geometry.dispose();
  return out;
}

/** Sets the texture coordinates from the X and Y of the positions, mapping the box to 0..1. */
export function planarUv<T extends BufferGeometry>(
  geometry: T,
  [x0, x1]: [number, number],
  [y0, y1]: [number, number],
): T {
  const position = geometry.attributes.position!;
  const uv: number[] = [];
  for (let i = 0; i < position.count; i++)
    uv.push((position.getX(i) - x0) / (x1 - x0), (position.getY(i) - y0) / (y1 - y0));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return geometry;
}

/**
 * Children that appear (growing from nothing) only in the exploded view,
 * once the pieces are mostly apart.
 */
export function ExplodeReveal({
  from = 0.55,
  position,
  children,
}: {
  from?: number;
  position?: Vec3;
  children: ReactNode;
}) {
  const ref = useRef<Group>(null);
  const { explode } = useView();
  const apply = (group: Group) => {
    const f = easeInOut(((explode.current ?? 0) - from) / (1 - from));
    group.visible = f > 0.01;
    group.scale.setScalar(Math.max(f, 0.01));
  };
  useLayoutEffect(() => {
    if (ref.current) apply(ref.current);
  });
  useFrame(() => {
    if (ref.current) apply(ref.current);
  });
  return (
    <group ref={ref} position={position}>
      {children}
    </group>
  );
}

/**
 * A value that follows `target` smoothly (instant with reduced motion),
 * calling `apply` while it moves and asking the canvas for frames until it
 * settles. Starts at the target, so posters show the final state.
 */
export function useFollow(target: number, apply: (value: number) => void, lambda = 8) {
  const reduced = useReducedMotion();
  const invalidate = useThree((s) => s.invalidate);
  const value = useRef<number | null>(null);
  const applyRef = useRef(apply);
  useLayoutEffect(() => {
    applyRef.current = apply;
    if (value.current === null) {
      value.current = target;
      apply(target);
    }
  });
  useEffect(() => invalidate(), [target, invalidate]);
  const moving = useRef(false);
  useFrame((_, dt) => {
    if (value.current === null) return;
    const step = transitionStep(moving.current, dt);
    let v = reduced ? target : damp(value.current, target, lambda, step);
    if (Math.abs(v - target) < 1e-4) v = target;
    value.current = v;
    applyRef.current(v);
    moving.current = v !== target;
    if (moving.current) invalidate();
  });
}

/** Turns the faces of a geometry over (winding and normals), in place. */
export function flipFaces<T extends BufferGeometry>(geometry: T): T {
  const index = geometry.index;
  if (index) {
    for (let i = 0; i + 2 < index.count; i += 3) {
      const b = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, b);
    }
    index.needsUpdate = true;
  } else {
    for (const attr of Object.values(geometry.attributes)) {
      const size = attr.itemSize;
      const array = attr.array as Float32Array;
      for (let i = 0; i + 2 < attr.count; i += 3)
        for (let k = 0; k < size; k++) {
          const t = array[(i + 1) * size + k]!;
          array[(i + 1) * size + k] = array[(i + 2) * size + k]!;
          array[(i + 2) * size + k] = t;
        }
      attr.needsUpdate = true;
    }
  }
  const normal = geometry.attributes.normal;
  if (normal) {
    for (let i = 0; i < normal.count; i++)
      normal.setXYZ(i, -normal.getX(i), -normal.getY(i), -normal.getZ(i));
    normal.needsUpdate = true;
  }
  return geometry;
}

/**
 * Field lines of a part (in one plane, gliding unless motion is reduced),
 * hidden in the exploded view and in the cutaway, where they would cross
 * the pieces.
 */
export function PartField({
  sources,
  plane,
  center,
  extent,
  count,
  color = '#2a7fd6',
}: {
  sources: FieldSource[];
  plane: Vec3;
  center: Vec3;
  extent: number;
  count: number;
  color?: string;
}) {
  const { explode, cutaway } = useView();
  const reduced = useReducedMotion();
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = (explode.current ?? 0) < 0.02;
  });
  if (cutaway) return null;
  return (
    <group ref={ref}>
      <FieldLines
        sources={sources}
        count={count}
        layout="plano"
        planeNormal={plane}
        center={center}
        extent={extent}
        color={color}
        opacity={0.8}
        flow={reduced ? 0 : extent * 0.12}
      />
    </group>
  );
}
