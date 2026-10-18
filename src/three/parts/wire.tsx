/**
 * Single-core building wire (fio rígido, classe 1) and flexible wire
 * (cabinho, classe 5), 0,5 to 6 mm², 70 °C PVC, in the NBR 5410 colours.
 * Dimensions from NBR NM 247-3 / NBR NM 280 and typical 450/750 V datasheets
 * (e.g. 1,5 mm²: solid Ø 1,38 mm, 30 × 0,25 mm strands, wall 0,7 mm, outer
 * ≈ 2,8–3,0 mm). Generic marking printed on the PVC, no brand.
 *
 * `WireRun` routes the same wire along any path (scenes, bench): pass
 * `points` (mm), and it strips both ends.
 *
 * The part lies on the table along Z, so the cutaway (plane z = 0) shows the
 * classic cross-section: one solid copper conductor or dozens of strands.
 */
import { useMemo } from 'react';
import { Color } from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode, useView } from '../core/view';
import { Material } from '../materials/Material';
import type { PartMeta, PartProps, Vec3 } from '../types';
import {
  framesFromPoints,
  MeshBuilder,
  rodProfile,
  sleeveProfile,
  smoothstep,
  strandLayout,
} from './_wiring-geometry';
import {
  addStrands,
  conductorSpec,
  COPPER_CUT,
  CORE_DARK,
  formatSection,
  layLength,
  useExploded,
  useGeometrySet,
  useInsulationTexture,
  WIRE_COLOR_ORDER,
  WIRE_COLORS,
  type WireColor,
  type WireKind,
} from './_wiring-parts';

export type { WireColor, WireKind } from './_wiring-parts';

type WireShape = 'reto' | 'curva' | 'u' | 'solto';

export interface WireProps {
  kind?: WireKind;
  /** Conductor cross-section (mm²): 0,5 to 6. */
  section?: number;
  color?: WireColor;
  /** Total length (mm). */
  length?: number;
  /** Insulation stripped at each end (mm). */
  strip?: number;
  shape?: WireShape;
}

const SECTIONS = [0.5, 0.75, 1, 1.5, 2.5, 4, 6];
const MARK_PERIOD = 64;

export const meta: PartMeta = {
  id: 'wire',
  label: 'Fio elétrico (rígido ou flexível)',
  category: 'conexoes',
  summary:
    'Fio de instalação com isolação de PVC: rígido (um condutor) ou flexível (muitos fios finos), nas cores da NBR 5410.',
  defaults: {
    kind: 'rigido',
    section: 1.5,
    color: 'azul-claro',
    length: 120,
    strip: 10,
    shape: 'reto',
  },
  controls: {
    kind: {
      kind: 'select',
      label: 'Tipo',
      options: [
        { value: 'rigido', label: 'Rígido (fio sólido)' },
        { value: 'flexivel', label: 'Flexível (cabinho)' },
      ],
    },
    section: {
      kind: 'select',
      label: 'Seção',
      options: SECTIONS.map((s) => ({ value: s, label: formatSection(s) })),
    },
    color: {
      kind: 'select',
      label: 'Cor',
      options: WIRE_COLOR_ORDER.map((c) => ({
        value: c,
        label: `${capitalize(WIRE_COLORS[c].label)} (${WIRE_COLORS[c].role})`,
      })),
    },
    length: { kind: 'number', label: 'Comprimento', min: 40, max: 300, step: 5, unit: 'mm' },
    strip: { kind: 'number', label: 'Ponta descascada', min: 0, max: 25, step: 1, unit: 'mm' },
    shape: {
      kind: 'select',
      label: 'Forma',
      options: [
        { value: 'reto', label: 'Reto' },
        { value: 'curva', label: 'Curva de 90°' },
        { value: 'u', label: 'Dobrado em U' },
        { value: 'solto', label: 'Solto (curva natural)' },
      ],
    },
  },
  annotations: (p) => {
    const path = wirePath(p);
    const flexible = p.kind === 'flexivel';
    const color = WIRE_COLORS[p.color as WireColor] ?? WIRE_COLORS.preto;
    const spec = conductorSpec(Number(p.section));
    return [
      {
        at: path.tip,
        text: flexible
          ? 'Condutor de cobre flexível: muitos fios finos torcidos'
          : 'Condutor de cobre rígido: um fio só',
        anchor: 'conductor',
      },
      {
        at: path.label,
        text: `Isolação de PVC (${spec.voltage})`,
        anchor: 'insulation',
      },
      {
        at: path.mid,
        text: colorRole(p.color as WireColor, color.label),
        exploded: false,
      },
    ];
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const spec = conductorSpec(Number(p.section));
    const color = WIRE_COLORS[p.color as WireColor] ?? WIRE_COLORS.preto;
    const kind =
      p.kind === 'flexivel'
        ? `Fio flexível (cabinho) de ${formatSection(spec.section)}, com ${spec.strands} fios de ${formatNumber(spec.strandD)} mm`
        : `Fio rígido de ${formatSection(spec.section)}, condutor sólido de ${formatNumber(spec.solidD)} mm`;
    const strip = Number(p.strip);
    const ends = strip > 0 ? `, ${formatNumber(strip)} mm descascados em cada ponta` : '';
    return `${kind}, isolação de PVC ${color.label} (${spec.voltage}), ${formatNumber(Number(p.length) / 10)} cm${ends}. Na instalação, ${colorRole(p.color as WireColor, color.label).toLowerCase()}.`;
  },
  view: [1.15, 0.85, 1],
};

