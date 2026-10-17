/**
 * Solderless breadboard (protoboard): 830 points (165,1 × 54,6 mm, 63
 * columns) or 400 points (82,5 × 54,6 mm, 30 columns), 8,5 mm tall with the
 * adhesive backing, 2,54 mm pitch, 7,62 mm centre channel (a DIP fits
 * across), four power rails of groups of 5 holes. Layout and sizes from the
 * typical MB-102 / BB830 drawings. The print (red + and blue − lines, column
 * numbers, row letters) is a canvas texture; the hundreds of holes are one
 * instanced mesh, the springs are instanced too.
 *
 * Coordinates for scenes and the bench — `breadboardHole(variant, row, column)`
 * returns the centre of a hole on the top surface, [x, y, z] in mm, in the
 * part's space (board centred on X/Z, resting on y = 0, top at y = 8,5):
 * - rows `a`–`j` are the terminal strips: `a` is nearest the viewer (+Z),
 *   `e` and `f` sit on each side of the channel, `j` is at the back;
 *   columns 1–63 (or 1–30) run from left (−X) to right.
 * - rails: `top+`, `top-` (behind row j) and `bottom+`, `bottom-` (in front of
 *   row a); `column` is the hole number along the rail, 1–50 (or 1–25), left
 *   to right. On the 830 board with `splitRails`, holes 1–25 and 26–50 are
 *   not connected.
 * Holes a–e of one column are connected; so are f–j; each rail row is one
 * conductor (or two halves).
 */
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Object3D,
  Path,
  Shape,
  ShapeGeometry,
  Vector3,
  type Group,
  type InstancedMesh,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Anchor, Explode, useView } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta, Vec3 } from '../types';
import { addSheet, MeshBuilder } from './_wiring-geometry';

export type BreadboardVariant = 'inteira' | 'meia';
export type BreadboardRail = 'top+' | 'top-' | 'bottom+' | 'bottom-';
export type BreadboardRow =
  'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | BreadboardRail;

export interface BreadboardProps {
  variant?: BreadboardVariant;
  /** Metal strips hidden in the white body, or revealed through a clear body. */
  strips?: 'ocultas' | 'reveladas';
  /** 830-point board: each rail split in two halves (not connected). */
  splitRails?: boolean;
  /** Holes to highlight: `a12` (its 5-hole strip), `a1-e3` (a block), `rail+`, `rail-`, `top+`… */
  highlight?: string;
}

const PITCH = 2.54;
const HEIGHT = 8.5;
const TAPE = 0.7;
const BEVEL = 0.7;
/** Half-size of the chamfered entry and of the square hole below it. */
const ENTRY = 0.75;
const HOLE = 0.5;
/** Depth down to the spring contacts. */
const PIT = 2.0;
const CHANNEL = 1.35;
const CHANNEL_DEPTH = 2.2;
const CLIP_LIFT = 7;
const BODY_LIFT = 20;

const VARIANTS = {
  inteira: { width: 165.1, depth: 54.6, columns: 63, rail: 50, points: 830 },
  meia: { width: 82.5, depth: 54.6, columns: 30, rail: 25, points: 400 },
} as const;

const ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const;
const RAILS: Record<BreadboardRail, { z: number; sign: '+' | '-' }> = {
  'top+': { z: -22.86, sign: '+' },
  'top-': { z: -20.32, sign: '-' },
  'bottom+': { z: 20.32, sign: '+' },
  'bottom-': { z: 22.86, sign: '-' },
};
const RAIL_NAMES = Object.keys(RAILS) as BreadboardRail[];
/** Printed lines: red beside each + row, blue beside each − row. */
const LINES = [
  { z: -24.75, color: '#d1262b' },
  { z: -18.43, color: '#1f5cc2' },
  { z: 18.43, color: '#d1262b' },
  { z: 24.75, color: '#1f5cc2' },
];
const PRINT = '#3a3a3c';
const IVORY = '#efebe0';

function spec(variant: unknown) {
  return VARIANTS[variant === 'meia' ? 'meia' : 'inteira'];
}

function rowZ(row: string): number {
  const i = ROWS.indexOf(row as (typeof ROWS)[number]);
  if (i < 0) return RAILS[row as BreadboardRail]?.z ?? 0;
  return i < 5 ? 3.81 + (4 - i) * PITCH : -(3.81 + (i - 5) * PITCH);
}

