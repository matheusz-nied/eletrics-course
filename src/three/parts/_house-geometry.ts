/**
 * Geometry shared by the parts of a house installation (distribution board,
 * wall switches): DIN rail devices, the TS 35 rail, flat plates with
 * windows, corrugated conduit and planes that show one region of a texture
 * atlas. All sizes in millimetres. Private to `parts/` (the leading `_`
 * keeps it out of the part registry).
 *
 * DIN device profile (EN 60715 rail, DIN 43880 outline, typical of
 * miniature circuit breakers, RCDs and surge protectors): 18 mm per module
 * (body 17,6 mm), 90 mm overall height, the 45 mm "front" that passes
 * through the cover window, the shoulder 44 mm in front of the rail and the
 * front face about 62 mm in front of it.
 */
import { Path, PlaneGeometry, Shape, type BufferGeometry } from 'three';
import { axialLathe } from '../shapes/geometry';
import { addRoundedRect, extrudeAlongX, extrudeAlongZ } from './_em-geometry';

/** DIN device outline (mm, device space: z = 0 on the rail, y = 0 on the rail axis). */
export const DIN = {
  /** Module pitch and body width of one module. */
  pitch: 18,
  width: 17.6,
  /** Half heights: whole body and the front that passes through the cover. */
  half: 45,
  frontHalf: 22.5,
  /** Shoulder (where the cover sits) and the front face. */
  shoulder: 44,
  front: 62,
  /** Terminal screws (on the shoulder) and the wire clamp and comb slot (on the top face). */
  screwY: 33,
  wireZ: 23,
  combZ: 37,
} as const;

/** Side profile of a DIN device, as [z, y] points around the outline. */
function dinProfile(): [number, number][] {
  const { half: H, frontHalf: F, shoulder: S, front: Z } = DIN;
  const upper: [number, number][] = [
    [0, H],
    [S - 5, H],
    [S - 2.5, H - 0.6],
    [S - 0.6, H - 2.5],
    [S, H - 5],
    [S, F + 2],
    [S + 0.6, F + 0.6],
    [S + 2, F],
    [Z - 2, F],
    [Z - 0.6, F - 0.6],
    [Z, F - 2],
  ];
  const lower = upper.map(([z, y]) => [z, -y] as [number, number]).reverse();
  return [...upper, ...lower];
}

/**
 * Body of a DIN device `modules` wide (x centred on 0), from the rail
 * (z = 0) to the front face (z = 62), y centred on the rail.
 */
export function dinBodyGeometry(modules: number): BufferGeometry {
  const shape = new Shape();
  dinProfile().forEach(([z, y], i) => (i === 0 ? shape.moveTo(-z, y) : shape.lineTo(-z, y)));
  shape.closePath();
  const width = modules * DIN.pitch - (DIN.pitch - DIN.width);
  return extrudeAlongX(shape, width, 0.5, { curveSegments: 2, bevelSegments: 2 });
}

/**
 * TS 35 × 7,5 top-hat rail (EN 60715), 1 mm steel, along X: the base sits
 * at z = 0 and the lips (where the devices clip) at z = 7,5; y centred.
 */
export function dinRailGeometry(length: number): BufferGeometry {
  const t = 1;
  const pts: [number, number][] = [
    [0, -13.5],
    [0, 13.5],
    [7.5 - t, 13.5],
    [7.5 - t, 17.5],
    [7.5, 17.5],
    [7.5, 13.5 - t],
    [t, 13.5 - t],
    [t, -13.5 + t],
    [7.5, -13.5 + t],
    [7.5, -17.5],
    [7.5 - t, -17.5],
    [7.5 - t, -13.5],
  ];
  const shape = new Shape();
  pts.forEach(([z, y], i) => (i === 0 ? shape.moveTo(-z, y) : shape.lineTo(-z, y)));
  shape.closePath();
  return extrudeAlongX(shape, length, 0, { curveSegments: 1 });
}

export interface PlateWindow {
  /** Centre (x, y) and size of the opening (mm). */
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
}

/**
 * A flat plate (w × h, corner radius r) with rectangular openings, extruded
 * along Z and centred on z = 0 (front face at +t/2).
 */
export function plateGeometry(
  w: number,
  h: number,
  r: number,
  t: number,
  windows: PlateWindow[],
  bevel = 0.5,
): BufferGeometry {
  const shape = new Shape();
  addRoundedRect(shape, w, h, r);
  for (const win of windows) {
    const hole = new Path();
    addRoundedRect(hole, win.w, win.h, win.r ?? 0.8, win.x, win.y, true);
    shape.holes.push(hole);
  }
  return extrudeAlongZ(shape, t, bevel, { curveSegments: 6, bevelSegments: 2 });
}

/**
 * Corrugated flexible conduit (the yellow "conduíte" of Brazilian walls):
 * a lathe along +Y from 0 to `length`, outer radius `r`, ridges every `pitch`.
 */
export function corrugatedConduitGeometry(r: number, length: number, pitch = 3.6): BufferGeometry {
  const depth = r * 0.09;
  const inner = r - r * 0.16;
  const profile: [number, number][] = [[inner, length]];
  const steps = Math.max(2, Math.round(length / pitch)) * 4;
  for (let i = steps; i >= 0; i--) {
    const y = (length * i) / steps;
    const phase = (i % 4) / 4;
    // Rounded ridge: cosine bump, flattened at the crest.
    const bump = Math.max(-0.8, Math.min(0.8, Math.cos(phase * Math.PI * 2)));
    profile.push([r - depth + bump * depth, y]);
  }
  profile.push([inner, 0]);
  return axialLathe(profile, 28);
}

/** A region of a texture atlas, in pixels (x, y from the top-left corner). */
export interface AtlasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A plane (w × h mm, facing +Z) whose UVs show only `rect` of an atlas of
 * `atlasW × atlasH` pixels (canvas textures are flipped: v = 1 at the top).
 */
export function atlasPlaneGeometry(
  w: number,
  h: number,
  rect: AtlasRect,
  atlasW: number,
  atlasH: number,
): PlaneGeometry {
  const g = new PlaneGeometry(w, h);
  const uv = g.attributes.uv!;
  const u0 = rect.x / atlasW;
  const u1 = (rect.x + rect.w) / atlasW;
  const v1 = 1 - rect.y / atlasH;
  const v0 = 1 - (rect.y + rect.h) / atlasH;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  }
  uv.needsUpdate = true;
  return g;
}
