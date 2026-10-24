/**
 * Photovoltaic module, lying glass up, in two typical sizes:
 *
 * - 60 cells, the residential module of the 2010s: 1.650 × 992 × 35 mm,
 *   6 × 10 monocrystalline cells of 156,75 mm (pseudo-square, 5 busbars),
 *   3 bypass diodes, 4 mm² cables with quick connectors; 330 W, Voc 40,6 V,
 *   Isc 10,4 A, Vmp 33,7 V, Imp 9,8 A (typical datasheet figures);
 * - 36 cells, the small "12 V" panel: 540 × 350 × 25 mm, 4 × 9
 *   polycrystalline cells cut to 52 × 78 mm, 2 bypass diodes; 20 W, Voc
 *   21,6 V, Isc 1,23 A, Vmp 17,5 V, Imp 1,14 A.
 *
 * Laminate in the frame's slot: 3,2 mm tempered glass, EVA, the cells with
 * their soldered ribbons, EVA and the white backsheet; anodized aluminium
 * frame (hollow profile with the bottom flange), junction box on the back
 * with the bypass diodes, cables taped to the back with generic quick
 * connectors and the data label. Cells, busbars and fingers are one canvas
 * texture tiled over a single plane, so the 60-cell module stays cheap.
 *
 * `shade` (0–1) lays a leaf over one cell: in a series string that cell
 * limits the current of its whole row until the bypass diode takes over.
 */