function columnX(columns: number, column: number) {
  return (column - (columns + 1) / 2) * PITCH;
}

function railX(holes: number, k: number) {
  const g = k - 1 + Math.floor((k - 1) / 5);
  const span = holes - 1 + Math.floor((holes - 1) / 5);
  return (g - span / 2) * PITCH;
}

/**
 * Centre of a hole on the top surface, in the part's space (mm). Rows `a`–`j`
 * with columns 1–63 (1–30 on the half board); rails `top+`, `top-`,
 * `bottom+`, `bottom-` with the hole number along the rail, 1–50 (1–25).
 */
export function breadboardHole(variant: BreadboardVariant, row: string, column: number): Vec3 {
  const s = spec(variant);
  const r = String(row).toLowerCase();
  if (r in RAILS) {
    const k = Math.min(Math.max(Math.round(column), 1), s.rail);
    return [railX(s.rail, k), HEIGHT, RAILS[r as BreadboardRail].z];
  }
  const c = Math.min(Math.max(Math.round(column), 1), s.columns);
  return [columnX(s.columns, c), HEIGHT, rowZ(r)];
}

interface Hole {
  x: number;
  z: number;
  rail: boolean;
  /** Connected group (one spring clip). */
  group: string;
  row: string;
  column: number;
}

function holesOf(variant: BreadboardVariant, split: boolean): Hole[] {
  const s = spec(variant);
  const out: Hole[] = [];
  for (const row of ROWS) {
    for (let c = 1; c <= s.columns; c++) {
      const side = ROWS.indexOf(row) < 5 ? 'ae' : 'fj';
      out.push({
        x: columnX(s.columns, c),
        z: rowZ(row),
        rail: false,
        group: `${c}:${side}`,
        row,
        column: c,
      });
    }
  }
  for (const rail of RAIL_NAMES) {
    for (let k = 1; k <= s.rail; k++) {
      const half = split && variant === 'inteira' && k > s.rail / 2 ? 2 : 1;
      out.push({
        x: railX(s.rail, k),
        z: RAILS[rail].z,
        rail: true,
        group: `${rail}:${half}`,
        row: rail,
        column: k,
      });
    }
  }
  return out;
}

/** Holes and groups named by the `highlight` text. */
function parseHighlight(text: string, holes: Hole[]) {
  const t = text.trim().toLowerCase().replace(/\s+/g, '').replace('−', '-');
  const picked = new Set<number>();
  if (!t) return { holes: picked, groups: new Set<string>() };
  const railSign = /^(?:rail|barramento|trilho)?([+-])$/.exec(t);
  const railName = /^(top|bottom)([+-])$/.exec(t);
  const single = /^([a-j])(\d{1,2})$/.exec(t);
  const block = /^([a-j])(\d{1,2})-([a-j])(\d{1,2})$/.exec(t);
  holes.forEach((h, i) => {
    if (railSign && h.rail && RAILS[h.row as BreadboardRail].sign === railSign[1]) picked.add(i);
    if (railName && h.row === `${railName[1]}${railName[2]}`) picked.add(i);
    if (block && !h.rail) {
      const r0 = ROWS.indexOf(block[1] as 'a');
      const r1 = ROWS.indexOf(block[3] as 'a');
      const c0 = Number(block[2]);
      const c1 = Number(block[4]);
      const r = ROWS.indexOf(h.row as 'a');
      if (
        r >= Math.min(r0, r1) &&
        r <= Math.max(r0, r1) &&
        h.column >= Math.min(c0, c1) &&
        h.column <= Math.max(c0, c1)
      )
        picked.add(i);
    }
  });
  if (single) {
    const target = holes.find(
      (h) => !h.rail && h.row === single[1] && h.column === Number(single[2]),
    );
    if (target) holes.forEach((h, i) => h.group === target.group && picked.add(i));
  }
  const groups = new Set<string>();
  picked.forEach((i) => groups.add(holes[i]!.group));
  return { holes: picked, groups };
}

