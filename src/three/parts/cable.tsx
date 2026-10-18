/**
 * Flexible cord: round "cabo PP" with 2 or 3 insulated cores under a PVC
 * sheath (300/500 V, NBR NM 247-5, like H05VV-F), or flat parallel cord
 * (cordão paralelo, 2 cores joined by a PVC web, like H03VH-H). One end is
 * cut flush (the cross-section shows), the other has the sheath removed and
 * the cores stripped, optionally with crimped tubular ferrules (DIN 46228-4
 * sizes and collar colours). Dimensions from typical datasheets: 2 × 0,75 mm²
 * Ø 6,2 mm; 3 × 1,5 mm² Ø 8,1 mm; 3 × 2,5 mm² Ø 10,0 mm.
 *
 * `CableRun` routes the same cord along any path (scenes, bench): the first
 * point is the flush-cut end, the last one the stripped end.
 */
import { useMemo } from 'react';
import { Color, Vector2, Vector3 } from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode, useView } from '../core/view';
import { Material } from '../materials/Material';
import type { PartMeta, PartProps, Vec3 } from '../types';
import {
  FnCurve,
  framesFromPoints,
  MeshBuilder,
  newFrame,
  PathFrames,
  rodProfile,
  sleeveProfile,
  smoothstep,
  strandLayout,
  type ProfilePoint,
} from './_wiring-geometry';
import {
  addStrands,
  conductorSpec,
  COPPER_CUT,
  CORE_DARK,
  cutCrossings,
  formatSection,
  layLength,
  useExploded,
  useGeometrySet,
  useInsulationTexture,
  usePlainInsulation,
  WIRE_COLORS,
  type WireColor,
} from './_wiring-parts';

type CableKind = 'pp' | 'paralelo';
type SheathColor = 'preto' | 'branco' | 'cinza';

export interface CableProps {
  kind?: CableKind;
  /** Number of cores of the round cord (the parallel cord always has 2). */
  conductors?: number;
  /** Core cross-section (mm²): 0,75, 1, 1,5 or 2,5. */
  section?: number;
  /** Sheath colour (or the colour of the parallel cord). */
  color?: SheathColor;
  length?: number;
  /** Sheath removed at the stripped end (mm). */
  sheathStrip?: number;
  /** Insulation stripped at the tip of each core (mm). */
  strip?: number;
  /** Crimped tubular ferrules on the cores. */
  ferrules?: boolean;
}

const SECTIONS = [0.75, 1, 1.5, 2.5];

const SHEATH_COLORS: Record<SheathColor, { base: string; ink: string; label: string }> = {
  preto: { base: '#1d1d1f', ink: '#e4e4df', label: 'preta' },
  branco: { base: '#eceae4', ink: '#2c2c2c', label: 'branca' },
  cinza: { base: '#8d9196', ink: '#1d1d1f', label: 'cinza' },
};

/** Core insulation and sheath walls (mm), H05VV-F / NBR NM 247-5. */
const CORE_WALL: Record<string, number> = { '0.75': 0.6, '1': 0.6, '1.5': 0.7, '2.5': 0.8 };
const SHEATH_WALL: Record<number, Record<string, number>> = {
  2: { '0.75': 0.8, '1': 0.8, '1.5': 0.8, '2.5': 1.0 },
  3: { '0.75': 0.8, '1': 0.8, '1.5': 0.9, '2.5': 1.1 },
};
/** Diameter of each half of the parallel cord (mm). */
const PARALLEL_LOBE: Record<string, number> = { '0.75': 2.9, '1': 3.1, '1.5': 3.5, '2.5': 4.2 };

/** DIN 46228-4 insulated ferrules: sleeve bore, wall, collar Ø and colour. */
const FERRULES: Record<string, { bore: number; wall: number; collar: number; color: string }> = {
  '0.75': { bore: 1.2, wall: 0.15, collar: 2.8, color: '#8f959c' },
  '1': { bore: 1.4, wall: 0.15, collar: 3.0, color: '#cc2a22' },
  '1.5': { bore: 1.7, wall: 0.15, collar: 3.5, color: '#202022' },
  '2.5': { bore: 2.2, wall: 0.2, collar: 4.2, color: '#2a62c4' },
};
const FERRULE_SLEEVE = 8;
const FERRULE_COLLAR = 6;
const MARK_PERIOD = 90;

