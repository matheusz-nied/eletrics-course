/**
 * Brazilian 4 × 2" wall plate and its support frame (NBR 5410 installation
 * box), for switches and sockets: plate 73 × 116 mm with a rounded front
 * edge, support 66 × 108 mm with the two box screws 83,5 mm apart and the
 * window for one horizontal module (45 × 23 mm). Dimensions from typical
 * catalogues of Brazilian 4 × 2 lines (the same as `wall-push-button`).
 * Both face +Z, centred on the origin. Private to `parts/`.
 */
import { Path, Shape, ShapeGeometry, type BufferGeometry } from 'three';
import { addRoundedRect, extrudeAlongZ, mergeAll, roundedRectSweep } from './_em-geometry';

/** Wall plate (mm): width, height, skirt depth, front thickness, corner and edge radii, wall. */
export const PLATE = { W: 73, H: 116, D: 7, T: 2.2, r: 5, f: 2.4, wall: 1.6 };
/** One horizontal module: body and the key opening of the plate. */
export const MODULE_4X2 = { W: 45, H: 23 };
/** Box screws of the support (y, from the centre). */
export const BOX_SCREW_Y = 41.75;

/** Flat face with holes at height y, facing up or down (shells built along +Y). */
function face(shape: Shape, y: number, up: boolean): BufferGeometry {
  const g = new ShapeGeometry(shape, 8);
  g.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/**
 * The plate as a thin shell: skirt with a rounded front edge and a front
 * panel with the module opening (w × h). Built facing +Y, then turned to
 * face +Z; the back rim sits on z = 0 and the front at z = D.
 */
export function wallPlateGeometry(openW: number, openH: number, openR = 1.4): BufferGeometry {
  const { W, H, D, T, r, f, wall } = PLATE;
  const outer: [number, number][] = [[0, 0]];
  for (let i = 0; i <= 6; i++) {
    const a = (Math.PI / 2) * (i / 6);
    outer.push([-f + Math.cos(a) * f, D - f + Math.sin(a) * f]);
  }
  const opening = (path: Path) => addRoundedRect(path, openW, openH, openR, 0, 0, true);
  const front = new Shape();
  addRoundedRect(front, W - 2 * f, H - 2 * f, r - f);
  const h1 = new Path();
  opening(h1);
  front.holes.push(h1);
  const back = new Shape();
  addRoundedRect(back, W - 2 * wall, H - 2 * wall, r - wall);
  const h2 = new Path();
  opening(h2);
  back.holes.push(h2);
  const g = mergeAll([
    roundedRectSweep(W, H, r, outer),
    face(front, D, true),
    // Walls of the opening.
    roundedRectSweep(openW, openH, openR, [
      [0, D],
      [0, D - T],
    ]),
    face(back, D - T, false),
    roundedRectSweep(W, H, r, [
      [-wall, D - T],
      [-wall, 0],
    ]),
    roundedRectSweep(W, H, r, [
      [-wall, 0],
      [0, 0],
    ]),
  ]);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Support frame (1,6 mm, z from 0,4 to 2) with the module window and the screw slots. */
export function supportFrameGeometry(): BufferGeometry {
  const s = new Shape();
  addRoundedRect(s, 66, 108, 3);
  const window = new Path();
  addRoundedRect(window, MODULE_4X2.W + 1, MODULE_4X2.H + 1, 1, 0, 0, true);
  s.holes.push(window);
  for (const y of [-BOX_SCREW_Y, BOX_SCREW_Y]) {
    const slot = new Path();
    addRoundedRect(slot, 7.5, 3.8, 1.85, 0, y, true);
    s.holes.push(slot);
  }
  const g = extrudeAlongZ(s, 1.6, 0.3, { curveSegments: 6 });
  g.translate(0, 0, 1.2);
  return g;
}