export const meta: PartMeta = {
  id: 'breadboard',
  label: 'Protoboard (matriz de contatos)',
  category: 'placas',
  summary:
    'Protoboard de 830 ou 400 pontos, com as lâminas de contato que ligam cada trilha de 5 furos e os barramentos de alimentação.',
  defaults: { variant: 'inteira', strips: 'ocultas', splitRails: false, highlight: '' },
  controls: {
    variant: {
      kind: 'select',
      label: 'Tamanho',
      options: [
        { value: 'inteira', label: 'Inteira (830 pontos)' },
        { value: 'meia', label: 'Meia (400 pontos)' },
      ],
    },
    strips: {
      kind: 'select',
      label: 'Lâminas de contato',
      options: [
        { value: 'ocultas', label: 'Ocultas (corpo branco)' },
        { value: 'reveladas', label: 'Reveladas (corpo transparente)' },
      ],
    },
    splitRails: { kind: 'toggle', label: 'Barramentos divididos ao meio (830)' },
    highlight: { kind: 'text', label: 'Destacar (ex.: a12, a1-e3, rail+)', maxLength: 12 },
  },
  annotations: (p) => {
    const variant = p.variant === 'meia' ? 'meia' : 'inteira';
    const s = spec(variant);
    const col = Math.min(8, s.columns);
    const strip = breadboardHole(variant, 'c', col);
    const rail = breadboardHole(variant, 'bottom+', Math.min(14, s.rail));
    const list = [
      {
        at: [strip[0], HEIGHT + 0.5, strip[2]] as Vec3,
        text: 'Trilha de 5 furos (a–e): todos ligados entre si',
        exploded: false,
      },
      {
        at: [rail[0], HEIGHT + 0.5, (RAILS['bottom+'].z + RAILS['bottom-'].z) / 2] as Vec3,
        text: 'Barramento de alimentação: + (vermelho) e − (azul)',
        exploded: false,
      },
      {
        at: [-s.width * 0.22, HEIGHT - 1, 0] as Vec3,
        text: 'Canal central: separa as duas metades (o CI encaixa aqui)',
        exploded: false,
      },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Lâmina de contato: mola de bronze fosforoso niquelado',
        anchor: 'clip',
      },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Fita dupla-face: fecha o fundo e segura as lâminas',
        anchor: 'tape',
        exploded: true,
      },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Corpo de plástico com os furos',
        anchor: 'body',
        exploded: true,
      },
    ];
    if (variant === 'inteira' && p.splitRails) {
      list.push({
        at: [0, HEIGHT + 0.5, RAILS['top+'].z] as Vec3,
        text: 'Barramento dividido: as duas metades não se ligam',
        exploded: false,
      });
    }
    return list;
  },
  explode: true,
  cutaway: true,
  // Across row c: the front rows come off and every clip shows its U section.
  cut: (p) => ({
    normal: [0, 0, -1],
    through: breadboardHole(p.variant === 'meia' ? 'meia' : 'inteira', 'c', 1),
  }),
  describe: (p) => {
    const variant = p.variant === 'meia' ? 'meia' : 'inteira';
    const s = spec(variant);
    const split = variant === 'inteira' && p.splitRails;
    const strips =
      p.strips === 'reveladas' ? ' O corpo transparente mostra as lâminas metálicas.' : '';
    const highlight = String(p.highlight ?? '').trim();
    return `Protoboard de ${s.points} pontos (${String(s.width).replace('.', ',')} × 54,6 mm): ${s.columns} colunas com duas trilhas de 5 furos ligados (a–e e f–j), separadas pelo canal central, e 4 barramentos de alimentação com ${s.rail} furos${split ? ', divididos ao meio' : ''}.${strips}${highlight ? ` Destaque: ${highlight}.` : ''}`;
  },
  view: [0.25, 1.2, 1.15],
};