function capitalize(text: string) {
  return text[0]!.toUpperCase() + text.slice(1);
}

function colorRole(color: WireColor, label: string): string {
  if (color === 'azul-claro') return 'Azul-claro: condutor neutro (NBR 5410)';
  if (color === 'verde-amarelo') return 'Verde-amarelo: condutor de proteção, o terra (NBR 5410)';
  return `${capitalize(label)}: fase ou retorno (a NBR 5410 reserva só azul-claro e verde-amarelo)`;
}

function outerDiameter(p: PartProps) {
  const spec = conductorSpec(Number(p.section));
  const core = p.kind === 'flexivel' ? spec.bundleD : spec.solidD;
  return core + 2 * spec.insulation;
}

/** Path of the part's wire (lying on the table) and annotation points. */
function wirePath(p: PartProps): {
  points: Vec3[];
  smooth: boolean;
  bend: number;
  tip: Vec3;
  mid: Vec3;
  label: Vec3;
} {
  const D = outerDiameter(p);
  const R = D / 2;
  const L = Math.max(Number(p.length) || 120, 30);
  const shape = String(p.shape) as WireShape;
  if (shape === 'curva') {
    const rb = Math.max(7 * D, 14);
    const leg = (L + 0.38 * rb) / 2;
    const pts: Vec3[] = [
      [-leg / 2, R, leg / 2],
      [-leg / 2, R, -leg / 2],
      [leg / 2, R, -leg / 2],
    ];
    return {
      points: pts,
      smooth: false,
      bend: rb,
      tip: [-leg / 2, R, leg / 2 - 3],
      mid: [-leg / 2, D, 0],
      label: [0, D, -leg / 2],
    };
  }
  if (shape === 'u') {
    const g = Math.max(9 * D, 18);
    const leg = Math.max((L - (Math.PI * g) / 2) / 2, 8);
    const zf = (leg + g / 2) / 2;
    const pts: Vec3[] = [
      [-g / 2, R, zf],
      [-g / 2, R, -zf],
      [g / 2, R, -zf],
      [g / 2, R, zf],
    ];
    return {
      points: pts,
      smooth: false,
      bend: g / 2,
      tip: [-g / 2, R, zf - 3],
      mid: [g / 2, D, 0],
      label: [0, D, -zf],
    };
  }
  if (shape === 'solto') {
    const base: [number, number][] = [
      [-0.13, 0.46],
      [0.05, 0.27],
      [0.09, 0.05],
      [-0.02, -0.15],
      [-0.03, -0.32],
      [0.1, -0.46],
    ];
    // Scale so the length matches (the spline is a bit longer than its chord).
    const scale = L / polylineLength(base);
    const pts = base.map(([x, z]): Vec3 => [x * scale * 0.97, R, z * scale * 0.97]);
    return {
      points: pts,
      smooth: true,
      bend: 0,
      tip: [pts[0]![0], R, pts[0]![2] - 3],
      mid: [pts[2]![0], D, pts[2]![2]],
      label: [pts[3]![0], D, pts[3]![2]],
    };
  }
  return {
    points: [
      [0, R, L / 2],
      [0, R, -L / 2],
    ],
    smooth: false,
    bend: 0,
    tip: [0, R, L / 2 - 3],
    mid: [0, D, -L / 6],
    label: [0, D, L / 8],
  };
}

