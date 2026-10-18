/**
 * Geometry shared by the bridge rectifier and the optocoupler: flat stamped
 * lead-frame plates, copper clip straps, rows of DIP leads and the bevelled
 * slab body of in-line packages (chamfered corner, mounting hole, printable
 * front). All sizes in millimetres. Private helper (the `_` prefix keeps it
 * out of the part registry).
 */
import { BoxGeometry, ExtrudeGeometry, Path, Shape, type BufferGeometry } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  bentStrip,
  extrudeOutline,
  mergeAll,
  mergeAt,
  placed,
  stripOutline,
  type Pt,
} from './_semi-geometry';

/** Axis-aligned rectangle in plan: [x0, z0, x1, z1]. */
export type Rect = [number, number, number, number];

export function rectOutline([x0, z0, x1, z1]: Rect): Pt[] {
  return [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
}

/** A stamped finger: centre line in plan, with one width or a width per point. */
export const fingerOutline = stripOutline;

/**
 * Flat sheet-metal plates lying in the XZ plane (outlines given in plan as
 * [x, z]), `t` thick and centred on y = 0, merged into one geometry.
 */
export function plates(outlines: Pt[][], t: number): BufferGeometry {
  return mergeAll(
    outlines.map((outline) => {
      const g = extrudeOutline(outline, t);
      g.rotateX(Math.PI / 2);
      return g;
    }),
  );
}

export interface ClipSpec {
  /** Start (on a die's top contact) and end (on a lead-frame pad), in plan. */
  from: Pt;
  to: Pt;
  /** Height of the die top and of the pad top. */
  fromY: number;
  toY: number;
  /** Height of the bottom of the arch. */
  arch: number;
}

/**
 * Copper clip straps (the "jumpers" of power rectifiers): a flat foot on the
 * die, a short rise, an arch and a slanted leg down to a foot on the pad.
 */
export function clipStraps(clips: ClipSpec[], t: number, width: number): BufferGeometry {
  return mergeAll(
    clips.map((c) => {
      const dx = c.to[0] - c.from[0];
      const dz = c.to[1] - c.from[1];
      const d = Math.hypot(dx, dz);
      const foot = width * 0.45;
      const yA = c.fromY + t / 2;
      const yB = c.toY + t / 2;
      const yT = Math.max(c.arch, c.fromY + 0.1) + t / 2;
      const rise = Math.max(yT - yA, 0.05) * 0.9 + 0.08;
      const fall = Math.max(yT - yB, 0.1) * 0.85 + 0.08;
      const pts: Pt[] = [
        [-foot, yA],
        [foot, yA],
        [foot + rise, yT],
        [Math.max(d - foot - fall, foot + rise + 0.05), yT],
        [d - foot, yB],
        [d + foot, yB],
      ];
      const g = bentStrip(pts, t, width, Math.min(0.3, t * 2.2));
      g.rotateY(Math.atan2(-dz, dx));
      g.translate(c.from[0], 0, c.from[1]);
      return g;
    }),
  );
}

/** Thin solder (or die-attach) pads under dies: boxes merged into one geometry. */
export function attachPads(
  pads: { at: Pt; size: [number, number] }[],
  y: number,
  thickness: number,
): BufferGeometry {
  const parts = pads.map(({ at, size }) => {
    const g = new BoxGeometry(size[0], thickness, size[1]);
    g.translate(at[0], y, at[1]);
    return g;
  });
  return mergeAll(parts);
}

export interface DipLeadRowOptions {
  /** X of each lead in the row. */
  xs: number[];
  /** Front (+Z) or back (−Z) row. */
  side: 1 | -1;
  /** Z where the lead leaves the body (positive). */
  edge: number;
  /** Row spacing (centre to centre, mm). */
  row: number;
  /** Height of the lead-frame plane where the leads leave the body. */
  frameY: number;
  /** Seating plane (end of the wide shoulder). */
  seat: number;
  thickness: number;
  shoulder: number;
  pin: number;
}

/**
 * A row of tinned DIP leads (JEDEC MS-001 style): shoulder bent down from the
 * parting line, then the narrow pin with its pointed tip at y = 0.
 */
export function dipLeadRow(o: DipLeadRowOptions): BufferGeometry {
  const shoulder = bentStrip(
    [
      [o.edge, o.frameY],
      [o.row / 2, o.frameY],
      [o.row / 2, o.seat],
    ],
    o.thickness,
    o.shoulder,
    0.35,
  );
  shoulder.rotateY(-Math.PI / 2);
  const half = o.shoulder / 2;
  const w = o.pin / 2;
  const outline: Pt[] = [
    [-half, o.seat],
    [-half, o.seat - 0.12],
    [-w, o.seat - 0.55],
    [-w, 0.3],
    [-w / 2, 0],
    [w / 2, 0],
    [w, 0.3],
    [w, o.seat - 0.55],
    [half, o.seat - 0.12],
    [half, o.seat],
  ];
  const pin = extrudeOutline(outline, o.thickness);
  pin.translate(0, 0, o.row / 2);
  const one = mergeAll([shoulder, pin]);
  const all = mergeAt(
    one,
    o.xs.map((x) => placed([x, 0, 0], o.side === 1 ? [0, 0, 0] : [0, Math.PI, 0])),
  );
  one.dispose();
  return all;
}

export interface SlabOptions {
  /** Face size: X from −width/2 to width/2, Y from 0 to height. */
  width: number;
  height: number;
  /** Thickness along Z, centred on z = 0. */
  thickness: number;
  /** Radius of the corners of the face. */
  radius: number;
  /** 45° chamfer of the top-left corner (polarity mark), 0 for none. */
  chamfer?: number;
  /** Rounded edge all round the faces. */
  bevel?: number;
  /** Round through hole (centre and radius on the face). */
  hole?: { x: number; y: number; r: number };
}

function slabShape(w: number, h: number, r: number, c: number, i: number): Shape {
  const x0 = -w / 2 + i;
  const x1 = w / 2 - i;
  const y0 = i;
  const y1 = h - i;
  const rr = Math.max(r - i, 0.05);
  // A 45° chamfer offset inwards by i keeps its angle; its legs shrink by 0,586 i.
  const cc = Math.max(c - 0.586 * i, 0.05);
  const s = new Shape();
  s.moveTo(x0 + rr, y0);
  s.lineTo(x1 - rr, y0);
  s.absarc(x1 - rr, y0 + rr, rr, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - rr);
  s.absarc(x1 - rr, y1 - rr, rr, 0, Math.PI / 2, false);
  if (c > 0) {
    s.lineTo(x0 + cc, y1);
    s.lineTo(x0, y1 - cc);
  } else {
    s.lineTo(x0 + rr, y1);
    s.absarc(x0 + rr, y1 - rr, rr, Math.PI / 2, Math.PI, false);
  }
  s.lineTo(x0, y0 + rr);
  s.absarc(x0 + rr, y0 + rr, rr, Math.PI, Math.PI * 1.5, false);
  return s;
}

/**
 * Moulded slab of in-line packages (KBP, GBU), standing on its bottom edge
 * with the face towards +Z. Groups: 0 = back and edges, 1 = front face with
 * UVs spanning width × height (V = 1 at the top), for the printed marking.
 */
export function inlineSlab(o: SlabOptions): BufferGeometry {
  const { width: W, height: H, thickness: T, radius, chamfer = 0, bevel = 0.3, hole } = o;
  const b = Math.max(Math.min(bevel, T / 2 - 0.05, radius * 0.95), 0.01);
  const shape = slabShape(W, H, radius, chamfer, b);
  if (hole) {
    const path = new Path();
    path.absarc(hole.x, hole.y, hole.r + b, 0, Math.PI * 2, true);
    shape.holes.push(path);
  }
  const g = new ExtrudeGeometry(shape, {
    depth: Math.max(T - 2 * b, 0.01),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments: 10,
  });
  g.translate(0, 0, -T / 2 + b);
  // ExtrudeGeometry: group 0 = back lid then front lid (same size), group 1 = sides.
  const [lids, sides] = g.groups;
  if (lids && sides) {
    const half = lids.count / 2;
    g.clearGroups();
    g.addGroup(lids.start, half, 0);
    g.addGroup(lids.start + half, half, 1);
    g.addGroup(sides.start, sides.count, 0);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    for (let k = lids.start + half; k < lids.start + lids.count; k++) {
      uv.setXY(k, (pos.getX(k) + W / 2) / W, pos.getY(k) / H);
    }
    uv.needsUpdate = true;
  }
  toCreasedNormals(g, Math.PI / 4.5);
  return g;
}