export default function Breadboard(props: BreadboardProps) {
  const p = { ...meta.defaults, ...props } as Required<BreadboardProps>;
  const variant: BreadboardVariant = p.variant === 'meia' ? 'meia' : 'inteira';
  const s = spec(variant);
  const split = variant === 'inteira' && !!p.splitRails;
  const revealed = p.strips === 'reveladas';
  const { cutaway } = useView();
  const W = s.width;
  const D = s.depth;

  const holes = useMemo(() => holesOf(variant, split), [variant, split]);
  const highlight = useMemo(
    () => parseHighlight(String(p.highlight ?? ''), holes),
    [p.highlight, holes],
  );

  const shell = useDisposable(() => buildShell(W, D), [W, D]);
  const top = useMemo(() => buildTop(variant), [variant]);
  useLayoutEffect(() => () => top.field.dispose(), [top]);
  const frame = useDisposable(() => buildFrame(W, D, top.edgeZ, top.fx), [W, D, top.edgeZ]);
  const pit = useDisposable(() => buildPit(), []);
  const bottom = useDisposable(() => buildPitBottom(), []);
  const terminalClip = useDisposable(() => buildClip(fingers(5, PITCH)), []);
  const railHoles = split ? s.rail / 2 : s.rail;
  const railClip = useDisposable(
    () => buildClip(Array.from({ length: railHoles }, (_, i) => railX(railHoles, i + 1))),
    [railHoles],
  );

  const print = usePrint(variant, split, revealed, highlight.holes, holes);
  const slit = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#a7a59d';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c9c7bf';
      ctx.fillRect(w * 0.12, 0, w * 0.18, h);
      ctx.fillRect(w * 0.7, 0, w * 0.18, h);
      ctx.fillStyle = '#121212';
      ctx.fillRect(w * 0.42, 0, w * 0.16, h);
    },
    'slit',
    { width: 32, height: 32 },
  );
  const noise = getNoiseTexture();

  // Instances: holes, their contact bottoms, terminal and rail clips.
  const pits = useRef<InstancedMesh>(null);
  const bottoms = useRef<InstancedMesh>(null);
  const terminals = useRef<InstancedMesh>(null);
  const rails = useRef<InstancedMesh>(null);
  const clipGroup = useRef<Group>(null);
  const bottomGroup = useRef<Group>(null);
  const { explode } = useView();

  const terminalGroups = useMemo(() => {
    const list: { x: number; z: number; group: string }[] = [];
    for (let c = 1; c <= s.columns; c++) {
      list.push({ x: columnX(s.columns, c), z: (rowZ('a') + rowZ('e')) / 2, group: `${c}:ae` });
      list.push({ x: columnX(s.columns, c), z: (rowZ('f') + rowZ('j')) / 2, group: `${c}:fj` });
    }
    return list;
  }, [s.columns]);
  const railGroups = useMemo(() => {
    const list: { x: number; z: number; group: string }[] = [];
    for (const rail of RAIL_NAMES) {
      const halves = split ? 2 : 1;
      for (let h = 1; h <= halves; h++) {
        const ks = Array.from({ length: railHoles }, (_, i) => i + 1 + (h - 1) * railHoles);
        const xs = ks.map((k) => railX(s.rail, k));
        list.push({
          x: (xs[0]! + xs[xs.length - 1]!) / 2,
          z: RAILS[rail].z,
          group: `${rail}:${h}`,
        });
      }
    }
    return list;
  }, [split, railHoles, s.rail]);

  useLayoutEffect(() => {
    const o = new Object3D();
    const place = (
      mesh: InstancedMesh | null,
      items: { x: number; y: number; z: number; ry: number }[],
    ) => {
      if (!mesh) return;
      items.forEach((it, i) => {
        o.position.set(it.x, it.y, it.z);
        o.rotation.set(0, it.ry, 0);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    };
    const holeItems = holes.map((h) => ({
      x: h.x,
      y: HEIGHT,
      z: h.z,
      ry: h.rail ? Math.PI / 2 : 0,
    }));
    place(pits.current, holeItems);
    place(bottoms.current, holeItems);
    place(
      terminals.current,
      terminalGroups.map((g) => ({ x: g.x, y: 0, z: g.z, ry: 0 })),
    );
    place(
      rails.current,
      railGroups.map((g) => ({ x: g.x, y: 0, z: g.z, ry: Math.PI / 2 })),
    );
    const tint = (mesh: InstancedMesh | null, lit: boolean[]) => {
      if (!mesh) return;
      const on = new Color('#7fe0a0');
      const off = new Color('#ffffff');
      lit.forEach((value, i) => mesh.setColorAt(i, value ? on : off));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    tint(
      terminals.current,
      terminalGroups.map((g) => highlight.groups.has(g.group)),
    );
    tint(
      rails.current,
      railGroups.map((g) => highlight.groups.has(g.group)),
    );
  }, [holes, terminalGroups, railGroups, highlight, revealed]);

  // Springs show when the body is clear, cut or lifted; the contact bottoms otherwise.
  const showClips = () => revealed || cutaway || (explode.current ?? 0) > 0.001;
  useLayoutEffect(() => {
    if (clipGroup.current) clipGroup.current.visible = showClips();
    if (bottomGroup.current) bottomGroup.current.visible = !showClips();
  });
  useFrame(() => {
    const visible = showClips();
    if (clipGroup.current && clipGroup.current.visible !== visible)
      clipGroup.current.visible = visible;
    if (bottomGroup.current && bottomGroup.current.visible === visible)
      bottomGroup.current.visible = !visible;
  });

  // Clear body: plain transparency (no refraction), so the springs read sharply.
  const bodyMaterial = revealed
    ? {
        color: '#eef3f7',
        metalness: 0,
        roughness: 0.15,
        clearcoat: 0.6,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }
    : { preset: 'absWhite' as const, color: IVORY, roughness: 0.48, roughnessMap: noise };

  const clipAnchor = breadboardHole(variant, 'c', Math.min(8, s.columns));
  const tapeAnchor: Vec3 = [W * 0.32, TAPE, D / 2 - 1];

  return (
    <group>
      {/* Adhesive backing: foam and paper liner. */}
      <mesh position={[0, 0.075, 0]}>
        <boxGeometry args={[W - 0.6, 0.15, D - 0.6]} />
        <Material preset="paper" color="#efe9da" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.15 + (TAPE - 0.15) / 2, 0]}>
        <boxGeometry args={[W - 0.9, TAPE - 0.15, D - 0.9]} />
        <Material color="#f2f2ee" roughness={0.95} metalness={0} />
      </mesh>
      <Anchor name="tape" position={tapeAnchor} />

      {/* Spring clips (phosphor bronze, nickel-plated). */}
      <Explode offset={[0, CLIP_LIFT, 0]} delay={0.1}>
        <group ref={clipGroup}>
          <instancedMesh
            key={`t${terminalGroups.length}`}
            ref={terminals}
            args={[terminalClip, undefined, terminalGroups.length]}
          >
            <Material preset="nickel" roughness={0.28} color="#d9d6cf" />
          </instancedMesh>
          <instancedMesh
            key={`r${railGroups.length}`}
            ref={rails}
            args={[railClip, undefined, railGroups.length]}
          >
            <Material preset="nickel" roughness={0.28} color="#d9d6cf" />
          </instancedMesh>
        </group>
        <Anchor name="clip" position={[clipAnchor[0], 6.3, clipAnchor[2]]} />
      </Explode>

      {/* Body: shell, top surface with the print, the holes. */}
      <Explode offset={[0, BODY_LIFT, 0]}>
        <mesh geometry={shell}>
          <Material {...bodyMaterial} clip cutColor="#e4e1d8" />
        </mesh>
        <mesh geometry={frame}>
          <Material {...bodyMaterial} clip cutColor="#e4e1d8" />
        </mesh>
        <mesh geometry={top.field}>
          <Material
            {...bodyMaterial}
            color="#ffffff"
            opacity={1}
            map={print}
            clip
            cutColor="#e4e1d8"
          />
        </mesh>
        {!revealed && (
          <instancedMesh key={`p${holes.length}`} ref={pits} args={[pit, undefined, holes.length]}>
            <Material
              preset="absWhite"
              color={IVORY}
              roughness={0.55}
              vertexColors
              clip
              cutColor="#e4e1d8"
            />
          </instancedMesh>
        )}
        <group ref={bottomGroup}>
          {!revealed && (
            <instancedMesh
              key={`b${holes.length}`}
              ref={bottoms}
              args={[bottom, undefined, holes.length]}
            >
              <Material preset="nickel" color="#ffffff" map={slit} roughness={0.4} clip />
            </instancedMesh>
          )}
        </group>
        <Anchor name="body" position={[-W * 0.3, HEIGHT, -D / 2 + 2]} />
      </Explode>
    </group>
  );
}