const CORE_COLORS: Record<number, WireColor[]> = {
  2: ['azul-claro', 'preto'],
  3: ['azul-claro', 'preto', 'verde-amarelo'],
};

export const meta: PartMeta = {
  id: 'cable',
  label: 'Cabo flexível (PP e paralelo)',
  category: 'conexoes',
  summary:
    'Cabo PP com 2 ou 3 condutores sob a capa de PVC, ou cordão paralelo, com a ponta descascada e terminais tubulares.',
  defaults: {
    kind: 'pp',
    conductors: 3,
    section: 1.5,
    color: 'preto',
    length: 150,
    sheathStrip: 45,
    strip: 8,
    ferrules: false,
  },
  controls: {
    kind: {
      kind: 'select',
      label: 'Tipo',
      options: [
        { value: 'pp', label: 'Cabo PP (redondo, com capa)' },
        { value: 'paralelo', label: 'Cordão paralelo (2 condutores)' },
      ],
    },
    conductors: {
      kind: 'select',
      label: 'Condutores',
      options: [
        { value: 2, label: '2 (fase e neutro)' },
        { value: 3, label: '3 (fase, neutro e terra)' },
      ],
    },
    section: {
      kind: 'select',
      label: 'Seção',
      options: SECTIONS.map((s) => ({ value: s, label: formatSection(s) })),
    },
    color: {
      kind: 'select',
      label: 'Cor da capa',
      options: [
        { value: 'preto', label: 'Preta' },
        { value: 'branco', label: 'Branca' },
        { value: 'cinza', label: 'Cinza' },
      ],
    },
    length: { kind: 'number', label: 'Comprimento', min: 80, max: 300, step: 10, unit: 'mm' },
    sheathStrip: { kind: 'number', label: 'Capa removida', min: 15, max: 80, step: 5, unit: 'mm' },
    strip: { kind: 'number', label: 'Ponta descascada', min: 0, max: 15, step: 1, unit: 'mm' },
    ferrules: { kind: 'toggle', label: 'Terminais tubulares (ponteiras)' },
  },
  annotations: (p) => {
    const g = cableGeometry(p);
    const parallel = g.kind === 'paralelo';
    const list = [
      {
        at: [0, g.outerD, g.length * 0.3] as Vec3,
        text: parallel
          ? 'Cordão paralelo: dois condutores unidos por PVC'
          : 'Capa externa de PVC (cobertura)',
        anchor: 'sheath',
      },
      {
        at: [0, g.outerD * 0.5, -g.length * 0.4] as Vec3,
        text:
          g.n === 3
            ? 'Cores: azul-claro = neutro, preto = fase, verde-amarelo = terra'
            : parallel
              ? 'Cada metade é um condutor isolado'
              : 'Cores: azul-claro = neutro, preto = fase',
        anchor: 'cores',
        exploded: false,
      },
      {
        at: [0, 1, -g.length / 2] as Vec3,
        text: p.ferrules
          ? 'Terminal tubular (ponteira) crimpado nos fios'
          : 'Condutor flexível: fios finos de cobre',
        anchor: 'tip',
      },
    ];
    if (!parallel) {
      list.push({
        at: [0, g.outerD, 0] as Vec3,
        text: 'Enchimento: mantém o cabo redondo',
        anchor: 'filler',
        exploded: true,
      });
    }
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const g = cableGeometry(p);
    const sheath = SHEATH_COLORS[p.color as SheathColor] ?? SHEATH_COLORS.preto;
    const section = formatSection(g.section);
    const ends = p.ferrules
      ? 'com terminais tubulares crimpados nas pontas'
      : `com ${formatNumber(Number(p.strip))} mm descascados em cada condutor`;
    if (g.kind === 'paralelo') {
      return `Cordão paralelo 2 × ${section}, ${sheath.label === 'preta' ? 'preto' : sheath.label === 'branca' ? 'branco' : 'cinza'}, ${formatNumber(g.lobeD * 2)} × ${formatNumber(g.lobeD)} mm; uma ponta cortada mostra a seção, a outra foi separada e descascada, ${ends}.`;
    }
    const cores = CORE_COLORS[g.n]!.map((c) => WIRE_COLORS[c].label).join(', ');
    return `Cabo PP ${g.n} × ${section} (300/500 V), capa ${sheath.label}, Ø ${formatNumber(g.outerD, 2)} mm, condutores ${cores}. Uma ponta cortada mostra a seção; na outra, a capa foi removida em ${formatNumber(Number(p.sheathStrip))} mm, ${ends}.`;
  },
  view: [1.2, 0.85, 1.05],
};

