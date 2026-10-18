/**
 * Breadboard jumper wires: Dupont-style jumpers (stranded 26 AWG, PVC
 * Ø 1,3 mm, black 2,54 mm housings 2,5 × 2,5 × 14 mm, male pin Ø 0,64 mm
 * protruding 6 mm, female receptacle with a latch window) and pre-bent solid
 * jumpers (tinned 22 AWG Ø 0,64 mm, PVC Ø 1,3 mm, legs of 6 mm), sizes from
 * typical catalogue drawings of 1-pin 2,54 mm housings and jumper kits.
 *
 * Helpers for scenes and the bench:
 * - `DupontRun({ points, color, ends })`: `points[0]` and the last point are
 *   the connector tips (male pin tip or female opening); the first and last
 *   segments give the connector axes and must be longer than the connector
 *   (20 mm male, 14 mm female) plus a few mm. The wire is a spline through the
 *   points in between.
 * - `RigidJumperRun({ from, to, color })`: `from`/`to` are the top centres of
 *   two holes (e.g. `breadboardHole()`); the jumper lies on the board with its
 *   legs `RIGID_LEG` mm into the holes.
 */
import { useMemo } from 'react';
import { Color, LineCurve3, Matrix4, Quaternion, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import type { PartMeta, PartProps, Vec3 } from '../types';
import {
  framesFromPoints,
  MeshBuilder,
  PathFrames,
  rodProfile,
  sleeveProfile,
  type ProfilePoint,
} from './_wiring-geometry';
import { useGeometrySet, useInsulationTexture } from './_wiring-parts';

type JumperKind = 'dupont' | 'rigido';
type JumperEnds = 'macho-macho' | 'macho-femea' | 'femea-femea';
export type JumperColor =
  | 'vermelho'
  | 'preto'
  | 'azul'
  | 'verde'
  | 'amarelo'
  | 'laranja'
  | 'branco'
  | 'marrom'
  | 'cinza'
  | 'roxo';

export interface JumperWireProps {
  kind?: JumperKind;
  ends?: JumperEnds;
  /** Wire colour, or `codigo` (rigid jumpers: colour by span, resistor code). */
  color?: JumperColor | 'codigo';
  /** Rigid jumpers: distance between the legs in holes (× 2,54 mm). */
  span?: number;
  /** Dupont jumpers: wire length between the housings (mm). */
  length?: number;
}

export const JUMPER_COLORS: Record<JumperColor, { base: string; label: string }> = {
  vermelho: { base: '#c8231d', label: 'vermelho' },
  preto: { base: '#1c1c1e', label: 'preto' },
  azul: { base: '#2358c6', label: 'azul' },
  verde: { base: '#1d8a3c', label: 'verde' },
  amarelo: { base: '#f0c21b', label: 'amarelo' },
  laranja: { base: '#ec6a1a', label: 'laranja' },
  branco: { base: '#efeee9', label: 'branco' },
  marrom: { base: '#6a3a1e', label: 'marrom' },
  cinza: { base: '#8d9196', label: 'cinza' },
  roxo: { base: '#6a3d9e', label: 'roxo' },
};

/** Resistor colour code by digit (0 = preto … 9 = branco). */
const CODE: JumperColor[] = [
  'preto',
  'marrom',
  'vermelho',
  'laranja',
  'amarelo',
  'verde',
  'azul',
  'roxo',
  'cinza',
  'branco',
];

/** Colour of a pre-bent jumper by its span: the digit of the span in tenths of an inch. */
export function jumperCodeColor(span: number): JumperColor {
  return CODE[Math.round(Math.abs(span)) % 10]!;
}

const PITCH = 2.54;
/** Bare legs of a rigid jumper below the board surface (mm). */
export const RIGID_LEG = 6;
const RIGID_COPPER = 0.32;
const RIGID_OUTER = 0.65;
const DUPONT_OUTER = 0.65;
const DUPONT_COPPER = 0.24;
const HOUSING = 2.5;
const HOUSING_LEN = 14;
const PIN_OUT = 6;
const PIN_R = 0.32;

/** Connector layout along its axis (mm from the tip). */
const CONNECTOR = {
  macho: { length: PIN_OUT + HOUSING_LEN, housing: PIN_OUT, insulation: 15.2 },
  femea: { length: HOUSING_LEN, housing: 0, insulation: 9.8 },
} as const;

export const meta: PartMeta = {
  id: 'jumper-wire',
  label: 'Jumper para protoboard',
  category: 'conexoes',
  summary:
    'Jumpers para protoboard: tipo Dupont, com conectores macho ou fêmea de 2,54 mm, e jumpers rígidos dobrados em U.',
  defaults: { kind: 'dupont', ends: 'macho-macho', color: 'vermelho', span: 6, length: 100 },
  controls: {
    kind: {
      kind: 'select',
      label: 'Tipo',
      options: [
        { value: 'dupont', label: 'Dupont (fio flexível com conectores)' },
        { value: 'rigido', label: 'Rígido dobrado em U' },
      ],
    },
    ends: {
      kind: 'select',
      label: 'Pontas (Dupont)',
      options: [
        { value: 'macho-macho', label: 'Macho-macho' },
        { value: 'macho-femea', label: 'Macho-fêmea' },
        { value: 'femea-femea', label: 'Fêmea-fêmea' },
      ],
    },
    color: {
      kind: 'select',
      label: 'Cor',
      options: [
        { value: 'codigo', label: 'Pelo vão (código de cores, rígido)' },
        ...(Object.keys(JUMPER_COLORS) as JumperColor[]).map((c) => ({
          value: c,
          label: JUMPER_COLORS[c].label[0]!.toUpperCase() + JUMPER_COLORS[c].label.slice(1),
        })),
      ],
    },
    span: { kind: 'number', label: 'Vão (rígido)', min: 1, max: 30, step: 1, unit: 'furos' },
    length: {
      kind: 'number',
      label: 'Comprimento (Dupont)',
      min: 40,
      max: 300,
      step: 10,
      unit: 'mm',
    },
  },
  annotations: (p) => {
    if (p.kind === 'rigido') {
      const span = spanOf(p);
      const x = (span * PITCH) / 2;
      return [
        {
          at: [-x, RIGID_LEG * 0.4, 0],
          text: 'Fio rígido 22 AWG estanhado: entra direto no furo',
          exploded: false,
        },
        {
          at: [0, RIGID_LEG + RIGID_OUTER * 2, 0],
          text: `Vão de ${span} furo${span > 1 ? 's' : ''} (${formatNumber(span * PITCH, 4)} mm)`,
          anchor: 'insulation',
          exploded: false,
        },
        { at: [0, 0, 0], text: 'Isolação de PVC', anchor: 'insulation', exploded: true },
        {
          at: [0, 0, 0],
          text: 'Condutor sólido de cobre estanhado',
          anchor: 'conductor',
          exploded: true,
        },
      ];
    }
    const layout = dupontLayout(p);
    const [a, b] = endsOf(p);
    return [
      {
        at: layout.tipA,
        text:
          a === 'macho'
            ? 'Pino macho: entra no furo da protoboard'
            : 'Conector fêmea: recebe um pino',
        exploded: false,
      },
      ...(b !== a
        ? [
            {
              at: layout.tipB,
              text: b === 'macho' ? 'Pino macho' : 'Conector fêmea: recebe um pino',
              exploded: false,
            },
          ]
        : []),
      { at: layout.mid, text: 'Fio flexível 26 AWG com isolação de PVC', exploded: false },
      { at: [0, 0, 0], text: 'Carcaça plástica de 2,54 mm', anchor: 'housing', exploded: true },
      {
        at: [0, 0, 0],
        text: 'Contato metálico crimpado no fio',
        anchor: 'contact',
        exploded: true,
      },
    ];
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    if (p.kind === 'rigido') {
      const span = spanOf(p);
      const color = colorOf(p);
      const code =
        p.color === 'codigo'
          ? ` A cor segue o vão pelo código de cores dos resistores, como em muitos kits (${span} = ${color}).`
          : '';
      return `Jumper rígido ${color}, fio 22 AWG estanhado dobrado em U, vão de ${span} furo${span > 1 ? 's' : ''} (${formatNumber(span * PITCH, 4)} mm), pernas de ${RIGID_LEG} mm.${code}`;
    }
    const color = colorOf(p);
    return `Jumper tipo Dupont ${String(p.ends).replace('femea', 'fêmea')}, ${color}, com ${formatNumber(Number(p.length) / 10)} cm de fio flexível 26 AWG e conectores de 2,54 mm.`;
  },
  view: [0.75, 1.15, 1.25],
};

function spanOf(p: PartProps) {
  return Math.min(Math.max(Math.round(Number(p.span) || 1), 1), 60);
}

function colorOf(p: PartProps): JumperColor {
  if (p.color === 'codigo') return p.kind === 'rigido' ? jumperCodeColor(spanOf(p)) : 'vermelho';
  return (p.color as JumperColor) in JUMPER_COLORS ? (p.color as JumperColor) : 'vermelho';
}

function endsOf(p: PartProps): ['macho' | 'femea', 'macho' | 'femea'] {
  if (p.ends === 'femea-femea') return ['femea', 'femea'];
  if (p.ends === 'macho-femea') return ['macho', 'femea'];
  return ['macho', 'macho'];
}

/** The default Dupont jumper lying on the table: housings on the X axis, wire bowing back. */
function dupontLayout(p: PartProps) {
  const length = Math.max(Number(p.length) || 100, 30);
  const [a, b] = endsOf(p);
  const y = HOUSING / 2;
  const r = DUPONT_OUTER;
  const half = Math.max(length * 0.36, 10);
  const tipA: Vec3 = [-half - CONNECTOR[a].length, y, 0];
  const tipB: Vec3 = [half + CONNECTOR[b].length, y, 0];
  // z(x) = -h sin²(…): leaves both housings along X and bows back by h.
  const sample = (h: number, steps = 28): Vec3[] =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const x = -half + (2 * half * i) / steps;
      const f = Math.sin((Math.PI * (x + half)) / (2 * half));
      const edge = Math.min(x + half, half - x);
      const t = Math.min(Math.max((edge - 4) / 10, 0), 1);
      const drop = 1 - t * t * (3 - 2 * t);
      return [x, r + (y - r) * drop, -h * f * f];
    });
  const lengthOf = (pts: Vec3[]) =>
    pts.reduce(
      (sum, q, i) =>
        i === 0
          ? 0
          : sum + Math.hypot(q[0] - pts[i - 1]![0], q[1] - pts[i - 1]![1], q[2] - pts[i - 1]![2]),
      0,
    );
  let lo = 0;
  let hi = length;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (lengthOf(sample(mid, 64)) > length) hi = mid;
    else lo = mid;
  }
  const h = (lo + hi) / 2;
  const points: Vec3[] = [tipA, ...sample(h), tipB];
  return { points, tipA, tipB, mid: [0, r * 2, -h] as Vec3 };
}

