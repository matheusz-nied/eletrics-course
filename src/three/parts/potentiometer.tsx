/**
 * Rotary carbon potentiometer, 16 mm or 24 mm body (dimensions from typical
 * datasheets: Alpha RV16/RV24, Bourns PDB18/PDB241): phenolic base with the
 * horseshoe carbon track and the silver collector ring, rotor with the
 * spring wiper, zinc-plated cover, threaded bushing with washer and nut,
 * 6 mm knurled (split) or D shaft, three solder lugs or PCB pins.
 * `rotation` (0..1) turns the shaft across 300°: 0 puts the wiper at
 * terminal 1, 1 at terminal 3 (seen from the shaft, terminals down: 1 left).
 */
import { useMemo } from 'react';
import { ExtrudeGeometry, LatheGeometry, Path, Shape, Vector2 } from 'three';
import { formatOhms, formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { axialLathe } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta, PartProps } from '../types';
import {
  arc,
  hexNutGeometry,
  thicken,
  threadProfile,
  washerGeometry,
  type Path2,
} from './_passive-common';

export type Taper = 'linear' | 'log';

export interface PotentiometerProps {
  ohms?: number;
  /** Linear (B) or logarithmic/audio (A). */
  taper?: Taper;
  /** Shaft position, 0 (fully counter-clockwise) to 1 (fully clockwise). */
  rotation?: number;
  /** Body diameter: 16 or 24 mm. */
  bodySize?: number;
  shaft?: 'estriado' | 'D';
  /** Solder lugs (panel mounting) or PCB pins. */
  terminals?: 'solda' | 'placa';
}

/** Electrical travel of the shaft. */
export const POT_TRAVEL_DEG = 300;

interface Dims {
  D: number;
  /** Cover height above the base. */
  hC: number;
  /** Bushing thread diameter, length and pitch. */
  M: number;
  bushL: number;
  pitch: number;
  /** Shaft length above the mounting face. */
  shaftL: number;
  /** Terminal pitch, lug width. */
  lugPitch: number;
  lugW: number;
  nutAF: number;
  nutH: number;
}

const SIZES: Record<16 | 24, Dims> = {
  16: {
    D: 16,
    hC: 5.2,
    M: 7,
    bushL: 7,
    pitch: 0.75,
    shaftL: 20,
    lugPitch: 5,
    lugW: 2.2,
    nutAF: 10,
    nutH: 2,
  },
  24: {
    D: 24,
    hC: 7.5,
    M: 9.5,
    bushL: 9.5,
    pitch: 0.8,
    shaftL: 25,
    lugPitch: 7.5,
    lugW: 2.8,
    nutAF: 12.7,
    nutH: 2.4,
  },
};

const BASE_T = 1.6; // phenolic base
const LIFT_LUGS = 0.45; // crimp tabs under the base
const PIN_LEN = 5;

/** Value code printed on pots: `B10K`, `A100K`, `B1M`, `B4K7`, `B500`. */
export function potCode(ohms: number, taper: Taper): string {
  const letter = taper === 'log' ? 'A' : 'B';
  const value = Number(ohms.toPrecision(2));
  const part = (v: number, unit: string) => {
    if (Number.isInteger(v)) return `${v}${unit}`;
    const [int, dec] = String(v).split('.');
    return `${int}${unit}${dec}`;
  };
  if (value >= 1e6) return letter + part(value / 1e6, 'M');
  if (value >= 1e3) return letter + part(value / 1e3, 'K');
  return letter + part(value, unit0(value));
}
const unit0 = (v: number) => (Number.isInteger(v) ? '' : 'R');

function dimsOf(p: PartProps): Dims {
  return SIZES[Number(p.bodySize) === 24 ? 24 : 16];
}

/** Wiper angle (radians, around Y, 0 = +Z) for a shaft position 0..1. */
export function wiperAngle(rotation: number): number {
  const r = Math.min(Math.max(rotation, 0), 1);
  return ((POT_TRAVEL_DEG / 2 - POT_TRAVEL_DEG * r) * Math.PI) / 180;
}

