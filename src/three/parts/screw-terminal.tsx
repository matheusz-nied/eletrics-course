/**
 * PCB screw terminal block ("borne"), 5,0 or 5,08 mm pitch, 2 to 12 ways,
 * green or blue, with the rising box clamp: turning the screw lifts the
 * steel cage, which squeezes the stripped wire against the tin-plated
 * current bar. Dimensions from typical datasheets (Phoenix Contact MKDS
 * 1,5/x-5,08, Dinkle/KF301-5.0): height 10 mm, depth 7,6 mm, wire entry
 * 4 × 3,5 mm, M3 combined slot/cross screw, pins 1,0 × 0,8 × 3,5 mm. Long
 * blocks are 2- and 3-way modules slid together. Optional printed labels and
 * inserted wires (1,5 mm², stranded).
 */
import { useRef } from 'react';
import { DoubleSide, Shape, type BufferGeometry, type Group } from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { roundedPath, tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta, Vec3 } from '../types';
import {
  addRoundedRect,
  extrudeAlongX,
  extrudeUp,
  mergeAll,
  screwHeadGeometry,
  threadedRodGeometry,
} from './_em-geometry';
import { Decal, Pin, useSmooth } from './_em-kit';

export interface ScrewTerminalProps {
  /** Number of ways (2 to 12). */
  ways?: number;
  /** Pitch (mm): 5 or 5,08. */
  pitch?: number;
  color?: 'verde' | 'azul';
  /**
   * How far each screw is loosened, 0 (tight, cage up) to 1 (open): one
   * number for all, or a comma-separated list per way ("0,1,0.5").
   */
  screwTurns?: number | string;
  /** Per-way list that overrides `screwTurns` when not empty ("0,1,0.5"). */
  screwTurnsEach?: string;
  /** Number of stripped wire ends inserted (from the first way). */
  wires?: number;
  /** Insulation colours of the wires, comma-separated (pt-BR names). */
  wireColors?: string;
  /** Text printed above each way, comma-separated ("F,N,ABRE,FECHA"). */
  labels?: string;
}

/** Profile (mm), body coordinates: front (wire entry) at +Z. */
const H = 10;
const D_FRONT = 3.8;
const D_BACK = -3.8;
const LOW = 6.5;
const ENTRY_BOTTOM = 1.3;
const ENTRY_TOP = 4.8;
const WELL_Z = 0.2;
const WELL_R = 1.95;
const SLAB = 2;
const PIN = 3.5;
/** Height of the housing bottom above the pin tips. */
export const SCREW_TERMINAL_SEAT = PIN;

/** Current bar (fixed) and cage travel. */
const BAR_BOTTOM = 3.5;
const BAR_TOP = 4;
const CAGE_T = 0.3;
const CAGE_INNER = 2.7;
const CAGE_OPEN = 1.35;
const WIRE_R = 0.69;
const INSULATION_R = 1.45;
const SCREW_SHAFT = 2.6;
const SCREW_HEAD_H = 1.5;
const SCREW_RISE = 0.9;
const SCREW_TURNS = 3.5;
/** Depth of the printed strip behind the wells. */
const LABEL_DEPTH = WELL_Z - WELL_R - 0.1 - (D_BACK + 0.4);

const WIRE_COLORS: Record<string, string> = {
  preto: '#1d1d1f',
  azul: '#1f56c9',
  'azul-claro': '#3d8fe0',
  vermelho: '#c8231b',
  branco: '#ecebe6',
  amarelo: '#f0c419',
  verde: '#21893f',
  'verde-amarelo': '#21893f',
  marrom: '#6b3b1c',
  cinza: '#8a8d91',
  laranja: '#ec7a16',
  violeta: '#6c3fa8',
};
const DEFAULT_WIRES = [
  'preto',
  'azul',
  'vermelho',
  'branco',
  'amarelo',
  'verde',
  'marrom',
  'cinza',
  'laranja',
  'violeta',
  'azul-claro',
  'verde-amarelo',
];

const HOUSING = {
  verde: { color: '#2b8045', cut: '#1d5a30' },
  azul: { color: '#2266c8', cut: '#174a93' },
};