/** Finger positions of a terminal clip (5 holes, centred). */
function fingers(count: number, pitch: number) {
  return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * pitch);
}

/**
 * One spring clip along local Z: a U-shaped base sitting on the tape and a
 * pair of V fingers under every hole (the lead is pinched between them).
 */
function buildClip(positions: number[]): BufferGeometry {
  const builder = new MeshBuilder();
  const t = 0.2;
  const first = Math.min(...positions);
  const last = Math.max(...positions);
  addSheet(
    builder,
    [
      [-0.88, 1.7],
      [-0.7, TAPE + 0.1],
      [0.7, TAPE + 0.1],
      [0.88, 1.7],
    ],
    t,
    [[first - 1.15, last + 1.15]],
  );
  const ranges = positions.map((z): [number, number] => [z - 1.0, z + 1.0]);
  for (const side of [1, -1]) {
    addSheet(
      builder,
      [
        [0.88 * side, 1.7],
        [0.2 * side, 4.9],
        [0.62 * side, 6.2],
      ],
      t,
      ranges,
    );
  }
  return builder.build();
}

/** Shell of the body (sides, rounded edges, bottom) without its top face. */
function buildShell(W: number, D: number): BufferGeometry {
  const shape = roundedRect(W / 2 - BEVEL, D / 2 - BEVEL, 0.8);
  const extruded = new ExtrudeGeometry(shape, {
    depth: HEIGHT - TAPE - 2 * BEVEL,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 4,
    curveSegments: 4,
  });
  extruded.rotateX(-Math.PI / 2);
  extruded.translate(0, TAPE + BEVEL, 0);
  const source = (extruded.index ? extruded.toNonIndexed() : extruded).getAttribute('position');
  const kept: number[] = [];
  for (let i = 0; i < source.count; i += 3) {
    const flatTop = [0, 1, 2].every((k) => source.getY(i + k) > HEIGHT - 1e-3);
    if (flatTop) continue;
    for (let k = 0; k < 3; k++)
      kept.push(source.getX(i + k), source.getY(i + k), source.getZ(i + k));
  }
  extruded.dispose();
  let geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(kept, 3));
  geometry = mergeVertices(geometry, 1e-4);
  geometry.computeVertexNormals();
  return geometry;
}