function polylineLength(points: [number, number][]) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
  }
  return len;
}

export default function Wire(props: WireProps) {
  const p = { ...meta.defaults, ...props } as Required<WireProps>;
  const path = wirePath(p);
  const D = outerDiameter(p);
  return (
    <WireRun
      points={path.points}
      smooth={path.smooth}
      bend={path.bend || undefined}
      section={p.section}
      kind={p.kind}
      color={p.color}
      strip={p.strip}
      explodeOffset={[0, Math.max(D * 2.6, 6), 0]}
      anchors
    />
  );
}

export interface WireRunProps {
  /** Path of the wire axis (mm), from one end to the other. */
  points: Vec3[];
  section?: number;
  kind?: WireKind;
  color?: WireColor;
  /** Insulation stripped at the start (mm); `stripEnd` for the other end (default: same). */
  strip?: number;
  stripEnd?: number;
  /** Spline through the points instead of straight runs with rounded corners. */
  smooth?: boolean;
  /** Corner radius for non-smooth paths (default 4 × the outer diameter). */
  bend?: number;
  /** Printed marking on the insulation. */
  marking?: boolean;
  /** Displacement of the insulation in the exploded view (only inside a ViewProvider). */
  explodeOffset?: Vec3;
  /** Adds the `conductor` and `insulation` anchors used by the part's annotations. */
  anchors?: boolean;
}

/**
 * A single-core wire along a path: PVC sleeve with the marking, the solid
 * conductor or the strands, both ends stripped (copper fanned out a little on
 * flexible wire). Cut and exploded views work inside a ViewProvider.
 */