export const meta: PartMeta = {
  id: 'screw-terminal',
  label: 'Borne de parafuso',
  category: 'conexoes',
  summary:
    'Borne de parafuso para placa (2 a 12 vias), com a gaiola que sobe ao apertar o parafuso e prende o fio contra a barra.',
  defaults: {
    ways: 3,
    pitch: 5.08,
    color: 'verde',
    screwTurns: 1,
    screwTurnsEach: '',
    wires: 0,
    wireColors: '',
    labels: '',
  },
  controls: {
    ways: { kind: 'number', label: 'Vias', min: 2, max: 12, step: 1 },
    pitch: {
      kind: 'select',
      label: 'Passo',
      options: [
        { value: 5.08, label: '5,08 mm' },
        { value: 5, label: '5,0 mm' },
      ],
    },
    color: {
      kind: 'select',
      label: 'Cor',
      options: [
        { value: 'verde', label: 'Verde' },
        { value: 'azul', label: 'Azul' },
      ],
    },
    screwTurns: { kind: 'number', label: 'Parafusos soltos', min: 0, max: 1, step: 0.05 },
    screwTurnsEach: {
      kind: 'text',
      label: 'Parafusos soltos por via (0 a 1, separados por vírgula)',
      maxLength: 60,
    },
    wires: { kind: 'number', label: 'Fios encaixados', min: 0, max: 12, step: 1 },
    wireColors: { kind: 'text', label: 'Cores dos fios (separadas por vírgula)', maxLength: 120 },
    labels: { kind: 'text', label: 'Serigrafia das vias (separada por vírgula)', maxLength: 120 },
  },
  annotations: (p) => {
    const n = waysOf(p.ways);
    const pitch = pitchOf(p.pitch);
    const x0 = -((n - 1) / 2) * pitch;
    return [
      {
        at: [x0, H + 0.5, WELL_Z] as Vec3,
        text: 'Parafuso: horário aperta, anti-horário solta',
        anchor: 'parafuso',
      },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Gaiola de aperto: sobe e prende o fio contra a barra',
        anchor: 'gaiola',
      },
      {
        at: [x0 + (n > 1 ? pitch : 0), (ENTRY_BOTTOM + ENTRY_TOP) / 2, D_FRONT + 0.3] as Vec3,
        text: 'Entrada do fio: desencape cerca de 6 mm',
        exploded: false,
      },
      { at: [0, 0, 0] as Vec3, text: 'Barra de contato ligada ao pino da placa', anchor: 'barra' },
    ];
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const n = waysOf(p.ways);
    const turns = turnsOf(p.screwTurnsEach || p.screwTurns, n);
    const wires = Math.min(Math.max(Math.round(Number(p.wires) || 0), 0), n);
    const color = p.color === 'azul' ? 'azul' : 'verde';
    const labels = labelsOf(p.labels, n).filter(Boolean);
    const open = turns.filter((t) => t > 0.5).length;
    const screws =
      open === 0
        ? 'todos os parafusos apertados'
        : open === n
          ? 'parafusos soltos'
          : `${open} parafuso(s) solto(s)`;
    return `Borne de parafuso ${color} de ${n} vias, passo de ${formatNumber(pitchOf(p.pitch))} mm, ${screws}${wires ? `, ${wires} fio(s) encaixado(s)` : ''}${labels.length ? `. Serigrafia: ${labels.join(', ')}` : ''}.`;
  },
  view: [0.45, 0.85, 1.4],
};

function waysOf(v: unknown): number {
  const n = Math.round(Number(v) || 3);
  return Math.min(Math.max(n, 2), 12);
}

function pitchOf(v: unknown): number {
  return Number(v) === 5 ? 5 : 5.08;
}

function turnsOf(v: unknown, n: number): number[] {
  const list = String(v ?? '0')
    .split(/[,;]/)
    .map((s) => Number(s.trim()))
    .filter((x) => Number.isFinite(x));
  const values = list.length ? list : [0];
  return Array.from({ length: n }, (_, i) =>
    Math.min(Math.max(values[i] ?? values[values.length - 1]!, 0), 1),
  );
}

function labelsOf(v: unknown, n: number): string[] {
  const list = String(v ?? '')
    .split(',')
    .map((s) => s.trim());
  return Array.from({ length: n }, (_, i) => list[i] ?? '');
}

/** Groups ways into 2- and 3-way modules (like real blocks slid together). */
function modulesOf(n: number): number[] {
  if (n <= 3) return [n];
  const out: number[] = [];
  let left = n;
  while (left > 0) {
    if (left === 4) {
      out.push(2, 2);
      left = 0;
    } else if (left === 2) {
      out.push(2);
      left = 0;
    } else {
      out.push(3);
      left -= 3;
    }
  }
  return out;
}