import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import {
  BoxGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Path,
  Shape,
  type BufferGeometry,
  type Group,
} from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode, useView } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { axialLathe, smoothPath, tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { extrudeUp, mergeAll, roundedRectShape } from './_em-geometry';
import { scaleUv, seeded } from './_power-shared';

type Cells = 36 | 60;

export interface SolarPanelProps {
  /** Number of cells: the small 36-cell "12 V" panel or the 60-cell residential module. */
  cells?: Cells;
  /** Fraction of one cell covered by a leaf (0 to 1). */
  shade?: number;
}

interface Spec {
  cells: Cells;
  /** Outer size (mm): length along X, width along Z, frame height. */
  length: number;
  width: number;
  height: number;
  cols: number;
  rows: number;
  /** Cell size along X and Z, gap between cells. */
  cellX: number;
  cellZ: number;
  gap: number;
  mono: boolean;
  busbars: number;
  diodes: number;
  /** Frame: bottom flange width, lip over the glass. */
  flange: number;
  lip: number;
  box: { x: number; z: number; h: number };
  cable: { r: number; run: number };
  connector: number;
  ratings: { p: number; voc: number; isc: number; vmp: number; imp: number; vmax: number };
}

const SPECS: Record<Cells, Spec> = {
  60: {
    cells: 60,
    length: 1650,
    width: 992,
    height: 35,
    cols: 10,
    rows: 6,
    cellX: 156.75,
    cellZ: 156.75,
    gap: 3,
    mono: true,
    busbars: 5,
    diodes: 3,
    flange: 25,
    lip: 6,
    box: { x: 85, z: 120, h: 20 },
    cable: { r: 3, run: 420 },
    connector: 7.5,
    ratings: { p: 330, voc: 40.6, isc: 10.4, vmp: 33.7, imp: 9.8, vmax: 1000 },
  },
  36: {
    cells: 36,
    length: 540,
    width: 350,
    height: 25,
    cols: 9,
    rows: 4,
    cellX: 52,
    cellZ: 78,
    gap: 2,
    mono: false,
    busbars: 2,
    diodes: 2,
    flange: 15,
    lip: 4.5,
    box: { x: 50, z: 60, h: 14 },
    cable: { r: 2.5, run: 150 },
    connector: 6.5,
    ratings: { p: 20, voc: 21.6, isc: 1.23, vmp: 17.5, imp: 1.14, vmax: 600 },
  },
};

const specOf = (props: PartProps): Spec => SPECS[Number(props.cells) === 36 ? 36 : 60];
const shadeOf = (props: PartProps) => Math.min(Math.max(Number(props.shade) || 0, 0), 1);

/** Laminate layer thicknesses (mm), top to bottom. */
const GLASS = 3.2;
const EVA = 0.5;
const CELL = 0.2;
const BACK = 0.4;
const LAMINATE = GLASS + EVA * 2 + CELL + BACK;
/** Frame lip thickness above the glass. */
const LIP_T = 1.4;

/** Heights of the layers and the derived geometry of a spec. */
function geometryOf(s: Spec) {
  const glassTop = s.height - LIP_T;
  const glassBottom = glassTop - GLASS;
  const cellY = glassBottom - EVA - CELL / 2;
  const backTop = glassBottom - EVA * 2 - CELL;
  const backBottom = backTop - BACK;
  const pitchX = s.cellX + s.gap;
  const pitchZ = s.cellZ + s.gap;
  const matX = s.cols * pitchX - s.gap;
  const matZ = s.rows * pitchZ - s.gap;
  /** The laminate goes 2 mm into the frame's slot. */
  const lamX = s.length - 4;
  const lamZ = s.width - 4;
  /** Junction box centre: at the +X end, over the last cells. */
  const boxX = s.length / 2 - s.flange - s.box.x / 2 + 12;
  return {
    glassTop,
    glassBottom,
    cellY,
    backTop,
    backBottom,
    pitchX,
    pitchZ,
    matX,
    matZ,
    lamX,
    lamZ,
    boxX,
  };
}

/** Rows (z) of each cell row, the series groups at the +X end and their taps into the box. */
function stringsOf(s: Spec) {
  const g = geometryOf(s);
  const rowZ = Array.from(
    { length: s.rows },
    (_, r) => -g.matZ / 2 + (r + 0.5) * g.pitchZ - s.gap / 2,
  );
  // +X end: row 0 alone, then rows (1, 2), (3, 4)…, the last row alone.
  const groups: number[][] = [[0]];
  for (let r = 1; r < s.rows - 1; r += 2) groups.push([r, r + 1]);
  groups.push([s.rows - 1]);
  const tapPitch = Math.min(30, (s.box.z - 20) / (groups.length - 1));
  const taps = groups.map((_, i) => (i - (groups.length - 1) / 2) * tapPitch);
  return { rowZ, groups, taps };
}

/** The leaf sits on this cell (row, column). */
const LEAF_CELL = { row: 1, col: 3 };

/** Power with one cell partly shaded: limited by that cell, or by losing one diode's group. */
function shadedPower(s: Spec, shade: number) {
  const fraction = Math.max(1 - shade, 1 - 1 / s.diodes);
  return { watts: s.ratings.p * fraction, bypass: 1 - shade < 1 - 1 / s.diodes };
}

const v = (value: number) => formatNumber(value);

// ---------------------------------------------------------------------------
// Meta.

export const meta: PartMeta = {
  id: 'solar-panel',
  label: 'Painel solar fotovoltaico',
  category: 'energia',
  summary:
    'Módulo fotovoltaico de 60 células (330 W) ou de 36 células (20 W): vidro temperado, células de silício com barramentos de prata, moldura de alumínio, caixa de junção com diodos de bypass e cabos com conectores de engate rápido.',
  defaults: { cells: 60, shade: 0 },
  controls: {
    cells: {
      kind: 'select',
      label: 'Células',
      options: [
        { value: 60, label: '60 células (330 W, residencial)' },
        { value: 36, label: '36 células (20 W, "12 V")' },
      ],
    },
    shade: { kind: 'number', label: 'Folha cobrindo uma célula', min: 0, max: 1, step: 0.05 },
  },
  annotations: (props) => {
    const s = specOf(props);
    const shade = shadeOf(props);
    const list: PartAnnotation[] = [
      { at: [0, 0, 0], anchor: 'pv-cell', text: 'Célula de silício (cerca de 0,6 V)' },
      {
        at: [0, 0, 0],
        anchor: 'pv-busbar',
        text: 'Barramentos e dedos de prata coletam a corrente',
      },
      { at: [0, 0, 0], anchor: 'pv-glass', text: 'Vidro temperado' },
      { at: [0, 0, 0], anchor: 'pv-frame', text: 'Moldura de alumínio' },
      {
        at: [0, 0, 0],
        anchor: 'pv-box',
        text: `Caixa de junção com ${s.diodes} diodos de bypass (na parte de trás)`,
      },
      {
        at: [0, 0, 0],
        anchor: 'pv-cables',
        text: 'Cabos com conectores de engate rápido',
      },
      { at: [0, 0, 0], anchor: 'pv-label', text: 'Placa de dados: Voc, Isc, Vmp, Imp' },
      {
        at: [0, 0, 0],
        anchor: 'pv-eva',
        text: 'EVA: plástico transparente que cola e protege as células',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        anchor: 'pv-back',
        text: 'Lâmina traseira (backsheet): isola e veda por trás',
        exploded: true,
      },
    ];
    if (shade > 0)
      list.push({
        at: [0, 0, 0],
        anchor: 'pv-leaf',
        text: 'Sombra numa célula: a fileira inteira perde corrente',
      });
    return list;
  },
  explode: true,
  cutaway: true,
  cut: (props) => {
    const g = geometryOf(specOf(props));
    return { normal: [-1, 0, 0], through: [g.boxX - 2, 0, 0] };
  },
  describe: (props) => {
    const s = specOf(props);
    const r = s.ratings;
    const shade = shadeOf(props);
    const parts: string[] = [];
    const n = s.rows * s.cols;
    parts.push(
      `Painel solar fotovoltaico de ${n} células ${s.mono ? 'monocristalinas' : 'policristalinas'} (${s.rows} × ${s.cols}), com ${formatNumber(s.length)} × ${formatNumber(s.width)} × ${formatNumber(s.height)} mm.`,
      `Por cima, vidro temperado; por baixo dele, as células de silício, cada uma com cerca de 0,6 V, ligadas em série por fitas soldadas sobre os barramentos de prata. Em volta, a moldura de alumínio.`,
      `Atrás, a caixa de junção com ${s.diodes} diodos de bypass e os dois cabos com conectores de engate rápido.`,
      `Placa de dados: Pmáx ${v(r.p)} W, Voc ${v(r.voc)} V, Isc ${v(r.isc)} A, Vmp ${v(r.vmp)} V, Imp ${v(r.imp)} A.`,
    );
    if (shade > 0) {
      const pct = Math.round(shade * 100);
      const { watts, bypass } = shadedPower(s, shade);
      parts.push(
        `Uma folha cobre ${pct} % de uma célula. Como as células da fileira estão em série, a célula sombreada limita a corrente de todas elas${
          bypass
            ? `; com tanta sombra, o diodo de bypass conduz e desvia a corrente desse grupo, e o painel entrega cerca de ${formatNumber(Math.round(watts))} W em vez de ${v(r.p)} W.`
            : `: o painel entrega cerca de ${formatNumber(Math.round(watts))} W em vez de ${v(r.p)} W.`
        }`,
      );
    }
    return parts.join(' ');
  },
  view: [0.45, 1.1, 1],
};

// ---------------------------------------------------------------------------
// Geometry.

/**
 * Frame profile (u inward from the outer face, v up): outer wall, lip over
 * the glass, the slot for the laminate, the hollow chamber under it and the
 * bottom flange.
 */
function profileShape(s: Spec): Shape {
  const H = s.height;
  const st = H - LIP_T;
  const sb = st - LAMINATE - 0.4;
  const li = s.lip;
  const shape = new Shape();
  const pts: [number, number][] = [
    [0, 0],
    [s.flange, 0],
    [s.flange, 1.6],
    [li + 1.5, 1.6],
    [li + 1.5, sb - 1.5],
    [li, sb],
    [1.5, sb],
    [1.5, st],
    [li, st],
    [li, H - 0.5],
    [li - 0.5, H],
    [0, H],
  ];
  shape.moveTo(...pts[0]!);
  for (const p of pts.slice(1)) shape.lineTo(...p);
  shape.closePath();
  const hole = new Path();
  const h0 = 3;
  const h1 = sb - 1.5;
  hole.moveTo(1.5, h0);
  hole.lineTo(1.5, h1);
  hole.lineTo(li, h1);
  hole.lineTo(li, h0);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

/** One frame side `length` long at the +Z edge (distance `edge` from the centre), mitred at 45°. */
function frameSide(s: Spec, length: number, edge: number): BufferGeometry {
  const g = new ExtrudeGeometry(profileShape(s), {
    depth: length,
    bevelEnabled: false,
    curveSegments: 1,
  });
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i);
    const z = p.getZ(i);
    // Mitre: the inner points of both ends come in by their distance from the outer face.
    p.setZ(i, z < length / 2 ? u : length - u);
  }
  g.computeVertexNormals();
  g.rotateY(Math.PI / 2);
  g.translate(-length / 2, 0, edge);
  return g;
}