function roundedRect(hw: number, hd: number, r: number) {
  const shape = new Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  return shape;
}

/**
 * Top surface with square openings at every hole and the centre channel,
 * built from strips (no texture alpha, crisp hole edges). Planar UVs for the
 * print. Returns the z of the strip edges, so the frame around it matches.
 */
function buildTop(variant: BreadboardVariant) {
  const s = spec(variant);
  const W = s.width;
  const D = s.depth;
  const fx = W / 2 - BEVEL - 0.5;
  const fz = D / 2 - BEVEL - 0.5;
  const cx = fx - 0.9;
  const b = new MeshBuilder();
  const up = new Vector3(0, 1, 0);
  const uv = (x: number, z: number) => [(x + W / 2) / W, 1 - (z + D / 2) / D];
  const v = (x: number, z: number, y = HEIGHT) => new Vector3(x, y, z);
  const flat = (x0: number, x1: number, z0: number, z1: number) => {
    if (x1 - x0 < 1e-6 || z1 - z0 < 1e-6) return;
    b.quad(v(x0, z0), v(x1, z0), v(x1, z1), v(x0, z1), up, [
      uv(x0, z0),
      uv(x1, z0),
      uv(x1, z1),
      uv(x0, z1),
    ]);
  };

  type Band = { z0: number; z1: number; xs?: number[]; channel?: boolean };
  const bands: Band[] = [];
  for (const row of ROWS) {
    const z = rowZ(row);
    bands.push({
      z0: z - ENTRY,
      z1: z + ENTRY,
      xs: Array.from({ length: s.columns }, (_, i) => columnX(s.columns, i + 1)),
    });
  }
  for (const rail of RAIL_NAMES) {
    const z = RAILS[rail].z;
    bands.push({
      z0: z - ENTRY,
      z1: z + ENTRY,
      xs: Array.from({ length: s.rail }, (_, i) => railX(s.rail, i + 1)),
    });
  }
  const chamfer = 0.3;
  bands.push({ z0: -CHANNEL - chamfer, z1: CHANNEL + chamfer, channel: true });
  bands.sort((a, c) => a.z0 - c.z0);

  const edgeZ: number[] = [-fz];
  let cursor = -fz;
  for (const band of bands) {
    flat(-fx, fx, cursor, band.z0);
    if (band.xs) {
      let start = -fx;
      for (const x of band.xs) {
        flat(start, x - ENTRY, band.z0, band.z1);
        start = x + ENTRY;
      }
      flat(start, fx, band.z0, band.z1);
    } else {
      flat(-fx, -cx, band.z0, band.z1);
      flat(cx, fx, band.z0, band.z1);
      addGroove(b, cx, chamfer, uv);
    }
    edgeZ.push(band.z0, band.z1);
    cursor = band.z1;
  }
  flat(-fx, fx, cursor, fz);
  edgeZ.push(fz);
  return { field: b.build(), edgeZ, fx, fz };
}

