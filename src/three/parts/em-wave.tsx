/* eslint-disable react-hooks/immutability -- React Three Fiber mutates three.js objects every frame (the wave's vertex buffers and instance matrices). */
/**
 * Teaching picture of a radio wave leaving a quarter-wave monopole antenna
 * (module 13, "Comunicação sem fio e controle remoto"): a vertical whip of
 * length λ/4 on a small aluminium ground plane, and, along +X, the far-field
 * wave over a few wavelengths: the electric field E (orange, vertical, in the
 * plane of the antenna) and the magnetic field B (blue, horizontal), in phase,
 * perpendicular to each other and to the direction of travel.
 *
 * Real scale (1 unit = 1 mm): λ = c / f, c = 299 792 458 m/s, so
 * 433,92 MHz → λ = 691 mm and the antenna is 173 mm. The field amplitude is
 * only a drawing scale (default λ · 0,1). The base is a generic panel-mount
 * coaxial connector (Ø 14 mm). The wave starts at the antenna with a short
 * fade-in (the near field is not drawn) and travels while `running`, frozen
 * with reduced motion. The curves and arrows are rebuilt on the CPU each
 * frame (a few thousand vertices); arrows are instanced, so the part stays
 * around 20 draw calls.
 */
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Object3D,
  Sphere,
  Vector3,
  type InstancedMesh,
} from 'three';
import { formatNumber } from '../core/format';
import { useReducedMotion } from '../core/motion';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, useCanvasTexture } from '../materials/textures';
import { axialLathe, roundedCylinderProfile, roundedPath, tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { mergeAll } from './_em-geometry';

export interface EmWaveProps {
  /** Frequency (MHz). */
  frequencyMHz?: number;
  /** Wavelengths drawn along the direction of travel. */
  cycles?: number;
  /** Draw the magnetic field B. */
  magnetic?: boolean;
  /** The wave travels (animation). */
  running?: boolean;
  /** Drawing amplitude of the fields (mm); default λ · 0,1. */
  amplitude?: number;
}

/** Speed of light (m/s). */
const C = 299_792_458;

const E_COLOR = '#e8641e';
const B_COLOR = '#2f7fd8';
const GUIDE_COLOR = '#646b78';

/** Height of the connector body and of its insulator (mm). */
const BASE_H = 8;
const BASE_R = 7;
const INSULATOR_H = 3;
const PLATE_T = 1.5;

/** Arrows per wavelength. */
const ARROWS_PER_LAMBDA = 12;
/** Tube rings per wavelength. */
const RINGS_PER_LAMBDA = 56;
const RADIAL = 8;
/** Seconds per period on screen. */
const PERIOD_S = 1.8;

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

export function wavelengthMm(frequencyMHz: number): number {
  return (C / (frequencyMHz * 1e6)) * 1000;
}

interface WaveLayout {
  f: number;
  lambda: number;
  quarter: number;
  cycles: number;
  amp: number;
  /** Antenna x, wave start and end x, axis height. */
  xa: number;
  xs: number;
  xe: number;
  axisY: number;
  /** Top of the plate and of the insulator (where the whip starts). */
  plateTop: number;
  whipY: number;
  plateR: number;
  /** Tube radius of the field curves; whip radius. */
  r: number;
  rodR: number;
  /** End of the axis arrow (tip). */
  tipX: number;
  /** Fade-in length of the wave. */
  fade: number;
  /** λ bracket: from, to, height. */
  bx0: number;
  bx1: number;
  by: number;
}

function layout(p: PartProps): WaveLayout {
  const fIn = Number(p.frequencyMHz);
  const f = clamp(Number.isFinite(fIn) && fIn > 0 ? fIn : 433.92, 1, 100_000);
  const lambda = wavelengthMm(f);
  const quarter = lambda / 4;
  const cIn = Number(p.cycles);
  const cycles = clamp(Number.isFinite(cIn) ? cIn : 2, 0.5, 8);
  const aIn = Number(p.amplitude);
  const amp = Number.isFinite(aIn) && aIn > 0 ? aIn : lambda * 0.1;
  const span = cycles * lambda + lambda * 0.3;
  const r = span * 0.0019;
  const rodR = clamp(span * 0.0022, 1.5, 6);
  const plateR = Math.max(quarter * 0.45, 22);
  const plateTop = PLATE_T;
  const whipY = plateTop + BASE_H + INSULATOR_H;
  const axisY = Math.max(whipY + quarter * 0.45, amp * 1.15 + r * 4);
  const gap = lambda * 0.025;
  // Centre the whole drawing on x = 0.
  const left = -plateR;
  const right = gap + cycles * lambda + lambda * 0.16;
  const xa = -(left + right) / 2;
  const xs = xa + gap;
  const xe = xs + cycles * lambda;
  const n = Math.max(0, Math.floor(cycles - 1.25));
  let bx0 = xs + lambda / 4 + n * lambda;
  if (bx0 + lambda > xe + 1e-6) bx0 = xe - lambda;
  return {
    f,
    lambda,
    quarter,
    cycles,
    amp,
    xa,
    xs,
    xe,
    axisY,
    plateTop,
    whipY,
    plateR,
    r,
    rodR,
    tipX: xe + lambda * 0.16,
    fade: lambda * 0.35,
    bx0,
    bx1: bx0 + lambda,
    by: axisY + amp * 1.32,
  };
}

const smoothstep = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/** Field value (mm of drawing) at x, phase φ (radians). */
function field(l: WaveLayout, x: number, phase: number): number {
  const u = x - l.xs;
  return l.amp * smoothstep(u / l.fade) * Math.sin((2 * Math.PI * u) / l.lambda - phase);
}

const cm = (mm: number) => formatNumber(mm / 10, 3);
const mhz = (f: number) => formatNumber(f, 5);

export const meta: PartMeta = {
  id: 'em-wave',
  label: 'Onda eletromagnética',
  category: 'magnetismo',
  summary:
    'Onda de rádio saindo de uma antena de ¼ de onda: campo elétrico e campo magnético em fase, perpendiculares entre si e à direção em que a onda viaja, em tamanho real.',
  defaults: { frequencyMHz: 433.92, cycles: 2, magnetic: true, running: true },
  controls: {
    frequencyMHz: {
      kind: 'number',
      label: 'Frequência',
      min: 300,
      max: 2500,
      step: 0.01,
      log: true,
      unit: 'MHz',
    },
    cycles: { kind: 'number', label: 'Ciclos desenhados', min: 1, max: 4, step: 1 },
    magnetic: { kind: 'toggle', label: 'Mostrar o campo magnético' },
    running: { kind: 'toggle', label: 'Onda em movimento' },
  },
  annotations: (p) => {
    const l = layout(p);
    const xE = l.xs + 0.75 * l.lambda;
    const xB = l.xs + l.lambda / 4 + Math.floor(l.cycles - 0.25) * l.lambda;
    const notes: PartAnnotation[] = [
      {
        at: [xE, l.axisY + field(l, xE, 0), 0] as Vec3,
        text: 'Campo elétrico (E): sobe e desce no mesmo plano da antena',
      },
    ];
    if (p.magnetic !== false)
      notes.push({
        at: [xB, l.axisY, field(l, xB, 0)] as Vec3,
        text: 'Campo magnético (B): perpendicular ao elétrico',
      });
    notes.push(
      {
        at: [(l.bx0 + l.bx1) / 2, l.by, 0] as Vec3,
        text: `Comprimento de onda λ = ${cm(l.lambda)} cm`,
      },
      {
        at: [l.xa, l.whipY + l.quarter * 0.72, 0] as Vec3,
        text: `Antena de ¼ de onda: ${cm(l.quarter)} cm`,
      },
      {
        at: [l.tipX, l.axisY, 0] as Vec3,
        text: 'A onda viaja à velocidade da luz, cerca de 300.000 km/s',
      },
    );
    return notes;
  },
  describe: (p) => {
    const l = layout(p);
    const cycles = formatNumber(l.cycles, 2);
    const b =
      p.magnetic === false
        ? ' Só o campo elétrico aparece no desenho; o magnético está sempre junto dele.'
        : ' O campo magnético (azul) oscila na horizontal, perpendicular ao elétrico, e os dois sobem e descem juntos, em fase.';
    const motion =
      p.running === false ? ' A onda está parada.' : ' A onda avança para longe da antena.';
    return `Onda de rádio de ${mhz(l.f)} MHz saindo de uma antena vertical de ¼ de onda, com ${cm(l.quarter)} cm, sobre um pequeno plano de terra de metal. O campo elétrico (laranja) sobe e desce no mesmo plano da antena.${b} A seta mostra a direção em que a onda viaja, à velocidade da luz. Comprimento de onda λ = ${cm(l.lambda)} cm; o desenho mostra ${cycles} ${l.cycles === 1 ? 'ciclo' : 'ciclos'}, em tamanho real.${motion}`;
  },
  view: [0.42, 0.3, 1],
  animated: (p) => p.running !== false,
};

// ---------------------------------------------------------------------------
// Dynamic geometry: a tube along a curve in a plane, and a translucent sheet
// between the axis and the curve.

type Plane = 'xy' | 'xz';

function tubeIndex(rings: number, radial: number): number[] {
  const index: number[] = [];
  for (let i = 0; i < rings - 1; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = a + radial;
      const d = b + radial;
      index.push(a, b, c, b, d, c);
    }
  return index;
}

function sheetIndex(columns: number): number[] {
  const index: number[] = [];
  for (let i = 0; i < columns - 1; i++) {
    const a = 2 * i;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return index;
}

/** Fixed bounds (the whole envelope), so culling and framing do not depend on the phase. */
function setBounds(g: BufferGeometry, box: Box3) {
  g.boundingBox = box.clone();
  g.boundingSphere = box.getBoundingSphere(new Sphere());
}

function envelopeBox(l: WaveLayout, plane: Plane): Box3 {
  const a = l.amp + l.r * 2;
  return plane === 'xy'
    ? new Box3(new Vector3(l.xs, l.axisY - a, -l.r * 2), new Vector3(l.xe, l.axisY + a, l.r * 2))
    : new Box3(new Vector3(l.xs, l.axisY - l.r * 2, -a), new Vector3(l.xe, l.axisY + l.r * 2, a));
}

interface FieldBuffers {
  tube: BufferGeometry;
  sheet: BufferGeometry;
  xs: Float64Array;
  values: Float64Array;
}

function useFieldBuffers(l: WaveLayout, plane: Plane): FieldBuffers {
  const rings = Math.max(8, Math.round(l.cycles * RINGS_PER_LAMBDA)) + 1;
  const key = [rings, plane, l.xs, l.xe, l.axisY, l.amp, l.r];
  const tubeGeo = useDisposable(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(rings * RADIAL * 3), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(rings * RADIAL * 3), 3));
    g.setIndex(tubeIndex(rings, RADIAL));
    setBounds(g, envelopeBox(l, plane));
    return g;
  }, key);
  const sheetGeo = useDisposable(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(rings * 2 * 3), 3));
    g.setIndex(sheetIndex(rings));
    setBounds(g, envelopeBox(l, plane));
    return g;
  }, key);
  const xs = useMemo(() => {
    const out = new Float64Array(rings);
    for (let i = 0; i < rings; i++) out[i] = l.xs + ((l.xe - l.xs) * i) / (rings - 1);
    return out;
  }, [rings, l.xs, l.xe]);
  const values = useMemo(() => new Float64Array(rings), [rings]);
  return { tube: tubeGeo, sheet: sheetGeo, xs, values };
}