export function WireRun({
  points,
  section = 1.5,
  kind = 'rigido',
  color = 'preto',
  strip = 10,
  stripEnd,
  smooth = false,
  bend,
  marking = true,
  explodeOffset,
  anchors = false,
}: WireRunProps) {
  const spec = conductorSpec(section);
  const flexible = kind === 'flexivel';
  const coreD = flexible ? spec.bundleD : spec.solidD;
  const D = coreD + 2 * spec.insulation;
  const colors = WIRE_COLORS[color] ?? WIRE_COLORS.preto;
  const exploded = useExploded();
  const { cutaway } = useView();
  const opened = exploded || cutaway;
  const lay = layLength(spec.bundleD);
  const bendRadius = bend ?? D * 4;

  const base = useGeometrySet(() => {
    const frames = framesFromPoints(points, { smooth, bend: bendRadius });
    const L = frames.length;
    const s0 = clampStrip(strip, L);
    const s1 = L - clampStrip(stripEnd ?? strip, L);
    const insulation = new MeshBuilder()
      .sweep(frames, sleeveProfile(s0, s1, D / 2, coreD / 2 + 0.01, { fillet: 0.12 }), {
        radial: 28,
        uvPeriod: MARK_PERIOD,
        maxStep: 30,
        maxTurn: 0.12,
      })
      .build();
    let conductor = null;
    let tips = null;
    if (!flexible) {
      conductor = new MeshBuilder()
        .sweep(frames, rodProfile(0, L, coreD / 2, Math.min(0.08, coreD * 0.06)), {
          radial: 20,
          maxStep: 30,
          maxTurn: 0.12,
        })
        .build();
    } else {
      const layout = strandLayout(spec.strands, spec.strandD / 2, coreD / 2);
      const fan = fanFunction(s0, s1, L);
      const builder = new MeshBuilder();
      if (s0 > 0.01) {
        addStrands(builder, frames, {
          layout,
          strandR: spec.strandD / 2,
          lay,
          from: 0,
          to: s0 + 1.5,
          trimStart: 0.6,
          fan,
          maxStep: 1.6,
          seed: 11,
        });
      }
      if (L - s1 > 0.01) {
        addStrands(builder, frames, {
          layout,
          strandR: spec.strandD / 2,
          lay,
          from: s1 - 1.5,
          to: L,
          trimEnd: 0.6,
          fan,
          maxStep: 1.6,
          seed: 13,
        });
      }
      tips = builder.positions.length ? builder.build() : null;
    }
    return { insulation, conductor, tips };
  }, [points, section, kind, strip, stripEnd, smooth, bendRadius]);

  // Strands under the insulation: only when someone can see them.
  const inside = useGeometrySet(() => {
    if (!opened || !flexible) return { strands: null, core: null };
    const frames = framesFromPoints(points, { smooth, bend: bendRadius });
    const L = frames.length;
    const s0 = clampStrip(strip, L);
    const s1 = L - clampStrip(stripEnd ?? strip, L);
    const layout = strandLayout(spec.strands, spec.strandD / 2, coreD / 2);
    const strands = addStrands(new MeshBuilder(), frames, {
      layout,
      strandR: spec.strandD / 2,
      lay,
      from: s0 + 1,
      to: s1 - 1,
      seed: 17,
      radial: 5,
      maxStep: lay / 6,
    }).build();
    const core = new MeshBuilder()
      .sweep(frames, rodProfile(s0 + 0.5, s1 - 0.5, coreD / 2 - spec.strandD * 0.6), {
        radial: 12,
        maxStep: 30,
      })
      .build();
    return { strands, core };
  }, [opened, points, section, kind, strip, stripEnd, smooth, bendRadius]);

  const text = marking
    ? `${flexible ? 'CABO FLEXÍVEL' : 'FIO'} ${formatSection(spec.section)}  ${spec.voltage}  70 °C  NBR NM 247-3  NÃO PROPAGANTE À CHAMA`
    : undefined;
  const map = useInsulationTexture({
    base: colors.base,
    stripe: colors.stripe,
    ink: colors.ink,
    text,
    diameter: D,
    period: MARK_PERIOD,
  });
  const cutColor = useMemo(
    () => `#${new Color(colors.base).multiplyScalar(0.82).getHexString()}`,
    [colors.base],
  );

  const anchorPoints = useMemo(() => {
    if (!anchors) return null;
    const frames = framesFromPoints(points, { smooth, bend: bendRadius });
    const L = frames.length;
    const s0 = clampStrip(strip, L);
    const tip = frames.at(Math.max(s0 * 0.4, 0.5)).p;
    const sleeve = frames.at(s0 + Math.min(L * 0.18, 30));
    return {
      conductor: [tip.x, tip.y + coreD * 0.6, tip.z] as Vec3,
      insulation: [
        sleeve.p.x + sleeve.u.x * D * 0.5,
        sleeve.p.y + sleeve.u.y * D * 0.5,
        sleeve.p.z + sleeve.u.z * D * 0.5,
      ] as Vec3,
    };
  }, [anchors, points, smooth, bendRadius, strip, coreD, D]);

  const insulation = (
    <>
      <mesh geometry={base.insulation}>
        <Material
          preset="pvc"
          color="#ffffff"
          map={map}
          roughness={0.36}
          clearcoat={0.35}
          clearcoatRoughness={0.45}
          clip
          cutColor={cutColor}
        />
      </mesh>
      {anchorPoints && <Anchor name="insulation" position={anchorPoints.insulation} />}
    </>
  );

  return (
    <group>
      {explodeOffset ? <Explode offset={explodeOffset}>{insulation}</Explode> : insulation}
      {base.conductor && (
        <mesh geometry={base.conductor}>
          <Material preset="copper" roughness={0.26} clip cutColor={COPPER_CUT} />
        </mesh>
      )}
      {base.tips && (
        <mesh geometry={base.tips}>
          <Material preset="copper" roughness={0.3} clip cutColor={COPPER_CUT} />
        </mesh>
      )}
      {inside.strands && (
        <mesh geometry={inside.strands}>
          <Material preset="copper" roughness={0.3} clip cutColor={COPPER_CUT} />
        </mesh>
      )}
      {inside.core && (
        <mesh geometry={inside.core}>
          <Material color={CORE_DARK} roughness={0.8} metalness={0} clip cutColor={CORE_DARK} />
        </mesh>
      )}
      {anchorPoints && <Anchor name="conductor" position={anchorPoints.conductor} />}
    </group>
  );
}

function clampStrip(strip: number, length: number) {
  return Math.min(Math.max(strip, 0), length * 0.42);
}

/** Strands spread a little towards the cut ends (fanned tips). */
function fanFunction(s0: number, s1: number, L: number) {
  const startLen = Math.max(s0, 1);
  const endLen = Math.max(L - s1, 1);
  return (s: number) => {
    const a = s < s0 ? smoothstep((s0 - s) / startLen) : 0;
    const b = s > s1 ? smoothstep((s - s1) / endLen) : 0;
    return 1 + 0.45 * a * a + 0.45 * b * b;
  };
}
