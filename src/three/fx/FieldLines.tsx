/**
 * `<FieldLines>`: magnetic field lines computed from the sources (`field.ts`),
 * drawn as thin tubes with arrowheads pointing along the field (out of the
 * north pole, into the south pole). The arrows can glide along the lines.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  CatmullRomCurve3,
  ConeGeometry,
  Object3D,
  Quaternion,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type InstancedMesh,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Vec3 } from '../types';
import { fieldLines, type FieldLinesOptions, type FieldSource } from './field';

export interface FieldLinesProps extends FieldLinesOptions {
  sources: FieldSource[];
  /** Tube radius (mm); default: in proportion to the drawing. */
  radius?: number;
  color?: string;
  opacity?: number;
  /** Arrowheads along the lines. */
  arrows?: boolean;
  /** Distance between arrowheads (mm). */
  arrowSpacing?: number;
  /** Arrowheads glide along the field (mm/s); 0 = still. */
  flow?: number;
}

interface Track {
  /** Points evenly spaced along the line. */
  table: Vector3[];
  length: number;
}

const SAMPLES = 160;
const UP = new Vector3(0, 1, 0);

export function FieldLines({
  sources,
  count,
  layout,
  planeNormal,
  extent,
  center,
  radius: radiusProp,
  color = '#3a8dde',
  opacity = 0.85,
  arrows = true,
  arrowSpacing,
  flow = 0,
}: FieldLinesProps) {
  const key = JSON.stringify([sources, count, layout, planeNormal, extent, center]);
  const lines = useMemo(
    () => fieldLines(sources, { count, layout, planeNormal, extent, center }),
    // `key` stands for the inputs, compared by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const span = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const line of lines)
      for (const p of line) {
        min = Math.min(min, p[0], p[1], p[2]);
        max = Math.max(max, p[0], p[1], p[2]);
      }
    return Number.isFinite(max - min) ? max - min : 100;
  }, [lines]);
  const radius = radiusProp ?? Math.max(span * 0.0018, 0.05);

  const { geometry, tracks } = useMemo(() => {
    const parts: BufferGeometry[] = [];
    const tracks: Track[] = [];
    for (const line of lines) {
      const curve = new CatmullRomCurve3(
        line.map((p) => new Vector3(...p)),
        false,
        'centripetal',
      );
      const length = curve.getLength();
      if (length < radius * 4) continue;
      parts.push(
        new TubeGeometry(curve, Math.min(Math.ceil(length / (radius * 4)), 600), radius, 6),
      );
      tracks.push({ table: curve.getSpacedPoints(SAMPLES), length });
    }
    const merged = parts.length ? mergeGeometries(parts) : null;
    for (const p of parts) p.dispose();
    return { geometry: merged, tracks };
  }, [lines, radius]);
  useEffect(() => () => geometry?.dispose(), [geometry]);

  const spacing = arrowSpacing ?? Math.max(span * 0.12, radius * 30);
  const arrowCount = useMemo(
    () => tracks.reduce((n, t) => n + Math.max(1, Math.floor(t.length / spacing)), 0),
    [tracks, spacing],
  );
  const cone = useMemo(() => new ConeGeometry(radius * 3.2, radius * 9, 10), [radius]);
  useEffect(() => () => cone.dispose(), [cone]);

  const mesh = useRef<InstancedMesh>(null);
  const phase = useRef(0);
  const tmp = useMemo(
    () => ({ o: new Object3D(), a: new Vector3(), b: new Vector3(), q: new Quaternion() }),
    [],
  );

  const place = () => {
    const m = mesh.current;
    if (!m) return;
    const { o, a, b, q } = tmp;
    let k = 0;
    for (const t of tracks) {
      const n = Math.max(1, Math.floor(t.length / spacing));
      const step = t.length / n;
      for (let i = 0; i < n; i++) {
        const s = (((phase.current + (i + 0.5) * step) % t.length) + t.length) % t.length;
        const f = (s / t.length) * SAMPLES;
        const j = Math.min(Math.floor(f), SAMPLES - 1);
        a.lerpVectors(t.table[j]!, t.table[j + 1]!, f - j);
        b.subVectors(t.table[j + 1]!, t.table[j]!).normalize();
        q.setFromUnitVectors(UP, b);
        o.position.copy(a);
        o.quaternion.copy(q);
        o.updateMatrix();
        m.setMatrixAt(k++, o.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true;
  };

  useEffect(place);
  useFrame(({ invalidate }, delta) => {
    if (!flow) return;
    phase.current += flow * Math.min(delta, 0.05);
    place();
    invalidate();
  });

  if (!geometry) return null;
  return (
    <group>
      <mesh geometry={geometry} renderOrder={4}>
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      {arrows && arrowCount > 0 && (
        <instancedMesh
          key={arrowCount}
          ref={mesh}
          args={[cone, undefined, arrowCount]}
          frustumCulled={false}
          renderOrder={4}
        >
          <meshBasicMaterial color={color} transparent opacity={Math.min(1, opacity + 0.1)} />
        </instancedMesh>
      )}
    </group>
  );
}

export type { FieldSource, Vec3 };
