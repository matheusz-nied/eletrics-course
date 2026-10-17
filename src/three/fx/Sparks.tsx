/**
 * `<Sparks>`: incandescent particles from a short circuit, a fuse blowing or
 * contacts opening an inductive load. Each change of `trigger` fires a burst;
 * `rate` keeps a steady arc going. Sparks fly ballistically, cool down along
 * the black-body colours and bounce on the floor (y = 0 of the part space).
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, Vector3 } from 'three';
import type { Vec3 } from '../types';
import { blackbodyColor, glowIntensity } from './blackbody';
import { GLOW } from './glow';
import { createQuadMaterial, createQuads, random } from './particles';

export interface SparksProps {
  /** Where the sparks come from (mm, parent space). */
  position?: Vec3;
  /** Change this number to fire a burst (a counter from the simulation). */
  trigger?: number;
  /** Sparks per burst. */
  count?: number;
  /** Continuous sparks per second (an arc); 0 = bursts only. */
  rate?: number;
  /** Launch speed (mm/s). */
  speed?: number;
  /** Main direction of the sparks; they spread in a cone around it. */
  direction?: Vec3;
  /** Half-angle of the cone (rad). */
  spread?: number;
  /** Starting temperature (K). */
  temperature?: number;
  /** Height of the floor in the parent space (mm), or null for no floor. */
  floor?: number | null;
  seed?: number;
}

const MAX = 180;
const GRAVITY = -9810; // mm/s²

export function Sparks({
  position = [0, 0, 0],
  trigger = 0,
  count = 40,
  rate = 0,
  speed = 900,
  direction = [0, 1, 0],
  spread = 1.1,
  temperature = 2300,
  floor = 0,
  seed = 11,
}: SparksProps) {
  const quads = useMemo(() => createQuads(MAX), []);
  const material = useMemo(() => createQuadMaterial('glow'), []);
  useEffect(
    () => () => {
      quads.geometry.dispose();
      material.dispose();
    },
    [quads, material],
  );

  const sim = useRef({
    age: new Float32Array(MAX).fill(-1),
    life: new Float32Array(MAX),
    pos: new Float32Array(MAX * 3),
    vel: new Float32Array(MAX * 3),
    next: 0,
    pending: 0,
    fired: trigger,
    rand: random(seed),
  });
  const tmp = useMemo(
    () => ({ axis: new Vector3(), u: new Vector3(), w: new Vector3(), c: new Color() }),
    [],
  );

  const emit = (n: number) => {
    const s = sim.current;
    const { axis, u, w } = tmp;
    axis.set(...direction).normalize();
    u.set(1, 0, 0);
    if (Math.abs(axis.x) > 0.9) u.set(0, 0, 1);
    u.cross(axis).normalize();
    w.copy(axis).cross(u);
    for (let k = 0; k < n; k++) {
      const i = s.next;
      s.next = (s.next + 1) % MAX;
      // Direction inside the cone, faster near its axis.
      const theta = Math.acos(1 - s.rand() * (1 - Math.cos(spread)));
      const phi = s.rand() * Math.PI * 2;
      const v = speed * (0.35 + s.rand() * 0.75) * (1 - (theta / Math.max(spread, 0.01)) * 0.3);
      const st = Math.sin(theta);
      const dx = axis.x * Math.cos(theta) + (u.x * Math.cos(phi) + w.x * Math.sin(phi)) * st;
      const dy = axis.y * Math.cos(theta) + (u.y * Math.cos(phi) + w.y * Math.sin(phi)) * st;
      const dz = axis.z * Math.cos(theta) + (u.z * Math.cos(phi) + w.z * Math.sin(phi)) * st;
      s.age[i] = 0;
      s.life[i] = 0.25 + s.rand() * 0.55;
      s.pos[i * 3] = s.pos[i * 3 + 1] = s.pos[i * 3 + 2] = 0;
      s.vel[i * 3] = dx * v;
      s.vel[i * 3 + 1] = dy * v;
      s.vel[i * 3 + 2] = dz * v;
    }
  };

  useFrame(({ invalidate }, delta) => {
    const s = sim.current;
    const dt = Math.min(delta, 0.033);
    if (trigger !== s.fired) {
      s.fired = trigger;
      emit(count);
    }
    if (rate > 0) {
      s.pending += rate * dt;
      const n = Math.floor(s.pending);
      s.pending -= n;
      if (n > 0) emit(n);
    }
    const floorY = floor === null ? -Infinity : floor - position[1];
    const peak = glowIntensity(temperature) || 1;
    let alive = 0;
    for (let i = 0; i < MAX; i++) {
      const o = i * 3;
      const q = i * 4;
      if (s.age[i]! < 0) {
        quads.shape[q + 2] = 0;
        continue;
      }
      s.age[i]! += dt;
      const t = s.age[i]! / s.life[i]!;
      if (t >= 1) {
        s.age[i] = -1;
        quads.shape[q + 2] = 0;
        continue;
      }
      alive++;
      // Air drag, gravity, a bounce that loses most of the energy.
      const drag = Math.exp(-2.2 * dt);
      s.vel[o]! *= drag;
      s.vel[o + 1] = s.vel[o + 1]! * drag + GRAVITY * dt;
      s.vel[o + 2]! *= drag;
      s.pos[o]! += s.vel[o]! * dt;
      s.pos[o + 1]! += s.vel[o + 1]! * dt;
      s.pos[o + 2]! += s.vel[o + 2]! * dt;
      if (s.pos[o + 1]! < floorY) {
        s.pos[o + 1] = floorY;
        s.vel[o + 1] = -s.vel[o + 1]! * 0.3;
        s.vel[o]! *= 0.5;
        s.vel[o + 2]! *= 0.5;
      }
      quads.offset[o] = s.pos[o]!;
      quads.offset[o + 1] = s.pos[o + 1]!;
      quads.offset[o + 2] = s.pos[o + 2]!;
      quads.direction[o] = s.vel[o]!;
      quads.direction[o + 1] = s.vel[o + 1]!;
      quads.direction[o + 2] = s.vel[o + 2]!;
      const v = Math.hypot(s.vel[o]!, s.vel[o + 1]!, s.vel[o + 2]!);
      const size = 0.5;
      // Motion blur of ~8 ms draws each spark as a streak.
      quads.shape[q] = size;
      quads.shape[q + 1] = 0;
      quads.shape[q + 2] = 1 - t * t;
      quads.shape[q + 3] = Math.min(Math.max((v * 0.008) / size, 1), 40);
      const kelvin = temperature * (1 - 0.55 * t);
      const glow = (glowIntensity(kelvin) / peak) * GLOW * 1.3;
      blackbodyColor(kelvin, tmp.c);
      quads.color[o] = tmp.c.r * glow;
      quads.color[o + 1] = tmp.c.g * glow;
      quads.color[o + 2] = tmp.c.b * glow;
    }
    quads.update();
    if (alive > 0 || rate > 0) invalidate();
  });

  return (
    <mesh
      position={position}
      geometry={quads.geometry}
      material={material}
      frustumCulled={false}
      renderOrder={11}
    />
  );
}
