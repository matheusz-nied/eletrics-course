/**
 * Camera framing math, kept free of React and WebGL so it can be unit-tested.
 */
import { Box3, InstancedMesh, Mesh, Vector3, type Object3D, type Plane } from 'three';

const UP = new Vector3(0, 1, 0);

/**
 * Camera distance (from `center`, along `dir`) at which every corner of the
 * box fits the view, for a perspective camera with vertical `fov` (degrees).
 * Long thin parts get framed by their silhouette, not by a bounding sphere.
 */
export function fitDistance(
  box: Box3,
  center: Vector3,
  dir: Vector3,
  fov: number,
  aspect: number,
): number {
  const tanV = Math.tan((fov * Math.PI) / 360);
  const tanH = tanV * aspect;
  const forward = dir.clone().normalize();
  const right = new Vector3().crossVectors(UP, forward);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  right.normalize();
  const up = new Vector3().crossVectors(forward, right);
  const corner = new Vector3();
  let distance = 0;
  for (let i = 0; i < 8; i++) {
    corner
      .set(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      )
      .sub(center);
    const depth = corner.dot(forward);
    distance = Math.max(
      distance,
      depth + Math.abs(corner.dot(right)) / tanH,
      depth + Math.abs(corner.dot(up)) / tanV,
    );
  }
  return Math.max(distance, 1e-3);
}

const part = new Box3();

/**
 * Bounding box of the meshes that are drawn: unlike `Box3.setFromObject`, it
 * skips hidden objects (an inner piece shown only in the exploded view, a
 * magnet that appears with a prop) and materials turned off.
 */
export function visibleBounds(root: Object3D, target: Box3): Box3 {
  target.makeEmpty();
  root.updateWorldMatrix(true, true);
  root.traverseVisible((object) => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (!materials.some((m) => m?.visible !== false)) return;
    if (object instanceof InstancedMesh) {
      if (object.count === 0) return;
      object.computeBoundingBox();
      part.copy(object.boundingBox!);
    } else {
      const geometry = object.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      part.copy(geometry.boundingBox!);
    }
    if (part.isEmpty()) return;
    part.applyMatrix4(object.matrixWorld);
    // Keep only what an axis-aligned cutaway plane leaves.
    for (const m of materials) for (const plane of m?.clippingPlanes ?? []) clipBox(part, plane);
    if (!part.isEmpty()) target.union(part);
  });
  return target;
}

/** Shrinks a box to the side of an axis-aligned plane that stays drawn (n·p + c ≥ 0). */
function clipBox(box: Box3, plane: Plane) {
  const { normal: n, constant: c } = plane;
  const axes = ['x', 'y', 'z'] as const;
  const axis = axes.find((a) => Math.abs(n[a]) > 0.999);
  if (!axis) return;
  const limit = -c / n[axis];
  if (n[axis] > 0) box.min[axis] = Math.max(box.min[axis], limit);
  else box.max[axis] = Math.min(box.max[axis], limit);
}