export default function JumperWire(props: JumperWireProps) {
  const p = { ...meta.defaults, ...props } as Required<JumperWireProps>;
  const color = colorOf(p);
  if (p.kind === 'rigido') {
    const x = (spanOf(p) * PITCH) / 2;
    return (
      <RigidJumperRun
        from={[-x, RIGID_LEG, 0]}
        to={[x, RIGID_LEG, 0]}
        color={color}
        explodable
        anchors
      />
    );
  }
  const layout = dupontLayout(p);
  const [a, b] = endsOf(p);
  return <DupontRun points={layout.points} color={color} start={a} end={b} explodable anchors />;
}

export interface RigidJumperRunProps {
  /** Top centre of the first hole (mm). */
  from: Vec3;
  /** Top centre of the second hole (mm). */
  to: Vec3;
  color?: JumperColor;
  /** Insulation lifts off in the exploded view. */
  explodable?: boolean;
  anchors?: boolean;
}

/** A pre-bent solid jumper lying on the board between two holes. */
export function RigidJumperRun({
  from,
  to,
  color = 'vermelho',
  explodable = false,
  anchors = false,
}: RigidJumperRunProps) {
  const base = JUMPER_COLORS[color]?.base ?? JUMPER_COLORS.vermelho.base;
  const geometries = useGeometrySet(() => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const dir = b.clone().sub(a);
    dir.y = 0;
    const span = Math.max(dir.length(), 0.5);
    dir.normalize();
    const h = RIGID_OUTER;
    const top = (v: Vector3, along: number) => [v.x + dir.x * along, v.y + h, v.z + dir.z * along];
    const legs: Vec3[] = [
      [a.x, a.y - RIGID_LEG, a.z],
      [a.x, a.y + h, a.z],
      [b.x, b.y + h, b.z],
      [b.x, b.y - RIGID_LEG, b.z],
    ];
    const frames = framesFromPoints(legs, { bend: 0.9 });
    const conductor = new MeshBuilder()
      .sweep(frames, rodProfile(0, frames.length, RIGID_COPPER, 0.05), {
        radial: 16,
        maxTurn: 0.12,
      })
      .build();
    const margin = Math.min(0.95, span * 0.3);
    const ends = [top(a, margin), top(a, span - margin)] as Vec3[];
    const sleeveFrames = framesFromPoints(ends);
    const insulation = new MeshBuilder()
      .sweep(
        sleeveFrames,
        sleeveProfile(0, sleeveFrames.length, RIGID_OUTER, RIGID_COPPER + 0.01, {
          fillet: 0.1,
          bore: 0,
        }),
        { radial: 24, uvPeriod: 50 },
      )
      .build();
    return { conductor, insulation };
  }, [from, to]);
  const map = useInsulationTexture({ base, ink: '#000000', diameter: RIGID_OUTER * 2, period: 50 });
  const mid: Vec3 = [
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2 + RIGID_OUTER * 2,
    (from[2] + to[2]) / 2,
  ];
  const insulation = (
    <>
      <mesh geometry={geometries.insulation}>
        <Material
          preset="pvc"
          color="#ffffff"
          map={map}
          roughness={0.4}
          clearcoat={0.3}
          clip
          cutColor={darker(base)}
        />
      </mesh>
      {anchors && <Anchor name="insulation" position={mid} />}
    </>
  );
  return (
    <group>
      {explodable ? <Explode offset={[0, 4, 0]}>{insulation}</Explode> : insulation}
      <mesh geometry={geometries.conductor}>
        <Material preset="tin" roughness={0.3} clip cutColor="#c7a58c" />
      </mesh>
      {anchors && (
        <Anchor name="conductor" position={[mid[0], mid[1] - RIGID_OUTER * 1.6, mid[2]]} />
      )}
    </group>
  );
}

