/* eslint-disable react-hooks/immutability -- three.js objects (materials, uniforms, geometries) are mutated every frame; the React Compiler is not used. */
/**
 * Static batching for the gate control board (`gate-control-board.tsx`):
 * the board reuses the kit's real parts (relay, terminals, LEDs…), which are
 * drawn with dozens of meshes each. Here they render hidden, and their
 * meshes are baked into one merged mesh per material, so the whole board
 * costs a few dozen draw calls.
 *
 * - `<BakeLayer>`: a group of parts that lifts together in the exploded
 *   view. The lift happens in the vertex shader (per-vertex offset and
 *   delay), so every layer shares the same merged meshes.
 * - `<BakeBlock id>`: marks the parts of a functional block, which
 *   `highlight` keeps in colour while the rest is desaturated and dimmed.
 * - `<BakePart>`: one placed part. Pieces hidden inside its shells (the
 *   materials that the cutaway opens) are dropped unless the cut plane
 *   passes through the part, when its insides become visible.
 *
 * The hidden sources keep working: when a part changes (a relay armature
 * moving, an LED turning on, a DIP lever), only that layer is baked again.
 */
import { useFrame, useThree } from '@react-three/fiber';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Box3,
  BufferAttribute,
  CanvasTexture,
  BufferGeometry,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  FrontSide,
  InstancedMesh,
  LatheGeometry,
  Matrix3,
  Matrix4,
  Mesh,
  TubeGeometry,
  Vector3,
  type Group,
  type Material as ThreeMaterial,
  type Object3D,
  type Side,
  type Texture,
} from 'three';
import { easeInOut } from '../core/motion';
import { useQuality, type QualityLevel } from '../core/quality';
import { Explode, ViewProvider, useView } from '../core/view';
import type { Vec3 } from '../types';

interface Bucket {
  /** A source material: cloned for the merged mesh. */
  source: ThreeMaterial;
  clip: boolean;
  renderOrder: number;
  position: number[];
  normal: number[];
  uv: number[];
  block: number[];
  color: number[];
  emissive: number[];
  index: number[];
}

interface LayerState {
  root: Group;
  lift: Vec3;
  delay: number;
  key: string;
  buckets: Map<string, Bucket> | null;
  box: Box3;
}

interface BatchApi {
  register: (id: number, root: Group, lift: Vec3, delay: number) => void;
  unregister: (id: number) => void;
  blocks: string[];
}

/** Share of the segments of round bodies kept at each quality level. */
const DETAIL: Record<QualityLevel, number> = { alta: 1, media: 0.6, baixa: 0.4 };

const BatchContext = createContext<BatchApi | null>(null);

/** Far-away plane: the sources are always "cut" (so clipped shells can be told apart) but nothing is removed. */
const NO_CUT_NORMAL: Vec3 = [0, 0, -1];
const NO_CUT_THROUGH: Vec3 = [0, 0, 1e5];

const TEXTURE_KEYS = [
  'map',
  'roughnessMap',
  'metalnessMap',
  'bumpMap',
  'normalMap',
  'alphaMap',
  'emissiveMap',
  'clearcoatMap',
  'clearcoatRoughnessMap',
] as const;
const NUMBER_KEYS = [
  'emissiveIntensity',
  'roughness',
  'metalness',
  'clearcoat',
  'clearcoatRoughness',
  'transmission',
  'thickness',
  'ior',
  'opacity',
  'alphaTest',
  'sheen',
  'sheenRoughness',
  'specularIntensity',
  'bumpScale',
  'envMapIntensity',
  'attenuationDistance',
  'iridescence',
  'polygonOffsetFactor',
] as const;
const COLOR_KEYS = [
  'color',
  'emissive',
  'attenuationColor',
  'specularColor',
  'sheenColor',
] as const;
const FLAG_KEYS = [
  'transparent',
  'depthWrite',
  'depthTest',
  'flatShading',
  'polygonOffset',
] as const;

function signature(m: ThreeMaterial): string {
  const r = m as unknown as Record<string, unknown>;
  let s = m.type;
  for (const k of COLOR_KEYS) {
    const c = r[k] as Color | undefined;
    if (c?.isColor) s += `|${c.getHexString()}`;
  }
  for (const k of NUMBER_KEYS) {
    const v = r[k];
    if (typeof v === 'number') s += `|${Math.round(v * 1000)}`;
  }
  for (const k of FLAG_KEYS) s += r[k] ? '1' : '0';
  for (const k of TEXTURE_KEYS) {
    const t = r[k] as { uuid?: string; version?: number } | null | undefined;
    if (t?.uuid) s += `|${k}:${t.uuid}@${t.version}`;
  }
  if (!clipped(m)) s += `|side${m.side}`;
  return s;
}

const clipped = (m: ThreeMaterial) => (m.clippingPlanes?.length ?? 0) > 0;

const q = (value: unknown, step: number) =>
  typeof value === 'number' ? Math.round(value / step) : 'x';

