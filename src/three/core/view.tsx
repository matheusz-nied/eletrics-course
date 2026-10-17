/* eslint-disable react-hooks/immutability, react-hooks/refs -- React Three Fiber mutates three.js objects every frame; these React Compiler rules do not apply here (the compiler is not used). */
/**
 * View modes shared by every part: exploded view, cutaway and annotation
 * anchors. Parts read them through hooks, so the same part works in the
 * <Model3D> viewer, in scenes and in the bench.
 */
import { useFrame, useThree } from '@react-three/fiber';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { Euler, Plane, Quaternion, Vector3, type Group, type Object3D } from 'three';
import { damp, easeInOut } from './motion';
import type { Vec3 } from '../types';

export interface ViewState {
  /** Exploded-view factor, 0 (assembled) to 1 (exploded), animated. */
  explode: RefObject<number>;
  /** Cutaway is on: clipped materials use `cutPlanes`. */
  cutaway: boolean;
  /** Clipping planes of the cutaway (stable array; the plane moves while animating). */
  cutPlanes: Plane[];
  /** Named points that annotations follow. */
  anchors: Map<string, Object3D>;
}

const DEFAULT_VIEW: ViewState = {
  explode: { current: 0 },
  cutaway: false,
  cutPlanes: [],
  anchors: new Map(),
};

const ViewContext = createContext<ViewState>(DEFAULT_VIEW);

export const useView = () => useContext(ViewContext);

interface ViewProviderProps {
  explode?: boolean;
  cutaway?: boolean;
  /** Normal of the cut plane: the half the normal points away from is removed. */
  cutNormal?: Vec3;
  /** A point the cut plane goes through once the cut is complete (mm). */
  cutThrough?: Vec3;
  /** Size of the model, to start the cut plane outside it. */
  extent?: number;
  /** Instant transitions (prefers-reduced-motion, posters). */
  instant?: boolean;
  children: ReactNode;
}

/**
 * Provides the view modes and animates their transitions. Put it around the
 * part inside a Canvas; outside one, parts render assembled and uncut.
 */
export function ViewProvider({
  explode = false,
  cutaway = false,
  cutNormal = [0, 0, -1],
  cutThrough = [0, 0, 0],
  extent = 100,
  instant = false,
  children,
}: ViewProviderProps) {
  const explodeRef = useRef(explode ? 1 : 0);
  const [nx, ny, nz] = cutNormal;
  const [tx, ty, tz] = cutThrough;
  const plane = useMemo(
    () => new Plane(new Vector3(nx, ny, nz).normalize(), extent),
    [nx, ny, nz, extent],
  );
  // Constant of the finished cut, and of a plane far enough to cut nothing.
  const cutEnd = -plane.normal.dot(new Vector3(tx, ty, tz));
  const cutStart = cutEnd + extent + Math.abs(cutEnd);
  const cutRef = useRef(cutaway ? 1 : 0);
  const invalidate = useThree((s) => s.invalidate);
  const anchors = useMemo(() => new Map<string, Object3D>(), []);

  // The cut stays active while the plane slides back out.
  const cutActive = cutaway || cutRef.current > 0.001;

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    const targetExplode = explode ? 1 : 0;
    const targetCut = cutaway ? 1 : 0;
    explodeRef.current = instant ? targetExplode : damp(explodeRef.current, targetExplode, 6, step);
    cutRef.current = instant ? targetCut : damp(cutRef.current, targetCut, 6, step);
    if (Math.abs(explodeRef.current - targetExplode) < 0.0005) explodeRef.current = targetExplode;
    if (Math.abs(cutRef.current - targetCut) < 0.0005) cutRef.current = targetCut;
    plane.constant = cutEnd + (cutStart - cutEnd) * (1 - easeInOut(cutRef.current));
    if (explodeRef.current !== targetExplode || cutRef.current !== targetCut) invalidate();
  });

  useEffect(() => invalidate(), [explode, cutaway, invalidate]);

  const value = useMemo<ViewState>(
    () => ({
      explode: explodeRef,
      cutaway: cutActive,
      cutPlanes: cutActive ? [plane] : [],
      anchors,
    }),
    [cutActive, plane, anchors],
  );

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

interface ExplodeProps {
  /** Displacement in the exploded view (mm, in the parent's space). */
  offset: Vec3;
  /** Extra rotation in the exploded view (radians). */
  rotate?: Vec3;
  position?: Vec3;
  rotation?: Vec3;
  /** Stagger: the piece starts moving after this fraction of the transition. */
  delay?: number;
  children: ReactNode;
}

/** A group that moves out to `offset` in the exploded view. */
export function Explode({
  offset,
  rotate,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  delay = 0,
  children,
}: ExplodeProps) {
  const ref = useRef<Group>(null);
  const { explode } = useView();
  const base = useMemo(() => new Vector3(...position), [position]);
  const delta = useMemo(() => new Vector3(...offset), [offset]);
  const q0 = useMemo(() => new Quaternion().setFromEuler(new Euler(...rotation)), [rotation]);
  const q1 = useMemo(() => {
    const extra = new Quaternion().setFromEuler(new Euler(...(rotate ?? [0, 0, 0])));
    return q0.clone().multiply(extra);
  }, [q0, rotate]);

  const apply = (group: Group) => {
    const raw = explode.current ?? 0;
    const f = easeInOut(delay > 0 ? (raw - delay) / (1 - delay) : raw);
    group.position.copy(base).addScaledVector(delta, f);
    if (rotate) group.quaternion.slerpQuaternions(q0, q1, f);
    else group.quaternion.copy(q0);
  };

  useLayoutEffect(() => {
    if (ref.current) apply(ref.current);
  });

  useFrame(() => {
    if (ref.current) apply(ref.current);
  });

  return <group ref={ref}>{children}</group>;
}

/** A named point that annotations with `anchor: name` follow. */
export function Anchor({ name, position = [0, 0, 0] }: { name: string; position?: Vec3 }) {
  const ref = useRef<Group>(null);
  const { anchors } = useView();
  useEffect(() => {
    const object = ref.current;
    if (!object) return;
    anchors.set(name, object);
    return () => {
      if (anchors.get(name) === object) anchors.delete(name);
    };
  }, [anchors, name]);
  return <group ref={ref} position={position} />;
}

/** Keeps the render loop running while `active` (for `frameloop="demand"`). */
export function useContinuousRender(active: boolean) {
  useFrame(({ invalidate }) => {
    if (active) invalidate();
  });
}