export interface DupontRunProps {
  /** Connector tip, path points of the wire, other connector tip (mm). */
  points: Vec3[];
  color?: JumperColor;
  start?: 'macho' | 'femea';
  end?: 'macho' | 'femea';
  /** Housings lift off in the exploded view. */
  explodable?: boolean;
  anchors?: boolean;
}

/** A Dupont jumper along a path, with its two connectors. */
export function DupontRun({
  points,
  color = 'vermelho',
  start = 'macho',
  end = 'macho',
  explodable = false,
  anchors = false,
}: DupontRunProps) {
  const base = JUMPER_COLORS[color]?.base ?? JUMPER_COLORS.vermelho.base;
  const ends = useMemo(() => {
    const n = points.length;
    const tipA = new Vector3(...points[0]!);
    const tipB = new Vector3(...points[n - 1]!);
    const dirA = new Vector3(...points[1]!).sub(tipA).normalize();
    const dirB = new Vector3(...points[n - 2]!).sub(tipB).normalize();
    return { tipA, tipB, dirA, dirB };
  }, [points]);

  const wire = useGeometrySet(() => {
    const { tipA, tipB, dirA, dirB } = ends;
    const at = (tip: Vector3, dir: Vector3, d: number): Vec3 => {
      const v = tip.clone().addScaledVector(dir, d);
      return [v.x, v.y, v.z];
    };
    const ca = CONNECTOR[start];
    const cb = CONNECTOR[end];
    const path: Vec3[] = [
      at(tipA, dirA, ca.insulation),
      at(tipA, dirA, ca.length),
      at(tipA, dirA, ca.length + 3),
      ...points.slice(1, -1).filter((q) => {
        const v = new Vector3(...q);
        return v.distanceTo(tipA) > ca.length + 4 && v.distanceTo(tipB) > cb.length + 4;
      }),
      at(tipB, dirB, cb.length + 3),
      at(tipB, dirB, cb.length),
      at(tipB, dirB, cb.insulation),
    ];
    const frames = framesFromPoints(path, { smooth: true });
    const insulation = new MeshBuilder()
      .sweep(
        frames,
        sleeveProfile(0, frames.length, DUPONT_OUTER, DUPONT_COPPER + 0.01, {
          fillet: 0.1,
          bore: 0,
        }),
        { radial: 20, uvPeriod: 50, maxStep: 20, maxTurn: 0.12 },
      )
      .build();
    return { insulation };
  }, [points, start, end]);
  const map = useInsulationTexture({
    base,
    ink: '#000000',
    diameter: DUPONT_OUTER * 2,
    period: 50,
  });

  return (
    <group>
      <mesh geometry={wire.insulation}>
        <Material
          preset="pvc"
          color="#ffffff"
          map={map}
          roughness={0.42}
          clearcoat={0.25}
          clip
          cutColor={darker(base)}
        />
      </mesh>
      <DupontConnector
        tip={ends.tipA}
        dir={ends.dirA}
        gender={start}
        explodable={explodable}
        anchors={anchors}
      />
      <DupontConnector tip={ends.tipB} dir={ends.dirB} gender={end} explodable={explodable} />
    </group>
  );
}

