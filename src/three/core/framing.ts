/**
 * Camera framing math, kept free of React and WebGL so it can be unit-tested.
 */
import { Vector3, type Box3 } from 'three';

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