function frameGeometry(s: Spec): BufferGeometry {
  const L = s.length;
  const D = s.width;
  const sides = [
    frameSide(s, L, D / 2),
    frameSide(s, L, D / 2).rotateY(Math.PI),
    frameSide(s, D, L / 2).rotateY(Math.PI / 2),
    frameSide(s, D, L / 2).rotateY(-Math.PI / 2),
  ];
  return mergeAll(sides);
}

/** Plane slab from y0 to y1 with the given size (centred). */
function slab(x: number, z: number, y0: number, y1: number): BufferGeometry {
  return new BoxGeometry(x, y1 - y0, z).translate(0, (y0 + y1) / 2, 0);
}

/** Cell plane: covers the cell matrix, UVs tiled two cells per texture tile. */
function cellPlane(s: Spec): BufferGeometry {
  const g = geometryOf(s);
  const w = s.cols * g.pitchX;
  const d = s.rows * g.pitchZ;
  const plane = new BoxGeometry(w, CELL, d);
  // Only the top face matters; keep the box (cheap) so the cut shows a section.
  return scaleUv(plane.translate(-s.gap / 2, g.cellY, -s.gap / 2), s.cols / 2, s.rows / 2);
}

/** Tinned copper bus ribbons at both ends of the cell matrix. */
function ribbonGeometry(s: Spec): BufferGeometry {
  const g = geometryOf(s);
  const { rowZ, groups, taps } = stringsOf(s);
  const y = g.cellY;
  const t = 0.3;
  const w = s.mono ? 6 : 4;
  const pieces: BufferGeometry[] = [];
  const bar = (x: number, z0: number, z1: number) =>
    pieces.push(new BoxGeometry(w, t, Math.abs(z1 - z0) + w).translate(x, y, (z0 + z1) / 2));
  const run = (z: number, x0: number, x1: number) =>
    pieces.push(new BoxGeometry(Math.abs(x1 - x0), t, w * 0.6).translate((x0 + x1) / 2, y, z));
  const endA = -g.matX / 2 - 3;
  const endB = g.matX / 2 + 3;
  // −X end: U-turns joining rows (0, 1), (2, 3)…
  for (let r = 0; r + 1 < s.rows; r += 2) {
    bar(endA - 6, rowZ[r]!, rowZ[r + 1]!);
    for (const k of [r, r + 1]) run(rowZ[k]!, endA - 6, endA);
  }
  // +X end: each group gathered to its tap into the junction box.
  groups.forEach((rows, i) => {
    const x = endB + 6 + i * (w + 3);
    const zs = rows.map((r) => rowZ[r]!);
    bar(x, Math.min(...zs, taps[i]!), Math.max(...zs, taps[i]!));
    for (const z of zs) run(z, endB, x);
  });
  return mergeAll(pieces);
}