interface ConnectorProps {
  tip: Vector3;
  dir: Vector3;
  gender: 'macho' | 'femea';
  explodable: boolean;
  anchors?: boolean;
}

/** Housing, metal contact and the wire end inside, built along local +Z and turned to `dir`. */
function DupontConnector({ tip, dir, gender, explodable, anchors = false }: ConnectorProps) {
  const c = CONNECTOR[gender];
  const male = gender === 'macho';
  const quaternion = useMemo(() => {
    // Local Z along the axis; local Y as close to world "up" as possible.
    const z = dir.clone().normalize();
    const ref = Math.abs(z.y) > 0.95 ? new Vector3(0, 0, -1) : new Vector3(0, 1, 0);
    const x = new Vector3().crossVectors(ref, z).normalize();
    const y = new Vector3().crossVectors(z, x);
    return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
  }, [dir]);

  const parts = useGeometrySet(() => {
    const line = new PathFrames(new LineCurve3(new Vector3(0, 0, 0), new Vector3(0, 0, 30)), 1);
    const metal = new MeshBuilder();
    if (male) {
      const pin: ProfilePoint[] = [
        [0, 0],
        [0, 0.1],
        [0.55, PIN_R],
        [9.6, PIN_R],
        [9.6, PIN_R],
        [9.6, 0],
      ];
      metal.sweep(line, pin, { radial: 16, maxStep: 4 });
    }
    // Crimp barrels: conductor crimp around the bare strands, insulation crimp around the PVC.
    const crimpStart = c.insulation - 2.4;
    metal.sweep(
      line,
      sleeveProfile(crimpStart, crimpStart + 1.7, 0.45, DUPONT_COPPER + 0.02, { bore: 0.3 }),
      {
        radial: 12,
        shape: crimpShape,
      },
    );
    metal.sweep(
      line,
      sleeveProfile(c.insulation + 0.5, c.insulation + 2.4, DUPONT_OUTER + 0.12, DUPONT_OUTER, {
        bore: 0.3,
      }),
      { radial: 16, shape: crimpShape },
    );
    const copper = new MeshBuilder()
      .sweep(line, rodProfile(crimpStart - 0.4, c.insulation + 0.2, DUPONT_COPPER), { radial: 10 })
      .build();
    const housing = new RoundedBoxGeometry(HOUSING, HOUSING, HOUSING_LEN, 2, 0.22);
    housing.translate(0, 0, c.housing + HOUSING_LEN / 2);
    return { metal: metal.build(), copper, housing };
  }, [gender]);

  const bodyZ = male ? 11.2 : 0.4;
  const bodyLen = male ? 3.6 : 6.8;
  const front = c.housing;
  const back = c.housing + HOUSING_LEN;
  const housing = (
    <>
      <mesh geometry={parts.housing}>
        <Material preset="absBlack" roughness={0.45} clip cutColor="#2a2a2c" />
      </mesh>
      {/* Front: the pin's exit hole, or the square socket with its chamfer. */}
      <mesh position={[0, 0, front - 0.004]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={male ? [0.95, 0.95] : [1.45, 1.45]} />
        <Material color="#3a3a3d" roughness={0.6} metalness={0} clip />
      </mesh>
      {!male && (
        <mesh position={[0, 0, front - 0.008]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.95, 0.95]} />
          <Material color="#050505" roughness={0.9} metalness={0} clip />
        </mesh>
      )}
      {/* Latch window on top, with the contact's lance inside. */}
      <mesh position={[0, HOUSING / 2 + 0.004, front + 3.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.25, 2.6]} />
        <Material color="#060606" roughness={0.9} metalness={0} clip />
      </mesh>
      <mesh position={[0, HOUSING / 2 + 0.008, front + 3.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.7, 1.4]} />
        <Material preset="tin" color="#8d9094" roughness={0.45} clip />
      </mesh>
      {/* Back: where the wire goes in. */}
      <mesh position={[0, 0, back + 0.004]}>
        <planeGeometry args={[1.6, 1.6]} />
        <Material color="#09090a" roughness={0.9} metalness={0} clip />
      </mesh>
      {anchors && <Anchor name="housing" position={[0, HOUSING / 2, (front + back) / 2]} />}
    </>
  );

  return (
    <group position={[tip.x, tip.y, tip.z]} quaternion={quaternion}>
      {explodable ? <Explode offset={[0, HOUSING * 2.6, 0]}>{housing}</Explode> : housing}
      <mesh geometry={parts.metal}>
        <Material preset="tin" roughness={0.28} clip cutColor="#c3c6c9" />
      </mesh>
      <mesh position={[0, 0, bodyZ + bodyLen / 2]}>
        <boxGeometry args={male ? [1.1, 1.1, bodyLen] : [1.3, 1.3, bodyLen]} />
        <Material preset="tin" roughness={0.3} clip cutColor="#c3c6c9" />
      </mesh>
      <mesh geometry={parts.copper}>
        <Material preset="copper" roughness={0.3} clip />
      </mesh>
      {anchors && <Anchor name="contact" position={[0, 0.7, bodyZ + bodyLen / 2]} />}
    </group>
  );
}

function darker(color: string) {
  return `#${new Color(color).multiplyScalar(0.8).getHexString()}`;
}

/** Crimp barrels are folded into a rounded "B"; a rounded square is close enough at this size. */
function crimpShape(angle: number) {
  const p = 3.2;
  const c = Math.abs(Math.cos(angle));
  const s = Math.abs(Math.sin(angle));
  return 0.95 / Math.pow(c ** p + s ** p, 1 / p);
}

export type { JumperEnds, JumperKind };
