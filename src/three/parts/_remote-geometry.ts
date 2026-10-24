/**
 * Geometry of the keychain remote (`remote-control-433.tsx`): the two halves
 * of the shell, swept around a key-fob outline (a rectangle with a fully
 * round end where the key ring goes), and small SMD packages for its board.
 * Private helper (the `_` prefix keeps it out of the part registry).
 *
 * Outline coordinates are [x, z] in millimetres, seen from above; the shell
 * is centred on the origin.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Curve,
  Float32BufferAttribute,
  Path,
  Shape,
  ShapeGeometry,
  Vector3,
} from 'three';
import { axialLathe } from '../shapes/geometry';
import { invertGeometry, mergeAll } from './_em-geometry';

export interface FobOutline {
  /** Overall length along X and width along Z (mm). */
  length: number;
  width: number;
  /** Corner radius of the square (+X) end. */
  corner: number;
}

export interface Hole {
  x: number;
  z: number;
  r: number;
}

/**
 * Points around the outline offset by `o` (negative = inwards), angle
 * increasing from +X towards +Z: the +X/+Z corner, the round −X end, the
 * +X/−Z corner.
 */
export function fobRing(f: FobOutline, o: number, cornerSegments = 6, endSegments = 28) {
  const hw = f.width / 2;
  const cx = -f.length / 2 + hw;
  const xc = f.length / 2 - f.corner;
  const zc = hw - f.corner;
  const rc = Math.max(f.corner + o, 0.05);
  const re = hw + o;
  const out: [number, number][] = [];
  for (let i = 0; i <= cornerSegments; i++) {
    const a = (Math.PI / 2) * (i / cornerSegments);
    out.push([xc + rc * Math.cos(a), zc + rc * Math.sin(a)]);
  }
  for (let i = 0; i <= endSegments; i++) {
    const a = Math.PI / 2 + Math.PI * (i / endSegments);
    out.push([cx + re * Math.cos(a), re * Math.sin(a)]);
  }
  for (let i = 0; i <= cornerSegments; i++) {
    const a = Math.PI * 1.5 + (Math.PI / 2) * (i / cornerSegments);
    out.push([xc + rc * Math.cos(a), -zc + rc * Math.sin(a)]);
  }
  return out;
}

/** Profile point: [outward offset, y]; `null` starts a new strip (a crease). */
export type FobSweepPoint = [number, number] | null;

/**
 * Sweeps a profile around the outline, like a lathe: walking up the outside
 * faces outwards, walking down an inner wall faces the cavity, walking
 * outwards at constant height faces down and inwards faces up.
 */