/** Centre channel: chamfered walls, rounded bottom, closed ends. */
function addGroove(
  b: MeshBuilder,
  cx: number,
  chamfer: number,
  uv: (x: number, z: number) => number[],
) {
  const top = CHANNEL + chamfer;
  const floor = HEIGHT - CHANNEL_DEPTH;
  const half: [number, number][] = [
    [top, HEIGHT],
    [CHANNEL, HEIGHT - chamfer],
    [CHANNEL, floor + 0.35],
    [CHANNEL - 0.35, floor],
  ];
  const profile: [number, number][] = [
    ...half,
    ...half
      .slice()
      .reverse()
      .map(([z, y]): [number, number] => [-z, y]),
  ];
  const target = new Vector3(0, HEIGHT + 2, 0);
  for (let i = 0; i < profile.length - 1; i++) {
    const [z0, y0] = profile[i]!;
    const [z1, y1] = profile[i + 1]!;
    const normal = new Vector3(0, z1 - z0, -(y1 - y0)).normalize();
    const mid = new Vector3(0, (y0 + y1) / 2, (z0 + z1) / 2);
    if (normal.dot(target.clone().sub(mid)) < 0) normal.negate();
    b.quad(
      new Vector3(-cx, y0, z0),
      new Vector3(cx, y0, z0),
      new Vector3(cx, y1, z1),
      new Vector3(-cx, y1, z1),
      normal,
      [uv(-cx, z0), uv(cx, z0), uv(cx, z1), uv(-cx, z1)],
    );
  }
  // End walls, as strips between mirrored profile points.
  for (const [x, nx] of [
    [-cx, 1],
    [cx, -1],
  ] as const) {
    const normal = new Vector3(nx, 0, 0);
    for (let i = 0; i < half.length - 1; i++) {
      const [z0, y0] = half[i]!;
      const [z1, y1] = half[i + 1]!;
      b.quad(
        new Vector3(x, y0, z0),
        new Vector3(x, y1, z1),
        new Vector3(x, y1, -z1),
        new Vector3(x, y0, -z0),
        normal,
        [uv(x, z0), uv(x, z1), uv(x, -z1), uv(x, -z0)],
      );
    }
  }
}

/** Thin flat ring between the field and the rounded edge of the shell. */
function buildFrame(W: number, D: number, edgeZ: number[], fx: number) {
  const shape = roundedRect(W / 2 - BEVEL, D / 2 - BEVEL, 0.8);
  // The opening follows every vertex of the field edge (no T-junctions).
  const zs = [...new Set(edgeZ.map((z) => Math.round(z * 1e4) / 1e4))].sort((a, b) => a - b);
  const hole = new Path();
  // Shape Y becomes −Z after the rotation.
  hole.moveTo(-fx, -zs[0]!);
  zs.slice(1).forEach((z) => hole.lineTo(-fx, -z));
  zs.slice()
    .reverse()
    .forEach((z) => hole.lineTo(fx, -z));
  hole.closePath();
  shape.holes.push(hole);
  const geometry = new ShapeGeometry(shape, 4);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, HEIGHT, 0);
  return geometry;
}