/**
 * Which merged mesh a piece goes to: the material without its colours (they
 * become vertex colours) and with close values rounded together, so parts
 * that only differ in colour share one draw call.
 */
function bucketKey(m: ThreeMaterial, renderOrder: number): string {
  const r = m as unknown as Record<string, unknown>;
  const transmission = Number(r.transmission ?? 0);
  let s = `${m.type}|r${q(r.roughness, 0.1)}|m${q(r.metalness, 0.5)}|c${q(r.clearcoat, 0.5)}`;
  s += `|t${q(transmission, 0.05)}|o${q(m.opacity, 0.05)}|s${q(r.sheen, 0.5)}|si${q(r.specularIntensity, 0.25)}`;
  if (transmission > 0) {
    s += `|th${q(r.thickness, 1)}|ad${q(r.attenuationDistance, 1)}`;
    const a = r.attenuationColor as Color | undefined;
    if (a?.isColor) s += `|${a.getHexString()}`;
  }
  for (const k of FLAG_KEYS) s += r[k] ? '1' : '0';
  s += `|po${m.polygonOffsetFactor}|at${m.alphaTest}|ro${renderOrder}`;
  for (const k of TEXTURE_KEYS) {
    const t = r[k] as { uuid?: string; version?: number } | null | undefined;
    if (t?.uuid) s += `|${k}:${t.uuid}@${t.version}`;
  }
  if (r.bumpMap) s += `|b${q(r.bumpScale, 0.1)}`;
  s += `|side${clipped(m) ? FrontSide : m.side}`;
  return s;
}

const linear = new Color();

/** Visible from the source root down (the root itself is hidden by the batch). */
function shown(object: Object3D, root: Object3D): boolean {
  for (let o: Object3D | null = object; o && o !== root; o = o.parent) if (!o.visible) return false;
  return true;
}

