/**
 * Small building blocks shared by the electromechanical parts: smooth
 * animation towards a target (armatures, levers, screws, reeds), printed
 * decals and rectangular PCB pins. Private to `parts/` (the leading `_` keeps
 * it out of the part registry).
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { type ColorRepresentation, type Texture } from 'three';
import { damp, useReducedMotion } from '../core/motion';
import { Material, type MaterialProps } from '../materials/Material';
import type { Vec3 } from '../types';

/**
 * Moves values smoothly towards `targets` and calls `apply` every frame while
 * they move (and once on mount). Keeps a `frameloop="demand"` canvas
 * rendering only while something moves; instant with reduced motion.
 */
export function useSmooth(targets: number[], apply: (values: number[]) => void, lambda = 12): void {
  const reduced = useReducedMotion();
  const invalidate = useThree((s) => s.invalidate);
  const values = useRef<number[] | null>(null);
  const applyRef = useRef(apply);
  const targetsRef = useRef(targets);
  useLayoutEffect(() => {
    applyRef.current = apply;
    targetsRef.current = targets;
  });

  const key = targets.join('|');
  useEffect(() => {
    invalidate();
  }, [key, invalidate]);

  useFrame((_, dt) => {
    const goal = targetsRef.current;
    const current = values.current;
    if (!current || current.length !== goal.length) {
      values.current = [...goal];
      applyRef.current(values.current);
      return;
    }
    const step = Math.min(dt, 0.05);
    let moving = false;
    for (let i = 0; i < goal.length; i++) {
      const target = goal[i]!;
      let v = reduced ? target : damp(current[i]!, target, lambda, step);
      if (Math.abs(v - target) < 1e-4) v = target;
      if (v !== target) moving = true;
      current[i] = v;
    }
    applyRef.current(current);
    if (moving) invalidate();
  });
}

export interface DecalProps {
  map: Texture;
  width: number;
  height: number;
  position: Vec3;
  rotation?: Vec3;
  /** Clipped by the cutaway like the shell it sits on. */
  clip?: boolean;
  color?: ColorRepresentation;
  roughness?: number;
  metalness?: number;
  bumpMap?: Texture;
  bumpScale?: number;
  opacity?: number;
}

/** Printed marking: a plane with a transparent canvas texture, drawn over its surface. */
export function Decal({
  map,
  width,
  height,
  position,
  rotation = [0, 0, 0],
  clip = false,
  color = '#ffffff',
  roughness = 0.55,
  metalness = 0,
  bumpMap,
  bumpScale,
  opacity = 1,
}: DecalProps) {
  return (
    <mesh position={position} rotation={rotation} renderOrder={2}>
      <planeGeometry args={[width, height]} />
      <Material
        color={color}
        map={map}
        transparent
        opacity={opacity}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-4}
        polygonOffsetUnits={-4}
        roughness={roughness}
        metalness={metalness}
        clip={clip}
        {...(bumpMap ? { bumpMap, bumpScale: bumpScale ?? 1 } : {})}
      />
    </mesh>
  );
}

export interface PinProps {
  /** Centre of the pin in X/Z. */
  x: number;
  z: number;
  /** Bottom (tip) and top of the pin. */
  bottom: number;
  top: number;
  /** Size along X and Z. */
  width: number;
  thickness: number;
  /** Length of the tapered tip. */
  tip?: number;
  material?: MaterialProps;
  /** Taper at the top too (header pins). */
  taperTop?: boolean;
}

/** Rectangular PCB pin with a chamfered tip (relay pins, header pins, terminal pins). */
export function Pin({
  x,
  z,
  bottom,
  top,
  width,
  thickness,
  tip = Math.min(width, thickness) * 0.6,
  material = { preset: 'tin' },
  taperTop = false,
}: PinProps) {
  const r = thickness / Math.SQRT2;
  const bodyBottom = bottom + tip;
  const bodyTop = taperTop ? top - tip : top;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, (bodyBottom + bodyTop) / 2, 0]}>
        <boxGeometry args={[width, bodyTop - bodyBottom, thickness]} />
        <Material {...material} />
      </mesh>
      <mesh position={[0, bottom + tip / 2, 0]} scale={[width / thickness, 1, 1]}>
        <cylinderGeometry args={[r, r * 0.45, tip, 4, 1, false, Math.PI / 4]} />
        <Material {...material} flatShading />
      </mesh>
      {taperTop && (
        <mesh position={[0, top - tip / 2, 0]} scale={[width / thickness, 1, 1]}>
          <cylinderGeometry args={[r * 0.45, r, tip, 4, 1, false, Math.PI / 4]} />
          <Material {...material} flatShading />
        </mesh>
      )}
    </group>
  );
}

/** Lighter or darker version of a colour (for moulded text and shading tints). */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const f = (c: number) =>
    Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))
      .toString(16)
      .padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}