/** One hole: chamfered entry and square shaft, darker as it goes down (vertex colours). */
function buildPit(): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const levels = [
    { y: 0, h: ENTRY, c: 0.95 },
    { y: -0.42, h: HOLE, c: 0.78 },
    { y: -PIT, h: HOLE, c: 0.3 },
  ];
  const corners: [number, number][] = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ];
  for (let l = 0; l < levels.length - 1; l++) {
    const a = levels[l]!;
    const b = levels[l + 1]!;
    for (let k = 0; k < 4; k++) {
      const [x0, z0] = corners[k]!;
      const [x1, z1] = corners[(k + 1) % 4]!;
      // Inward normal of this side, tilted up on the chamfer.
      const side = new Vector3(-(x0 + x1) / 2, 0, -(z0 + z1) / 2);
      const n = new Vector3(
        side.x * Math.abs(a.y - b.y),
        a.h - b.h,
        side.z * Math.abs(a.y - b.y),
      ).normalize();
      const quad = [
        [x0 * a.h, a.y, z0 * a.h, a.c],
        [x1 * a.h, a.y, z1 * a.h, a.c],
        [x1 * b.h, b.y, z1 * b.h, b.c],
        [x0 * b.h, b.y, z0 * b.h, b.c],
      ];
      // Winding: seen from inside the hole.
      const p0 = new Vector3(quad[0]![0], quad[0]![1], quad[0]![2]);
      const p1 = new Vector3(quad[1]![0], quad[1]![1], quad[1]![2]);
      const p2 = new Vector3(quad[2]![0], quad[2]![1], quad[2]![2]);
      const flip = p1.clone().sub(p0).cross(p2.clone().sub(p0)).dot(n) < 0;
      const order = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
      for (const i of order) {
        const q = quad[i]!;
        positions.push(q[0]!, q[1]!, q[2]!);
        normals.push(n.x, n.y, n.z);
        colors.push(q[3]!, q[3]!, q[3]!);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

/** The spring contacts seen at the bottom of a hole (slit along local Z). */
function buildPitBottom(): BufferGeometry {
  const b = new MeshBuilder();
  const h = HOLE;
  b.quad(
    new Vector3(-h, -PIT, -h),
    new Vector3(h, -PIT, -h),
    new Vector3(h, -PIT, h),
    new Vector3(-h, -PIT, h),
    new Vector3(0, 1, 0),
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  );
  return b.build();
}

/** Moulded print: rail lines and signs, column numbers, row letters, highlights. */
function usePrint(
  variant: BreadboardVariant,
  split: boolean,
  revealed: boolean,
  picked: Set<number>,
  holes: Hole[],
) {
  const s = spec(variant);
  const W = s.width;
  const D = s.depth;
  const key = `${variant}|${split}|${revealed}|${[...picked].join(',')}`;
  return useCanvasTexture(
    (ctx, w, h) => {
      const px = w / W;
      const X = (x: number) => (x + W / 2) * px;
      const Y = (z: number) => (z + D / 2) * (h / D);
      // On the clear body the print is opaque and the plastic around it is not.
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = revealed ? 'rgba(238,243,247,0.2)' : IVORY;
      ctx.fillRect(0, 0, w, h);

      // Highlighted holes: a soft band and a ring around each.
      if (picked.size) {
        ctx.fillStyle = 'rgba(34,197,94,0.30)';
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 0.28 * px;
        picked.forEach((i) => {
          const hole = holes[i]!;
          const size = 2.3 * px;
          ctx.fillRect(X(hole.x) - size / 2, Y(hole.z) - size / 2, size, size);
          ctx.strokeRect(X(hole.x) - size / 2, Y(hole.z) - size / 2, size, size);
        });
      }

      // Rail lines (broken in the middle on split rails) and their signs.
      const railHalf = railX(s.rail, s.rail);
      const ext = railHalf + 1.6;
      for (const line of LINES) {
        ctx.fillStyle = line.color;
        const y = Y(line.z) - 0.28 * px;
        const height = 0.56 * px;
        if (split) {
          ctx.fillRect(X(-ext), y, (ext - 1.6) * px, height);
          ctx.fillRect(X(1.6), y, (ext - 1.6) * px, height);
        } else {
          ctx.fillRect(X(-ext), y, 2 * ext * px, height);
        }
      }
      for (const rail of RAIL_NAMES) {
        const { z, sign } = RAILS[rail];
        ctx.fillStyle = sign === '+' ? '#d1262b' : '#1f5cc2';
        for (const side of [-1, 1]) {
          fitText(
            ctx,
            sign === '+' ? '+' : '−',
            X(side * (railHalf + 2.6)),
            Y(z),
            3 * px,
            2.4 * px,
            {
              weight: 700,
              family: FONT_SANS,
            },
          );
        }
      }

      // Column numbers above j and below a; row letters at both ends.
      ctx.fillStyle = PRINT;
      const numbers = [1];
      for (let c = 5; c <= s.columns; c += 5) numbers.push(c);
      for (const c of numbers) {
        for (const z of [16.25, -16.25]) {
          fitText(ctx, String(c), X(columnX(s.columns, c)), Y(z), 3 * px, 1.45 * px, {
            weight: 600,
            family: FONT_SANS,
          });
        }
      }
      for (const row of ROWS) {
        for (const side of [-1, 1]) {
          const x = side < 0 ? columnX(s.columns, 1) - 2.35 : columnX(s.columns, s.columns) + 2.35;
          fitText(ctx, row, X(x), Y(rowZ(row)), 2 * px, 1.6 * px, {
            weight: 600,
            family: FONT_SANS,
          });
        }
      }
    },
    key,
    {
      width: variant === 'meia' ? 1024 : 2048,
      height: 680,
      fonts: [`600 40px ${FONT_SANS}`, `700 40px ${FONT_SANS}`],
    },
  );
}

export function isBreadboardRail(row: string): row is BreadboardRail {
  return row in RAILS;
}
