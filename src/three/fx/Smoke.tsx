/**
 * `<Smoke>`: smoke rising from an overloaded or burning component. Driven by
 * the simulation through `intensity`; puffs already in the air keep rising
 * and fade after it drops to zero.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, type ColorRepresentation } from 'three';
import type { Vec3 } from '../types';
import { createQuadMaterial, createQuads, random } from './particles';

export interface SmokeProps {
  /** Source position (mm, parent space). */
  position?: Vec3;
  /** 0 = no new smoke; 1 = a burning resistor; up to ~3 for a capacitor venting. */
  intensity?: number;
  /** Radius of the source (mm). */
  radius?: number;
  /** How high the smoke rises before it disappears (mm). */
  height?: number;
  color?: ColorRepresentation;
  /** Steady drift (mm/s). */
  wind?: Vec3;
  seed?: number;
}

const COUNT = 110;

export function Smoke({
  position = [0, 0, 0],
  intensity = 1,
  radius = 2,
  height = 40,
  color = '#55514e',
  wind = [4, 0, -1],
  seed = 3,
}: SmokeProps) {
  const quads = useMemo(() => createQuads(COUNT), []);
  const material = useMemo(() => createQuadMaterial('smoke'), []);
  useEffect(
    () => () => {
      quads.geometry.dispose();
      material.dispose();
    },
    [quads, material],
  );

  const base = useMemo(() => new Color(color), [color]);
  const sim = useRef({
    age: new Float32Array(COUNT).fill(-1),
    life: new Float32Array(COUNT),
    strength: new Float32Array(COUNT),
    start: new Float32Array(COUNT * 3),
    spin: new Float32Array(COUNT),
    shade: new Float32Array(COUNT),
    pending: 0,
    rand: random(seed),
  });

  useFrame(({ invalidate }, delta) => {
    const s = sim.current;
    const dt = Math.min(delta, 0.05);
    const level = Math.max(intensity, 0);
    s.pending += level * 26 * dt;
    let alive = 0;
    for (let i = 0; i < COUNT; i++) {
      if (s.age[i]! < 0 && s.pending >= 1) {
        s.pending -= 1;
        const a = s.rand() * Math.PI * 2;
        const d = Math.sqrt(s.rand()) * radius;
        s.age[i] = 0;
        s.life[i] = 2.4 + s.rand() * 1.8;
        s.strength[i] = Math.min(level, 3);
        s.start[i * 3] = Math.cos(a) * d;
        s.start[i * 3 + 1] = s.rand() * radius * 0.3;
        s.start[i * 3 + 2] = Math.sin(a) * d;
        s.spin[i] = s.rand() * Math.PI * 2;
        s.shade[i] = 0.82 + s.rand() * 0.3;
      }
      const o = i * 3;
      const q = i * 4;
      if (s.age[i]! < 0) {
        quads.shape[q] = 0;
        quads.shape[q + 2] = 0;
        continue;
      }
      s.age[i]! += dt;
      const age = s.age[i]!;
      const t = age / s.life[i]!;
      if (t >= 1) {
        s.age[i] = -1;
        quads.shape[q + 2] = 0;
        continue;
      }
      alive++;
      // Rises fast at first, slows as it cools; curls sideways as it goes.
      const rise = height * (1 - Math.pow(1 - t, 1.7));
      const curl = Math.sin(age * 1.7 + i) * radius * 0.8 * t;
      quads.offset[o] = s.start[o]! + wind[0] * age + curl;
      quads.offset[o + 1] = s.start[o + 1]! + rise + wind[1] * age;
      quads.offset[o + 2] =
        s.start[o + 2]! + wind[2] * age + Math.cos(age * 1.3 + i) * radius * 0.5 * t;
      quads.shape[q] = radius * (1.1 + 5.5 * t);
      quads.shape[q + 1] = s.spin[i]! + age * 0.35 * (i % 2 ? 1 : -1);
      const fadeIn = Math.min(t / 0.05, 1);
      quads.shape[q + 2] = 0.55 * Math.min(s.strength[i]!, 1.8) * fadeIn * Math.pow(1 - t, 1.3);
      quads.shape[q + 3] = 0;
      const shade = s.shade[i]! * (1 + t * 0.25);
      quads.color[o] = base.r * shade;
      quads.color[o + 1] = base.g * shade;
      quads.color[o + 2] = base.b * shade;
    }
    quads.update();
    if (alive > 0 || level > 0) invalidate();
  });

  return (
    <mesh
      position={position}
      geometry={quads.geometry}
      material={material}
      frustumCulled={false}
      renderOrder={10}
    />
  );
}
