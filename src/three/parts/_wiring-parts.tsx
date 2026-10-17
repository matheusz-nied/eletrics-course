/**
 * Shared data and hooks for wires, cables and jumpers: conductor tables
 * (NBR NM 247-3, NBR NM 280 class 1 and class 5), NBR 5410 colours, the
 * printed insulation texture and the "opened" state (exploded or cut) that
 * decides when hidden strands are built.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import type { BufferGeometry } from 'three';
import { useView } from '../core/view';
import { FONT_SANS, fitText, useCanvasTexture } from '../materials/textures';
import { type MeshBuilder, type PathFrames, rodProfile, seeded } from './_wiring-geometry';
import type { Vec3 } from '../types';

export type WireKind = 'rigido' | 'flexivel';

export type WireColor =
  'azul-claro' | 'verde-amarelo' | 'preto' | 'vermelho' | 'marrom' | 'branco' | 'cinza' | 'amarelo';

/** PVC colours (sRGB, from catalogue photos) and the ink printed on them. */
export const WIRE_COLORS: Record<
  WireColor,
  { base: string; stripe?: string; ink: string; label: string; role: string }
> = {
  'azul-claro': { base: '#2a86d4', ink: '#eef3f8', label: 'azul-claro', role: 'neutro' },
  'verde-amarelo': {
    base: '#13763a',
    stripe: '#f2c81a',
    ink: '#eef3ee',
    label: 'verde-amarelo',
    role: 'terra (PE)',
  },
  preto: { base: '#1c1c1e', ink: '#e8e8e4', label: 'preto', role: 'fase ou retorno' },
  vermelho: { base: '#c21f1b', ink: '#f6eeec', label: 'vermelho', role: 'fase ou retorno' },
  marrom: { base: '#5c3420', ink: '#efe5dc', label: 'marrom', role: 'fase ou retorno' },
  branco: { base: '#efede6', ink: '#2b2b2b', label: 'branco', role: 'fase ou retorno' },
  cinza: { base: '#8a8e93', ink: '#1d1d1f', label: 'cinza', role: 'fase ou retorno' },
  amarelo: { base: '#f0c01c', ink: '#2b2b2b', label: 'amarelo', role: 'fase ou retorno' },
};

export const WIRE_COLOR_ORDER: WireColor[] = [
  'azul-claro',
  'verde-amarelo',
  'preto',
  'vermelho',
  'marrom',
  'branco',
  'cinza',
  'amarelo',
];

export interface ConductorSpec {
  section: number;
  /** Class 1 (solid) conductor diameter. */
  solidD: number;
  /** Class 5 (flexible) strand count and strand diameter. */
  strands: number;
  strandD: number;
  /** Class 5 conductor (bundle) diameter. */
  bundleD: number;
  /** PVC wall of single-core building wire. */
  insulation: number;
  voltage: string;
}

/**
 * Typical 70 °C PVC building wire: NBR NM 247-3 (type 05 up to 1 mm²,
 * 300/500 V; type 07 from 1,5 mm², 450/750 V) and the class 1 / class 5
 * conductors of NBR NM 280 (strands of 0,21 / 0,26 / 0,31 mm at most).
 */
export const CONDUCTORS: Record<string, ConductorSpec> = {
  '0.5': {
    section: 0.5,
    solidD: 0.8,
    strands: 16,
    strandD: 0.2,
    bundleD: 0.92,
    insulation: 0.6,
    voltage: '300/500 V',
  },
  '0.75': {
    section: 0.75,
    solidD: 0.98,
    strands: 24,
    strandD: 0.2,
    bundleD: 1.12,
    insulation: 0.6,
    voltage: '300/500 V',
  },
  '1': {
    section: 1,
    solidD: 1.13,
    strands: 32,
    strandD: 0.2,
    bundleD: 1.3,
    insulation: 0.6,
    voltage: '300/500 V',
  },
  '1.5': {
    section: 1.5,
    solidD: 1.38,
    strands: 30,
    strandD: 0.25,
    bundleD: 1.58,
    insulation: 0.7,
    voltage: '450/750 V',
  },
  '2.5': {
    section: 2.5,
    solidD: 1.78,
    strands: 50,
    strandD: 0.25,
    bundleD: 2.05,
    insulation: 0.8,
    voltage: '450/750 V',
  },
  '4': {
    section: 4,
    solidD: 2.26,
    strands: 56,
    strandD: 0.3,
    bundleD: 2.6,
    insulation: 0.8,
    voltage: '450/750 V',
  },
  '6': {
    section: 6,
    solidD: 2.76,
    strands: 84,
    strandD: 0.3,
    bundleD: 3.2,
    insulation: 0.8,
    voltage: '450/750 V',
  },
};

export function conductorSpec(section: number): ConductorSpec {
  return CONDUCTORS[String(section)] ?? CONDUCTORS['1.5']!;
}

/** `1,5 mm²` */
export function formatSection(section: number): string {
  return `${String(section).replace('.', ',')} mm²`;
}

/** Copper cut face, dark gaps between strands, PVC cut faces. */
export const COPPER_CUT = '#e39a6b';
export const CORE_DARK = '#2b1d15';