/** Sizes of a cord from its props. */
function cableGeometry(p: PartProps) {
  const kind: CableKind = p.kind === 'paralelo' ? 'paralelo' : 'pp';
  const section = SECTIONS.includes(Number(p.section)) ? Number(p.section) : 1.5;
  const key = String(section);
  const n = kind === 'paralelo' ? 2 : Number(p.conductors) === 2 ? 2 : 3;
  const spec = conductorSpec(section);
  const lobeD = PARALLEL_LOBE[key]!;
  const coreD = kind === 'paralelo' ? lobeD : spec.bundleD + 2 * CORE_WALL[key]!;
  const wall = SHEATH_WALL[n]![key]!;
  const outerD = kind === 'paralelo' ? lobeD : (n === 2 ? 2 : 2.155) * coreD + 2 * wall;
  return {
    kind,
    section,
    key,
    n,
    spec,
    lobeD,
    coreD,
    wall,
    outerD,
    length: Math.max(Number(p.length) || 150, 60),
  };
}

export default function Cable(props: CableProps) {
  const p = { ...meta.defaults, ...props } as Required<CableProps>;
  const g = cableGeometry(p);
  const R = g.outerD / 2;
  const ferrule = FERRULES[g.key]!;
  const lowest = Math.max(g.coreD / 2, p.ferrules ? ferrule.collar / 2 : 0);
  return (
    <CableRun
      points={[
        [0, R, g.length / 2],
        [0, R, -g.length / 2],
      ]}
      kind={g.kind}
      conductors={g.n}
      section={g.section}
      color={p.color}
      sheathStrip={p.sheathStrip}
      strip={p.strip}
      ferrules={p.ferrules}
      fanDrop={g.kind === 'paralelo' ? 0 : R - lowest}
      explodable
      anchors
    />
  );
}

export interface CableRunProps {
  /** Path of the cord axis (mm): from the flush-cut end to the stripped end. */
  points: Vec3[];
  kind?: CableKind;
  conductors?: number;
  section?: number;
  color?: SheathColor;
  sheathStrip?: number;
  strip?: number;
  ferrules?: boolean;
  smooth?: boolean;
  /** Corner radius for non-smooth paths (default 5 × the cord diameter). */
  bend?: number;
  marking?: boolean;
  /** How far the cores drop (along the path's "up" normal) where they leave the sheath. */
  fanDrop?: number;
  /** Sheath and filler move apart in the exploded view. */
  explodable?: boolean;
  /** Anchors used by the part's annotations. */
  anchors?: boolean;
}

/**
 * A flexible cord along a path, flush-cut at the first point and stripped
 * at the last one. Works in scenes; exploded and cut views need a
 * ViewProvider.
 */