function materialsOf(mesh: Mesh): ThreeMaterial[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/** A cheap fingerprint of everything that changes the baked result. */
function fingerprint(root: Group, inverse: Matrix4, tmp: Matrix4): string {
  const parts: string[] = [];
  root.traverse((o) => {
    if (!(o instanceof Mesh) || !shown(o, root)) return;
    tmp.multiplyMatrices(inverse, o.matrixWorld);
    const e = tmp.elements;
    let m = '';
    for (let i = 0; i < 16; i++) if (i % 4 !== 3) m += `${Math.round(e[i]! * 500)},`;
    const mats = materialsOf(o)
      .map((x) => (x.visible ? `${x.uuid}:${signature(x)}` : 'off'))
      .join(';');
    const count = o instanceof InstancedMesh ? o.count : 1;
    parts.push(`${o.id}/${o.geometry.id}/${count}/${m}/${mats}`);
  });
  return parts.join('\n');
}

interface Piece {
  mesh: Mesh;
  geometry: BufferGeometry;
  matrix: Matrix4;
  start: number;
  count: number;
  material: ThreeMaterial;
  block: number;
  part: Object3D | null;
}

const v = new Vector3();
const n = new Vector3();
const normalMatrix = new Matrix3();

function boxOf(piece: Piece, target: Box3): Box3 {
  const geometry = piece.geometry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  return target.copy(geometry.boundingBox!).applyMatrix4(piece.matrix);
}

const SIMPLE = new WeakMap<BufferGeometry, Map<number, BufferGeometry>>();

const near = (a: BufferAttribute, b: BufferAttribute, i: number, size: number) => {
  for (let k = 0; k < size; k++)
    if (Math.abs(a.array[i * size + k]! - b.array[i * size + k]!) > 1e-4) return false;
  return true;
};

const pa = new Vector3();
const pb = new Vector3();
const pc = new Vector3();

/**
 * The affine transform that takes `fresh` (rebuilt from the same
 * parameters, so with the same vertex order) to `g`, or null when the part
 * reshaped the geometry some other way after building it.
 */
function transformFrom(g: BufferGeometry, fresh: BufferGeometry): Matrix4 | null {
  const a = g.attributes.position as BufferAttribute | undefined;
  const b = fresh.attributes.position as BufferAttribute | undefined;
  const na = g.attributes.normal as BufferAttribute | undefined;
  const nb = fresh.attributes.normal as BufferAttribute | undefined;
  if (!a || !b || !na || !nb || a.count !== b.count || a.count < 4) return null;
  // Four vertices of `fresh` spanning a tetrahedron.
  const at = (i: number, t: Vector3) => t.fromBufferAttribute(b, i);
  const p0 = at(0, new Vector3());
  let best = -1;
  let bestD = 1e-6;
  for (let i = 0; i < b.count; i++) {
    const d = at(i, pa).distanceToSquared(p0);
    if (d > bestD) [best, bestD] = [i, d];
  }
  if (best < 0) return null;
  const ids = [0, best];
  const axis = at(best, new Vector3()).sub(p0).normalize();
  best = -1;
  bestD = 1e-6;
  for (let i = 0; i < b.count; i++) {
    at(i, pa).sub(p0);
    const d = pa.sub(pc.copy(axis).multiplyScalar(pa.dot(axis))).lengthSq();
    if (d > bestD) [best, bestD] = [i, d];
  }
  if (best < 0) return null;
  ids.push(best);
  const normal = at(ids[1]!, new Vector3()).sub(p0).cross(at(best, pb).sub(p0)).normalize();
  best = -1;
  bestD = 1e-4;
  for (let i = 0; i < b.count; i++) {
    const d = Math.abs(at(i, pa).sub(p0).dot(normal));
    if (d > bestD) [best, bestD] = [i, d];
  }
  if (best < 0) return null;
  ids.push(best);
  const from = new Matrix4();
  const to = new Matrix4();
  const e = from.elements;
  const f = to.elements;
  ids.forEach((id, c) => {
    e[c * 4] = b.getX(id);
    e[c * 4 + 1] = b.getY(id);
    e[c * 4 + 2] = b.getZ(id);
    e[c * 4 + 3] = 1;
    f[c * 4] = a.getX(id);
    f[c * 4 + 1] = a.getY(id);
    f[c * 4 + 2] = a.getZ(id);
    f[c * 4 + 3] = 1;
  });
  if (Math.abs(from.determinant()) < 1e-9) return null;
  const m = to.multiply(from.invert());
  // Check a sample of the vertices and normals.
  const nm = new Matrix3().getNormalMatrix(m);
  const step = Math.max(1, Math.floor(a.count / 24));
  for (let i = 0; i < a.count; i += step) {
    if (at(i, pa).applyMatrix4(m).distanceTo(pb.fromBufferAttribute(a, i)) > 1e-3) return null;
    pa.fromBufferAttribute(nb, i).applyMatrix3(nm).normalize();
    if (pa.distanceTo(pb.fromBufferAttribute(na, i)) > 1e-2) return null;
  }
  return m;
}

/** Whether `g` keeps the texture coordinates of `fresh`, or has them set by height (`axialLathe`). */
function uvKind(g: BufferGeometry, fresh: BufferGeometry): 'same' | 'height' | null {
  const a = g.attributes.uv as BufferAttribute | undefined;
  const b = fresh.attributes.uv as BufferAttribute | undefined;
  if (!a || !b || a.count !== b.count) return null;
  const step = Math.max(1, Math.floor(a.count / 24));
  for (let i = 0; i < a.count; i += step) if (!near(a, b, i, 2)) return 'height';
  return 'same';
}

/** Sets v from the height in the profile, as `axialLathe` does; false when `g` does not match that. */
function heightUv(g: LatheGeometry, fresh: BufferGeometry, low: BufferGeometry): boolean {
  const ys = g.parameters.points.map((p) => p.y);
  const min = Math.min(...ys);
  const span = Math.max(...ys) - min || 1;
  const a = g.attributes.uv!;
  const fp = fresh.attributes.position!;
  const fine = [0, 1, Math.floor(a.count / 2), a.count - 1].every(
    (i) => Math.abs(a.getY(i) - (fp.getY(i) - min) / span) < 1e-4,
  );
  if (!fine) return false;
  const pos = low.attributes.position!;
  const uv = low.attributes.uv!;
  for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) - min) / span);
  return true;
}

/**
 * Lathes, tubes and extrusions rebuilt with fewer segments (the low quality
 * levels): the kit's parts are drawn for close-ups, and on a whole board
 * their round bodies can do with far fewer facets. Geometries that a part
 * reshaped after building (other than moving, turning or scaling them) are
 * kept as they are.
 */
function simplified(g: BufferGeometry, detail: number): BufferGeometry {
  if (detail >= 1) return g;
  const cache = SIMPLE.get(g) ?? new Map<number, BufferGeometry>();
  SIMPLE.set(g, cache);
  const hit = cache.get(detail);
  if (hit) return hit;
  let out = g;
  let fresh: BufferGeometry | null = null;
  let low: BufferGeometry | null = null;
  if (g instanceof LatheGeometry) {
    const { points, segments, phiStart, phiLength } = g.parameters;
    const fewer = Math.max(12, Math.round(segments * detail));
    if (fewer < segments) {
      fresh = new LatheGeometry(points, segments, phiStart, phiLength);
      low = new LatheGeometry(points, fewer, phiStart, phiLength);
    }
  } else if (g instanceof TubeGeometry) {
    const { path, tubularSegments, radius, radialSegments, closed } = g.parameters;
    const radial = Math.min(radialSegments, Math.max(5, Math.round(radialSegments * detail)));
    const tubular = Math.max(6, Math.round(tubularSegments * Math.min(1, detail * 1.5)));
    if (radial < radialSegments || tubular < tubularSegments) {
      fresh = new TubeGeometry(path, tubularSegments, radius, radialSegments, closed);
      low = new TubeGeometry(path, tubular, radius, radial, closed);
    }
  } else if (g instanceof ExtrudeGeometry) {
    const { shapes, options } = g.parameters;
    const curve = options.curveSegments ?? 12;
    const bevel = options.bevelSegments ?? 3;
    const curveLow = Math.min(curve, Math.max(4, Math.round(curve * detail)));
    const bevelLow = Math.min(bevel, Math.max(1, Math.round(bevel * detail * 1.5)));
    if (curveLow < curve || bevelLow < bevel) {
      fresh = new ExtrudeGeometry(shapes, options);
      low = new ExtrudeGeometry(shapes, {
        ...options,
        curveSegments: curveLow,
        bevelSegments: bevelLow,
      });
    }
  }
  if (fresh && low) {
    const m = transformFrom(g, fresh);
    const uv = m ? uvKind(g, fresh) : null;
    const ok =
      uv === 'same' || (uv === 'height' && g instanceof LatheGeometry && heightUv(g, fresh, low));
    if (m && ok) out = low.applyMatrix4(m);
    fresh.dispose();
    if (out !== low) low.dispose();
  }
  cache.set(detail, out);
  return out;
}