/**
 * Geometries rebuilt when `deps` change (compared by value) and disposed
 * when replaced or unmounted. Values may be null.
 */
export function useGeometrySet<T extends Record<string, BufferGeometry | null>>(
  factory: () => T,
  deps: unknown[],
): T {
  const key = JSON.stringify(deps);
  // `key` stands for the dependency values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => factory(), [key]);
  useEffect(
    () => () => {
      for (const geometry of Object.values(value)) geometry?.dispose();
    },
    [value],
  );
  return value;
}

/** True while the view is exploded (or moving); hidden strands are built only then. */
export function useExploded(): boolean {
  const { explode } = useView();
  const [exploded, setExploded] = useState(false);
  useFrame(() => {
    const now = (explode.current ?? 0) > 0.001;
    if (now !== exploded) setExploded(now);
  });
  return exploded;
}

/**
 * Printed PVC: base colour, optional longitudinal stripe (green-yellow) and
 * a marking repeated every `period` mm, drawn with the right proportions for
 * a sleeve of `diameter` mm. U runs along the wire, V around it (top = 0,5).
 */
export function useInsulationTexture({
  base,
  stripe,
  ink,
  text,
  diameter,
  period,
  textAt = 0.5,
  textSize,
}: {
  base: string;
  stripe?: string;
  ink: string;
  text?: string;
  diameter: number;
  period: number;
  /** V of the text centre (0,5 = top of a round sleeve). */
  textAt?: number;
  /** Height of the letters (mm); default from the diameter. */
  textSize?: number;
}) {
  return useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      if (stripe) {
        // One stripe on the shoulder (about a third of the circumference).
        // V = 0,5 is the top; the stripe covers the shoulder towards +v and the side.
        ctx.fillStyle = stripe;
        ctx.fillRect(0, h * 0.6, w, h * 0.33);
        ctx.fillStyle = 'rgba(0,0,0,0.07)';
        ctx.fillRect(0, h * 0.6, w, 2);
        ctx.fillRect(0, h * 0.93 - 2, w, 2);
      }
      if (text) {
        const pxX = w / period;
        const pxY = h / (Math.PI * diameter);
        const size = (textSize ?? Math.min(1.5, diameter * 0.38)) * pxX;
        ctx.save();
        ctx.translate(0, h * (1 - textAt));
        ctx.scale(1, pxY / pxX);
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.9;
        fitText(ctx, text, w / 2, 0, w * 0.86, size, { weight: 600, family: FONT_SANS });
        ctx.restore();
      }
    },
    `${base}|${stripe}|${ink}|${text}|${diameter.toFixed(2)}|${period}|${textAt}|${textSize}`,
    { width: 2048, height: 256, repeat: true, fonts: text ? [`600 40px ${FONT_SANS}`] : [] },
  );
}

/** Plain PVC (no marking), for jumpers and the cores inside a cable. */
export function usePlainInsulation(color: WireColor | string, diameter: number) {
  const c = WIRE_COLORS[color as WireColor];
  return useInsulationTexture({
    base: c?.base ?? color,
    stripe: c?.stripe,
    ink: '#000000',
    diameter,
    period: 50,
  });
}

/** Lay length of a bunched class 5 conductor (mm). */
export const layLength = (bundleD: number) => Math.max(20 * bundleD, 22);

export interface StrandOptions {
  layout: [number, number][];
  strandR: number;
  lay: number;
  from: number;
  to: number;
  /** Random trim of the strand ends (uneven cut). */
  trimStart?: number;
  trimEnd?: number;
  /** Radial spread factor (fanned tips) as a function of s. */
  fan?: (s: number) => number;
  maxStep?: number;
  radial?: number;
  seed?: number;
}

/** All the strands of a conductor between two arc lengths, in one builder. */
export function addStrands(builder: MeshBuilder, frames: PathFrames, o: StrandOptions) {
  const random = seeded(o.seed ?? 3);
  const twist = (2 * Math.PI) / o.lay;
  for (const [x, y] of o.layout) {
    const a = o.from + (o.trimStart ?? 0) * random();
    const b = o.to - (o.trimEnd ?? 0) * random();
    if (b - a < 0.05) continue;
    builder.sweep(frames, rodProfile(a, b, o.strandR), {
      radial: o.radial ?? 6,
      maxStep: o.maxStep ?? o.lay / 8,
      maxTurn: 0.15,
      offset: (s, out) => {
        const ang = s * twist;
        const c = Math.cos(ang);
        const sn = Math.sin(ang);
        const m = o.fan ? o.fan(s) : 1;
        out.set((x * c - y * sn) * m, (x * sn + y * c) * m);
      },
    });
  }
  return builder;
}

/**
 * Arc lengths where a path crosses the cutaway plane (z = 0), so cut-only
 * detail (strands in a cable section) is built only there.
 */
export function cutCrossings(frames: PathFrames, step = 1): number[] {
  const out: number[] = [];
  const f = frames.at(0);
  let prevZ = f.p.z;
  for (let s = step; s <= frames.length + 1e-6; s += step) {
    frames.at(Math.min(s, frames.length), f);
    if (prevZ > 0 !== f.p.z > 0) out.push(s - step / 2);
    prevZ = f.p.z;
  }
  return out;
}

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