export function CableRun({
  points,
  kind = 'pp',
  conductors = 3,
  section = 1.5,
  color = 'preto',
  sheathStrip = 45,
  strip = 8,
  ferrules = false,
  smooth = false,
  bend,
  marking = true,
  fanDrop = 0,
  explodable = false,
  anchors = false,
}: CableRunProps) {
  const g = cableGeometry({ kind, conductors, section, length: 100 });
  const { spec, n, coreD, outerD, wall, lobeD } = g;
  const parallel = g.kind === 'paralelo';
  const ferrule = FERRULES[g.key]!;
  const bendRadius = bend ?? outerD * 5;
  const strandR = spec.strandD / 2;
  const bundleR = spec.bundleD / 2;
  const lay = layLength(spec.bundleD);
  const exploded = useExploded();
  const { cutaway } = useView();
  const deps = [
    points,
    g.kind,
    n,
    g.section,
    sheathStrip,
    strip,
    ferrules,
    smooth,
    bendRadius,
    fanDrop,
  ];

  const depsKey = JSON.stringify(deps);

  // Axis frames and the centre line of every core.
  const layout = useMemo(() => {
    const frames = framesFromPoints(points, { smooth, bend: bendRadius });
    const L = frames.length;
    const sE = L - Math.min(Math.max(sheathStrip, 5), L * 0.6);
    const fanLen = Math.min(Math.max((L - sE) * 0.55, 4), 30);
    const twist = parallel ? 0 : (2 * Math.PI) / (outerD * 14);
    const rLay = parallel ? lobeD / 2 : n === 2 ? coreD / 2 : coreD / Math.sqrt(3);
    const phase = (k: number) =>
      parallel ? (k === 0 ? -Math.PI / 2 : Math.PI / 2) : (2 * Math.PI * k) / n;
    const helix = (k: number, s: number, out: Vector2) => {
      const a = phase(k) + s * twist;
      return out.set(rLay * Math.cos(a), rLay * Math.sin(a));
    };
    // Cores leave the sheath side by side, in the order they have there.
    const tmp = new Vector2();
    const order = Array.from({ length: n }, (_, k) => k).sort(
      (a, b) => helix(a, sE, tmp).y - helix(b, sE, new Vector2()).y,
    );
    const gap = Math.max(coreD * 1.9, ferrules ? ferrule.collar * 1.3 : 0);
    const target = new Map<number, Vector2>();
    order.forEach((k, i) => {
      const v =
        n === 2 ? (i === 0 ? -0.5 : 0.5) * (gap + (parallel ? lobeD * 0.4 : 0)) : (i - 1) * gap;
      target.set(k, new Vector2(-fanDrop, v));
    });
    const offset = (k: number) => (s: number, out: Vector2) => {
      helix(k, s, out);
      const e = smoothstep((s - sE) / fanLen);
      if (e > 0) out.lerp(target.get(k)!, e);
      return out;
    };
    const cores = Array.from({ length: n }, (_, k) => {
      const f = offset(k);
      const frame = newFrame();
      const off = new Vector2();
      const curve = new FnCurve((t, out) => {
        const s = t * L;
        frames.at(s, frame);
        f(s, off);
        return out.copy(frame.p).addScaledVector(frame.u, off.x).addScaledVector(frame.v, off.y);
      });
      return new PathFrames(curve, 0.5);
    });
    return { frames, L, sE, cores };
    // `depsKey` stands for the dependency values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  const geometries = useGeometrySet(() => {
    const { frames, sE, cores } = layout;
    const out: Record<string, ReturnType<MeshBuilder['build']> | null> = {};
    const stripLen = ferrules ? FERRULE_SLEEVE + 0.6 : Math.max(strip, 0);
    const strandLayoutK = strandLayout(spec.strands, strandR, bundleR);

    if (!parallel) {
      out.sheath = new MeshBuilder()
        .sweep(
          frames,
          sleeveProfile(0, sE, outerD / 2, outerD / 2 - wall, { fillet: 0.25, bore: 3 }),
          {
            radial: 40,
            uvPeriod: MARK_PERIOD,
            maxStep: 30,
            maxTurn: 0.1,
          },
        )
        .build();
      out.filler = new MeshBuilder()
        .sweep(frames, rodProfile(0.06, sE - 0.5, outerD / 2 - wall - 0.02), {
          radial: 32,
          maxStep: 30,
        })
        .build();
    } else {
      const c = lobeD / 2;
      const web = c * 0.52;
      out.sheath = new MeshBuilder()
        .sweep(frames, rodProfile(0.6, sE, 1, 0, 0), {
          radial: 72,
          uvPeriod: MARK_PERIOD,
          maxStep: 30,
          maxTurn: 0.1,
          shape: figureEight(c, web),
        })
        .build();
    }

    const strands = new MeshBuilder();
    const plugs = new MeshBuilder();
    const ferruleMetal = new MeshBuilder();
    const ferruleCollar = new MeshBuilder();
    cores.forEach((core, k) => {
      const Lc = core.length;
      const end = Lc - stripLen;
      // Core insulation; the parallel cord only shows it at the ends.
      const insulation = new MeshBuilder();
      if (!parallel) {
        insulation.sweep(core, sleeveProfile(0, end, coreD / 2, bundleR + 0.01, { fillet: 0.12 }), {
          radial: 24,
          maxStep: 30,
          maxTurn: 0.1,
        });
      } else {
        const sSplit = sE;
        insulation.sweep(core, sleeveProfile(0, 0.6, coreD / 2, bundleR + 0.01, { end: false }), {
          radial: 24,
        });
        insulation.sweep(
          core,
          sleeveProfile(sSplit, end, coreD / 2, bundleR + 0.01, { start: false, fillet: 0.12 }),
          { radial: 24, maxStep: 30, maxTurn: 0.1 },
        );
      }
      out[`core${k}`] = insulation.build();

      // Strand ends at the flush cut, with a dark plug so the gaps read as gaps.
      plugs.sweep(core, rodProfile(0.06, 2.4, bundleR * 0.96), { radial: 16 });
      addStrands(strands, core, {
        layout: strandLayoutK,
        strandR,
        lay,
        from: 0,
        to: 2.5,
        seed: 21 + k,
        maxStep: 2.5,
      });
      // Stripped tip: fanned strands, or packed inside the ferrule.
      if (stripLen > 0) {
        addStrands(strands, core, {
          layout: strandLayoutK,
          strandR: ferrules ? strandR * 0.92 : strandR,
          lay,
          from: end - 1.2,
          to: ferrules ? Lc - 0.12 : Lc,
          trimEnd: ferrules ? 0 : 0.6,
          fan: ferrules
            ? (s) =>
                s > end + 0.6 ? Math.min((ferrule.bore / 2 - strandR) / (bundleR - strandR), 1) : 1
            : (s) => {
                const e = smoothstep((s - end) / Math.max(stripLen, 1));
                return 1 + 0.45 * e * e;
              },
          maxStep: ferrules ? 4 : 1.6,
          seed: 31 + k,
        });
      }
      if (ferrules) {
        const ro = ferrule.bore / 2 + ferrule.wall;
        const s0 = Lc - FERRULE_SLEEVE;
        ferruleMetal.sweep(core, ferruleSleeveProfile(s0, Lc, ro, ferrule.bore / 2), {
          radial: 32,
          maxStep: 2,
          shape: crimpShape,
        });
        ferruleCollar.sweep(
          core,
          collarProfile(s0 - FERRULE_COLLAR, s0, ferrule.collar / 2, ro, coreD / 2),
          { radial: 32, maxStep: 2 },
        );
      }
    });
    out.strands = strands.build();
    out.plugs = plugs.build();
    out.ferruleMetal = ferrules ? ferruleMetal.build() : null;
    out.ferruleCollar = ferrules ? ferruleCollar.build() : null;
    return out;
  }, [...deps, section]);

  // Cut-only detail: strands and dark cores where the cut plane crosses the
  // cores (or along the whole core when the parallel cord is exploded).
  const inside = useGeometrySet(() => {
    const full = parallel && exploded;
    if (!cutaway && !full) return { strands: null, cores: null };
    const { cores } = layout;
    const stripLen = ferrules ? FERRULE_SLEEVE + 0.6 : Math.max(strip, 0);
    const strands = new MeshBuilder();
    const dark = new MeshBuilder();
    const strandLayoutK = strandLayout(spec.strands, strandR, bundleR);
    cores.forEach((core, k) => {
      const end = core.length - stripLen;
      const windows: [number, number][] = full
        ? [[2, end - 0.5]]
        : cutCrossings(core).map((s): [number, number] => [
            Math.max(s - 3, 2),
            Math.min(s + 3, end - 0.5),
          ]);
      for (const [a, b] of windows) {
        if (b - a < 0.5) continue;
        addStrands(strands, core, {
          layout: strandLayoutK,
          strandR,
          lay,
          from: a,
          to: b,
          seed: 41 + k,
        });
        dark.sweep(core, rodProfile(a + 0.2, b - 0.2, bundleR - strandR * 1.2), {
          radial: 14,
          maxStep: 30,
        });
      }
    });
    return {
      strands: strands.positions.length ? strands.build() : null,
      cores: dark.positions.length ? dark.build() : null,
    };
  }, [...deps, cutaway, exploded && parallel]);

  const sheathColors = SHEATH_COLORS[color] ?? SHEATH_COLORS.preto;
  const text = marking
    ? parallel
      ? `CORDÃO PARALELO 2 × ${formatSection(g.section)}  300/300 V  70 °C`
      : `CABO PP ${n} × ${formatSection(g.section)}  300/500 V  70 °C  NBR NM 247-5`
    : undefined;
  const sheathMap = useInsulationTexture({
    base: sheathColors.base,
    ink: sheathColors.ink,
    text,
    diameter: parallel ? lobeD * 2 : outerD,
    period: MARK_PERIOD,
    textAt: parallel ? 0.36 : 0.5,
    textSize: parallel ? lobeD * 0.36 : undefined,
  });
  const coreColors: WireColor[] = parallel ? ([color, color] as WireColor[]) : CORE_COLORS[n]!;
  const map0 = usePlainInsulation(parallel ? sheathColors.base : coreColors[0]!, coreD);
  const map1 = usePlainInsulation(parallel ? sheathColors.base : coreColors[1]!, coreD);
  const map2 = usePlainInsulation(parallel ? sheathColors.base : (coreColors[2] ?? 'preto'), coreD);
  const maps = [map0, map1, map2];
  const cutOf = (base: string) => `#${new Color(base).multiplyScalar(0.8).getHexString()}`;
  const coreBase = (k: number) =>
    parallel ? sheathColors.base : (WIRE_COLORS[coreColors[k]!]?.base ?? '#333333');

  const anchorPoints = useMemo(() => {
    if (!anchors) return null;
    const { frames, L, sE, cores } = layout;
    const lift = (s: number, r: number, fr: PathFrames): Vec3 => {
      const f = fr.at(s);
      const q = new Vector3().copy(f.p).addScaledVector(f.u, r);
      return [q.x, q.y, q.z];
    };
    const tipCore = cores[0]!;
    return {
      sheath: lift(L * 0.1, outerD / 2, frames),
      filler: lift(L * 0.6, outerD / 2 - wall, frames),
      cores: lift(sE + (L - sE) * 0.35, coreD / 2, cores[Math.min(1, cores.length - 1)]!),
      tip: lift(
        tipCore.length - (ferrules ? FERRULE_SLEEVE / 2 : Math.max(strip / 2, 1)),
        coreD / 2,
        tipCore,
      ),
    };
  }, [anchors, layout, outerD, wall, coreD, ferrules, strip]);

  const sheathOffset: Vec3 = [0, outerD * (parallel ? 2.4 : 2.7), 0];
  const fillerOffset: Vec3 = [0, outerD * 1.45, 0];

  const sheath = (
    <>
      <mesh geometry={geometries.sheath!}>
        <Material
          preset="pvc"
          color="#ffffff"
          map={sheathMap}
          roughness={0.5}
          clearcoat={0.2}
          clearcoatRoughness={0.6}
          clip
          cutColor={cutOf(sheathColors.base)}
        />
      </mesh>
      {parallel &&
        layout.cores.map((_, k) => (
          <mesh key={k} geometry={geometries[`core${k}`]!}>
            <Material
              preset="pvc"
              color="#ffffff"
              map={maps[k]}
              roughness={0.5}
              clearcoat={0.2}
              clip
              cutColor={cutOf(sheathColors.base)}
            />
          </mesh>
        ))}
      {anchorPoints && <Anchor name="sheath" position={anchorPoints.sheath} />}
    </>
  );
  const filler = geometries.filler ? (
    <>
      <mesh geometry={geometries.filler}>
        <Material color="#d9d6cf" roughness={0.85} metalness={0} clip cutColor="#c9c5bc" />
      </mesh>
      {anchorPoints && <Anchor name="filler" position={anchorPoints.filler} />}
    </>
  ) : null;

  return (
    <group>
      {explodable ? <Explode offset={sheathOffset}>{sheath}</Explode> : sheath}
      {filler && (explodable ? <Explode offset={fillerOffset}>{filler}</Explode> : filler)}
      {!parallel &&
        layout.cores.map((_, k) => (
          <mesh key={k} geometry={geometries[`core${k}`]!}>
            <Material
              preset="pvc"
              color="#ffffff"
              map={maps[k]}
              roughness={0.4}
              clearcoat={0.3}
              clip
              cutColor={cutOf(coreBase(k))}
            />
          </mesh>
        ))}
      <mesh geometry={geometries.strands!}>
        <Material preset="copper" roughness={0.3} clip cutColor={COPPER_CUT} />
      </mesh>
      <mesh geometry={geometries.plugs!}>
        <Material color={CORE_DARK} roughness={0.8} metalness={0} clip cutColor={CORE_DARK} />
      </mesh>
      {inside.strands && (
        <mesh geometry={inside.strands}>
          <Material preset="copper" roughness={0.3} clip cutColor={COPPER_CUT} />
        </mesh>
      )}
      {inside.cores && (
        <mesh geometry={inside.cores}>
          <Material color={CORE_DARK} roughness={0.8} metalness={0} clip cutColor={CORE_DARK} />
        </mesh>
      )}
      {geometries.ferruleMetal && (
        <mesh geometry={geometries.ferruleMetal}>
          <Material preset="tin" roughness={0.3} clip cutColor="#b9bcbf" />
        </mesh>
      )}
      {geometries.ferruleCollar && (
        <mesh geometry={geometries.ferruleCollar}>
          <Material color={ferrule.color} roughness={0.45} metalness={0} clearcoat={0.2} clip />
        </mesh>
      )}
      {anchorPoints && <Anchor name="cores" position={anchorPoints.cores} />}
      {anchorPoints && <Anchor name="tip" position={anchorPoints.tip} />}
    </group>
  );
}

