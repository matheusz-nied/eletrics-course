/**
 * Worm gear reducer (redutor de coroa e rosca sem-fim), size 40 (40 mm
 * between the worm and crown axes), like the gearbox of a sliding gate
 * operator or a small "NMRV 040" type industrial reducer: die-cast aluminium
 * (or painted cast iron) housing, hardened steel worm cut on the input shaft
 * (Ø 14 end with a 5 × 5 key), bronze crown wheel on the vertical output
 * shaft (Ø 17), 6202 bearings on the worm, 6203 on the output, oil seals.
 * Ratio = crown teeth ÷ worm starts; the crown keeps its size and the module
 * changes with the tooth count, as in reducer catalogues (worm pitch
 * diameter 18 to 26 mm, crown 54 to 62 mm). The optional output pinion is a
 * module 4, 12-tooth steel spur gear like the ones that drive a gate rack.
 *
 * The worm turns at a viewable speed and the crown exactly `ratio` times
 * slower, so the teeth stay in mesh. Exploded view: cover up, crown with the
 * output shaft lifted out, worm with its bearings pulled out along its axis.
 * Cutaway (plane at the worm axis height): housing, cover and bosses cut,
 * gears, shafts and bearings whole.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  PlaneGeometry,
  Vector3,
  type Group,
} from 'three';
import { formatNumber } from '../core/format';
import { useReducedMotion } from '../core/motion';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import type { PartAnnotation, PartMeta, PartProps } from '../types';
import { extrudeUp } from './_em-geometry';
import {
  ballBearingGeometry,
  circlePoints,
  keyGeometry,
  latheX,
  polygonPath,
  polygonShape,
  spurGearShape,
  visualRps,
} from './_machine-shared';
import { lathe, merge, scaleUv, useGeometrySet } from './_power-shared';

type Housing = 'aluminio' | 'ferro-fundido';

export interface WormGearProps {
  /** Reduction ratio (crown teeth ÷ worm starts). */
  ratio?: number;
  /** Starts (threads) of the worm: 1 or 2. */
  starts?: number;
  /** Input (worm) speed in rpm; 0 = stopped. */
  rpm?: number;
  /** Steel spur pinion on the output shaft (gate rack drive). */
  pinion?: boolean;
  housing?: Housing;
}

const RATIOS = [15, 20, 30, 40, 60];
/** Centre distance between the worm and crown axes (mm). */
const A = 40;
/** Height of the worm axis and of the crown mid-plane. */
const YC = 28;
/** Housing: half width (X), back and front faces (Z), wall, top of the walls, cover thickness. */
const HX = 46;
const ZB = -43;
const ZF = 64;
const WALL = 5;
const Y_TOP = 48;
const COVER_T = 6;
/** Worm bearings (6202) centred at ±BX; bosses from BOSS0 to BOSS1. */
const BX = 52;
const BOSS0 = 44;
const BOSS1 = 58;
/** Half length of the threaded part of the worm. */
const THREAD = 28;
/** Pinion (module 4, 12 teeth) and output shaft top. */
const PINION_Y0 = 72;
const PINION_Y1 = 94;

function ratioOf(p: PartProps): number {
  const r = Number(p.ratio);
  return RATIOS.includes(r) ? r : 30;
}

function startsOf(p: PartProps): 1 | 2 {
  return Number(p.starts) === 2 ? 2 : 1;
}

/** Gear data for a crown of `teeth` and a worm of `starts`, at the fixed centre distance. */
function gearing(ratio: number, starts: number) {
  const teeth = ratio * starts;
  const m0 = (2 * A) / (10 + teeth);
  const d1 = Math.min(Math.max(10 * m0, 18), 26);
  const m = (2 * A - d1) / teeth;
  const r1 = d1 / 2;
  const r2 = A - r1;
  const px = Math.PI * m;
  const lead = starts * px;
  const rth = r1 - m;
  return {
    teeth,
    m,
    r1,
    r2,
    px,
    lead,
    rth,
    face: 1.5 * rth,
    tanGamma: lead / (2 * Math.PI * r1),
  };
}