/** Writes the tube and the sheet for the field values in `buffers.values`. */
function writeField(l: WaveLayout, plane: Plane, buffers: FieldBuffers) {
  const { xs, values } = buffers;
  const n = xs.length;
  const pos = buffers.tube.attributes.position as BufferAttribute;
  const nor = buffers.tube.attributes.normal as BufferAttribute;
  const sheet = buffers.sheet.attributes.position as BufferAttribute;
  const P = pos.array as Float32Array;
  const N = nor.array as Float32Array;
  const S = sheet.array as Float32Array;
  const r = l.r;
  for (let i = 0; i < n; i++) {
    const x = xs[i]!;
    const v = values[i]!;
    const i0 = Math.max(i - 1, 0);
    const i1 = Math.min(i + 1, n - 1);
    const slope = (values[i1]! - values[i0]!) / (xs[i1]! - xs[i0]!);
    const len = Math.hypot(1, slope);
    const tx = 1 / len;
    const tv = slope / len;
    // Curve centre, the in-plane normal and the plane normal.
    const cx = x;
    const cy = plane === 'xy' ? l.axisY + v : l.axisY;
    const cz = plane === 'xy' ? 0 : v;
    for (let j = 0; j < RADIAL; j++) {
      const a = (j / RADIAL) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      let nx: number;
      let ny: number;
      let nz: number;
      if (plane === 'xy') {
        // N = (−tv, tx, 0), binormal = +Z.
        nx = -tv * ca;
        ny = tx * ca;
        nz = sa;
      } else {
        // N = (tv, 0, −tx), binormal = +Y.
        nx = tv * ca;
        ny = sa;
        nz = -tx * ca;
      }
      const k = (i * RADIAL + j) * 3;
      N[k] = nx;
      N[k + 1] = ny;
      N[k + 2] = nz;
      P[k] = cx + r * nx;
      P[k + 1] = cy + r * ny;
      P[k + 2] = cz + r * nz;
    }
    const s = i * 6;
    S[s] = x;
    S[s + 1] = l.axisY;
    S[s + 2] = 0;
    S[s + 3] = cx;
    S[s + 4] = cy;
    S[s + 5] = cz;
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  sheet.needsUpdate = true;
}

/** One field: tube, sheet and instanced arrows (stem + head). */
function FieldDrawing({
  l,
  plane,
  color,
  phase,
}: {
  l: WaveLayout;
  plane: Plane;
  color: string;
  phase: { current: number };
}) {
  const buffers = useFieldBuffers(l, plane);
  const count = Math.max(1, Math.round(l.cycles * ARROWS_PER_LAMBDA));
  const stemR = l.r * 0.42;
  const headR = l.r * 1.9;
  const headH = l.r * 5;
  const stem = useDisposable(
    () => new CylinderGeometry(stemR, stemR, 1, 6, 1, true).translate(0, 0.5, 0),
    [stemR],
  );
  const head = useDisposable(
    () => new ConeGeometry(headR, headH, 12).translate(0, headH / 2, 0),
    [headR, headH],
  );
  const stems = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  const tmp = useMemo(() => new Object3D(), []);

  const update = () => {
    const { xs, values } = buffers;
    for (let i = 0; i < xs.length; i++) values[i] = field(l, xs[i]!, phase.current);
    writeField(l, plane, buffers);
    const sm = stems.current;
    const hm = heads.current;
    if (!sm || !hm) return;
    for (let i = 0; i < count; i++) {
      const x = l.xs + ((i + 0.5) * (l.xe - l.xs)) / count;
      const v = field(l, x, phase.current);
      const mag = Math.abs(v);
      const sign = v >= 0 ? 1 : -1;
      const stemLen = Math.max(mag - headH, 0);
      const headScale = mag >= headH ? 1 : mag / headH;
      // Rotation that takes +Y to the field direction.
      if (plane === 'xy') tmp.rotation.set(0, 0, sign > 0 ? 0 : Math.PI);
      else tmp.rotation.set(sign > 0 ? Math.PI / 2 : -Math.PI / 2, 0, 0);
      tmp.position.set(x, l.axisY, 0);
      tmp.scale.set(stemLen > 1e-3 ? 1 : 0, Math.max(stemLen, 1e-3), stemLen > 1e-3 ? 1 : 0);
      tmp.updateMatrix();
      sm.setMatrixAt(i, tmp.matrix);
      const reach = sign * stemLen;
      if (plane === 'xy') tmp.position.set(x, l.axisY + reach, 0);
      else tmp.position.set(x, l.axisY, reach);
      tmp.scale.setScalar(Math.max(headScale, 1e-3));
      tmp.updateMatrix();
      hm.setMatrixAt(i, tmp.matrix);
    }
    sm.instanceMatrix.needsUpdate = true;
    hm.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(update);
  useFrame(update);

  return (
    <group>
      <mesh geometry={buffers.tube} renderOrder={2}>
        <Material color={color} roughness={0.38} clearcoat={0.4} clearcoatRoughness={0.3} />
      </mesh>
      <mesh geometry={buffers.sheet} renderOrder={3}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.16}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <instancedMesh
        key={`s${count}`}
        ref={stems}
        args={[stem, undefined, count]}
        frustumCulled={false}
      >
        <Material color={color} roughness={0.45} />
      </instancedMesh>
      <instancedMesh
        key={`h${count}`}
        ref={heads}
        args={[head, undefined, count]}
        frustumCulled={false}
      >
        <Material color={color} roughness={0.4} />
      </instancedMesh>
    </group>
  );
}

/** Text on a light pill, always facing the camera. */
function Label({
  text,
  color,
  position,
  height,
}: {
  text: string;
  color: string;
  position: Vec3;
  height: number;
}) {
  const w = 512;
  const h = 128;
  const map = useCanvasTexture(
    (ctx) => {
      ctx.font = `700 76px ${FONT_SANS}`;
      const tw = Math.min(ctx.measureText(text).width + 64, w - 4);
      const x0 = (w - tw) / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.beginPath();
      ctx.roundRect(x0, 14, tw, h - 28, (h - 28) / 2);
      ctx.fill();
      ctx.fillStyle = color;
      fitText(ctx, text, w / 2, h / 2 + 2, tw - 40, 76, { weight: 700 });
    },
    `em-label-${text}-${color}`,
    { width: w, height: h, fonts: [`700 76px ${FONT_SANS}`] },
  );
  return (
    <sprite position={position} scale={[height * (w / h), height, 1]} renderOrder={6}>
      <spriteMaterial map={map} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

export default function EmWave(props: EmWaveProps) {
  const p = { ...meta.defaults, ...props } as Required<EmWaveProps>;
  const l = layout(p as unknown as PartProps);
  const reduced = useReducedMotion();
  const phase = useRef(0);

  useFrame((_, dt) => {
    if (p.running && !reduced)
      phase.current =
        (phase.current + (Math.min(dt, 0.05) * 2 * Math.PI) / PERIOD_S) % (Math.PI * 2);
  });

  // Ground plane, connector body and insulator: one lathe each.
  const plate = useDisposable(
    () => axialLathe(roundedCylinderProfile(l.plateR, 0, PLATE_T, 0.5, 3), 72),
    [l.plateR],
  );
  const connector = useDisposable(() => {
    const body = axialLathe(
      [
        [0, PLATE_T],
        [BASE_R + 1.5, PLATE_T],
        [BASE_R + 1.5, PLATE_T + 1.6],
        [BASE_R, PLATE_T + 1.9],
        [BASE_R, PLATE_T + BASE_H - 0.6],
        [BASE_R - 0.6, PLATE_T + BASE_H],
        [0, PLATE_T + BASE_H],
      ],
      40,
    );
    return body;
  }, []);
  const insulator = useDisposable(
    () =>
      axialLathe(
        [
          [0, PLATE_T + BASE_H],
          [3.2, PLATE_T + BASE_H],
          [3.2, PLATE_T + BASE_H + INSULATOR_H - 0.6],
          [2.4, PLATE_T + BASE_H + INSULATOR_H],
          [0, PLATE_T + BASE_H + INSULATOR_H],
        ],
        28,
      ),
    [],
  );
  const whip = useDisposable(() => {
    const top = l.whipY + l.quarter;
    const rod = axialLathe(
      [
        [0, l.whipY - 1],
        [l.rodR, l.whipY - 1],
        [l.rodR, top - l.rodR * 0.2],
        [0, top - l.rodR * 0.2],
      ],
      16,
    );
    const ball = axialLathe(
      roundedCylinderProfile(l.rodR * 1.6, top - l.rodR * 1.6, top + l.rodR * 1.4, l.rodR * 1.5, 5),
      16,
    );
    return mergeAll([rod, ball]);
  }, [l.whipY, l.quarter, l.rodR]);

  // Direction of travel: the axis with an arrowhead.
  const arrow = useDisposable(() => {
    const headH = l.lambda * 0.055;
    const axis = tube(
      roundedPath([
        [l.xa + l.rodR * 3, l.axisY, 0],
        [l.tipX - headH, l.axisY, 0],
      ]),
      l.r * 0.5,
      { radial: 8, segments: 1 },
    );
    const head = new ConeGeometry(l.r * 2.6, headH, 16)
      .rotateZ(-Math.PI / 2)
      .translate(l.tipX - headH / 2, l.axisY, 0);
    return mergeAll([axis, head]);
  }, [l]);

  // λ dimension: a bar with arrowheads and end ticks, dashed lines down to two crests.
  const bracket = useDisposable(() => {
    const br = l.r * 0.32;
    const tick = l.amp * 0.16;
    const arrowH = l.r * 3.4;
    const line = (a: Vec3, b: Vec3) => tube(roundedPath([a, b]), br, { radial: 6, segments: 1 });
    const parts: BufferGeometry[] = [
      line([l.bx0 + arrowH, l.by, 0], [l.bx1 - arrowH, l.by, 0]),
      new ConeGeometry(l.r * 1.2, arrowH, 10)
        .rotateZ(Math.PI / 2)
        .translate(l.bx0 + arrowH / 2, l.by, 0),
      new ConeGeometry(l.r * 1.2, arrowH, 10)
        .rotateZ(-Math.PI / 2)
        .translate(l.bx1 - arrowH / 2, l.by, 0),
    ];
    const dash = l.amp * 0.05;
    const bottom = l.axisY + l.amp * 1.04;
    for (const x of [l.bx0, l.bx1]) {
      parts.push(line([x, l.by - tick, 0], [x, l.by + tick, 0]));
      for (let y = l.by - tick - dash; y > bottom; y -= dash * 2)
        parts.push(new CylinderGeometry(br * 0.8, br * 0.8, dash, 5).translate(x, y - dash / 2, 0));
    }
    return mergeAll(parts);
  }, [l]);

  return (
    <group>
      <group position={[l.xa, 0, 0]}>
        <mesh geometry={plate} receiveShadow>
          <Material preset="brushedAluminum" />
        </mesh>
        <mesh geometry={connector}>
          <Material preset="nickel" />
        </mesh>
        <mesh geometry={insulator}>
          <Material preset="ceramicWhite" roughness={0.4} />
        </mesh>
        <mesh geometry={whip}>
          <Material preset="steel" color="#8d9096" roughness={0.26} />
        </mesh>
      </group>

      <mesh geometry={arrow}>
        <Material color={GUIDE_COLOR} roughness={0.5} />
      </mesh>
      <mesh geometry={bracket}>
        <Material color={GUIDE_COLOR} roughness={0.5} />
      </mesh>

      <FieldDrawing l={l} plane="xy" color={E_COLOR} phase={phase} />
      {p.magnetic && <FieldDrawing l={l} plane="xz" color={B_COLOR} phase={phase} />}

      <Label
        text="E"
        color={E_COLOR}
        position={[l.xe + l.lambda * 0.07, l.axisY + l.amp * 0.95, 0]}
        height={l.cycles * l.lambda * 0.03}
      />
      {p.magnetic && (
        <Label
          text="B"
          color={B_COLOR}
          position={[l.xe + l.lambda * 0.07, l.axisY, l.amp * 0.95]}
          height={l.cycles * l.lambda * 0.03}
        />
      )}
      <Label
        text={`λ = ${cm(l.lambda)} cm`}
        color="#2b3038"
        position={[(l.bx0 + l.bx1) / 2, l.by + l.cycles * l.lambda * 0.022, 0]}
        height={l.cycles * l.lambda * 0.03}
      />
    </group>
  );
}