/** Junction box: body, lid, cable glands. Hangs under the backsheet. */
function boxGeometry(s: Spec) {
  const g = geometryOf(s);
  const { x, z, h } = s.box;
  const top = g.backBottom;
  const body = extrudeUp(roundedRectShape(x, z, 6), h * 0.7, 1.2, { curveSegments: 4 }).translate(
    g.boxX,
    top - h * 0.7,
    0,
  );
  const lid = extrudeUp(roundedRectShape(x - 3, z - 3, 5), h * 0.3, 1.2, {
    curveSegments: 4,
  }).translate(g.boxX, top - h, 0);
  const glands = [-1, 1].map((side) =>
    axialLathe(
      [
        [0, 0],
        [s.cable.r + 2.5, 0],
        [s.cable.r + 2.5, 8],
        [s.cable.r + 1, 10],
        [0, 10],
      ],
      8,
    )
      .rotateX((side * Math.PI) / 2)
      .translate(g.boxX - x * 0.2, top - h * 0.55, (side * z) / 2),
  );
  return { body: mergeAll([body, ...glands]), lid };
}

/** Bypass diodes and terminal rails inside the box. */
function diodeGeometry(s: Spec) {
  const g = geometryOf(s);
  const { taps } = stringsOf(s);
  const top = g.backBottom;
  const y = top - s.box.h * 0.4;
  const xd = g.boxX - 12;
  const bodies: BufferGeometry[] = [];
  const metal: BufferGeometry[] = [];
  const r = s.cells === 60 ? 4 : 2.6;
  for (let i = 0; i + 1 < taps.length; i++) {
    const za = taps[i]!;
    const zb = taps[i + 1]!;
    const len = Math.min(r * 2.2, (zb - za) * 0.55);
    const body = axialLathe(
      [
        [0, -len / 2],
        [r * 0.9, -len / 2],
        [r, -len / 2 + 0.6],
        [r, len / 2 - 0.6],
        [r * 0.9, len / 2],
        [0, len / 2],
      ],
      16,
    );
    body.rotateX(Math.PI / 2).translate(xd, y, (za + zb) / 2);
    bodies.push(body);
    // Cathode band.
    metal.push(
      tube(
        smoothPath([
          [xd, y, za],
          [xd, y, zb],
        ]),
        0.5,
        { radial: 6, segments: 4 },
      ),
    );
  }
  // Terminal rails, one per tap, with the ribbon coming down from the backsheet.
  for (const z of taps) {
    metal.push(new BoxGeometry(s.box.x * 0.55, 1, 5).translate(g.boxX - 4, y + r * 0.4, z));
    metal.push(
      new BoxGeometry(4, s.box.h * 0.5, 0.4).translate(g.boxX + 14, top - s.box.h * 0.25, z),
    );
  }
  const band = taps.slice(0, -1).map((za, i) => {
    const zb = taps[i + 1]!;
    const len = Math.min(r * 2.2, (zb - za) * 0.55);
    return axialLathe(
      [
        [0, 0],
        [r + 0.05, 0],
        [r + 0.05, len * 0.18],
        [0, len * 0.18],
      ],
      16,
    )
      .rotateX(Math.PI / 2)
      .translate(xd, y, (za + zb) / 2 + len / 2 - len * 0.18);
  });
  return { bodies: mergeAll(bodies), metal: mergeAll(metal), band: mergeAll(band) };
}

