import { useEffect, useMemo, type ReactNode } from 'react';
import type { BufferGeometry, Texture } from 'three';
import { Material, type MaterialProps } from '../materials/Material';
import type { Vec3 } from '../types';
import { roundedPath, smoothPath, tube } from './geometry';

/**
 * Memoized geometry or texture, rebuilt when `deps` change (compared by
 * value, so plain objects and arrays are fine) and disposed when replaced or
 * when the component unmounts.
 */
export function useDisposable<T extends BufferGeometry | Texture>(
  factory: () => T,
  deps: unknown[],
): T {
  const key = JSON.stringify(deps);
  // `key` stands for the dependency values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => factory(), [key]);
  useEffect(() => () => value.dispose(), [value]);
  return value;
}

export interface WireProps {
  /** Corners of the path (mm). */
  points: Vec3[];
  /** Conductor radius (mm): 0,3 for a 1/4 W resistor lead, 0,5 for a header pin. */
  radius: number;
  /** Corner radius; `smooth` makes a spline through the points instead. */
  bend?: number;
  smooth?: boolean;
  radial?: number;
  material?: MaterialProps;
  children?: ReactNode;
}

/** A round conductor along a path: component leads, jumpers, solid wire. */
export function Wire({
  points,
  radius,
  bend = radius * 3,
  smooth = false,
  radial = 10,
  material = { preset: 'tin' },
  children,
}: WireProps) {
  const geometry = useDisposable(() => {
    const curve = smooth ? smoothPath(points) : roundedPath(points, bend);
    return tube(curve, radius, { radial });
  }, [points, radius, bend, smooth, radial]);

  return <mesh geometry={geometry}>{children ?? <Material {...material} />}</mesh>;
}
