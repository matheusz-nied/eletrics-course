/**
 * `<CurrentFlow>`: dots moving along a conductor at a speed proportional to
 * the current, in the conventional direction (+ to −) or as electrons (the
 * opposite way). The real drift speed of electrons is a fraction of a
 * millimetre per second; the dots show the direction and the relative size of
 * the current, not that speed.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, Object3D, SphereGeometry, Vector3, type InstancedMesh } from 'three';
import { roundedPath, smoothPath } from '../shapes/geometry';
import type { Vec3 } from '../types';
import { GLOW } from './glow';

export type CurrentConvention = 'convencional' | 'eletrons';

export const CURRENT_COLORS: Record<CurrentConvention, string> = {
  convencional: '#ffc93c',
  eletrons: '#4aa8ff',
};

export interface CurrentFlowProps {
  /** Path of the conductor (mm), from the end the positive current enters. */
  points: Vec3[];
  /** Current in amperes; negative flows from the last point to the first. */
  current: number;
  convention?: CurrentConvention;
  /** Speed of the dots for 1 A (mm/s); the speed grows with the logarithm above 1 A. */
  speedPerAmp?: number;
  /** Distance between dots (mm). */
  spacing?: number;
  /** Dot radius (mm). */
  radius?: number;
  smooth?: boolean;
  /** Corner radius when not smooth. */
  bend?: number;
  color?: string;
  /** Draw the dots through whatever covers them (inside an insulated wire). */
  xray?: boolean;
}

/** Dot speed (mm/s) for a current: linear up to 1 A, logarithmic above, capped. */
export function flowSpeed(current: number, speedPerAmp = 30): number {
  const a = Math.abs(current);
  const v = a <= 1 ? a * speedPerAmp : speedPerAmp * (1 + Math.log10(a) * 1.5);
  return Math.sign(current) * Math.min(v, speedPerAmp * 5);
}

const SAMPLES = 256;

export function CurrentFlow({
  points,
  current,
  convention = 'eletrons',
  speedPerAmp = 30,
  spacing = 6,
  radius = 0.45,
  smooth = false,
  bend = 2,
  color,
  xray = false,
}: CurrentFlowProps) {
  const key = JSON.stringify([points, smooth, bend]);
  const path = useMemo(() => {
    const curve = smooth ? smoothPath(points) : roundedPath(points, bend);
    const length = curve.getLength();
    const table = curve.getSpacedPoints(SAMPLES).map((p) => p.clone());
    return { length, table };
    // `key` stands for the path inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const count = Math.max(1, Math.floor(path.length / spacing));
  const geometry = useMemo(() => new SphereGeometry(1, 10, 8), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const mesh = useRef<InstancedMesh>(null);
  const phase = useRef(0);
  const dummy = useMemo(() => new Object3D(), []);
  const at = useMemo(() => new Vector3(), []);
  const tint = useMemo(() => new Color(color ?? CURRENT_COLORS[convention]), [color, convention]);

  const sign = convention === 'eletrons' ? -1 : 1;
  const speed = flowSpeed(current, speedPerAmp) * sign;
  const visible = Math.abs(current) > 1e-9;

  useFrame(({ invalidate }, delta) => {
    const m = mesh.current;
    if (!m) return;
    phase.current = (phase.current + speed * Math.min(delta, 0.05)) % spacing;
    const step = path.length / count;
    for (let i = 0; i < count; i++) {
      let s = (phase.current + i * step) % path.length;
      if (s < 0) s += path.length;
      const f = (s / path.length) * SAMPLES;
      const j = Math.min(Math.floor(f), SAMPLES - 1);
      at.lerpVectors(path.table[j]!, path.table[j + 1]!, f - j);
      dummy.position.copy(at);
      dummy.scale.setScalar(radius);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    if (speed !== 0) invalidate();
  });

  if (!visible) return null;
  return (
    <instancedMesh
      key={count}
      ref={mesh}
      args={[geometry, undefined, count]}
      frustumCulled={false}
      renderOrder={xray ? 20 : 5}
    >
      <meshBasicMaterial
        color={tint.clone().multiplyScalar(GLOW * 0.012)}
        depthTest={!xray}
        transparent={xray}
        opacity={xray ? 0.95 : 1}
      />
    </instancedMesh>
  );
}