export function fobSweep(f: FobOutline, profile: FobSweepPoint[]): BufferGeometry {
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
    const base = positions.length / 3;
    let count = 0;
    strip.forEach(([offset, y], j) => {
      const ring = fobRing(f, offset);
      count = ring.length;
      ring.forEach(([x, z], i) => {
        positions.push(x, y, z);
        uvs.push(i / ring.length, j / (strip.length - 1));
      });
    });
    for (let j = 0; j < strip.length - 1; j++) {
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

/** Flat face of the outline (offset `o`) at height y, with round holes, facing up or down. */
export function fobCap(f: FobOutline, o: number, y: number, holes: Hole[], up: boolean) {
  const shape = new Shape();
  fobRing(f, o).forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  for (const h of holes) {
    const path = new Path();
    path.absarc(h.x, -h.z, h.r, 0, Math.PI * 2, true);
    shape.holes.push(path);
  }
  const geometry = new ShapeGeometry(shape, 12);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  return up ? geometry : invertGeometry(geometry);
}

/** Vertical wall of a round hole from y0 to y1, facing the hole axis or away from it. */
export function holeWall(h: Hole, y0: number, y1: number, inward: boolean, segments = 28) {
  const profile: [number, number][] = inward
    ? [
        [h.r, y1],
        [h.r, y0],
      ]
    : [
        [h.r, y0],
        [h.r, y1],
      ];
  const g = axialLathe(profile, segments);
  g.translate(h.x, 0, h.z);
  return g;
}

/** Flat ring (annulus) at height y around (x, z), facing up or down. */
export function annulus(x: number, z: number, r0: number, r1: number, y: number, up: boolean) {
  const profile: [number, number][] = up
    ? [
        [r1, y],
        [r0, y],
      ]
    : [
        [r0, y],
        [r1, y],
      ];
  const g = axialLathe(profile, 28);
  g.translate(x, 0, z);
  return g;
}

export interface ShellSpec {
  outline: FobOutline;
  /** Total height, parting line height and wall thickness (mm). */
  height: number;
  parting: number;
  wall: number;
  /** Fillet of the outer top and bottom edges. */
  fillet: number;
  /** Key-ring hole: centre, hole radius and the radius of the boss around it. */
  ring: { x: number; z: number; r: number; boss: number };
}

/** Top half: outer wall and top face with the button and LED holes, hollow inside. */
export function topShellGeometry(s: ShellSpec, holes: Hole[]): BufferGeometry {
  const { outline: o, height: H, parting: P, wall: t, fillet: f } = s;
  const g = 0.35;
  const outer: FobSweepPoint[] = [
    [-g, P],
    [0, P + g],
    [0, H - f],
  ];
  for (let i = 1; i <= 6; i++) {
    const a = (Math.PI / 2) * (i / 6);
    outer.push([-f + f * Math.cos(a), H - f + f * Math.sin(a)]);
  }
  const ringHole: Hole = { x: s.ring.x, z: s.ring.z, r: s.ring.r };
  const ringBoss: Hole = { x: s.ring.x, z: s.ring.z, r: s.ring.boss };
  const parts: BufferGeometry[] = [
    fobSweep(o, outer),
    fobCap(o, -f, H, [ringHole, ...holes], true),
    fobSweep(o, [
      [-t, P],
      [-g, P],
    ]),
    fobSweep(o, [
      [-t, H - t],
      [-t, P],
    ]),
    fobCap(o, -t, H - t, [ringBoss, ...holes], false),
    holeWall(ringHole, P, H, true),
    holeWall(ringBoss, P, H - t, false),
    annulus(s.ring.x, s.ring.z, s.ring.r, s.ring.boss, P, false),
    ...holes.map((h) => holeWall(h, H - t, H, true)),
  ];
  return mergeAll(parts);
}

/** Bottom half: floor, outer wall, key-ring boss and the board posts (`extras`). */
export function bottomShellGeometry(s: ShellSpec, extras: BufferGeometry[] = []): BufferGeometry {
  const { outline: o, parting: P, wall: t, fillet: f } = s;
  const g = 0.35;
  const outer: FobSweepPoint[] = [];
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / 6);
    outer.push([-f + f * Math.cos(a), f + f * Math.sin(a)]);
  }
  outer.push([0, P - g], [-g, P]);
  const ringHole: Hole = { x: s.ring.x, z: s.ring.z, r: s.ring.r };
  const ringBoss: Hole = { x: s.ring.x, z: s.ring.z, r: s.ring.boss };
  const parts: BufferGeometry[] = [
    fobSweep(o, outer),
    fobCap(o, -f, 0, [ringHole], false),
    fobSweep(o, [
      [-g, P],
      [-t, P],
    ]),
    fobSweep(o, [
      [-t, P],
      [-t, t],
    ]),
    fobCap(o, -t, t, [ringBoss], true),
    holeWall(ringHole, 0, P, true),
    holeWall(ringBoss, t, P, false),
    annulus(s.ring.x, s.ring.z, s.ring.r, s.ring.boss, P, true),
    ...extras,
  ];
  return mergeAll(parts);
}

/** Box from its centre and size. */
export function boxAt(x: number, y: number, z: number, w: number, h: number, d: number) {
  return new BoxGeometry(w, h, d).translate(x, y, z);
}

/** Vertical cylinder standing on y0. */
export function postAt(x: number, z: number, r: number, y0: number, y1: number, segments = 16) {
  return new CylinderGeometry(r, r, y1 - y0, segments).translate(x, (y0 + y1) / 2, z);
}

/**
 * Gull-wing leads of an SMD package lying on y = 0: `count` leads along X at
 * `pitch`, leaving the body at |z| = `bodyHalf` and `exitY`, landing with
 * their feet ending at |z| = `tipHalf`, on the +Z (`side` 1) or −Z (−1) side.
 */
export function gullWings(
  xs: number[],
  side: 1 | -1,
  bodyHalf: number,
  tipHalf: number,
  exitY: number,
  width: number,
  thickness = 0.15,
): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  const foot = Math.min(0.6, (tipHalf - bodyHalf) * 0.55);
  const knee = tipHalf - foot;
  for (const x of xs) {
    const shoulder = bodyHalf + (knee - bodyHalf) * 0.35;
    out.push(
      boxAt(x, exitY, side * ((bodyHalf + shoulder) / 2), width, thickness, shoulder - bodyHalf),
      boxAt(
        x,
        (exitY + thickness / 2) / 2,
        side * ((shoulder + knee) / 2),
        width,
        exitY + thickness / 2,
        thickness,
      ),
      boxAt(x, thickness / 2, side * ((knee + tipHalf) / 2), width, thickness, foot),
    );
  }
  return out;
}

/** Conical spring from z = 0 towards −Z (battery contacts): radius r0 at the base to r1. */
export class ConeSpring extends Curve<Vector3> {
  constructor(
    public r0: number,
    public r1: number,
    public length: number,
    public turns: number,
  ) {
    super();
  }

  override getPoint(t: number, target = new Vector3()): Vector3 {
    const a = t * this.turns * Math.PI * 2;
    const r = this.r0 + (this.r1 - this.r0) * t;
    return target.set(r * Math.cos(a), r * Math.sin(a), -t * this.length);
  }
}