/** A side profile given as (z, y) points, for `extrudeAlongX`. */
function profile(points: [number, number][]): Shape {
  const shape = new Shape();
  points.forEach(([z, y], i) => (i === 0 ? shape.moveTo(-z, y) : shape.lineTo(-z, y)));
  shape.closePath();
  return shape;
}

export default function ScrewTerminal(props: ScrewTerminalProps) {
  const p = { ...meta.defaults, ...props } as Required<ScrewTerminalProps>;
  const n = waysOf(p.ways);
  const pitch = pitchOf(p.pitch);
  const turns = turnsOf(p.screwTurnsEach || p.screwTurns, n);
  const wireCount = Math.min(Math.max(Math.round(Number(p.wires) || 0), 0), n);
  const colorNames = String(p.wireColors || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const labels = labelsOf(p.labels, n);
  const housing = HOUSING[p.color === 'azul' ? 'azul' : 'verde'];
  const noise = getNoiseTexture();
  const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * pitch);

  // Housing: lower part per way (walls + slab with the entry tunnel), upper part
  // per module with the round screw wells.
  const housingGeometry = useDisposable(() => {
    const parts: BufferGeometry[] = [];
    const wall = profile([
      [D_BACK, 0],
      [D_FRONT, 0],
      [D_FRONT, 5.6],
      [2.6, LOW],
      [D_BACK, LOW],
    ]);
    const slabMain = profile([
      [D_BACK, 0],
      [D_FRONT, 0],
      [D_FRONT, ENTRY_BOTTOM],
      [-1.8, ENTRY_BOTTOM],
      [-1.8, LOW],
      [D_BACK, LOW],
    ]);
    const slabBridge = profile([
      [WELL_Z + 2, ENTRY_TOP],
      [D_FRONT, ENTRY_TOP],
      [D_FRONT, 5.6],
      [2.6, LOW],
      [WELL_Z + 2, LOW],
    ]);
    const gap = 0.12;
    let first = 0;
    for (const size of modulesOf(n)) {
      const last = first + size - 1;
      const mx0 = xs[first]! - pitch / 2 + gap / 2;
      const mx1 = xs[last]! + pitch / 2 - gap / 2;
      for (let i = first; i <= last; i++) {
        const x = xs[i]!;
        const left = i === first ? mx0 : x - pitch / 2;
        const right = i === last ? mx1 : x + pitch / 2;
        const lw = x - SLAB - left;
        const rw = right - (x + SLAB);
        const a = extrudeAlongX(wall, lw);
        a.translate(left + lw / 2, 0, 0);
        const b = extrudeAlongX(wall, rw);
        b.translate(x + SLAB + rw / 2, 0, 0);
        const c = extrudeAlongX([slabMain, slabBridge], SLAB * 2);
        c.translate(x, 0, 0);
        parts.push(a, b, c);
      }
      // Upper part with the wells (shape Y is −Z).
      const top = new Shape();
      addRoundedRect(top, mx1 - mx0, 2.6 - D_BACK, 0.45, (mx0 + mx1) / 2, -(2.6 + D_BACK) / 2);
      for (let i = first; i <= last; i++) {
        const hole = new Shape();
        hole.absarc(xs[i]!, -WELL_Z, WELL_R, 0, Math.PI * 2, true);
        top.holes.push(hole);
      }
      const upper = extrudeUp(top, H - LOW, 0.2, { curveSegments: 16 });
      upper.translate(0, LOW, 0);
      parts.push(upper);
      first = last + 1;
    }
    return mergeAll(parts);
  }, [n, pitch]);

  const labelText = labels.join('|');
  const labelMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#f3f3ee';
      labels.forEach((text, i) => {
        if (!text) return;
        fitText(ctx, text, ((i + 0.5) / n) * w, h * 0.55, (w / n) * 0.86, h * 0.78, {
          weight: 700,
          family: FONT_SANS,
        });
      });
    },
    `${labelText}|${n}`,
    {
      width: 160 * n,
      height: Math.round((160 * LABEL_DEPTH) / pitch),
      fonts: [`700 40px ${FONT_SANS}`],
    },
  );

  const cageGeometry = useDisposable(() => {
    const w = 3.5;
    const len = 3;
    const boxes: BufferGeometry[] = [];
    const add = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
      const s = new Shape();
      addRoundedRect(s, sx, sz, 0.06);
      const g = extrudeUp(s, sy, 0.04, { curveSegments: 2, bevelSegments: 1 });
      g.translate(x, y, z);
      boxes.push(g);
    };
    add(w, CAGE_T, len, 0, 0, 0);
    add(w, CAGE_T, len, 0, CAGE_T + CAGE_INNER, 0);
    add(CAGE_T, CAGE_INNER + 2 * CAGE_T, len, -(w - CAGE_T) / 2, 0, 0);
    add(CAGE_T, CAGE_INNER + 2 * CAGE_T, len, (w - CAGE_T) / 2, 0, 0);
    // Serrations on the floor that bite the wire.
    for (const z of [-0.8, 0, 0.8]) add(w - 0.8, 0.12, 0.25, 0, CAGE_T, z);
    const merged = mergeAll(boxes);
    merged.translate(0, 0, WELL_Z);
    return merged;
  }, []);

  const barGeometry = useDisposable(() => {
    const parts: BufferGeometry[] = [];
    const plate = new Shape();
    addRoundedRect(plate, 2.5, 3.3, 0.2);
    const a = extrudeUp(plate, BAR_TOP - BAR_BOTTOM, 0.05, { curveSegments: 3, bevelSegments: 1 });
    a.translate(0, BAR_BOTTOM, -0.2);
    parts.push(a);
    const leg = new Shape();
    addRoundedRect(leg, 2.5, 0.4, 0.05);
    const b = extrudeUp(leg, BAR_BOTTOM + 0.1, 0.05, { curveSegments: 2, bevelSegments: 1 });
    b.translate(0, 0, -1.75);
    parts.push(b);
    return mergeAll(parts);
  }, []);

  const headGeometry = useDisposable(
    () => screwHeadGeometry(1.72, SCREW_HEAD_H, 'combinada', { slot: 0.5 }),
    [],
  );
  const shaftGeometry = useDisposable(
    () => threadedRodGeometry(2.6, 0.5, SCREW_SHAFT + 0.2, 32),
    [],
  );

  return (
    <group position={[0, SCREW_TERMINAL_SEAT, 0]}>
      <mesh geometry={housingGeometry}>
        <Material
          color={housing.color}
          roughness={0.55}
          roughnessMap={noise}
          clip
          cutColor={housing.cut}
        />
      </mesh>
      {labelText.replace(/\|/g, '') && (
        <Decal
          map={labelMap}
          width={n * pitch}
          height={LABEL_DEPTH}
          position={[0, H + 0.01, (D_BACK + 0.4 + WELL_Z - WELL_R - 0.1) / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          roughness={0.6}
          clip
        />
      )}
      {xs.map((x, i) => (
        <Way
          key={i}
          index={i}
          x={x}
          turns={turns[i]!}
          wire={i < wireCount ? (colorNames[i] ?? DEFAULT_WIRES[i % DEFAULT_WIRES.length]!) : null}
          cage={cageGeometry}
          bar={barGeometry}
          head={headGeometry}
          shaft={shaftGeometry}
        />
      ))}
    </group>
  );
}

interface WayProps {
  index: number;
  x: number;
  turns: number;
  wire: string | null;
  cage: BufferGeometry;
  bar: BufferGeometry;
  head: BufferGeometry;
  shaft: BufferGeometry;
}

/** One way: current bar and pin, rising cage, screw and (optionally) the wire. */
function Way({ index, x, turns, wire, cage, bar, head, shaft }: WayProps) {
  const cageRef = useRef<Group>(null);
  const screwRef = useRef<Group>(null);
  const spinRef = useRef<Group>(null);
  const wireRef = useRef<Group>(null);
  const closedFloor = BAR_BOTTOM - (wire ? 2 * WIRE_R : 0) - CAGE_T - (wire ? 0 : 0.02);
  const first = index === 0;

  useSmooth(
    [turns],
    ([t]) => {
      const v = t!;
      const floor = closedFloor + (CAGE_OPEN - closedFloor) * v;
      if (cageRef.current) cageRef.current.position.y = floor;
      if (screwRef.current) screwRef.current.position.y = BAR_TOP + SCREW_RISE * v;
      if (spinRef.current) spinRef.current.rotation.y = v * SCREW_TURNS * Math.PI * 2;
      // The wire rests on the cage floor.
      if (wireRef.current) wireRef.current.position.y = floor + CAGE_T + WIRE_R;
    },
    7,
  );

  const insulation = wire ? (WIRE_COLORS[wire] ?? WIRE_COLORS.preto!) : '#000000';
  const stripe = wire === 'verde-amarelo';

  return (
    <group position={[x, 0, 0]}>
      {/* Current bar and PCB pin. */}
      <Explode offset={[0, -9, 0]}>
        <mesh geometry={bar}>
          <Material preset="tin" roughness={0.3} />
        </mesh>
        <Pin x={0} z={-1.75} bottom={-PIN} top={0.2} width={1} thickness={0.8} />
        {first && <Anchor name="barra" position={[0, BAR_TOP, 1]} />}
      </Explode>

      {/* Rising cage. */}
      <Explode offset={[0, 7, 0]} delay={0.15}>
        <group ref={cageRef} position={[0, closedFloor, 0]}>
          <mesh geometry={cage}>
            <Material preset="zinc" color="#c5cad0" roughness={0.36} />
          </mesh>
          {first && <Anchor name="gaiola" position={[1.75, 1.5, WELL_Z + 1.5]} />}
        </group>
      </Explode>

      {/* Screw. */}
      <Explode offset={[0, 13, 0]} delay={0.25}>
        <group ref={screwRef} position={[0, BAR_TOP, WELL_Z]}>
          <group ref={spinRef}>
            <mesh geometry={shaft} position={[0, -0.1, 0]}>
              <Material preset="nickel" roughness={0.35} />
            </mesh>
            <mesh geometry={head} position={[0, SCREW_SHAFT, 0]}>
              <Material preset="nickel" color="#d2d3d0" roughness={0.26} />
            </mesh>
          </group>
          {first && <Anchor name="parafuso" position={[0, SCREW_SHAFT + SCREW_HEAD_H, 0]} />}
        </group>
      </Explode>

      {/* Stripped wire end with its insulation. */}
      {wire && (
        <Explode offset={[0, 0, 14]}>
          <group ref={wireRef} position={[0, closedFloor + CAGE_T + WIRE_R, 0]}>
            <StrandedEnd />
            <WireLead color={insulation} stripe={stripe} />
          </group>
        </Explode>
      )}
    </group>
  );
}

/** Stripped conductor: a twisted bundle of copper strands. */
function StrandedEnd() {
  const twist = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = w / 14;
      for (let i = -8; i < 16; i++) {
        ctx.beginPath();
        ctx.moveTo((i * w) / 7, 0);
        ctx.lineTo((i * w) / 7 + w * 1.6, h);
        ctx.stroke();
      }
    },
    'strands',
    { width: 64, height: 256, color: false },
  );
  const length = D_FRONT + 0.6 - -1.3;
  return (
    <mesh position={[0, 0, (D_FRONT + 0.6 + -1.3) / 2]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[WIRE_R, WIRE_R, length, 20, 1]} />
      <Material preset="copper" bumpMap={twist} bumpScale={2} roughness={0.35} />
    </mesh>
  );
}

