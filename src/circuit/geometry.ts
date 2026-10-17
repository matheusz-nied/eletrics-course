/**
 * Grid geometry shared by the schematic and the stand-in engine.
 * Coordinates are grid units (1 unit = 10 px at zoom 1), y grows downwards.
 * `rot` turns clockwise on screen; `flip` mirrors x before rotating:
 * screen = at + rotate(rot, flip ? [-x, y] : [x, y]).
 */
import type { DeviceInfo, ElementDoc, ParamValue, Vec2 } from '../engine/contract';

export const GRID = 10;

export function rotate([x, y]: Vec2, rot: number): Vec2 {
  switch (((rot % 360) + 360) % 360) {
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

/** Local offset (rotation 0) → offset on the grid for an element with `rot`/`flip`. */
export function transformOffset(offset: Vec2, rot = 0, flip = false): Vec2 {
  const mirrored: Vec2 = flip ? [-offset[0], offset[1]] : offset;
  const [x, y] = rotate(mirrored, rot);
  // Avoid -0 so keys like "3,0" stay stable.
  return [x + 0, y + 0];
}

export function pointKey([x, y]: Vec2): string {
  return `${x},${y}`;
}

export function samePoint(a: Vec2, b: Vec2): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** Parameters of an element with the device defaults filled in. */
export function elementParams(
  el: ElementDoc,
  info: DeviceInfo | undefined,
): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  if (info) for (const [name, p] of Object.entries(info.params)) out[name] = p.default;
  return { ...out, ...el.params };
}

/** Grid position of each pin of an element ("a"/"b" for two-terminal devices). */
export function pinPositions(el: ElementDoc, info: DeviceInfo | undefined): Record<string, Vec2> {
  if (el.type === 'wire') return {};
  if (el.a && el.b) return { a: el.a, b: el.b };
  if (!info) return {};
  const at = el.at ?? [0, 0];
  const out: Record<string, Vec2> = {};
  for (const pin of info.pins) {
    const [dx, dy] = transformOffset(pin.offset, el.rot, el.flip);
    out[pin.name] = [at[0] + dx, at[1] + dy];
  }
  return out;
}

export function isTwoTerminal(el: ElementDoc): boolean {
  return !!(el.a && el.b);
}