/** Bakes one layer: every visible mesh piece, transformed into layer space, sorted by material. */
function bakeLayer(
  root: Group,
  blocks: string[],
  keepInside: (box: Box3) => boolean,
  detail: number,
): Map<string, Bucket> {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const pieces: Piece[] = [];
  root.traverse((o) => {
    if (!(o instanceof Mesh) || !shown(o, root)) return;
    let block = -1;
    let part: Object3D | null = null;
    for (let p: Object3D | null = o; p && p !== root; p = p.parent) {
      if (part === null && p.userData.gatePart) part = p;
      if (block < 0 && typeof p.userData.gateBlock === 'string')
        block = blocks.indexOf(p.userData.gateBlock as string);
    }
    const base = new Matrix4().multiplyMatrices(inverse, o.matrixWorld);
    const matrices: Matrix4[] = [];
    if (o instanceof InstancedMesh) {
      const im = new Matrix4();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, im);
        matrices.push(new Matrix4().multiplyMatrices(base, im));
      }
    } else matrices.push(base);
    const multi = Array.isArray(o.material) && o.geometry.groups.length > 0;
    const geometry = multi ? o.geometry : simplified(o.geometry, detail);
    const total = geometry.index
      ? geometry.index.count
      : (geometry.attributes.position?.count ?? 0);
    const mats = materialsOf(o);
    const groups = multi ? geometry.groups : [{ start: 0, count: total, materialIndex: 0 }];
    for (const matrix of matrices) {
      for (const g of groups) {
        const material = mats[g.materialIndex ?? 0];
        if (!material || !material.visible) continue;
        const count = Math.min(g.count, total - g.start);
        if (count <= 0) continue;
        pieces.push({ mesh: o, geometry, matrix, start: g.start, count, material, block, part });
      }
    }
  });

  // Shells of each part: opaque pieces that the cutaway opens. Pieces deep
  // inside a shell are hidden (and dropped) unless the cut opens the part.
  const partBoxes = new Map<Object3D, Box3>();
  const shells: { piece: Piece; box: Box3 }[] = [];
  const pieceBox = new Map<Piece, Box3>();
  for (const piece of pieces) {
    const box = boxOf(piece, new Box3());
    pieceBox.set(piece, box);
    if (!piece.part) continue;
    const whole = partBoxes.get(piece.part) ?? new Box3();
    partBoxes.set(piece.part, whole.union(box));
    const r = piece.material as unknown as { transmission?: number };
    if (clipped(piece.material) && !piece.material.transparent && !r.transmission)
      shells.push({ piece, box });
  }
  const DEPTH = 1.5;
  const inside = (piece: Piece) => {
    if (!piece.part || piece.part.userData.gateKeepInside) return false;
    const b = pieceBox.get(piece)!;
    return shells.some(
      ({ piece: s, box }) =>
        s !== piece &&
        s.part === piece.part &&
        b.min.x >= box.min.x - 0.05 &&
        b.max.x <= box.max.x + 0.05 &&
        b.min.z >= box.min.z - 0.05 &&
        b.max.z <= box.max.z + 0.05 &&
        b.min.y >= box.min.y - 0.05 &&
        b.max.y <= box.max.y - DEPTH &&
        (b.max.x - b.min.x) * (b.max.z - b.min.z) <
          (box.max.x - box.min.x) * (box.max.z - box.min.z),
    );
  };
  // Parts can drop whatever is above a height (in the part's own space).
  const partSpace = new Map<Object3D, Matrix4>();
  const above = (piece: Piece) => {
    const limit = piece.part?.userData.gateDropAbove as number | undefined;
    if (limit === undefined) return false;
    let m = partSpace.get(piece.part!);
    if (!m) {
      m = new Matrix4().multiplyMatrices(inverse, piece.part!.matrixWorld).invert();
      partSpace.set(piece.part!, m);
    }
    return box.copy(pieceBox.get(piece)!).applyMatrix4(m).min.y > limit;
  };
  const box = new Box3();

  const buckets = new Map<string, Bucket>();
  for (const piece of pieces) {
    if (above(piece)) continue;
    if (inside(piece) && !keepInside(partBoxes.get(piece.part!)!)) continue;
    const key = bucketKey(piece.material, piece.mesh.renderOrder);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        source: piece.material,
        clip: clipped(piece.material),
        renderOrder: piece.mesh.renderOrder,
        position: [],
        normal: [],
        uv: [],
        block: [],
        color: [],
        emissive: [],
        index: [],
      };
      buckets.set(key, bucket);
    }
    append(bucket, piece);
  }
  return buckets;
}