/** Insulated part of the wire, leaving the entry and bending down. */
function WireLead({ color, stripe }: { color: string; stripe: boolean }) {
  const geometry = useDisposable(() => {
    const start = D_FRONT + 0.4;
    const path = roundedPath(
      [
        [0, 0, start],
        [0, 0, start + 6],
        [0, -2.5, start + 14],
        [0, -2.5, start + 26],
      ],
      5,
    );
    return tube(path, INSULATION_R, { radial: 20 });
  }, []);
  const stripeMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      if (!stripe) return;
      ctx.fillStyle = '#f0c419';
      for (let i = 0; i < 4; i++) ctx.fillRect((i / 4) * w, 0, w / 8, h);
    },
    `${color}|${stripe}`,
    { width: 64, height: 16 },
  );
  return (
    <group>
      <mesh geometry={geometry}>
        <Material preset="pvc" color="#ffffff" map={stripeMap} />
      </mesh>
      {/* Far end: insulation and conductor cut flush. */}
      <group position={[0, -2.5, D_FRONT + 0.4 + 26]}>
        <mesh>
          <ringGeometry args={[WIRE_R, INSULATION_R, 24]} />
          <Material preset="pvc" color={color} side={DoubleSide} />
        </mesh>
        <mesh>
          <circleGeometry args={[WIRE_R, 20]} />
          <Material preset="copper" side={DoubleSide} />
        </mesh>
      </group>
      {/* Cut face of the insulation. */}
      <mesh position={[0, 0, D_FRONT + 0.4]}>
        <ringGeometry args={[WIRE_R, INSULATION_R, 24]} />
        <Material preset="pvc" color={color} side={DoubleSide} />
      </mesh>
    </group>
  );
}
