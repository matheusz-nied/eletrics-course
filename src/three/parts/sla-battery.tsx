/**
 * Sealed lead-acid battery, 12 V (VRLA with AGM separators), as used in gate
 * openers, alarm panels and small UPSs (nobreaks). Case sizes from the usual
 * datasheets of the generic 12 V series: 7 Ah is 151 × 65 × 94 mm (about
 * 100 mm to the top of the terminals), 12 Ah is 151 × 98 × 95 mm (about
 * 101 mm). Faston terminals: F1 is a 4,75 × 0,8 mm tab (the "4,8 mm" or
 * 0.187" connector), F2 a 6,35 × 0,8 mm tab (0.250"). Typical ratings
 * printed on these batteries: cycle use 14,4–15,0 V, standby (float)
 * 13,5–13,8 V, maximum initial charging current 0,3 C (2,1 A for 7 Ah,
 * 3,6 A for 12 Ah).
 *
 * ABS case and lid, generic printed label (no brand), red and black terminal
 * collars. Cutaway: the six 2 V cells in series, each a stack of positive
 * plates (PbO₂, brown) and negative plates (Pb, grey) with white glass-mat
 * separators that hold the electrolyte, the straps and inter-cell
 * connectors, and the rubber safety valves under the lid. `bulged` swells the
 * case walls (overcharge or heat).
 */
import { useMemo } from 'react';
import {
  BoxGeometry,
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  PlaneGeometry,
  Shape,
  Vector3,
} from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode, useView } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta, PartProps, Vec3 } from '../types';
import { lathe, merge, roundedRectSlab, useGeometrySet } from './_power-shared';

type Capacity = 7 | 12;
type Terminal = 'F1' | 'F2';

export interface SlaBatteryProps {
  /** Capacity (Ah): sets the case depth. */
  capacity?: Capacity;
  /** Faston terminal size: F1 (4,8 mm) or F2 (6,3 mm). */
  terminal?: Terminal;
  /** Swollen case (overcharged or overheated). */
  bulged?: boolean;
}

const MODELS: Record<Capacity, { l: number; d: number; h: number; imax: number }> = {
  7: { l: 151, d: 65, h: 94, imax: 2.1 },
  12: { l: 151, d: 98, h: 95, imax: 3.6 },
};

/** Faston tabs: width, thickness, height above the lid and hole diameter (mm). */
const TABS: Record<Terminal, { w: number; t: number; h: number; hole: number; name: string }> = {
  F1: { w: 4.75, t: 0.8, h: 6, hole: 1.4, name: 'F1 (4,8 mm)' },
  F2: { w: 6.35, t: 0.8, h: 7.5, hole: 1.6, name: 'F2 (6,3 mm)' },
};

/** Case wall, partition and lid thicknesses; lid height over the case. */
const WALL = 2.5;
const PARTITION = 1.5;
const LID = 9;
const CORNER = 3;
/** Plate stack: negative 1,4 mm, positive 1,8 mm, AGM mats fill the rest. */
const NEG_T = 1.4;
const POS_T = 1.8;
const PLATE_BOTTOM = 6;

