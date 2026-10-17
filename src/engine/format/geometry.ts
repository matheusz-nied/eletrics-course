import type { DeviceInfo, ElementDoc, Vec2 } from '../contract';

/**
 * Pin offset of an N-terminal device placed at `at`: mirrored horizontally
 * when `flip`, then rotated clockwise on screen (y grows downwards) by `rot`.
 */
export function transformOffset(offset: Vec2, rot: ElementDoc['rot'] = 0, flip = false): Vec2 {
  const x = flip ? -offset[0] : offset[0];
  const y = offset[1];
  switch (rot) {
    case 90:
      return [-y, x];
    case 180:
      return [-x, -y];
    case 270:
      return [y, -x];
    default:
      return [x, y];
  }
}

/** Grid position of every pin of an element, in `info.pins` order. Wires use their end points. */
export function pinPoints(el: ElementDoc, info: DeviceInfo): Vec2[] {
  if (info.terminals === 'two') {
    if (el.type === 'wire' && el.points && el.points.length >= 2) {
      return [el.points[0], el.points[el.points.length - 1]];
    }
    return [el.a ?? [0, 0], el.b ?? [0, 0]];
  }
  const at = el.at ?? [0, 0];
  return info.pins.map((pin) => {
    const [dx, dy] = transformOffset(pin.offset, el.rot, el.flip);
    return [at[0] + dx, at[1] + dy];
  });
}

/** Points of a wire's polyline (`points`, or `a`→`b`). */
export function wirePoints(el: ElementDoc): Vec2[] {
  if (el.points && el.points.length >= 2) return el.points;
  if (el.a && el.b) return [el.a, el.b];
  return [];
}

export const pointKey = (p: Vec2) => `${p[0]},${p[1]}`;