/** Cable paths: out of each gland, along the back towards −X. */
function cablePaths(s: Spec): Vec3[][] {
  const g = geometryOf(s);
  const top = g.backBottom;
  // Taped to the back, low enough for the connectors to clear the backsheet.
  const yc = top - s.connector - 0.6;
  const x0 = g.boxX - s.box.x * 0.2;
  return [-1, 1].map((side) => {
    const z0 = (side * s.box.z) / 2;
    const out = side * (s.box.z / 2 + s.box.z * 0.35);
    return [
      [x0, top - s.box.h * 0.55, z0 + side * 9],
      [x0, top - s.box.h * 0.55 + 2, z0 + side * 24],
      [x0 - 30, yc, out],
      [x0 - s.cable.run * 0.5, yc, out + side * 6],
      [x0 - s.cable.run, yc, out],
    ];
  });
}

/** Generic quick connector bodies (male on one cable, female on the other), along −X. */
function connectorGeometry(s: Spec) {
  const r = s.connector;
  const paths = cablePaths(s);
  const pieces: BufferGeometry[] = [];
  paths.forEach((path, i) => {
    const end = path[path.length - 1]!;
    const male = i === 0;
    const profile: [number, number][] = male
      ? [
          [0, 0],
          [r * 0.85, 0],
          [r, 3],
          [r, 16],
          [r * 0.8, 17],
          [r * 0.8, 34],
          [r * 0.95, 35],
          [r * 0.95, 44],
          [r * 0.6, 46],
          [r * 0.6, 56],
          [0, 56],
        ]
      : [
          [0, 0],
          [r * 0.85, 0],
          [r, 3],
          [r, 16],
          [r * 0.8, 17],
          [r * 0.8, 30],
          [r * 1.05, 32],
          [r * 1.05, 52],
          [r * 0.9, 54],
          [0, 54],
        ];
    const body = axialLathe(profile, 12);
    // Lathe along +Y → along −X from the cable end.
    body.rotateZ(Math.PI / 2).translate(end[0], end[1], end[2]);
    pieces.push(body);
  });
  return mergeAll(pieces);
}

// ---------------------------------------------------------------------------
// Textures.