export const meta: PartMeta = {
  id: 'sla-battery',
  label: 'Bateria selada 12 V',
  category: 'energia',
  summary:
    'Bateria selada de chumbo-ácido (VRLA/AGM) de 12 V, como a de centrais de portão, alarmes e nobreaks, com terminais faston e, em corte, as seis células, as placas, os separadores e as válvulas.',
  defaults: { capacity: 7, terminal: 'F1', bulged: false },
  controls: {
    capacity: {
      kind: 'select',
      label: 'Capacidade',
      options: [
        { value: 7, label: '7 Ah (151 × 65 × 94 mm)' },
        { value: 12, label: '12 Ah (151 × 98 × 95 mm)' },
      ],
    },
    terminal: {
      kind: 'select',
      label: 'Terminal',
      options: [
        { value: 'F1', label: 'F1, faston de 4,8 mm' },
        { value: 'F2', label: 'F2, faston de 6,3 mm' },
      ],
    },
    bulged: { kind: 'toggle', label: 'Estufada (com defeito)' },
  },
  annotations: (p) => {
    const m = modelOf(p);
    const tab = tabOf(p);
    const g = cellLayout(m);
    const x = g.centers[5]!;
    const list = [
      { at: [0, 0, 0] as Vec3, text: 'Seis células de 2 V em série', anchor: 'cells' },
      { at: [0, 0, 0] as Vec3, text: 'Placas positivas (dióxido de chumbo)', anchor: 'pos' },
      { at: [0, 0, 0] as Vec3, text: 'Placas negativas (chumbo)', anchor: 'neg' },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Separador de fibra de vidro (AGM) com o eletrólito absorvido',
        anchor: 'sep',
      },
      { at: [0, 0, 0] as Vec3, text: 'Válvula de segurança', anchor: 'valve' },
      {
        at: [x, m.h + tab.h, -g.strapZ] as Vec3,
        text: 'Terminal faston positivo (vermelho)',
      },
      {
        at: [-x, m.h + tab.h, -g.strapZ] as Vec3,
        text: 'Terminal negativo (preto)',
      },
    ];
    if (p.bulged)
      list.push({
        at: [0, (m.h - LID) * 0.5, m.d / 2 + bulgeOf(m)] as Vec3,
        text: 'Caixa estufada: tire de uso e leve para reciclar',
      } as (typeof list)[number]);
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const m = modelOf(p);
    const tab = tabOf(p);
    const cap = capacityOf(p);
    const base = `Bateria selada de chumbo-ácido (VRLA, com separadores AGM) de 12 V e ${cap} Ah, ${m.l} × ${m.d} × ${m.h} mm (${formatNumber(m.h + tab.h)} mm até o topo dos terminais), com terminais faston ${tab.name}: vermelho no positivo e preto no negativo. Por dentro, seis células de 2 V em série, com placas de dióxido de chumbo e de chumbo separadas por mantas de fibra de vidro que seguram o eletrólito. Na etiqueta: uso em ciclo 14,4 a 15,0 V, flutuação 13,5 a 13,8 V, corrente inicial máxima ${formatNumber(m.imax)} A.`;
    return p.bulged
      ? `${base} A caixa está estufada, sinal de sobrecarga ou calor: a bateria deve sair de uso e ir para a reciclagem, sem tentar recarregar.`
      : base;
  },
  view: [0.55, 0.6, 1.3],
};

function capacityOf(p: PartProps): Capacity {
  return Number(p.capacity) === 12 ? 12 : 7;
}

function modelOf(p: PartProps) {
  return MODELS[capacityOf(p)];
}

function tabOf(p: PartProps) {
  return TABS[p.terminal === 'F2' ? 'F2' : 'F1'];
}

/** How far the long walls swell at the middle (mm). */
const bulgeOf = (m: { d: number }) => 6 + m.d * 0.05;

/** Cell centres along X, cell width and the strap position (|z|). */
function cellLayout(m: { l: number; d: number }) {
  const inner = m.l - 2 * WALL;
  const cell = (inner - 5 * PARTITION) / 6;
  const centers = Array.from(
    { length: 6 },
    (_, i) => -inner / 2 + cell / 2 + i * (cell + PARTITION),
  );
  const strapZ = m.d / 2 - WALL - 8.5;
  return { inner, cell, centers, strapZ };
}