/** Figure-8 section of the parallel cord: two lobes of radius c joined by a web. */
function figureEight(c: number, web: number) {
  return (angle: number) => {
    const cu = Math.cos(angle);
    const cv = Math.sin(angle);
    const lobe = 2 * c * Math.abs(cv);
    const webR = Math.min(web / Math.max(Math.abs(cu), 1e-6), c / Math.max(Math.abs(cv), 1e-6));
    // Smooth maximum: rounds the groove between the lobes.
    const k = 6;
    return Math.log(Math.exp(k * lobe) + Math.exp(k * webR)) / k;
  };
}

/** Square crimp of a ferrule: a rounded square of about the same perimeter. */
function crimpShape(angle: number) {
  const p = 4;
  const c = Math.abs(Math.cos(angle));
  const s = Math.abs(Math.sin(angle));
  return 0.93 / Math.pow(c ** p + s ** p, 1 / p);
}

/** Tinned copper sleeve of a ferrule, open at the tip (strands show inside). */
function ferruleSleeveProfile(s0: number, s1: number, ro: number, ri: number): ProfilePoint[] {
  const f = 0.08;
  return [
    [s0, ro * 0.98],
    [s1 - f, ro],
    [s1, ro - f],
    [s1, ro - f],
    [s1, ri],
    [s1, ri],
    [s1 - 1.6, ri],
    [s1 - 1.6, ri],
    [s1 - 1.6, 0],
  ];
}

/** Plastic collar: funnel at the back, tapering to the sleeve. */
function collarProfile(
  c0: number,
  c1: number,
  R: number,
  sleeve: number,
  insulation: number,
): ProfilePoint[] {
  const opening = Math.max(insulation + 0.06, R - 0.28);
  return [
    [c0 + 2.2, insulation + 0.02],
    [c0 + 0.6, opening - 0.05],
    [c0, opening],
    [c0, opening],
    [c0, R - 0.12],
    [c0 + 0.12, R],
    [c1 - 2.2, R],
    [c1 - 0.5, sleeve + 0.32],
    [c1, sleeve + 0.12],
    [c1, sleeve + 0.12],
    [c1, sleeve * 0.9],
  ];
}