/** Two by two cells per tile: monocrystalline (dark, cut corners) or polycrystalline (blue grains). */
function useCellTexture(s: Spec) {
  const g = geometryOf(s);
  const k = s.mono ? 1024 / (2 * g.pitchX) : 6;
  const width = Math.round(2 * g.pitchX * k);
  const height = Math.round(2 * g.pitchZ * k);
  return useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const cw = s.cellX * k;
      const ch = s.cellZ * k;
      const gap = s.gap * k;
      const random = seeded(s.mono ? 3 : 11);
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const x0 = i * (cw + gap);
          const y0 = j * (ch + gap);
          ctx.save();
          ctx.beginPath();
          if (s.mono) {
            // Pseudo-square wafer: corners cut by the round ingot.
            const c = 11 * k;
            ctx.moveTo(x0 + c, y0);
            ctx.lineTo(x0 + cw - c, y0);
            ctx.lineTo(x0 + cw, y0 + c);
            ctx.lineTo(x0 + cw, y0 + ch - c);
            ctx.lineTo(x0 + cw - c, y0 + ch);
            ctx.lineTo(x0 + c, y0 + ch);
            ctx.lineTo(x0, y0 + ch - c);
            ctx.lineTo(x0, y0 + c);
          } else ctx.rect(x0, y0, cw, ch);
          ctx.closePath();
          ctx.clip();
          if (s.mono) {
            const grad = ctx.createLinearGradient(x0, y0, x0 + cw, y0 + ch);
            grad.addColorStop(0, '#1d2638');
            grad.addColorStop(1, '#141b29');
            ctx.fillStyle = grad;
            ctx.fillRect(x0, y0, cw, ch);
          } else {
            ctx.fillStyle = '#2b4f9e';
            ctx.fillRect(x0, y0, cw, ch);
            // Crystal grains.
            for (let n = 0; n < 70; n++) {
              const cx = x0 + random() * cw;
              const cy = y0 + random() * ch;
              const rr = (6 + random() * 16) * k;
              const l = 30 + random() * 22;
              ctx.fillStyle = `hsl(${218 + random() * 10}, ${55 + random() * 15}%, ${l}%)`;
              ctx.beginPath();
              const sides = 5 + Math.floor(random() * 3);
              for (let q = 0; q < sides; q++) {
                const a = (q / sides) * Math.PI * 2 + random() * 0.6;
                const d = rr * (0.6 + random() * 0.5);
                ctx.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
              }
              ctx.closePath();
              ctx.fill();
            }
          }
          // Fingers across the busbars.
          ctx.fillStyle = 'rgba(205, 210, 220, 0.42)';
          const pitch = 1.7 * k;
          for (let x = x0 + pitch / 2; x < x0 + cw; x += pitch)
            ctx.fillRect(x, y0, Math.max(1, 0.12 * k), ch);
          ctx.restore();
        }
      // Busbars along X, with the ribbons soldered over them crossing the gaps.
      ctx.fillStyle = s.mono ? '#c9ccd0' : '#aeb3ba';
      const bw = Math.max(2, (s.mono ? 1.2 : 1.6) * k);
      for (let j = 0; j < 2; j++) {
        const y0 = j * (ch + gap);
        for (let b = 0; b < s.busbars; b++) {
          const y = y0 + (ch * (b + 0.5)) / s.busbars;
          ctx.fillRect(0, y - bw / 2, w, bw);
        }
      }
    },
    `pv-cells|${s.cells}`,
    { width, height, repeat: true },
  );
}

/** A leaf with its veins (transparent around it). */
function useLeafTexture() {
  return useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-0.6);
      const len = w * 0.46;
      const wid = w * 0.24;
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.bezierCurveTo(-len * 0.5, -wid * 1.3, len * 0.5, -wid * 1.2, len, 0);
      ctx.bezierCurveTo(len * 0.5, wid * 1.2, -len * 0.5, wid * 1.3, -len, 0);
      ctx.closePath();
      ctx.fillStyle = '#4f5a24';
      ctx.fill();
      ctx.strokeStyle = '#7d7a3a';
      ctx.lineWidth = w * 0.01;
      ctx.beginPath();
      ctx.moveTo(-len * 1.15, 0);
      ctx.lineTo(len * 0.95, 0);
      for (let i = -4; i <= 4; i++) {
        const x = (i / 5) * len;
        ctx.moveTo(x, 0);
        ctx.lineTo(x + len * 0.18, -wid * 0.75 * Math.cos((i / 5) * 1.3));
        ctx.moveTo(x, 0);
        ctx.lineTo(x + len * 0.18, wid * 0.75 * Math.cos((i / 5) * 1.3));
      }
      ctx.stroke();
      ctx.restore();
    },
    'pv-leaf',
    { width: 512, height: 512 },
  );
}

/** Area of the leaf drawing as a fraction of its square. */
const LEAF_FILL = 0.33;