export const meta: PartMeta = {
  id: 'potentiometer',
  label: 'Potenciômetro',
  category: 'passivos',
  summary:
    'Potenciômetro rotativo de 16 ou 24 mm: pista de carbono em ferradura, cursor que gira com o eixo e três terminais.',
  defaults: {
    ohms: 10_000,
    taper: 'linear',
    rotation: 0.25,
    bodySize: 16,
    shaft: 'estriado',
    terminals: 'solda',
  },
  controls: {
    ohms: { kind: 'number', label: 'Resistência', min: 100, max: 1_000_000, log: true, unit: 'Ω' },
    taper: {
      kind: 'select',
      label: 'Curva',
      options: [
        { value: 'linear', label: 'Linear (B)' },
        { value: 'log', label: 'Logarítmica (A)' },
      ],
    },
    rotation: { kind: 'number', label: 'Posição do eixo', min: 0, max: 1, step: 0.01 },
    bodySize: {
      kind: 'select',
      label: 'Tamanho',
      options: [
        { value: 16, label: '16 mm' },
        { value: 24, label: '24 mm' },
      ],
    },
    shaft: {
      kind: 'select',
      label: 'Eixo',
      options: [
        { value: 'estriado', label: 'Estriado (com fenda)' },
        { value: 'D', label: 'Em D (meia-lua)' },
      ],
    },
    terminals: {
      kind: 'select',
      label: 'Terminais',
      options: [
        { value: 'solda', label: 'Para solda (painel)' },
        { value: 'placa', label: 'Para placa (pinos)' },
      ],
    },
  },
  annotations: (p) => {
    const d = dimsOf(p);
    const R = d.D / 2;
    const lift = p.terminals === 'placa' ? PIN_LEN + LIFT_LUGS : LIFT_LUGS;
    // The model is turned −90° around Y: terminals point to +X, terminal 1 in front.
    const lugX = R + (p.terminals === 'placa' ? 1.6 : 3.5);
    const y = lift + BASE_T + 0.3;
    const top = lift + BASE_T + d.hC;
    return [
      {
        at: [lugX, y, d.lugPitch],
        text: 'Terminal 1: uma ponta da pista',
        exploded: false,
      },
      {
        at: [lugX + 0.6, y, 0],
        text: 'Terminal 2: cursor (meio)',
        exploded: false,
      },
      {
        at: [lugX, y, -d.lugPitch],
        text: 'Terminal 3: outra ponta da pista',
        exploded: false,
      },
      {
        at: [0, top + 0.1, R * 0.72],
        text: `${potCode(Number(p.ohms), p.taper as Taper)}: ${p.taper === 'log' ? 'A = logarítmico' : 'B = linear'}, ${formatOhms(Number(p.ohms))}`,
        exploded: false,
      },
      {
        at: [0, top + d.bushL + d.shaftL * 0.55, 3],
        text: 'Eixo: gira 300° e leva o cursor',
        exploded: false,
      },
      { at: [0, 0, 0], text: 'Pista de carbono (ferradura)', anchor: 'track', exploded: true },
      {
        at: [0, 0, 0],
        text: 'Cursor: lâmina que desliza na pista',
        anchor: 'wiper',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: 'Anel coletor: liga o cursor ao terminal 2',
        anchor: 'collector',
        exploded: true,
      },
      { at: [0, 0, 0], text: 'Tampa metálica e bucha roscada', anchor: 'cover', exploded: true },
    ];
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const d = dimsOf(p);
    const code = potCode(Number(p.ohms), p.taper as Taper);
    const pct = Math.round(Math.min(Math.max(Number(p.rotation), 0), 1) * 100);
    return `Potenciômetro ${p.taper === 'log' ? 'logarítmico' : 'linear'} de ${formatOhms(Number(p.ohms))} (marcado ${code}), corpo de ${d.D} mm, eixo ${p.shaft === 'D' ? 'em D' : 'estriado'} de 6 mm, girado a ${formatNumber(pct)} % do curso. Entre os terminais 1 e 3 fica a resistência total; o terminal 2 é o cursor.`;
  },
  view: [0.55, 0.95, 1.35],
};