export default function SlaBattery(props: SlaBatteryProps) {
  const p = { ...meta.defaults, ...props } as Required<SlaBatteryProps>;
  const m = modelOf(p as unknown as PartProps);
  const tab = tabOf(p as unknown as PartProps);
  const cap = capacityOf(p as unknown as PartProps);
  const { l: L, d: D, h: H } = m;
  const boxH = H - LID;
  const g = cellLayout(m);
  const bulge = p.bulged ? bulgeOf(m) : 0;
  const noise = getNoiseTexture();
  const { cutaway } = useView();

  const caseGeo = useGeometrySet(
    () => ({
      walls: caseShell(L, D, CORNER, 0, boxH, WALL, bulge),
      floor: roundedRectSlab(L - 0.4, D - 0.4, CORNER, 0, 2.5, 0.4),
      partitions: merge(
        g.centers
          .slice(1)
          .map((cx) =>
            new BoxGeometry(PARTITION, boxH - 2.5, D - 2 * WALL).translate(
              cx - g.cell / 2 - PARTITION / 2,
              2.5 + (boxH - 2.5) / 2,
              0,
            ),
          ),
      ),
      label: labelGeometry(L, D, boxH, bulge),
    }),
    [L, D, boxH, bulge],
  );

  const lidGeo = useGeometrySet(
    () => ({
      skirt: caseShell(L + 0.8, D + 0.8, CORNER + 0.4, boxH, H - 2.5, WALL, 0),
      top: roundedRectSlab(L + 0.8, D + 0.8, CORNER + 0.4, H - 2.5, H, 0.8),
      cover: roundedRectSlab(L - 50, D - 14, 2, H - 0.6, H + 0.5, 0.3),
      deck: roundedRectSlab(L - 2 * WALL, D - 2 * WALL, 1, boxH, boxH + 2, 0),
    }),
    [L, D, H, boxH],
  );

  const cells = useCellGeometry(m, boxH);
  /** Where the cell annotations sit: on the cut face, or on the front edges of the plates. */
  const faceZ = cutaway ? 0.3 : cells.front;
  const valve = useDisposable(
    () =>
      lathe(
        [
          [0, 0],
          [3, 0],
          [3, 2.2],
          [3.6, 2.4],
          [3.6, 3.8],
          [3.1, 4.5],
          [1.6, 4.9],
          [0, 4.9],
        ],
        24,
      ),
    [],
  );
  const nipple = useDisposable(
    () =>
      lathe(
        [
          [0, 0],
          [3.8, 0],
          [3.8, 0.6],
          [2.4, 0.8],
          [2.4, 2.6],
          [0, 2.6],
        ],
        24,
      ),
    [],
  );
  const tabGeo = useDisposable(() => fastonGeometry(tab), [tab]);
  const collar = useDisposable(() => roundedRectSlab(tab.w + 5, 6.5, 1.6, 0, 1.6, 0.4), [tab.w]);
  const maps = useLabelMaps(cap, m.imax);
  const valveY = boxH + 2;
  const terminals = [
    { x: g.centers[5]!, sign: '+', color: '#c8221b' },
    { x: g.centers[0]!, sign: '−', color: '#141416' },
  ];

  return (
    <group>
      {/* Case: walls, floor, partitions and the printed label. */}
      <Explode offset={[0, 0, -D * 1.6]} delay={0.2}>
        <mesh geometry={caseGeo.walls}>
          <Material
            preset="absBlack"
            color="#1d1e20"
            roughness={0.55}
            roughnessMap={noise}
            clip
            cutColor="#2c2d30"
          />
        </mesh>
        <mesh geometry={caseGeo.floor}>
          <Material preset="absBlack" color="#1d1e20" roughness={0.6} clip cutColor="#2c2d30" />
        </mesh>
        <mesh geometry={caseGeo.partitions}>
          <Material preset="absBlack" color="#232427" roughness={0.6} clip cutColor="#34363a" />
        </mesh>
        <mesh geometry={caseGeo.label}>
          <Material
            color="#ffffff"
            map={maps.front}
            roughness={0.42}
            clearcoat={0.4}
            polygonOffset
            polygonOffsetFactor={-2}
            clip
          />
        </mesh>
      </Explode>

      {/* Cells: plates, AGM separators, straps, connectors and terminal posts. */}
      <group>
        <mesh geometry={cells.positive}>
          <Material color="#4a2216" roughness={0.9} clip cutColor="#4e2618" />
        </mesh>
        <mesh geometry={cells.negative}>
          <Material color="#8a8e94" roughness={0.55} metalness={0.45} clip cutColor="#9a9ea4" />
        </mesh>
        <mesh geometry={cells.separators}>
          <Material color="#e4e1d8" roughness={0.98} clip cutColor="#f0eee8" />
        </mesh>
        <mesh geometry={cells.lead}>
          <Material color="#8c8f94" roughness={0.5} metalness={0.75} clip cutColor="#a4a7ab" />
        </mesh>
        <Anchor name="cells" position={[g.centers[1]!, boxH * 0.5, faceZ + 0.5]} />
        <Anchor name="pos" position={[cells.posX, boxH * 0.32, faceZ]} />
        <Anchor name="neg" position={[cells.negX, boxH * 0.45, faceZ]} />
        <Anchor name="sep" position={[cells.sepX, boxH * 0.6, faceZ]} />

        {/* Faston tabs on the posts. */}
        {terminals.map((t) => (
          <mesh key={t.sign} geometry={tabGeo} position={[t.x, H, -g.strapZ]}>
            <Material preset="tin" color="#d9d4c4" roughness={0.3} />
          </mesh>
        ))}
      </group>

      {/* Deck with the vent nipples and the rubber safety valves. */}
      <Explode offset={[0, H * 0.35, 0]} delay={0.1}>
        <mesh geometry={lidGeo.deck}>
          <Material preset="absBlack" color="#202124" roughness={0.6} clip cutColor="#303236" />
        </mesh>
        {g.centers.map((cx) => (
          <group key={cx} position={[cx, valveY, 0]}>
            <mesh geometry={nipple}>
              <Material preset="absBlack" color="#202124" roughness={0.6} />
            </mesh>
            <mesh geometry={valve} position={[0, 0.6, 0]}>
              <Material preset="rubber" color="#c9b46a" roughness={0.75} />
            </mesh>
          </group>
        ))}
        <Anchor name="valve" position={[g.centers[2]!, valveY + 5.5, 1.5]} />
      </Explode>

      {/* Lid: skirt, top, glued vent cover, terminal collars and polarity marks. */}
      <Explode offset={[0, H * 0.75, 0]}>
        <mesh geometry={lidGeo.skirt}>
          <Material preset="absBlack" color="#202124" roughness={0.5} clip cutColor="#303236" />
        </mesh>
        <mesh geometry={lidGeo.top}>
          <Material
            preset="absBlack"
            color="#202124"
            roughness={0.5}
            roughnessMap={noise}
            clip
            cutColor="#303236"
          />
        </mesh>
        <mesh geometry={lidGeo.cover}>
          <Material preset="absBlack" color="#18191b" roughness={0.42} clip cutColor="#2a2b2e" />
        </mesh>
        <mesh position={[0, H + 0.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[L - 56, D - 20]} />
          <Material
            color="#ffffff"
            map={maps.top}
            roughness={0.5}
            transparent
            alphaTest={0.5}
            clip
          />
        </mesh>
        {terminals.map((t) => (
          <group key={t.sign}>
            <mesh geometry={collar} position={[t.x, H, -g.strapZ]}>
              <Material preset="absBlack" color={t.color} roughness={0.38} clearcoat={0.5} clip />
            </mesh>
            <mesh position={[t.x, H + 0.05, -g.strapZ + 9]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[8, 8]} />
              <Material
                color="#ffffff"
                map={t.sign === '+' ? maps.plus : maps.minus}
                roughness={0.5}
                transparent
                alphaTest={0.5}
                clip
              />
            </mesh>
          </group>
        ))}
      </Explode>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Geometry.

interface OutlinePoint {
  x: number;
  z: number;
  nx: number;
  nz: number;
}

/** Rounded rectangle in XZ, straight edges subdivided (for the bulge), closed. */
function outline(w: number, d: number, r: number, step = 5, seg = 5): OutlinePoint[] {
  const rr = Math.min(r, w / 2, d / 2);
  const cx = w / 2 - rr;
  const cz = d / 2 - rr;
  const out: OutlinePoint[] = [];
  const edge = (x0: number, z0: number, x1: number, z1: number, nx: number, nz: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / step));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      out.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, nx, nz });
    }
  };
  const corner = (x: number, z: number, a0: number) => {
    for (let i = 0; i < seg; i++) {
      const a = a0 + (Math.PI / 2) * (i / seg);
      out.push({
        x: x + Math.cos(a) * rr,
        z: z + Math.sin(a) * rr,
        nx: Math.cos(a),
        nz: Math.sin(a),
      });
    }
  };
  // Counter-clockwise seen from +Y is clockwise in XZ: front edge (+Z) left to right…
  edge(-cx, d / 2, cx, d / 2, 0, 1);
  corner(cx, cz, Math.PI / 2);
  edge(w / 2, cz, w / 2, -cz, 1, 0);
  corner(cx, -cz, 0);
  edge(cx, -d / 2, -cx, -d / 2, 0, -1);
  corner(-cx, -cz, -Math.PI / 2);
  edge(-w / 2, -cz, -w / 2, cz, -1, 0);
  corner(-cx, cz, -Math.PI);
  out.push({ ...out[0]! });
  return out;
}