function append(bucket: Bucket, piece: Piece) {
  const geometry = piece.geometry;
  const pos = geometry.attributes.position;
  if (!pos) return;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const nor = geometry.attributes.normal!;
  const uv = geometry.attributes.uv;
  const index = geometry.index;
  normalMatrix.getNormalMatrix(piece.matrix);
  const mr = piece.material as unknown as {
    color?: Color;
    emissive?: Color;
    emissiveIntensity?: number;
  };
  const color = mr.color?.isColor ? mr.color : linear.setRGB(1, 1, 1);
  const [cr, cg, cb] = [color.r, color.g, color.b];
  const glow = mr.emissiveIntensity ?? 1;
  const [er, eg, eb] = mr.emissive?.isColor
    ? [mr.emissive.r * glow, mr.emissive.g * glow, mr.emissive.b * glow]
    : [0, 0, 0];
  const flip = piece.matrix.determinant() < 0;

  // Only the vertices this piece's triangles use.
  const remap = new Map<number, number>();
  const base = bucket.position.length / 3;
  const take = (i: number) => {
    let j = remap.get(i);
    if (j !== undefined) return j;
    j = base + remap.size;
    remap.set(i, j);
    v.fromBufferAttribute(pos, i).applyMatrix4(piece.matrix);
    n.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
    bucket.position.push(v.x, v.y, v.z);
    bucket.normal.push(n.x, n.y, n.z);
    if (uv) bucket.uv.push(uv.getX(i), uv.getY(i));
    else bucket.uv.push(0, 0);
    bucket.block.push(piece.block);
    bucket.color.push(cr, cg, cb);
    bucket.emissive.push(er, eg, eb);
    return j;
  };
  for (let k = piece.start; k + 2 < piece.start + piece.count + 0; k += 3) {
    const a = index ? index.getX(k) : k;
    const b = index ? index.getX(k + 1) : k + 1;
    const c = index ? index.getX(k + 2) : k + 2;
    const ia = take(a);
    const ib = take(b);
    const ic = take(c);
    if (flip) bucket.index.push(ia, ic, ib);
    else bucket.index.push(ia, ib, ic);
  }
}

interface Merged {
  key: string;
  geometry: BufferGeometry;
  material: ThreeMaterial;
  renderOrder: number;
  /** Per-layer bounds, to keep the framing right while the layers lift. */
  layers: { box: Box3; lift: Vec3; delay: number }[];
  blocks: Float32Array;
}

interface SharedUniforms {
  uExplode: { value: number };
}

/**
 * A smaller copy of a drawn texture (labels, printed sleeves): on a whole
 * board the parts' close-up textures are far sharper than the screen shows.
 */
function scaledTexture(texture: Texture, scale: number): Texture | null {
  const image = texture.image as CanvasImageSource & { width?: number; height?: number };
  const drawable =
    (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) ||
    (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) ||
    (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap);
  const w = Number(image?.width ?? 0);
  const h = Number(image?.height ?? 0);
  if (!drawable || Math.max(w, h) <= 256) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const copy = new CanvasTexture(canvas);
  copy.colorSpace = texture.colorSpace;
  copy.wrapS = texture.wrapS;
  copy.wrapT = texture.wrapT;
  copy.repeat.copy(texture.repeat);
  copy.offset.copy(texture.offset);
  copy.rotation = texture.rotation;
  copy.center.copy(texture.center);
  copy.flipY = texture.flipY;
  copy.anisotropy = texture.anisotropy;
  copy.magFilter = texture.magFilter;
  copy.minFilter = texture.minFilter;
  copy.generateMipmaps = texture.generateMipmaps;
  copy.premultiplyAlpha = texture.premultiplyAlpha;
  copy.matrixAutoUpdate = texture.matrixAutoUpdate;
  if (!texture.matrixAutoUpdate) copy.matrix.copy(texture.matrix);
  return copy;
}

function disposeMaterial(m: ThreeMaterial) {
  for (const t of (m.userData.owned as Texture[] | undefined) ?? []) t.dispose();
  m.dispose();
}