export const meta: PartMeta = {
  id: 'worm-gear',
  label: 'Redutor de coroa e rosca sem-fim',
  category: 'saidas',
  summary:
    'Redutor de coroa e rosca sem-fim, como o de um motor de portão: a rosca de aço no eixo de entrada gira a coroa de bronze, muitas vezes mais devagar e com mais força, no eixo de saída a 90°.',
  defaults: { ratio: 30, starts: 1, rpm: 0, pinion: false, housing: 'aluminio' },
  controls: {
    ratio: {
      kind: 'select',
      label: 'Redução',
      options: RATIOS.map((r) => ({ value: r, label: `1:${r}` })),
    },
    starts: {
      kind: 'select',
      label: 'Entradas da rosca',
      options: [
        { value: 1, label: '1 entrada' },
        { value: 2, label: '2 entradas' },
      ],
    },
    rpm: { kind: 'number', label: 'Rotação de entrada', min: 0, max: 3600, step: 10, unit: 'rpm' },
    pinion: { kind: 'toggle', label: 'Pinhão de saída (cremalheira de portão)' },
    housing: {
      kind: 'select',
      label: 'Carcaça',
      options: [
        { value: 'aluminio', label: 'Alumínio' },
        { value: 'ferro-fundido', label: 'Ferro fundido pintado' },
      ],
    },
  },
  annotations: (p) => {
    const ratio = ratioOf(p);
    const starts = startsOf(p);
    const g = gearing(ratio, starts);
    const material = p.housing === 'ferro-fundido' ? 'ferro fundido' : 'alumínio';
    const list: PartAnnotation[] = [
      { at: [0, 0, 0], anchor: 'worm', text: 'Rosca sem-fim de aço: entrada, girada pelo motor' },
      { at: [0, 0, 0], anchor: 'crown', text: `Coroa de bronze com ${g.teeth} dentes` },
      {
        at: [0, 0, 0],
        anchor: 'output',
        text: `Eixo de saída: ${ratio} vezes mais lento e com mais força`,
      },
      { at: [26, 13, ZF], text: `Carcaça de ${material}: guarda o óleo e os rolamentos` },
      { at: [0, 0, 0], anchor: 'bearing', text: 'Rolamentos de esferas' },
      {
        at: [0, YC + g.face / 2 + 1, A - g.r1 - 1],
        text: `Redução: ${g.teeth} dentes da coroa ÷ ${starts} ${starts === 1 ? 'entrada' : 'entradas'} da rosca = 1:${ratio}`,
        exploded: false,
      },
    ];
    if (p.pinion)
      list.push({
        at: [0, 0, 0],
        anchor: 'pinion',
        text: 'Pinhão de aço: empurra a cremalheira do portão',
      });
    return list;
  },
  explode: true,
  cutaway: true,
  cut: { normal: [0, -1, 0], through: [0, YC, 0] },
  animated: (p) => Number(p.rpm) > 0,
  describe: (p) => {
    const ratio = ratioOf(p);
    const starts = startsOf(p);
    const g = gearing(ratio, starts);
    const rpm = Math.max(Number(p.rpm) || 0, 0);
    const material = p.housing === 'ferro-fundido' ? 'ferro fundido pintado' : 'alumínio';
    const entries = starts === 1 ? '1 entrada' : '2 entradas';
    const pinion = p.pinion
      ? ' No eixo de saída há um pinhão de aço de 12 dentes (módulo 4), que empurra a cremalheira de um portão deslizante.'
      : '';
    const state =
      rpm > 0
        ? ` Entrada a ${formatNumber(rpm, 4)} rpm, saída a ${formatNumber(rpm / ratio)} rpm (a animação mostra as rotações bem mais lentas, na mesma proporção).`
        : ' Parado.';
    return `Redutor de coroa e rosca sem-fim com carcaça de ${material}: rosca sem-fim de aço de ${entries} no eixo de entrada e coroa de bronze de ${g.teeth} dentes no eixo de saída, a 90°. Redução 1:${ratio} (${g.teeth} dentes ÷ ${entries}): a coroa avança um dente a cada volta de cada entrada da rosca.${pinion}${state}`;
  },
  view: [0.8, 0.85, 1.05],
};