export default function Potentiometer(props: PotentiometerProps) {
  const p = { ...meta.defaults, ...props } as Required<PotentiometerProps>;
  const d = dimsOf(p as PartProps);
  const R = d.D / 2;
  const pcb = p.terminals === 'placa';
  const lift = (pcb ? PIN_LEN : 0) + LIFT_LUGS;
  const angle = wiperAngle(p.rotation);
  const code = potCode(p.ohms, p.taper);

  const coverTop = BASE_T + d.hC;
  const tCover = 0.4;
  const rCover = R;
  const bushTop = coverTop + d.bushL;
  const shaftTop = coverTop + d.shaftL;
  const trackOut = R * 0.78;
  const trackIn = R * 0.47;
  const collOut = R * 0.36;
  const collIn = R * 0.18;
  const tabW = 2 * d.lugPitch + d.lugW + 2.2;
  const tabExt = 2.6;
  const lugZ = -(R + tabExt * 0.35);

  // Phenolic base: disc plus the tab that holds the terminals (toward −Z).
  const baseShape = useMemo(() => {
    const r = R - 0.25;
    const half = tabW / 2;
    const yc = Math.sqrt(r * r - half * half);
    const shape = new Shape();
    shape.moveTo(half, yc);
    shape.lineTo(half, r + tabExt - 0.6);
    shape.quadraticCurveTo(half, r + tabExt, half - 0.6, r + tabExt);
    shape.lineTo(-half + 0.6, r + tabExt);
    shape.quadraticCurveTo(-half, r + tabExt, -half, r + tabExt - 0.6);
    shape.lineTo(-half, yc);
    shape.absarc(0, 0, r, Math.atan2(yc, -half), Math.atan2(yc, half) + Math.PI * 2, false);
    return shape;
  }, [R, tabW]);
  const baseGeometry = useDisposable(() => {
    const g = new ExtrudeGeometry(baseShape, {
      depth: BASE_T - 0.1,
      bevelEnabled: true,
      bevelSize: 0.05,
      bevelThickness: 0.05,
      bevelSegments: 1,
      curveSegments: 48,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.05, 0);
    return g;
  }, [R, tabW]);

  // Printed inks on the base: carbon track, silver collector and traces.
  const span = R + tabExt;
  const inkMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const s = w / (2 * span);
      const cx = w / 2;
      const cy = h / 2;
      // Canvas y grows toward +Z (the plane is turned to face up).
      const ringPath = (r0: number, r1: number, a0: number, a1: number) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r1 * s, a0, a1, false);
        ctx.arc(cx, cy, r0 * s, a1, a0, true);
        ctx.closePath();
      };
      // Angles: canvas angle 0 = +X, 90° = +Z. Track gap at −Z (canvas −90°).
      const gap = ((180 - POT_TRAVEL_DEG / 2) * Math.PI) / 180;
      const a0 = -Math.PI / 2 + gap;
      const a1 = -Math.PI / 2 - gap + Math.PI * 2;
      // Silver terminations under the track ends and traces to the rivets.
      ctx.fillStyle = '#c9cccf';
      const endW = 0.32;
      ringPath(trackIn - 0.3, trackOut + 0.3, a0 - 0.05, a0 + endW);
      ctx.fill();
      ringPath(trackIn - 0.3, trackOut + 0.3, a1 - endW, a1 + 0.05);
      ctx.fill();
      const lugY = cy + lugZ * s;
      for (const side of [-1, 1]) {
        const ex = cx + Math.cos(side === 1 ? a0 + 0.1 : a1 - 0.1) * ((trackIn + trackOut) / 2) * s;
        const ey = cy + Math.sin(side === 1 ? a0 + 0.1 : a1 - 0.1) * ((trackIn + trackOut) / 2) * s;
        ctx.lineWidth = 1.6 * s;
        ctx.strokeStyle = '#c9cccf';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(cx + side * d.lugPitch * s, lugY);
        ctx.stroke();
      }
      // Collector ring and its trace to the middle terminal.
      ctx.fillStyle = '#c9cccf';
      ringPath(collIn, collOut, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 0.8 * s, lugY, 1.6 * s, cy - lugY - collIn * s);
      // Carbon track (on top of the terminations).
      ctx.fillStyle = '#26231f';
      ringPath(trackIn, trackOut, a0, a1);
      ctx.fill();
      // Fine wear line where the wiper runs.
      ctx.strokeStyle = 'rgba(120,115,105,0.35)';
      ctx.lineWidth = 0.35 * s;
      ctx.beginPath();
      ctx.arc(cx, cy, ((trackIn + trackOut) / 2) * s, a0 + 0.1, a1 - 0.1);
      ctx.stroke();
    },
    `${R}|${d.lugPitch}`,
    { width: 1024, height: 1024 },
  );

  const coverGeometry = useDisposable(() => {
    const f = 0.7;
    const path: Path2 = [
      [rCover - tCover / 2, BASE_T - 0.15],
      ...arc(rCover - f, coverTop - f, f - tCover / 2, 0, Math.PI / 2, 5),
      [d.M / 2 + 1.6, coverTop - tCover / 2],
    ];
    return axialLathe(thicken(path, tCover), 72);
  }, [rCover, coverTop, d.M]);

  // Crimp tabs folded under the base.
  const crimpGeometry = useDisposable(() => {
    const path: Path2 = [
      [R - tCover / 2, BASE_T * 0.5],
      [R - tCover / 2, 0.1],
      ...arc(R - 0.6, 0.1, 0.4, 0, -Math.PI / 2, 4),
      [R - 1.7, -0.3],
    ];
    return new LatheGeometry(
      thicken(path, 0.3).map(([r, y]) => new Vector2(r, y)),
      4,
      -0.2,
      0.4,
    );
  }, [R]);

  const bushGeometry = useDisposable(() => {
    const outer = threadProfile(d.M / 2, 0.42, d.pitch, coverTop + 0.6, bushTop - 0.3, false);
    const path: Path2 = [
      [3.08, coverTop - 0.3],
      [d.M / 2 + 1.5, coverTop - 0.3],
      [d.M / 2 + 1.5, coverTop + 0.3],
      [d.M / 2 - 0.42, coverTop + 0.6],
      ...outer,
      [d.M / 2 - 0.42, bushTop - 0.3],
      [d.M / 2 - 0.75, bushTop],
      [3.08, bushTop],
      [3.08, coverTop - 0.3],
    ];
    return axialLathe(path, 48);
  }, [d.M, d.pitch, coverTop, bushTop]);

  const nutGeometry = useDisposable(() => hexNutGeometry(d.nutAF, d.nutH, d.M), [d]);
  const washerGeo = useDisposable(() => washerGeometry(d.M + 4.5, d.M + 0.3, 0.5), [d.M]);

  // Shaft: plain in the bushing, knurled (split) or D-shaped at the top.
  const gripL = Math.min(d.shaftL - d.bushL - 2, 10);
  const gripGeometry = useDisposable(() => {
    const shape = new Shape();
    if (p.shaft === 'D') {
      // 6 mm shaft with a flat at 4,5 mm across.
      const r = 3;
      const flat = 1.5;
      const x = Math.sqrt(r * r - flat * flat);
      shape.moveTo(x, flat);
      shape.absarc(0, 0, r, Math.atan2(flat, x), Math.atan2(flat, -x), true);
      shape.lineTo(x, flat);
      return extrudeShaft([shape], gripL);
    }
    // Knurled: 18 teeth, split by a 1 mm slot into two halves.
    const halves: Shape[] = [];
    for (const side of [1, -1]) {
      const half = new Shape();
      const teeth = 18;
      const points: [number, number][] = [];
      for (let i = 0; i <= teeth * 6; i++) {
        const a = (i / (teeth * 6)) * Math.PI * 2;
        const tooth = 0.5 + 0.5 * Math.cos(a * teeth);
        const r = 2.72 + tooth * 0.28;
        const x = r * Math.cos(a);
        const y = r * Math.sin(a);
        if (side * x > 0.5) points.push([x, y]);
      }
      points.sort((a, b) => Math.atan2(a[1], side * a[0]) - Math.atan2(b[1], side * b[0]));
      half.moveTo(side * 0.5, points[0]![1]);
      for (const [x, y] of points) half.lineTo(x, y);
      half.lineTo(side * 0.5, points[points.length - 1]![1]);
      half.closePath();
      halves.push(half);
    }
    return extrudeShaft(halves, gripL);
  }, [p.shaft, gripL]);

  const rotorGeometry = useDisposable(() => {
    const r = trackOut + 0.6;
    const path: Path2 = [
      [3.05, BASE_T + 0.45],
      [r - 0.3, BASE_T + 0.45],
      [r, BASE_T + 0.75],
      [r, BASE_T + 1.6],
      [r - 0.3, BASE_T + 1.85],
      [3.05, BASE_T + 1.85],
    ];
    return axialLathe(path, 64);
  }, [trackOut]);

  const printMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#1d1e20';
      fitText(ctx, code, w / 2, h / 2, w * 0.92, h * 0.8, { weight: 700, family: FONT_SANS });
    },
    code,
    { width: 512, height: 160, fonts: [`700 40px ${FONT_SANS}`] },
  );

  const noise = getNoiseTexture();
  const bandW = rCover - (d.M / 2 + 1.6);
  const printW = Math.min(bandW * 2.6, d.D * 0.42);
  const printH = printW / 3.2;
  const printZ = d.M / 2 + 1.6 + bandW * 0.5;
  const wiperMid = (trackIn + trackOut) / 2;

  return (
    <group position={[0, lift, 0]} rotation={[0, -Math.PI / 2, 0]}>
      {/* Base with the printed track, rivets and terminals. */}
      <mesh geometry={baseGeometry}>
        <Material preset="phenolic" color="#6b4325" roughnessMap={noise} roughness={0.7} />
      </mesh>
      <mesh position={[0, BASE_T + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2 * span, 2 * span]} />
        <Material
          preset="carbonFilm"
          color="#ffffff"
          map={inkMap}
          transparent
          alphaTest={0.4}
          roughness={0.75}
        />
      </mesh>
      <Anchor name="track" position={[-trackOut * 0.85, BASE_T, -trackOut * 0.3]} />
      <Anchor name="collector" position={[collOut * 0.7, BASE_T, -collOut * 0.7]} />
      {/* Hollow centre rivet (pivot of the rotor). */}
      <mesh position={[0, BASE_T + 0.2, 0]}>
        <cylinderGeometry args={[collIn + 0.1, collIn + 0.25, 0.4, 32]} />
        <Material preset="brass" roughness={0.35} />
      </mesh>
      <Terminals d={d} lugZ={lugZ} pcb={pcb} tabExt={tabExt} R={R} />

      {/* Wiper: lifts just off the track when exploded. */}
      <Explode offset={[0, 2.6, 0]}>
        <group rotation={[0, angle, 0]}>
          {/* Wiper: spring blade with contacts on the track and on the collector. */}
          <group>
            <mesh position={[0, BASE_T + 0.38, (collIn + trackOut) / 2]}>
              <boxGeometry args={[2.2, 0.12, trackOut - collIn]} />
              <Material preset="nickel" color="#e0d2a8" roughness={0.3} />
            </mesh>
            {[-0.6, 0.6].map((x) => (
              <group key={x}>
                <mesh position={[x, BASE_T + 0.17, wiperMid]} rotation={[0.35, 0, 0]}>
                  <boxGeometry args={[0.45, 0.12, 1.4]} />
                  <Material preset="nickel" color="#e0d2a8" roughness={0.3} />
                </mesh>
                <mesh
                  position={[x, BASE_T + 0.17, (collIn + collOut) / 2]}
                  rotation={[-0.35, 0, 0]}
                >
                  <boxGeometry args={[0.45, 0.12, 1.2]} />
                  <Material preset="nickel" color="#e0d2a8" roughness={0.3} />
                </mesh>
              </group>
            ))}
            <Anchor name="wiper" position={[0, BASE_T + 0.3, wiperMid]} />
          </group>
        </group>
      </Explode>

      {/* Rotor and shaft (turn with the wiper); off to the side when exploded. */}
      <Explode offset={[d.D * 0.55, d.hC + 3, -d.D * 1.15]}>
        <group rotation={[0, angle, 0]}>
          <mesh geometry={rotorGeometry}>
            <Material preset="absBlack" clip color="#2a2624" roughness={0.6} cutColor="#1a1716" />
          </mesh>
          {/* Shaft: plain through the bushing, grip on top. */}
          <mesh position={[0, (BASE_T + 1.2 + shaftTop - gripL) / 2, 0]}>
            <cylinderGeometry args={[3, 3, shaftTop - gripL - BASE_T - 1.2, 40]} />
            <Material preset="zinc" clip roughness={0.32} cutColor="#8d9196" />
          </mesh>
          <mesh geometry={gripGeometry} position={[0, shaftTop - gripL, 0]}>
            <Material preset="zinc" clip roughness={0.3} cutColor="#8d9196" />
          </mesh>
        </group>
      </Explode>

      {/* Cover, bushing, crimp tabs, anti-rotation tab and the printed code. */}
      <Explode offset={[-d.D * 0.9, d.hC + d.bushL + 4, 0]} delay={0.1}>
        <mesh geometry={coverGeometry}>
          <Material
            preset="zinc"
            clip
            color="#c3c8cc"
            roughnessMap={noise}
            roughness={0.36}
            cutColor="#7f8489"
          />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} geometry={crimpGeometry} rotation={[0, (i * Math.PI) / 2 + Math.PI / 4, 0]}>
            <Material preset="zinc" color="#c3c8cc" roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[-(rCover - 1.1), coverTop + 0.55, 0]}>
          <boxGeometry args={[0.4, 1.3, 1.6]} />
          <Material preset="zinc" color="#c3c8cc" roughness={0.4} />
        </mesh>
        <mesh position={[printZ, coverTop + 0.01, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <planeGeometry args={[printW, printH]} />
          <Material
            preset="epoxyBlack"
            clip
            color="#ffffff"
            map={printMap}
            transparent
            depthWrite={false}
            roughness={0.6}
          />
        </mesh>
        <mesh geometry={bushGeometry}>
          <Material preset="nickel" clip roughness={0.28} cutColor="#8a8780" />
        </mesh>
        <Anchor name="cover" position={[rCover * 0.75, coverTop, rCover * 0.4]} />
      </Explode>

      {/* Washer and nut on the bushing. */}
      <Explode offset={[0, d.bushL, d.D * 0.95]} delay={0.2}>
        <group position={[0, bushTop - d.nutH - 0.9, 0]}>
          <mesh geometry={washerGeo}>
            <Material preset="zinc" clip roughness={0.35} cutColor="#8d9196" />
          </mesh>
          <mesh geometry={nutGeometry} position={[0, 0.5, 0]}>
            <Material preset="zinc" clip roughness={0.3} cutColor="#8d9196" />
          </mesh>
        </group>
      </Explode>
    </group>
  );
}