function patchMaterial(
  source: ThreeMaterial,
  clip: boolean,
  shared: SharedUniforms,
  textureScale: number,
): ThreeMaterial & { userData: { cut: { value: number }; baseSide: Side; clip: boolean } } {
  const m = source.clone() as ThreeMaterial & {
    color?: Color;
    emissive?: Color;
    emissiveIntensity?: number;
  };
  const owned: Texture[] = [];
  if (textureScale < 1) {
    const slots = m as unknown as Record<string, Texture | null | undefined>;
    for (const k of TEXTURE_KEYS) {
      const t = slots[k];
      if (!t?.isTexture) continue;
      const copy = scaledTexture(t, textureScale);
      if (!copy) continue;
      slots[k] = copy;
      owned.push(copy);
    }
  }
  // Colours come per vertex (several parts share this material).
  m.color?.set(0xffffff);
  m.emissive?.set(0x000000);
  m.emissiveIntensity = 1;
  m.vertexColors = true;
  const cut = { value: 0 };
  m.clippingPlanes = null;
  m.side = clip ? FrontSide : source.side;
  m.userData = { cut, baseSide: m.side, clip, owned };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uExplode = shared.uExplode;
    shader.uniforms.uCutOn = cut;
    shader.vertexShader =
      `attribute vec3 aLift;\nattribute float aDelay;\nattribute float aDim;\nattribute vec3 aEmissive;\nuniform float uExplode;\nvarying float vDim;\nvarying vec3 vEmissive;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  float gateT = clamp((uExplode - aDelay) / (1.0 - aDelay), 0.0, 1.0);
  transformed += aLift * (gateT * gateT * (3.0 - 2.0 * gateT));
  vDim = aDim;
  vEmissive = aEmissive;`,
      );
    shader.fragmentShader =
      `uniform float uCutOn;\nvarying float vDim;\nvarying vec3 vEmissive;\n${shader.fragmentShader}`
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
  float gateL = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.18 + gateL * 0.35), vDim * 0.82);`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.85, vDim * 0.6);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
  totalEmissiveRadiance = (totalEmissiveRadiance + vEmissive) * (1.0 - vDim * 0.85);`,
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
  if (!gl_FrontFacing && uCutOn > 0.5) gl_FragColor = vec4(mix(vColor.rgb * 0.55, vec3(0.18), vDim * 0.82), 1.0);`,
        );
  };
  m.customProgramCacheKey = () => 'gate-batch-v2';
  return m as ThreeMaterial & {
    userData: { cut: { value: number }; baseSide: Side; clip: boolean };
  };
}

/** Whether the plane through `through` with `normal` passes through a box: its insides show in the cut. */
function crossedBy(normal: Vec3, through: Vec3): (box: Box3) => boolean {
  const n = new Vector3(...normal).normalize();
  const d = n.dot(new Vector3(...through));
  const corner = new Vector3();
  return (box) => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 8; i++) {
      corner.set(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      );
      const s = n.dot(corner) - d;
      min = Math.min(min, s);
      max = Math.max(max, s);
    }
    return min < 0 && max > 0;
  };
}

const NO_HIGHLIGHT: string[] = [];

export interface BatchRootProps {
  /** Block ids, in a fixed order. */
  blocks: string[];
  /** The blocks that stay in colour; the others are dimmed. Empty: none dimmed. */
  highlight?: string[];
  /** Where the cutaway plane ends up (part space), to show the insides it opens. */
  cutNormal?: Vec3;
  cutThrough?: Vec3;
  children: ReactNode;
}

/** Owns the merged meshes and bakes the layers inside it. */
export function BatchRoot({
  blocks,
  highlight = NO_HIGHLIGHT,
  cutNormal = [0, 0, -1],
  cutThrough = [0, 0, 0],
  children,
}: BatchRootProps) {
  const { explode, cutaway, cutPlanes } = useView();
  const level = useQuality((s) => s.level);
  const detail = DETAIL[level];
  const invalidate = useThree((s) => s.invalidate);
  const layers = useRef(new Map<number, LayerState>());
  const [merged, setMerged] = useState<Merged[]>([]);
  /** The latest merged meshes (the state reaches the frame loop one render later). */
  const latest = useRef<Merged[]>([]);
  const shared = useMemo<SharedUniforms>(() => ({ uExplode: { value: 0 } }), []);
  const materials = useRef(new Map<string, ReturnType<typeof patchMaterial>>());
  const dirty = useRef(true);
  const tmp = useMemo(() => ({ inverse: new Matrix4(), m: new Matrix4(), box: new Box3() }), []);
  const lastExplode = useRef(-1);

  const [nx, ny, nz] = cutNormal;
  const [tx, ty, tz] = cutThrough;
  const keepInside = useMemo(
    () => (cutaway ? crossedBy([nx, ny, nz], [tx, ty, tz]) : () => false),
    [cutaway, nx, ny, nz, tx, ty, tz],
  );

  useEffect(() => {
    for (const layer of layers.current.values()) layer.key = '';
    dirty.current = true;
    invalidate();
  }, [keepInside, detail, invalidate]);

  const api = useMemo<BatchApi>(
    () => ({
      blocks,
      register: (id, root, lift, delay) => {
        layers.current.set(id, { root, lift, delay, key: '', buckets: null, box: new Box3() });
        dirty.current = true;
      },
      unregister: (id) => {
        layers.current.delete(id);
        dirty.current = true;
      },
    }),
    [blocks],
  );

  const rebuild = () => {
    const all = new Map<string, { bucket: Bucket; lift: Vec3; delay: number }[]>();
    for (const layer of layers.current.values()) {
      for (const [key, bucket] of layer.buckets ?? []) {
        const list = all.get(key) ?? [];
        list.push({ bucket, lift: layer.lift, delay: layer.delay });
        all.set(key, list);
      }
    }
    const out: Merged[] = [];
    const used = new Set<string>();
    for (const [key, list] of all) {
      let vertices = 0;
      let indices = 0;
      for (const { bucket } of list) {
        vertices += bucket.position.length / 3;
        indices += bucket.index.length;
      }
      if (indices === 0) continue;
      const position = new Float32Array(vertices * 3);
      const normal = new Float32Array(vertices * 3);
      const uv = new Float32Array(vertices * 2);
      const lift = new Float32Array(vertices * 3);
      const delay = new Float32Array(vertices);
      const blockIds = new Float32Array(vertices);
      const colors = new Float32Array(vertices * 3);
      const emissive = new Float32Array(vertices * 3);
      const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
      let vo = 0;
      let io = 0;
      const boxes: Merged['layers'] = [];
      for (const { bucket, lift: l, delay: d } of list) {
        const count = bucket.position.length / 3;
        position.set(bucket.position, vo * 3);
        normal.set(bucket.normal, vo * 3);
        uv.set(bucket.uv, vo * 2);
        blockIds.set(bucket.block, vo);
        colors.set(bucket.color, vo * 3);
        emissive.set(bucket.emissive, vo * 3);
        for (let i = 0; i < count; i++) {
          lift[(vo + i) * 3] = l[0];
          lift[(vo + i) * 3 + 1] = l[1];
          lift[(vo + i) * 3 + 2] = l[2];
          delay[vo + i] = d;
        }
        // Indices were stored relative to the bucket's own vertices.
        for (let i = 0; i < bucket.index.length; i++) index[io + i] = bucket.index[i]! + vo;
        const box = new Box3();
        for (let i = 0; i < count; i++)
          box.expandByPoint(
            v.set(
              bucket.position[i * 3]!,
              bucket.position[i * 3 + 1]!,
              bucket.position[i * 3 + 2]!,
            ),
          );
        boxes.push({ box, lift: l, delay: d });
        vo += count;
        io += bucket.index.length;
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(position, 3));
      geometry.setAttribute('normal', new BufferAttribute(normal, 3));
      geometry.setAttribute('uv', new BufferAttribute(uv, 2));
      geometry.setAttribute('aLift', new BufferAttribute(lift, 3));
      geometry.setAttribute('aDelay', new BufferAttribute(delay, 1));
      geometry.setAttribute('aDim', new BufferAttribute(new Float32Array(vertices), 1));
      geometry.setAttribute('color', new BufferAttribute(colors, 3));
      geometry.setAttribute('aEmissive', new BufferAttribute(emissive, 3));
      geometry.setIndex(new BufferAttribute(index, 1));
      geometry.boundingBox = new Box3();
      const first = list[0]!.bucket;
      // Per quality level: the textures are scaled with it.
      const materialKey = `${key}|${detail}`;
      let material = materials.current.get(materialKey);
      if (!material) {
        material = patchMaterial(first.source, first.clip, shared, detail < 1 ? 0.5 : 1);
        materials.current.set(materialKey, material);
      }
      used.add(materialKey);
      out.push({
        key,
        geometry,
        material,
        renderOrder: first.renderOrder,
        layers: boxes,
        blocks: blockIds,
      });
    }
    for (const [key, material] of materials.current) {
      if (used.has(key)) continue;
      disposeMaterial(material);
      materials.current.delete(key);
    }
    lastExplode.current = -1;
    latest.current = out;
    setMerged((previous) => {
      for (const m of previous) m.geometry.dispose();
      return out;
    });
  };

  const step = () => {
    let changed = dirty.current;
    dirty.current = false;
    for (const layer of layers.current.values()) {
      layer.root.updateWorldMatrix(true, true);
      tmp.inverse.copy(layer.root.matrixWorld).invert();
      const key = fingerprint(layer.root, tmp.inverse, tmp.m);
      if (key === layer.key && layer.buckets) continue;
      layer.key = key;
      layer.buckets = bakeLayer(layer.root, blocks, keepInside, detail);
      changed = true;
    }
    if (changed) {
      rebuild();
      // One more frame to see whether the sources settled.
      invalidate();
    }
    const f = explode.current ?? 0;
    shared.uExplode.value = f;
    if (f !== lastExplode.current) {
      lastExplode.current = f;
      for (const m of latest.current) {
        const target = m.geometry.boundingBox!.makeEmpty();
        for (const layer of m.layers) {
          const t = easeInOut(layer.delay > 0 ? (f - layer.delay) / (1 - layer.delay) : f);
          tmp.box.copy(layer.box).translate(v.set(...layer.lift).multiplyScalar(t));
          target.union(tmp.box);
        }
      }
    }
  };
  useFrame(step);
  // Bake once before the first frame, so the view frames the whole board from the start.
  const first = useRef(step);
  useLayoutEffect(() => first.current(), []);

  // Dim every block but the highlighted ones.
  const kept = highlight.join(' ');
  useLayoutEffect(() => {
    const targets = new Set(kept ? kept.split(' ').map((b) => blocks.indexOf(b)) : []);
    for (const m of merged) {
      const attr = m.geometry.attributes.aDim as BufferAttribute;
      const array = attr.array as Float32Array;
      for (let i = 0; i < array.length; i++)
        array[i] = targets.size > 0 && !targets.has(m.blocks[i]) ? 1 : 0;
      attr.needsUpdate = true;
    }
    invalidate();
  }, [merged, kept, blocks, invalidate]);

  // Cutaway: every merged material is cut (the board is shown in section).
  useLayoutEffect(() => {
    for (const m of merged) {
      const material = m.material as ReturnType<typeof patchMaterial>;
      material.clippingPlanes = cutaway ? cutPlanes : null;
      material.side = cutaway ? DoubleSide : material.userData.baseSide;
      material.userData.cut.value = cutaway ? 1 : 0;
      material.needsUpdate = true;
    }
    invalidate();
  }, [merged, cutaway, cutPlanes, invalidate]);

  useEffect(() => {
    const live = latest;
    const owned = materials;
    return () => {
      // R3F does not dispose geometry passed as a prop.
      for (const m of live.current) m.geometry.dispose();
      for (const material of owned.current.values()) disposeMaterial(material);
    };
  }, []);

  return (
    <BatchContext.Provider value={api}>
      {children}
      {merged.map((m) => (
        <mesh
          key={m.key + m.geometry.id}
          geometry={m.geometry}
          material={m.material}
          renderOrder={m.renderOrder}
          frustumCulled={false}
        />
      ))}
    </BatchContext.Provider>
  );
}

let nextLayer = 1;

export interface BakeLayerProps {
  /** Lift in the exploded view (mm). */
  lift: Vec3;
  /** Stagger: the layer starts moving after this fraction of the transition. */
  delay?: number;
  /** Parts to bake (rendered hidden). */
  children: ReactNode;
  /** Live objects that move with the layer: anchors, glow halos. */
  extras?: ReactNode;
}

/** A set of parts baked together and lifted together in the exploded view. */
export function BakeLayer({ lift, delay = 0, children, extras }: BakeLayerProps) {
  const api = useContext(BatchContext);
  const root = useRef<Group>(null);
  const [id] = useState(() => nextLayer++);
  const [lx, ly, lz] = lift;
  useLayoutEffect(() => {
    if (!api || !root.current) return;
    api.register(id, root.current, [lx, ly, lz], delay);
    return () => api.unregister(id);
  }, [api, id, lx, ly, lz, delay]);
  const offset = useMemo<Vec3>(() => [lx, ly, lz], [lx, ly, lz]);
  return (
    <Explode offset={offset} delay={delay}>
      <group ref={root} visible={false}>
        <ViewProvider cutaway cutNormal={NO_CUT_NORMAL} cutThrough={NO_CUT_THROUGH} instant>
          {children}
        </ViewProvider>
      </group>
      {extras}
    </Explode>
  );
}

/** Marks the parts of a functional block (for `highlight`). */
export function BakeBlock({ id, children }: { id: string; children: ReactNode }) {
  const userData = useMemo(() => ({ gateBlock: id }), [id]);
  return <group userData={userData}>{children}</group>;
}

export interface BakePartProps {
  position?: Vec3;
  rotation?: Vec3;
  scale?: number;
  /** Keep the pieces inside the shells (they show through openings). */
  keepInside?: boolean;
  /** Drop the pieces that start above this height in the part (a loose plug, say). */
  dropAbove?: number;
  children: ReactNode;
}

/** One placed part: its shells hide its insides unless the cut opens it. */
export function BakePart({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  keepInside = false,
  dropAbove,
  children,
}: BakePartProps) {
  const userData = useMemo(
    () => ({ gatePart: true, gateKeepInside: keepInside, gateDropAbove: dropAbove }),
    [keepInside, dropAbove],
  );
  return (
    <group position={position} rotation={rotation} scale={scale} userData={userData}>
      {children}
    </group>
  );
}