/** Outward swelling of a case wall at (x, y, z) for walls of length w and depth d. */
function swell(
  o: OutlinePoint,
  y: number,
  w: number,
  d: number,
  y0: number,
  y1: number,
  b: number,
) {
  if (b === 0) return 0;
  const v = (y - (y0 + y1) / 2) / ((y1 - y0) / 2);
  const fy = Math.max(0, 1 - v * v);
  const fx = Math.max(0, 1 - (o.x / (w / 2)) ** 2);
  const fz = Math.max(0, 1 - (o.z / (d / 2)) ** 2);
  return b * fy * (Math.abs(o.nz) * fx + 0.45 * Math.abs(o.nx) * fz);
}

/**
 * Closed wall of the case (outer and inner faces and both rims), with the
 * long and short walls swollen by `bulge` at their middle. Thick enough for
 * the cutaway to show the cut wall. U runs around the outer wall, V up.
 */
function caseShell(
  w: number,
  d: number,
  r: number,
  y0: number,
  y1: number,
  t: number,
  bulge: number,
): BufferGeometry {
  const ring = outline(w, d, r);
  const rows = bulge > 0 ? 14 : 1;
  const lengths = [0];
  for (let i = 1; i < ring.length; i++)
    lengths.push(
      lengths[i - 1]! + Math.hypot(ring[i]!.x - ring[i - 1]!.x, ring[i]!.z - ring[i - 1]!.z),
    );
  const total = lengths[lengths.length - 1]!;
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  const n = ring.length;
  const point = (o: OutlinePoint, y: number, inset: number): Vec3 => {
    const s = swell(o, y, w, d, y0, y1, bulge) - inset;
    return [o.x + o.nx * s, y, o.z + o.nz * s];
  };
  /** A grid of `cols` × (`rowsOf` + 1) vertices; faces oriented along `facing`. */
  const grid = (
    rowsOf: number,
    at: (i: number, k: number) => Vec3,
    facing: (i: number) => Vec3,
    uvAt: (i: number, k: number) => [number, number],
  ) => {
    const start = pos.length / 3;
    for (let k = 0; k <= rowsOf; k++)
      for (let i = 0; i < n; i++) {
        pos.push(...at(i, k));
        uv.push(...uvAt(i, k));
      }
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    for (let k = 0; k < rowsOf; k++)
      for (let i = 0; i < n - 1; i++) {
        const i0 = start + k * n + i;
        const i1 = i0 + 1;
        const i2 = i0 + n + 1;
        const i3 = i0 + n;
        a.fromArray(pos, i0 * 3);
        b.fromArray(pos, i1 * 3).sub(a);
        c.fromArray(pos, i2 * 3).sub(a);
        const f = b.cross(c);
        const [fx, fy, fz] = facing(i);
        if (f.x * fx + f.y * fy + f.z * fz >= 0) index.push(i0, i1, i2, i0, i2, i3);
        else index.push(i0, i2, i1, i0, i3, i2);
      }
  };
  const yOf = (k: number) => y0 + ((y1 - y0) * k) / rows;
  const out = (i: number): Vec3 => [ring[i]!.nx, 0, ring[i]!.nz];
  const inward = (i: number): Vec3 => [-ring[i]!.nx, 0, -ring[i]!.nz];
  grid(
    rows,
    (i, k) => point(ring[i]!, yOf(k), 0),
    out,
    (i, k) => [lengths[i]! / total, k / rows],
  );
  grid(
    rows,
    (i, k) => point(ring[i]!, yOf(k), t),
    inward,
    (i, k) => [lengths[i]! / total, k / rows],
  );
  for (const [y, ny] of [
    [y1, 1],
    [y0, -1],
  ] as const)
    grid(
      1,
      (i, k) => point(ring[i]!, y, k * t),
      () => [0, ny, 0],
      (i, k) => [lengths[i]! / total, k],
    );
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** The front label, following the swollen wall. */
function labelGeometry(w: number, d: number, boxH: number, bulge: number): BufferGeometry {
  const lw = w - 14;
  const lh = boxH - 12;
  const g = new PlaneGeometry(lw, lh, bulge > 0 ? 24 : 1, bulge > 0 ? 12 : 1);
  g.translate(0, 5 + lh / 2, d / 2 + 0.08);
  if (bulge > 0) {
    const position = g.attributes.position!;
    for (let i = 0; i < position.count; i++) {
      const o = { x: position.getX(i), z: d / 2, nx: 0, nz: 1 };
      position.setZ(i, d / 2 + 0.08 + swell(o, position.getY(i), w, d, 0, boxH, bulge));
    }
    g.computeVertexNormals();
  }
  return g;
}

/** Faston tab with its hole, standing on the lid (tab plane XY, 0,8 mm along Z). */
function fastonGeometry(tab: { w: number; t: number; h: number; hole: number }): BufferGeometry {
  const s = new Shape();
  const hw = tab.w / 2;
  const top = tab.h;
  const c = 0.6;
  s.moveTo(-hw, -1.6);
  s.lineTo(hw, -1.6);
  s.lineTo(hw, top - c);
  s.lineTo(hw - c, top);
  s.lineTo(-hw + c, top);
  s.lineTo(-hw, top - c);
  s.closePath();
  const hole = new Shape();
  hole.absarc(0, top - 3.2, tab.hole / 2, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new ExtrudeGeometry(s, {
    depth: tab.t - 0.1,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelOffset: -0.05,
    bevelSegments: 1,
    curveSegments: 16,
  });
  g.translate(0, 0, -tab.t / 2 + 0.05);
  // Square post under the tab, down through the lid.
  const post = new BoxGeometry(tab.w + 1, 9, 3).translate(0, -1.6 - 4.5, 0);
  return merge([g, post]);
}

/** Plates, separators and lead parts of the six cells (merged by material). */
function useCellGeometry(m: { l: number; d: number; h: number }, boxH: number) {
  const g = cellLayout(m);
  const depth = m.d - 2 * WALL - 4;
  const plateTop = boxH - 13;
  const front = depth / 2;
  const built = useGeometrySet(() => {
    const pos: BufferGeometry[] = [];
    const neg: BufferGeometry[] = [];
    const sep: BufferGeometry[] = [];
    const lead: BufferGeometry[] = [];
    const box = (w: number, h: number, dd: number, x: number, y: number, z: number) =>
      new BoxGeometry(w, h, dd).translate(x, y, z);
    const room = g.cell - 0.4;
    const sepT = (room - 4 * NEG_T - 3 * POS_T) / 8;
    const h = plateTop - PLATE_BOTTOM;
    const strapY = plateTop + 4.5;
    g.centers.forEach((cx, ci) => {
      // Cell ci: its positive lugs at the back for odd cells, at the front for even ones, so
      // each cell's positive strap meets the next cell's negative strap through the partition.
      const posZ = ci % 2 === 1 ? -g.strapZ : g.strapZ;
      let x = cx - room / 2;
      const layers: ('S' | 'N' | 'P')[] = [
        'S',
        'N',
        'S',
        'P',
        'S',
        'N',
        'S',
        'P',
        'S',
        'N',
        'S',
        'P',
        'S',
        'N',
        'S',
      ];
      const lugsP: number[] = [];
      const lugsN: number[] = [];
      for (const kind of layers) {
        const t = kind === 'S' ? sepT : kind === 'N' ? NEG_T : POS_T;
        const mid = x + t / 2;
        if (kind === 'S')
          sep.push(box(t - 0.05, h - 1.5, depth - 1.5, mid, PLATE_BOTTOM + (h - 1.5) / 2, 0));
        else {
          (kind === 'P' ? pos : neg).push(box(t, h, depth, mid, PLATE_BOTTOM + h / 2, 0));
          (kind === 'P' ? lugsP : lugsN).push(mid);
        }
        x += t;
      }
      for (const [lugs, z] of [
        [lugsP, posZ],
        [lugsN, -posZ],
      ] as const) {
        for (const lx of lugs) lead.push(box(1.2, 4, 6, lx, plateTop + 2, z));
        const span = lugs[lugs.length - 1]! - lugs[0]! + 2.4;
        lead.push(box(span, 3, 7, (lugs[0]! + lugs[lugs.length - 1]!) / 2, strapY, z));
      }
      // Feet under the plates.
      for (const z of [-depth / 3, depth / 3])
        lead.push(box(room - 2, 2, 3, cx, PLATE_BOTTOM - 2, z));
    });
    // Inter-cell connectors through the partitions, alternating back and front.
    for (let i = 0; i < 5; i++) {
      const z = i % 2 === 0 ? g.strapZ : -g.strapZ;
      const a = g.centers[i]!;
      const b = g.centers[i + 1]!;
      lead.push(box(b - a - 6, 5, 6, (a + b) / 2, strapY + 0.5, z));
    }
    // Terminal posts from the end straps (at the back) up into the lid.
    for (const i of [0, 5]) {
      const top = m.h - 1.6 - 9;
      lead.push(box(5, top - strapY, 5, g.centers[i]!, (strapY + top) / 2, -g.strapZ));
    }
    return {
      positive: merge(pos),
      negative: merge(neg),
      separators: merge(sep),
      lead: merge(lead),
    };
  }, [m.l, m.d, m.h, boxH]);
  // Annotation targets: plates of cells 2 and 3 and a mat of cell 4.
  const layout = useMemo(() => {
    const room = g.cell - 0.4;
    const sepT = (room - 4 * NEG_T - 3 * POS_T) / 8;
    const left = (ci: number) => g.centers[ci]! - room / 2;
    return {
      posX: left(2) + 2 * sepT + NEG_T + POS_T / 2,
      negX: left(3) + sepT + NEG_T / 2,
      sepX: left(4) + sepT / 2,
    };
  }, [g]);
  return { ...built, ...layout, front };
}

// ---------------------------------------------------------------------------
// Printed label and marks.

function useLabelMaps(capacity: Capacity, imax: number) {
  const front = useCanvasTexture(
    (ctx, w, h) => {
      // Light grey label with a dark header and a red stripe.
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#eceeef');
      bg.addColorStop(1, '#d9dcdf');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#23262b';
      ctx.fillRect(0, 0, w, h * 0.27);
      ctx.fillStyle = '#c8221b';
      ctx.fillRect(0, h * 0.27, w, h * 0.025);
      ctx.fillStyle = '#ffffff';
      fitText(ctx, 'Bateria selada chumbo-ácido', w * 0.04, h * 0.09, w * 0.62, h * 0.08, {
        weight: 700,
        align: 'left',
      });
      fitText(ctx, `12 V  ${capacity} Ah`, w * 0.04, h * 0.19, w * 0.6, h * 0.11, {
        weight: 800,
        align: 'left',
      });
      ctx.fillStyle = '#c8221b';
      ctx.beginPath();
      ctx.roundRect(w * 0.74, h * 0.05, w * 0.22, h * 0.17, h * 0.03);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      fitText(ctx, 'VRLA · AGM', w * 0.85, h * 0.135, w * 0.2, h * 0.08, { weight: 800 });
      // Charging figures.
      ctx.fillStyle = '#1e2126';
      const line = (text: string, y: number, size = 0.075, weight = 700) =>
        fitText(ctx, text, w * 0.05, h * y, w * 0.62, h * size, { weight, align: 'left' });
      line('Carga com tensão constante:', 0.38, 0.06, 600);
      line('Uso em ciclo: 14,4 a 15,0 V', 0.475);
      line('Flutuação (stand-by): 13,5 a 13,8 V', 0.565);
      line(`Corrente inicial máx.: ${formatNumber(imax)} A`, 0.655);
      // Polarity reminder on the right.
      ctx.fillStyle = '#c8221b';
      fitText(ctx, '+ vermelho', w * 0.94, h * 0.43, w * 0.24, h * 0.07, {
        weight: 800,
        align: 'right',
      });
      ctx.fillStyle = '#1e2126';
      fitText(ctx, '− preto', w * 0.94, h * 0.53, w * 0.24, h * 0.07, {
        weight: 800,
        align: 'right',
      });
      ctx.fillStyle = '#4a4f57';
      fitText(ctx, 'Não carregar em local fechado', w * 0.94, h * 0.62, w * 0.3, h * 0.04, {
        weight: 600,
        align: 'right',
      });
      // Footer: pictograms and the warning.
      ctx.fillStyle = '#c9cdd1';
      ctx.fillRect(0, h * 0.74, w, h * 0.26);
      const r = h * 0.075;
      drawRecycle(ctx, w * 0.07, h * 0.87, r);
      drawBin(ctx, w * 0.07 + r * 2.6, h * 0.87, r);
      drawNoFlame(ctx, w * 0.07 + r * 5.2, h * 0.87, r);
      ctx.fillStyle = '#1e2126';
      fitText(
        ctx,
        'Não abrir. Reciclável. Contém chumbo.',
        w * 0.07 + r * 7,
        h * 0.84,
        w * 0.62,
        h * 0.065,
        {
          weight: 700,
          align: 'left',
        },
      );
      ctx.fillStyle = '#4a4f57';
      fitText(
        ctx,
        'Devolva a bateria usada ao revendedor para reciclagem.',
        w * 0.07 + r * 7,
        h * 0.92,
        w * 0.62,
        h * 0.045,
        { weight: 500, align: 'left' },
      );
    },
    `sla-front|${capacity}|${imax}`,
    {
      width: 1024,
      height: 512,
      fonts: [`800 40px ${FONT_SANS}`, `700 40px ${FONT_SANS}`, `600 40px ${FONT_SANS}`],
    },
  );
  const top = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#d9dcdf';
      fitText(ctx, `12 V  ${capacity} Ah`, w / 2, h * 0.38, w * 0.7, h * 0.3, { weight: 800 });
      ctx.fillStyle = '#a9adb2';
      fitText(ctx, 'VÁLVULAS SOB A TAMPA · NÃO ABRIR', w / 2, h * 0.72, w * 0.9, h * 0.12, {
        weight: 700,
      });
    },
    `sla-top|${capacity}`,
    { width: 512, height: 192, fonts: [`800 40px ${FONT_SANS}`, `700 40px ${FONT_SANS}`] },
  );
  const sign =
    (text: string, color: string) => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      fitText(ctx, text, w / 2, h / 2 + 3, w * 0.7, h * 0.8, { weight: 800 });
    };
  const plus = useCanvasTexture(sign('+', '#c8221b'), 'sla-plus', {
    width: 128,
    height: 128,
    fonts: [`800 40px ${FONT_SANS}`],
  });
  const minus = useCanvasTexture(sign('−', '#3a3d42'), 'sla-minus', {
    width: 128,
    height: 128,
    fonts: [`800 40px ${FONT_SANS}`],
  });
  return { front, top, plus, minus };
}