function extrudeShaft(shapes: Shape[], length: number) {
  const g = new ExtrudeGeometry(shapes, {
    depth: length - 0.3,
    bevelEnabled: true,
    bevelSize: 0.25,
    bevelThickness: 0.3,
    bevelSegments: 2,
    curveSegments: 24,
    bevelOffset: -0.25,
  });
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Three riveted terminals: flat solder lugs with a hole, or bent PCB pins. */
function Terminals({
  d,
  lugZ,
  pcb,
  tabExt,
  R,
}: {
  d: Dims;
  lugZ: number;
  pcb: boolean;
  tabExt: number;
  R: number;
}) {
  const lugLen = pcb ? 2.2 : 6.5;
  const lugGeometry = useDisposable(() => {
    const w = d.lugW;
    const shape = new Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(w / 2, lugLen - w / 2);
    shape.absarc(0, lugLen - w / 2, w / 2, 0, Math.PI, false);
    shape.lineTo(-w / 2, 0);
    if (!pcb) {
      const hole = new Path();
      hole.absarc(0, lugLen - w / 2, w * 0.27, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    const g = new ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: false, curveSegments: 16 });
    // Lying flat on the base, pointing toward −Z.
    g.rotateX(-Math.PI / 2);
    return g;
  }, [d.lugW, lugLen, pcb]);
  const tip = lugZ + 1.2 - lugLen;
  void tabExt;
  void R;
  return (
    <>
      {[-1, 0, 1].map((i) => {
        const x = i * d.lugPitch;
        const start = lugZ + 1.2;
        return (
          <group key={i}>
            <mesh geometry={lugGeometry} position={[x, BASE_T, start]}>
              <Material preset="tin" roughness={0.3} />
            </mesh>
            {/* Rivet head. */}
            <mesh position={[x, BASE_T + 0.45, start - 0.9]}>
              <cylinderGeometry args={[0.85, 0.95, 0.35, 20]} />
              <Material preset="tin" roughness={0.3} />
            </mesh>
            {pcb && (
              <mesh position={[x, (BASE_T + 0.4 - PIN_LEN - LIFT_LUGS) / 2, tip + 0.5]}>
                <boxGeometry
                  args={[Math.min(d.lugW * 0.55, 1.2), PIN_LEN + BASE_T + LIFT_LUGS + 0.4, 0.4]}
                />
                <Material preset="tin" roughness={0.3} />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}