/** Collects triangles with an outward direction, so the faces always point the right way. */
class MeshBuilder {
  positions: number[] = [];
  uvs: number[] = [];
  indices: number[] = [];
  private a = new Vector3();
  private b = new Vector3();
  private c = new Vector3();

  vertex(x: number, y: number, z: number, u = 0, v = 0): number {
    this.positions.push(x, y, z);
    this.uvs.push(u, v);
    return this.positions.length / 3 - 1;
  }

  private at(i: number, target: Vector3) {
    return target.set(
      this.positions[i * 3]!,
      this.positions[i * 3 + 1]!,
      this.positions[i * 3 + 2]!,
    );
  }

  /** Adds triangle (i, j, k), flipped if its normal points against `out`. */
  tri(i: number, j: number, k: number, out: Vector3) {
    const a = this.at(i, this.a);
    const b = this.at(j, this.b).sub(a);
    const c = this.at(k, this.c).sub(a);
    const n = b.cross(c);
    if (n.lengthSq() < 1e-12) return;
    if (n.dot(out) >= 0) this.indices.push(i, j, k);
    else this.indices.push(i, k, j);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2));
    g.setIndex(this.indices);
    g.computeVertexNormals();
    return g;
  }
}

const smooth = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
};

/**
 * The threaded part of the worm, along X around (0, 0, 0): trapezoidal
 * thread (20°) swept along the helix, built from strips whose corners follow
 * the helix exactly (crisp crests). Right hand: the thread advances +X as the
 * angle grows from +Y towards +Z. The thread runs out at both ends.
 */
function wormGeometry(g: ReturnType<typeof gearing>): BufferGeometry {
  const { r1, m, px, lead } = g;
  const tip = r1 + m;
  const root = r1 - 1.2 * m;
  const t20 = Math.tan((20 * Math.PI) / 180);
  const c = px / 4 - m * t20;
  const f = px / 4 + 1.2 * m * t20;
  // One period of the profile: [s, level] with level 1 = tip, 0 = root; strips between breaks.
  const strips: [number, number][][] = [
    [
      [-c, 1],
      [0, 1],
      [c, 1],
    ],
    [
      [c, 1],
      [f, 0],
    ],
    [
      [f, 0],
      [px / 2, 0],
      [px - f, 0],
    ],
    [
      [px - f, 0],
      [px - c, 1],
    ],
  ];
  const turns = 64;
  const mb = new MeshBuilder();
  const out = new Vector3();
  const kMin = Math.floor((-THREAD - lead) / px) - 1;
  const kMax = Math.ceil(THREAD / px) + 1;
  const runOut = Math.min(px * 1.2, THREAD * 0.4);
  for (let k = kMin; k <= kMax; k++)
    for (const strip of strips) {
      const ids: number[][] = [];
      for (let j = 0; j <= turns; j++) {
        const th = (j / turns) * Math.PI * 2;
        const row: number[] = [];
        for (const [s, level] of strip) {
          const xRaw = k * px + s + (lead * th) / (2 * Math.PI);
          const x = Math.min(Math.max(xRaw, -THREAD), THREAD);
          const w = smooth((THREAD - Math.abs(xRaw)) / runOut);
          const r = root + (tip - root) * level * w;
          row.push(mb.vertex(x, r * Math.cos(th), r * Math.sin(th), j / turns, x / 20));
        }
        ids.push(row);
      }
      for (let j = 0; j < turns; j++)
        for (let i = 0; i < strip.length - 1; i++) {
          const th = ((j + 0.5) / turns) * Math.PI * 2;
          out.set(0, Math.cos(th), Math.sin(th));
          const a = ids[j]![i]!;
          const b = ids[j]![i + 1]!;
          const cc = ids[j + 1]![i]!;
          const d = ids[j + 1]![i + 1]!;
          mb.tri(a, b, cc, out);
          mb.tri(b, d, cc, out);
        }
    }
  return mb.build();
}