function useDataLabel(s: Spec) {
  const r = s.ratings;
  return useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#f7f7f4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#2a2d31';
      ctx.lineWidth = w * 0.006;
      ctx.strokeRect(w * 0.02, h * 0.03, w * 0.96, h * 0.94);
      ctx.fillStyle = '#1f2226';
      const left = w * 0.07;
      fitText(ctx, 'Módulo fotovoltaico', w / 2, h * 0.12, w * 0.84, h * 0.09, { weight: 700 });
      fitText(
        ctx,
        `${s.rows * s.cols} células de silício ${s.mono ? 'monocristalino' : 'policristalino'}`,
        w / 2,
        h * 0.22,
        w * 0.84,
        h * 0.055,
        { weight: 500 },
      );
      const rows: [string, string][] = [
        ['Potência máxima (Pmáx)', `${v(r.p)} W`],
        ['Tensão de circuito aberto (Voc)', `${v(r.voc)} V`],
        ['Corrente de curto-circuito (Isc)', `${v(r.isc)} A`],
        ['Tensão de máxima potência (Vmp)', `${v(r.vmp)} V`],
        ['Corrente de máxima potência (Imp)', `${v(r.imp)} A`],
        ['Tensão máxima do sistema', `${v(r.vmax)} V`],
      ];
      rows.forEach(([name, value], i) => {
        const y = h * (0.35 + i * 0.085);
        fitText(ctx, name, left, y, w * 0.62, h * 0.05, { weight: 500, align: 'left' });
        fitText(ctx, value, w - left, y, w * 0.24, h * 0.055, { weight: 700, align: 'right' });
      });
      fitText(
        ctx,
        'Condições padrão: 1.000 W/m², 25 °C, AM 1,5',
        w / 2,
        h * 0.89,
        w * 0.84,
        h * 0.04,
        { weight: 500 },
      );
    },
    `pv-label|${s.cells}`,
    { width: 1024, height: 704, fonts: [`700 40px ${FONT_SANS}`, `500 40px ${FONT_SANS}`] },
  );
}

// ---------------------------------------------------------------------------
// Component.

/** Children shown only while the exploded view is open (the EVA sheets). */
function ExplodedOnly({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null);
  const { explode } = useView();
  useFrame(() => {
    if (ref.current) ref.current.visible = (explode.current ?? 0) > 0.02;
  });
  return (
    <group ref={ref} visible={false}>
      {children}
    </group>
  );
}