type Icon = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => void;

const drawRecycle: Icon = (ctx, x, y, r) => {
  ctx.strokeStyle = '#1e2126';
  ctx.fillStyle = '#1e2126';
  ctx.lineWidth = r * 0.14;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.62, a + 0.25, a + 1.75);
    ctx.stroke();
    const tip = a + 1.85;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(tip) * r * 0.62, y + Math.sin(tip) * r * 0.62);
    ctx.lineTo(x + Math.cos(tip - 0.35) * r * 0.85, y + Math.sin(tip - 0.35) * r * 0.85);
    ctx.lineTo(x + Math.cos(tip - 0.35) * r * 0.4, y + Math.sin(tip - 0.35) * r * 0.4);
    ctx.fill();
  }
  fitText(ctx, 'Pb', x, y + 1, r * 0.8, r * 0.5, { weight: 800 });
};

const drawBin: Icon = (ctx, x, y, r) => {
  ctx.strokeStyle = '#1e2126';
  ctx.fillStyle = '#1e2126';
  ctx.lineWidth = r * 0.1;
  ctx.strokeRect(x - r * 0.38, y - r * 0.45, r * 0.76, r * 0.95);
  ctx.fillRect(x - r * 0.5, y - r * 0.6, r, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.75, y - r * 0.8);
  ctx.lineTo(x + r * 0.75, y + r * 0.8);
  ctx.moveTo(x + r * 0.75, y - r * 0.8);
  ctx.lineTo(x - r * 0.75, y + r * 0.8);
  ctx.stroke();
};

const drawNoFlame: Icon = (ctx, x, y, r) => {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e2126';
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.55);
  ctx.quadraticCurveTo(x + r * 0.42, y - r * 0.05, x + r * 0.2, y + r * 0.45);
  ctx.quadraticCurveTo(x, y + r * 0.55, x - r * 0.2, y + r * 0.45);
  ctx.quadraticCurveTo(x - r * 0.42, y - r * 0.05, x, y - r * 0.55);
  ctx.fill();
  ctx.strokeStyle = '#c8221b';
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.86, 0, Math.PI * 2);
  ctx.moveTo(x - r * 0.6, y - r * 0.6);
  ctx.lineTo(x + r * 0.6, y + r * 0.6);
  ctx.stroke();
};