/**
 * Crown wheel rim with throated (concave) helical teeth that wrap around
 * the worm, around the Y axis, mid-plane at y = 0. Tooth k is centred at
 * angle `phase + k · 2π / teeth` (measured from +Z towards +X) in the
 * mid-plane and leans with the lead angle of the worm. Also the two side
 * faces of the rim, down to `rimIn`.
 */
function crownRimGeometry(g: ReturnType<typeof gearing>, phase: number, rimIn: number) {
  const { teeth, m, r1, r2, px, face, tanGamma } = g;
  const t20 = Math.tan((20 * Math.PI) / 180);
  const rows = 8;
  const mb = new MeshBuilder();
  const out = new Vector3();
  const tipR = (dy: number) => A - Math.sqrt((r1 - m) ** 2 - dy * dy);
  const rootR = (dy: number) => A - Math.sqrt((r1 + 1.2 * m) ** 2 - dy * dy);
  const pitchR = (dy: number) => A - Math.sqrt(r1 * r1 - dy * dy);
  const halfAngle = (R: number, dy: number) => (px / 4 - (R - pitchR(dy)) * t20) / R;
  const pitch = (2 * Math.PI) / teeth;
  // Columns of one tooth period: [angle offset, radius] as functions of dy.
  const columns = (dy: number): [number, number, boolean][] => {
    const rt = tipR(dy);
    const rf = rootR(dy);
    const bt = halfAngle(rt, dy);
    const bf = halfAngle(rf, dy);
    // [offset from tooth centre, radius, starts a new strip]
    return [
      [-bf, rf, true],
      [-bt, rt, false],
      [-bt, rt, true],
      [0, rt, false],
      [bt, rt, false],
      [bt, rt, true],
      [bf, rf, false],
      [bf, rf, true],
      [bf + (pitch - 2 * bf) / 3, rf, false],
      [bf + ((pitch - 2 * bf) * 2) / 3, rf, false],
      [pitch - bf, rf, false],
    ];
  };
  const point = (alpha: number, R: number, y: number, u: number): number =>
    mb.vertex(R * Math.sin(alpha), y, R * Math.cos(alpha), u, y / 10);
  const edges: { top: number[]; bottom: number[] } = { top: [], bottom: [] };
  for (let k = 0; k < teeth; k++) {
    const grid: number[][] = [];
    const starts: boolean[] = [];
    for (let j = 0; j <= rows; j++) {
      const dy = -face / 2 + (face * j) / rows;
      const centre = phase + k * pitch + (tanGamma * dy) / r2;
      const cols = columns(dy);
      grid.push(cols.map(([o, R], i) => point(centre + o, R, dy, (k + i / cols.length) / teeth)));
      if (j === 0) cols.forEach(([, , s]) => starts.push(s));
    }
    const n = grid[0]!.length;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < n - 1; i++) {
        if (starts[i + 1]) continue;
        const alpha = phase + (k + 0.5) * pitch;
        out.set(Math.sin(alpha), 0, Math.cos(alpha));
        const a = grid[j]![i]!;
        const b = grid[j]![i + 1]!;
        const c = grid[j + 1]![i]!;
        const d = grid[j + 1]![i + 1]!;
        mb.tri(a, b, c, out);
        mb.tri(b, d, c, out);
      }
    // Side outline: one vertex per distinct column.
    for (const [side, j] of [
      ['bottom', 0],
      ['top', rows],
    ] as const) {
      const dy = -face / 2 + (face * j) / rows;
      const centre = phase + k * pitch + (tanGamma * dy) / r2;
      columns(dy).forEach(([o, R, s], i) => {
        if (s && i > 0) return;
        edges[side].push(point(centre + o, R, dy, 0));
      });
    }
  }
  // Side faces of the rim: from the tooth outline down to the inner radius.
  for (const side of ['top', 'bottom'] as const) {
    const y = side === 'top' ? face / 2 : -face / 2;
    out.set(0, side === 'top' ? 1 : -1, 0);
    const ring = edges[side];
    const inner = ring.map((id) => {
      const x = mb.positions[id * 3]!;
      const z = mb.positions[id * 3 + 2]!;
      const l = Math.hypot(x, z) || 1;
      return mb.vertex((x / l) * rimIn, y, (z / l) * rimIn, 0, 0);
    });
    for (let i = 0; i < ring.length; i++) {
      const i1 = (i + 1) % ring.length;
      mb.tri(ring[i]!, ring[i1]!, inner[i]!, out);
      mb.tri(ring[i1]!, inner[i1]!, inner[i]!, out);
    }
  }
  return mb.build();
}