export default function SolarPanel(props: SolarPanelProps) {
  const p = { ...meta.defaults, ...props } as PartProps;
  const s = specOf(p);
  const shade = shadeOf(p);
  const g = geometryOf(s);
  const key = s.cells;
  const noise = getNoiseTexture();

  const frame = useDisposable(() => frameGeometry(s), [key]);
  const glass = useDisposable(() => slab(g.lamX, g.lamZ, g.glassBottom, g.glassTop), [key]);
  const back = useDisposable(() => slab(g.lamX, g.lamZ, g.backBottom, g.backTop), [key]);
  const eva = useDisposable(() => slab(g.lamX, g.lamZ, -EVA / 2, EVA / 2), [key]);
  const cells = useDisposable(() => cellPlane(s), [key]);
  const ribbons = useDisposable(() => ribbonGeometry(s), [key]);
  const box = useDisposable(() => {
    const b = boxGeometry(s);
    b.lid.dispose();
    return b.body;
  }, [key]);
  const lid = useDisposable(() => {
    const b = boxGeometry(s);
    b.body.dispose();
    return b.lid;
  }, [key]);
  const diodes = useDisposable(() => {
    const d = diodeGeometry(s);
    d.metal.dispose();
    d.band.dispose();
    return d.bodies;
  }, [key]);
  const diodeMetal = useDisposable(() => {
    const d = diodeGeometry(s);
    d.bodies.dispose();
    return mergeAll([d.metal, d.band]);
  }, [key]);
  const cables = useDisposable(
    () =>
      mergeAll(cablePaths(s).map((path) => tube(smoothPath(path, 0.4), s.cable.r, { radial: 10 }))),
    [key],
  );
  const connectors = useDisposable(() => connectorGeometry(s), [key]);
  const cellMap = useCellTexture(s);
  const leafMap = useLeafTexture();
  const label = useDataLabel(s);

  const gap = s.mono ? 110 : 45;
  const { rowZ } = stringsOf(s);
  const cellX = -g.matX / 2 + (LEAF_CELL.col + 0.5) * g.pitchX - s.gap / 2;
  const cellZ = rowZ[LEAF_CELL.row]!;
  const leafSide = Math.sqrt((shade * s.cellX * s.cellZ) / LEAF_FILL);
  const labelW = s.mono ? 170 : 92;
  const labelD = labelW * (704 / 1024);
  const cellRef = rowZ[s.rows - 2]!;

  return (
    <group>
      {/* Frame. */}
      <mesh geometry={frame}>
        <Material preset="aluminum" color="#c8ccd1" roughness={0.38} clip cutColor="#9fa4aa" />
      </mesh>
      <Anchor name="pv-frame" position={[-s.length / 2 + 2, s.height, s.width / 2 - 2]} />

      {/* Backsheet with the junction box, cables and label (lifts first). */}
      <Explode offset={[0, gap, 0]}>
        <mesh geometry={back}>
          <Material color="#f2f2ee" roughness={0.6} clip cutColor="#d8d8d2" />
        </mesh>
        <mesh geometry={box}>
          <Material preset="pbtBlack" roughnessMap={noise} clip cutColor="#2b2c2f" />
        </mesh>
        <mesh geometry={lid}>
          <Material preset="pbtBlack" color="#26272a" clip cutColor="#2b2c2f" />
        </mesh>
        <mesh geometry={diodes}>
          <Material preset="epoxyBlack" clip />
        </mesh>
        <mesh geometry={diodeMetal}>
          <Material preset="tin" clip />
        </mesh>
        <mesh geometry={cables}>
          <Material preset="pvc" color="#151517" roughness={0.55} clip />
        </mesh>
        <mesh geometry={connectors}>
          <Material preset="absBlack" color="#18181a" roughness={0.5} clip />
        </mesh>
        <mesh position={[-s.length * 0.12, g.backBottom - 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[labelW, labelD]} />
          <Material color="#ffffff" map={label} roughness={0.5} clip />
        </mesh>
        <Anchor name="pv-back" position={[-s.length * 0.3, g.backTop, -s.width * 0.47]} />
        <Anchor name="pv-box" position={[g.boxX, g.backBottom - s.box.h, 0]} />
        <Anchor
          name="pv-cables"
          position={[
            g.boxX - s.box.x * 0.2 - s.cable.run - 30,
            g.backBottom - s.cable.r,
            s.box.z / 2 + s.box.z * 0.35,
          ]}
        />
        <Anchor name="pv-label" position={[-s.length * 0.12, g.backBottom - 0.2, 0]} />
      </Explode>

      {/* Lower EVA. */}
      <Explode offset={[0, gap * 2, 0]}>
        <ExplodedOnly>
          <mesh geometry={eva} position={[0, g.backTop + EVA / 2, 0]}>
            <Material
              color="#ffffff"
              roughness={0.3}
              transparent
              opacity={0.3}
              depthWrite={false}
            />
          </mesh>
        </ExplodedOnly>
      </Explode>

      {/* Cells and ribbons. */}
      <Explode offset={[0, gap * 3, 0]}>
        <mesh geometry={cells}>
          <Material
            color="#ffffff"
            map={cellMap}
            alphaTest={0.5}
            roughness={0.32}
            metalness={0.2}
            clip
            cutColor="#3d4552"
          />
        </mesh>
        <mesh geometry={ribbons}>
          <Material preset="tin" roughness={0.35} clip />
        </mesh>
        <Anchor name="pv-cell" position={[g.matX * 0.32, g.cellY, cellRef]} />
        <Anchor name="pv-busbar" position={[-g.matX * 0.18, g.cellY, rowZ[0]! - s.cellZ * 0.3]} />
      </Explode>

      {/* Upper EVA. */}
      <Explode offset={[0, gap * 4, 0]}>
        <ExplodedOnly>
          <mesh geometry={eva} position={[0, g.glassBottom - EVA / 2, 0]}>
            <Material
              color="#ffffff"
              roughness={0.3}
              transparent
              opacity={0.3}
              depthWrite={false}
            />
          </mesh>
          <Anchor name="pv-eva" position={[-g.lamX * 0.42, g.glassBottom, g.lamZ * 0.45]} />
        </ExplodedOnly>
      </Explode>

      {/* Glass (and the leaf lying on it). */}
      <Explode offset={[0, gap * 5, 0]}>
        <mesh geometry={glass}>
          <Material
            preset="glass"
            color="#eef6f3"
            roughness={0.05}
            thickness={GLASS}
            clip
            cutColor="#b9d3cc"
          />
        </mesh>
        <Anchor name="pv-glass" position={[g.lamX * 0.4, g.glassTop, -g.lamZ * 0.4]} />
        {shade > 0 && (
          <mesh
            position={[cellX, g.glassTop + 0.3, cellZ]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={2}
          >
            <planeGeometry args={[leafSide, leafSide]} />
            <Material
              color="#ffffff"
              map={leafMap}
              alphaTest={0.5}
              roughness={0.7}
              side={DoubleSide}
            />
          </mesh>
        )}
        <Anchor name="pv-leaf" position={[cellX, g.glassTop + 0.5, cellZ]} />
      </Explode>
    </group>
  );
}