/** Rounded rectangle outline in XZ (x0 < x1, z0 < z1) with back (z0) and front corner radii, as [x, z]. */
function outline(
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  rb: number,
  rf: number,
): [number, number][] {
  const pts: [number, number][] = [];
  const corner = (cx: number, cz: number, r: number, a0: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (Math.PI / 2) * (i / 6);
      pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
    }
  };
  corner(x1 - rf, z1 - rf, rf, 0);
  corner(x0 + rf, z1 - rf, rf, Math.PI / 2);
  corner(x0 + rb, z0 + rb, rb, Math.PI);
  corner(x1 - rb, z0 + rb, rb, Math.PI * 1.5);
  return pts;
}

/** [x, z] points → shape points for `extrudeUp` (its shape Y becomes −Z). */
const toShape = (pts: [number, number][]) => pts.map(([x, z]) => [x, -z] as [number, number]);

export default function WormGear(props: WormGearProps) {
  const p = { ...meta.defaults, ...props } as Required<WormGearProps>;
  const ratio = ratioOf(p as unknown as PartProps);
  const starts = startsOf(p as unknown as PartProps);
  const g = gearing(ratio, starts);
  const pinion = Boolean(p.pinion);
  const iron = p.housing === 'ferro-fundido';
  const noise = getNoiseTexture();
  const shaftTop = pinion ? PINION_Y1 + 2 : 92;

  const geo = useGeometrySet(() => {
    const t = WALL;
    // Housing: bottom plate with mounting holes, walls, bearing bosses; cover with the top boss.
    const plateShape = polygonShape(toShape(outline(-HX - 10, HX + 10, ZB - 9, ZF + 8, 16, 8)));
    for (const [x, z] of [
      [-HX - 4.5, ZB - 3],
      [HX + 4.5, ZB - 3],
      [-HX - 4.5, ZF + 2.5],
      [HX + 4.5, ZF + 2.5],
    ] as const)
      plateShape.holes.push(polygonPath(toShape(circlePoints(3.6, 20, x, z)).reverse()));
    const wallShape = polygonShape(toShape(outline(-HX, HX, ZB, ZF, 18, 9)));
    wallShape.holes.push(
      polygonPath(toShape(outline(-HX + t, HX - t, ZB + t, ZF - t, 13, 4)).reverse()),
    );
    const boss = (side: 1 | -1) => {
      const ring: [number, number][] = [
        [17.6, BOSS0],
        [22, BOSS0],
        [22, BOSS1 - 1],
        [21, BOSS1],
        [17.6, BOSS1],
        [17.6, BOSS0],
      ];
      const profile =
        side === 1 ? ring : ring.map(([r, x]) => [r, -x] as [number, number]).reverse();
      return latheX(profile, 48).translate(0, YC, A);
    };
    const bottomBoss = lathe(
      [
        [20.1, 5],
        [25, 5],
        [25, 18],
        [24, 19],
        [20.1, 19],
        [20.1, 5],
      ],
      48,
    );
    const endCap = latheX(
      [
        [0, BOSS1 - 0.5],
        [21, BOSS1 - 0.5],
        [22, BOSS1 + 0.5],
        [22, BOSS1 + 2.4],
        [20.5, BOSS1 + 3.2],
        [0, BOSS1 + 3.2],
      ],
      48,
    ).translate(0, YC, A);
    const plate = extrudeUp(plateShape, 6, 0.8);
    const walls = extrudeUp(wallShape, Y_TOP - 5.5, 0.6).translate(0, 5.5, 0);
    const body = merge([
      scaleUv(plate, 1 / 8, 1 / 8),
      scaleUv(walls, 1 / 8, 1 / 8),
      boss(1),
      boss(-1),
      bottomBoss,
      endCap,
    ]);

    const coverShape = polygonShape(toShape(outline(-HX, HX, ZB, ZF, 18, 9)));
    coverShape.holes.push(polygonPath(toShape(circlePoints(9, 32)).reverse()));
    const cover = merge([
      scaleUv(extrudeUp(coverShape, COVER_T, 0.8).translate(0, Y_TOP, 0), 1 / 8, 1 / 8),
      lathe(
        [
          [20.1, Y_TOP + 2],
          [26, Y_TOP + 2],
          [26, Y_TOP + COVER_T + 11],
          [25, Y_TOP + COVER_T + 12],
          [20.1, Y_TOP + COVER_T + 12],
          [20.1, Y_TOP + 2],
        ],
        48,
      ),
    ]);
    const screwPos: [number, number][] = [
      [-HX + 7, ZB + 7],
      [HX - 7, ZB + 7],
      [-HX + 7, ZF - 7],
      [HX - 7, ZF - 7],
    ];
    const screws = merge(
      screwPos.map(([x, z]) =>
        new CylinderGeometry(4.4, 4.4, 4, 20).translate(x, Y_TOP + COVER_T + 2, z),
      ),
    );
    const sockets = merge(
      screwPos.map(([x, z]) =>
        new CylinderGeometry(2, 2, 0.2, 6).translate(x, Y_TOP + COVER_T + 4.02, z),
      ),
    );
    const seals = merge([
      latheX(
        [
          [7.1, -BOSS1 - 3],
          [17.6, -BOSS1 - 3],
          [17.6, -BOSS1 + 0.5],
          [7.1, -BOSS1 + 0.5],
          [7.1, -BOSS1 - 3],
        ],
        40,
      ).translate(0, YC, A),
    ]);
    const topSeal = lathe(
      [
        [8.6, Y_TOP + COVER_T + 12],
        [20.1, Y_TOP + COVER_T + 12],
        [20.1, Y_TOP + COVER_T + 14.5],
        [8.6, Y_TOP + COVER_T + 14.5],
        [8.6, Y_TOP + COVER_T + 12],
      ],
      40,
    );

    // Worm: thread, shaft (bearing seats, input end) and the input key.
    const rCore = g.r1 - 1.2 * g.m - 0.04;
    const shaftProfile: [number, number][] = [
      [0, -BOSS1 - 30],
      [6.6, -BOSS1 - 30],
      [7, -BOSS1 - 29.6],
      [7, -BX - 5.5],
      [7.5, -BX - 5.5],
      [7.5, -BX + 5.5],
      [8.2, -BX + 5.5],
      [8.2, -THREAD - 3],
      [rCore, -THREAD - 0.5],
      [rCore, THREAD + 0.5],
      [8.2, THREAD + 3],
      [8.2, BX - 5.5],
      [7.5, BX - 5.5],
      [7.5, BX + 5.5],
      [6, BX + 5.5],
      [6, BX + 6.5],
      [0, BX + 6.5],
    ];
    const worm = merge([
      wormGeometry(g),
      latheX(shaftProfile, 40),
      keyGeometry(20, 5, 5).translate(-BOSS1 - 15, 4, 0),
    ]);
    worm.translate(0, YC, A);
    const wormBearings = merge(
      [-BX, BX].map((x) =>
        ballBearingGeometry(15, 35, 11, { balls: 8 })
          .rotateZ(-Math.PI / 2)
          .translate(x, YC, A),
      ),
    );

    // Crown: bronze rim with the teeth, web and hub; tooth spaces meet the worm crests.
    const rimIn = g.r2 - 1.2 * g.m - Math.max(3, 2 * g.m);
    const phase = (g.px / 2 - g.lead / 4) / g.r2;
    const crown = merge([
      crownRimGeometry(g, phase, rimIn).translate(0, YC, 0),
      lathe(
        [
          [rimIn, YC + g.face / 2],
          [rimIn, YC + 3],
          [14, YC + 3],
          [14, YC + 9],
          [8.5, YC + 9],
          [8.5, YC - 9],
          [14, YC - 9],
          [14, YC - 3],
          [rimIn, YC - 3],
          [rimIn, YC - g.face / 2],
        ],
        64,
      ),
    ]);
    const outputParts: BufferGeometry[] = [
      lathe(
        [
          [0, 4.5],
          [8, 4.5],
          [8.5, 5],
          [8.5, shaftTop - 0.6],
          [7.9, shaftTop],
          [0, shaftTop],
        ],
        40,
      ),
    ];
    if (!pinion)
      outputParts.push(
        keyGeometry(20, 5, 5)
          .rotateZ(Math.PI / 2)
          .rotateY(Math.PI / 2)
          .translate(0, shaftTop - 13, 6),
      );
    const output = merge(outputParts);
    const pinionGeo = merge([
      extrudeUp(spurGearShape(12, 4, 17, { phase: Math.PI / 12 }), PINION_Y1 - PINION_Y0, 0.6, {
        curveSegments: 4,
      }).translate(0, PINION_Y0, 0),
      new CylinderGeometry(12, 12, 2, 32).translate(0, PINION_Y1 + 1, 0),
      new CylinderGeometry(7.5, 7.5, 5, 6).translate(0, PINION_Y1 + 4.5, 0),
    ]);
    scaleUv(pinionGeo, 1 / 30, 1 / 30);
    const bottomBearing = ballBearingGeometry(17, 40, 12, { balls: 8 }).translate(0, 12, 0);
    const topBearing = ballBearingGeometry(17, 40, 12, { balls: 8 }).translate(
      0,
      Y_TOP + COVER_T + 6,
      0,
    );
    const nameplate = new PlaneGeometry(44, 15).translate(-12, 14, ZF + 0.05);
    return {
      body,
      cover,
      screws,
      sockets,
      seals,
      topSeal,
      worm,
      wormBearings,
      crown,
      output,
      pinionGeo,
      bottomBearing,
      topBearing,
      nameplate,
    };
  }, [ratio, starts, pinion]);

  const plateMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#d3d5d8';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#2b2d30';
      ctx.lineWidth = 5;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = '#1d1f22';
      fitText(ctx, `REDUTOR 1:${ratio}`, w / 2, h * 0.36, w - 40, 44, { weight: 800 });
      fitText(
        ctx,
        `${g.teeth} DENTES ÷ ${starts} ${starts === 1 ? 'ENTRADA' : 'ENTRADAS'}`,
        w / 2,
        h * 0.72,
        w - 40,
        30,
        {
          weight: 600,
        },
      );
    },
    `worm-plate|${ratio}|${starts}`,
    { width: 384, height: 131, fonts: [`800 44px ${FONT_SANS}`, `600 30px ${FONT_SANS}`] },
  );

  // Worm at a viewable speed; the crown exactly `ratio` times slower (teeth in mesh).
  const reduced = useReducedMotion();
  const wormRef = useRef<Group>(null);
  const crownRef = useRef<Group>(null);
  const angle = useRef(0);
  const rpm = Math.max(Number(p.rpm) || 0, 0);
  const rps = Math.min(visualRps(rpm), reduced ? 0.25 : Infinity);
  useFrame((_, dt) => {
    if (rps === 0) return;
    angle.current += 2 * Math.PI * rps * Math.min(dt, 0.05);
    if (wormRef.current) wormRef.current.rotation.x = angle.current % (2 * Math.PI * ratio);
    if (crownRef.current) crownRef.current.rotation.y = -angle.current / ratio;
  });

  const housingMaterial = iron ? (
    <Material
      color="#3f4b5c"
      metalness={0}
      roughness={0.6}
      roughnessMap={noise}
      clearcoat={0.12}
      clearcoatRoughness={0.5}
      clip
      cutColor="#55585c"
    />
  ) : (
    <Material
      preset="aluminum"
      color="#cdd0d3"
      roughness={0.5}
      roughnessMap={noise}
      clip
      cutColor="#9a9ea3"
    />
  );
  const bearing = <Material preset="chrome" color="#d9dcdf" roughness={0.18} />;
  const tipY = pinion ? PINION_Y1 + 7 : shaftTop;

  return (
    <group>
      <mesh geometry={geo.body}>{housingMaterial}</mesh>
      <mesh geometry={geo.nameplate}>
        <Material color="#ffffff" map={plateMap} metalness={0.5} roughness={0.45} clip />
      </mesh>
      <mesh geometry={geo.seals}>
        <Material preset="rubber" clip />
      </mesh>
      <mesh geometry={geo.bottomBearing}>{bearing}</mesh>

      {/* Cover with the top bearing, seal and screws. */}
      <Explode offset={[0, 100, 0]} delay={0.1}>
        <mesh geometry={geo.cover}>{housingMaterial}</mesh>
        <mesh geometry={geo.screws}>
          <Material preset="steel" color="#3a3c40" roughness={0.35} clip />
        </mesh>
        <mesh geometry={geo.sockets}>
          <Material color="#0f1012" roughness={0.9} clip />
        </mesh>
        <mesh geometry={geo.topBearing}>{bearing}</mesh>
        <mesh geometry={geo.topSeal}>
          <Material preset="rubber" />
        </mesh>
      </Explode>

      {/* Crown with the output shaft (and pinion), lifted out. */}
      <Explode offset={[0, 44, 0]} delay={0.25}>
        <group ref={crownRef}>
          <mesh geometry={geo.crown}>
            <Material
              preset="brass"
              color="#c08a52"
              roughness={0.32}
              roughnessMap={noise}
              clearcoat={0.3}
              clearcoatRoughness={0.3}
            />
          </mesh>
          <mesh geometry={geo.output}>
            <Material preset="steel" color="#cfd2d5" roughness={0.22} />
          </mesh>
          {pinion && (
            <mesh geometry={geo.pinionGeo}>
              <Material preset="steel" color="#b9bcc0" roughness={0.3} roughnessMap={noise} />
            </mesh>
          )}
        </group>
        <Anchor name="crown" position={[-g.r2 * 0.62, YC + g.face / 2, -g.r2 * 0.62]} />
        <Anchor name="output" position={[0, tipY, 0]} />
        {pinion && <Anchor name="pinion" position={[20, (PINION_Y0 + PINION_Y1) / 2, 20]} />}
      </Explode>

      {/* Worm with its bearings, pulled out along its axis. */}
      <Explode offset={[-125, 0, 0]} delay={0.4}>
        <group position={[0, YC, A]}>
          <group ref={wormRef}>
            <mesh geometry={geo.worm} position={[0, -YC, -A]}>
              <Material preset="steel" color="#d7dadd" roughness={0.18} roughnessMap={noise} />
            </mesh>
          </group>
        </group>
        <mesh geometry={geo.wormBearings}>{bearing}</mesh>
        <Anchor name="worm" position={[6, YC + g.r1 + g.m, A]} />
        <Anchor name="bearing" position={[-BX, YC + 12, A + 6]} />
      </Explode>
    </group>
  );
}
