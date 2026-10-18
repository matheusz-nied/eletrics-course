/**
 * Mains transformer with an EI core (scrapless EI laminations, IEC 60740-1
 * proportions: centre leg a, width 3a, height 2,5a; EI-48 is a = 16 mm,
 * EI-57 a = 19 mm, EI-66 a = 22 mm), 0,5 mm silicon-steel sheets, a nylon
 * bobbin with the primary (many turns of thin wire) under the secondary
 * (few turns of thick wire), polyester tape, a zinc-plated steel frame with
 * mounting feet and flying leads (primary: black 0 V, brown 127 V, red 220 V;
 * secondary: yellow), as on common Brazilian bivolt transformers.
 * Exploded view: E and I stacks, bobbin, primary and secondary. Cutaway: the
 * windings sawn through, with their wire cross-sections and tape layers.
 */
import { useMemo } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  ExtrudeGeometry,
  Path,
  Shape,
  ShapeGeometry,
} from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode, useView } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import {
  Lead,
  roundedRectShell,
  scaleUv,
  useGeometrySet,
  useLaminationTexture,
  useTurnsTexture,
  WireSection,
} from './_power-shared';

type Size = 'EI-48' | 'EI-57' | 'EI-66';

export interface TransformerEiProps {
  size?: Size;
  /** Primary: 127 V, 220 V or both (three wires). */
  primaryVoltage?: 127 | 220 | 'bivolt';
  /** Secondary voltage (V AC). */
  secondaryVoltage?: number;
  /** Secondary current (A). */
  secondaryCurrent?: number;
  /** Text printed on the label instead of the ratings. */
  label?: string;
}

/** Centre-leg width a and stack height (mm). */
const SIZES: Record<Size, { a: number; stack: number }> = {
  'EI-48': { a: 16, stack: 25 },
  'EI-57': { a: 19, stack: 30 },
  'EI-66': { a: 22, stack: 35 },
};

const LAMINATION = 0.5;
const FRAME_T = 0.8;
const FOOT = 11;
const PRIMARY_WIRE = 0.25;
const SECONDARY_WIRE = 0.8;

export const meta: PartMeta = {
  id: 'transformer-ei',
  label: 'Transformador',
  category: 'energia',
  summary:
    'Transformador de rede com núcleo EI de chapas de aço-silício, carretel com primário e secundário, fita, suporte e fios coloridos.',
  defaults: {
    size: 'EI-48',
    primaryVoltage: 'bivolt',
    secondaryVoltage: 12,
    secondaryCurrent: 1,
    label: '',
  },
  controls: {
    size: {
      kind: 'select',
      label: 'Núcleo',
      options: [
        { value: 'EI-48', label: 'EI-48 (até ~12 VA)' },
        { value: 'EI-57', label: 'EI-57 (até ~25 VA)' },
        { value: 'EI-66', label: 'EI-66 (até ~50 VA)' },
      ],
    },
    primaryVoltage: {
      kind: 'select',
      label: 'Primário',
      options: [
        { value: 'bivolt', label: '127/220 V (bivolt, 3 fios)' },
        { value: 127, label: '127 V' },
        { value: 220, label: '220 V' },
      ],
    },
    secondaryVoltage: {
      kind: 'select',
      label: 'Secundário',
      options: [6, 9, 12, 15, 18, 24].map((v) => ({ value: v, label: `${v} V` })),
    },
    secondaryCurrent: {
      kind: 'select',
      label: 'Corrente do secundário',
      options: [0.5, 1, 2, 3].map((v) => ({ value: v, label: `${formatNumber(v)} A` })),
    },
    label: { kind: 'text', label: 'Texto da etiqueta', maxLength: 28 },
  },
  annotations: (p) => {
    const { a, stack } = sizeOf(p);
    const list: PartAnnotation[] = [
      {
        at: [1.5 * a, a * 1.4, 0],
        text: 'Núcleo de chapas finas de aço-silício',
        exploded: false,
      },
      {
        at: [0, a * 2.3, stack / 2 + a / 2 + 10],
        text: 'Primário: vai à rede (127 ou 220 V)',
        exploded: false,
      },
      {
        at: [0, a * 2.3, -(stack / 2 + a / 2 + 10)],
        text: 'Secundário: fios amarelos, baixa tensão',
        exploded: false,
      },
      {
        at: [-1.5 * a, 0.4, stack / 2 + FOOT - 4],
        text: 'Pé de fixação com furos',
        exploded: false,
      },
      { at: [0, 0, 0], text: 'Chapas E', anchor: 'e', exploded: true },
      { at: [0, 0, 0], text: 'Chapas I fecham o caminho do fluxo', anchor: 'i', exploded: true },
      { at: [0, 0, 0], text: 'Carretel isolante', anchor: 'bobbin', exploded: true },
      {
        at: [0, 0, 0],
        text: 'Primário: muitas espiras de fio fino',
        anchor: 'primary',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: 'Secundário: poucas espiras de fio grosso',
        anchor: 'secondary',
        exploded: true,
      },
    ];
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const { a, stack } = sizeOf(p);
    const primary =
      p.primaryVoltage === 'bivolt'
        ? 'primário 127/220 V (fios preto 0 V, marrom 127 V e vermelho 220 V)'
        : `primário ${p.primaryVoltage} V (fios preto e ${Number(p.primaryVoltage) === 220 ? 'vermelho' : 'marrom'})`;
    const v = Number(p.secondaryVoltage);
    const i = Number(p.secondaryCurrent);
    return `Transformador com núcleo ${String(p.size)} (${3 * a} × ${formatNumber(2.5 * a)} × ${stack} mm), ${primary}, secundário ${formatNumber(v)} V ${formatNumber(i)} A (fios amarelos), ${formatNumber(v * i)} VA. O primário vai à rede elétrica: só mexa nos fios com o disjuntor desligado.`;
  },
  view: [0.75, 0.6, 1.35],
};

function sizeOf(p: PartProps) {
  return SIZES[(String(p.size) as Size) in SIZES ? (String(p.size) as Size) : 'EI-48'];
}

/** Rounded rectangle path (centre at origin) for shapes and holes. */
function roundedRect<T extends Path>(path: T, w: number, h: number, r: number, cx = 0, cy = 0): T {
  const x = w / 2;
  const y = h / 2;
  const rr = Math.min(r, x, y);
  path.moveTo(cx - x + rr, cy - y);
  path.lineTo(cx + x - rr, cy - y);
  path.quadraticCurveTo(cx + x, cy - y, cx + x, cy - y + rr);
  path.lineTo(cx + x, cy + y - rr);
  path.quadraticCurveTo(cx + x, cy + y, cx + x - rr, cy + y);
  path.lineTo(cx - x + rr, cy + y);
  path.quadraticCurveTo(cx - x, cy + y, cx - x, cy + y - rr);
  path.lineTo(cx - x, cy - y + rr);
  path.quadraticCurveTo(cx - x, cy - y, cx - x + rr, cy - y);
  return path;
}

/** Splits an extrusion into its caps (group 0) and sides (group 1). */
function splitExtrusion(geometry: ExtrudeGeometry): {
  caps: BufferGeometry;
  sides: BufferGeometry;
} {
  const out = geometry.groups.map((group) => {
    const g = new BufferGeometry();
    for (const name of ['position', 'normal', 'uv'] as const) {
      const attr = geometry.attributes[name]!;
      const size = attr.itemSize;
      const array = (attr.array as Float32Array).slice(
        group.start * size,
        (group.start + group.count) * size,
      );
      g.setAttribute(name, new BufferAttribute(array, size));
    }
    return { g, index: group.materialIndex ?? 0 };
  });
  geometry.dispose();
  const pick = (i: number) => {
    const found = out.filter((o) => o.index === i).map((o) => o.g);
    return found[0] ?? new BufferGeometry();
  };
  return { caps: pick(0), sides: pick(1) };
}

/** Lamination stack extruded along Z from a 2D outline, centred on z = 0. */
function stack(shape: Shape, depth: number) {
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  // Sides: V is the depth in mm; one texture tile holds eight 0,5 mm sheets.
  const { caps, sides } = splitExtrusion(g);
  scaleUv(sides, 0.05, 1 / (LAMINATION * 8));
  return { caps, sides };
}

export default function TransformerEi(props: TransformerEiProps) {
  const p = { ...meta.defaults, ...props } as Required<TransformerEiProps>;
  const { a, stack: S } = sizeOf(p as unknown as PartProps);
  const H = 2.5 * a;
  const noise = getNoiseTexture();
  const { cutaway } = useView();

  // Window geometry: the coil fills the two windows (a/2 wide, 1,5a tall).
  const tubeIn = { w: a + 0.6, d: S + 0.6 };
  const tubeWall = 0.9;
  const tubeOut = { w: tubeIn.w + tubeWall * 2, d: tubeIn.d + tubeWall * 2 };
  const build = a / 2 - 0.3 - tubeWall - 0.5;
  const tp = build * 0.5;
  const tape = 0.25;
  const ts = build * 0.38;
  const outerTape = 0.3;
  const yLow = a / 2 + 1.4;
  const yHigh = 2 * a - 1.4;
  const coilH = yHigh - yLow;
  const r0 = 1.2;
  const primaryOut = { w: tubeOut.w + tp * 2, d: tubeOut.d + tp * 2 };
  const secondaryIn = { w: primaryOut.w + tape * 2, d: primaryOut.d + tape * 2 };
  const secondaryOut = { w: secondaryIn.w + ts * 2, d: secondaryIn.d + ts * 2 };
  const coilOut = { w: secondaryOut.w + outerTape * 2, d: secondaryOut.d + outerTape * 2 };
  const coilFrontZ = coilOut.d / 2;

  const core = useCoreGeometry(a, S);
  const frame = useFrameGeometry(a, S);
  const coil = useGeometrySet(
    () => ({
      tube: roundedRectShell(
        tubeOut.w,
        tubeOut.d,
        r0 + tubeWall,
        a / 2 + 0.1,
        2 * a - 0.1,
        tubeWall,
        4,
      ),
      primary: scaleUv(
        roundedRectShell(primaryOut.w, primaryOut.d, r0 + tubeWall + tp, yLow, yHigh, tp, 8),
        1,
        coilH / (PRIMARY_WIRE * 8),
      ),
      tape: roundedRectShell(
        secondaryIn.w,
        secondaryIn.d,
        r0 + tubeWall + tp + tape,
        yLow,
        yHigh,
        tape,
        8,
      ),
      secondary: scaleUv(
        roundedRectShell(
          secondaryOut.w,
          secondaryOut.d,
          r0 + tubeWall + tp + tape + ts,
          yLow,
          yHigh,
          ts,
          8,
        ),
        1,
        coilH / (SECONDARY_WIRE * 8),
      ),
      outer: roundedRectShell(
        coilOut.w,
        coilOut.d,
        r0 + tubeWall + build,
        yLow + 0.5,
        yHigh - 0.5,
        outerTape,
        8,
      ),
      flange: flangeGeometry(a, S, tubeOut),
    }),
    [a, S],
  );

  const primaryMaps = { map: useTurnsTexture('color', '#b4582c'), bump: useTurnsTexture('bump') };
  const secondaryMaps = { map: useTurnsTexture('color', '#a8542a') };
  const lamColor = useLaminationTexture('color');
  const lamRough = useLaminationTexture('rough');

  const bivolt = p.primaryVoltage === 'bivolt';
  const priLabel = bivolt ? '127/220V' : `${p.primaryVoltage}V`;
  const va = p.secondaryVoltage * p.secondaryCurrent;
  const mainText =
    p.label.trim() ||
    `${priLabel} – ${formatNumber(p.secondaryVoltage)}V ${formatNumber(p.secondaryCurrent)}A`;
  const labelW = Math.max(coilOut.w - 2 * (r0 + tubeWall + build) - 1, 10);
  const labelH = coilH - 3;
  const labelMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#f4f1e8';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1d1d1f';
      fitText(ctx, mainText, w / 2, h * 0.2, w * 0.92, h * 0.17, { weight: 800 });
      ctx.fillRect(w * 0.06, h * 0.33, w * 0.88, h * 0.012);
      const line = (text: string, y: number) =>
        fitText(ctx, text, w * 0.06, y, w * 0.88, h * 0.1, { weight: 600, align: 'left' });
      line(
        bivolt
          ? 'PRI: PRETO 0V · MARROM 127V · VERM. 220V'
          : `PRI: PRETO 0V · ${p.primaryVoltage === 220 ? 'VERMELHO 220V' : 'MARROM 127V'}`,
        h * 0.46,
      );
      line(`SEC: AMARELO ${formatNumber(p.secondaryVoltage)}V ~`, h * 0.6);
      line(`${formatNumber(va)}VA  60Hz  ${p.size}`, h * 0.74);
      ctx.fillStyle = '#7a1d17';
      fitText(ctx, 'CUIDADO: PRIMÁRIO LIGADO À REDE', w / 2, h * 0.89, w * 0.9, h * 0.08, {
        weight: 700,
      });
    },
    `trafo|${mainText}|${p.primaryVoltage}|${p.secondaryVoltage}|${va}|${p.size}`,
    { width: 512, height: 400, fonts: [`800 40px ${FONT_SANS}`, `600 40px ${FONT_SANS}`] },
  );

  const leadsPrimary = useMemo(() => {
    const zf = coilFrontZ;
    const list: { x: number; color: string }[] = bivolt
      ? [
          { x: -0.42 * a, color: '#1a1a1c' },
          { x: -0.12 * a, color: '#6b3a1e' },
          { x: 0.18 * a, color: '#c42a1f' },
        ]
      : [
          { x: -0.3 * a, color: '#1a1a1c' },
          { x: 0.05 * a, color: p.primaryVoltage === 220 ? '#c42a1f' : '#6b3a1e' },
        ];
    // Out of the winding, over the frame and down to the bench in front.
    return list.map(({ x, color }, i) => ({
      color,
      points: [
        [x, yHigh - 1.6, zf - 1.5],
        [x, yHigh - 1.6, zf + 1.4],
        [x, yHigh + 2.5 + i * 0.6, zf + 3],
        [x * 1.2, yHigh + 1 + i * 0.6, zf + 11],
        [x * 1.45 - 2, 9 + i * 1.5, zf + 19 + i * 1.5],
        [x * 1.7 - 4, 0.9, zf + 30 + i * 2],
        [x * 2 - 6, 0.9, zf + 46 + i * 3],
      ] as Vec3[],
    }));
  }, [a, bivolt, coilFrontZ, p.primaryVoltage, yHigh]);
  const leadsSecondary = useMemo(() => {
    const zb = -coilFrontZ;
    return [-0.22 * a, 0.22 * a].map((x, i) => ({
      color: '#e0b81e',
      points: [
        [x, yHigh - 2, zb + 1.5],
        [x, yHigh - 2, zb - 1.6],
        [x, yHigh + 2.6, zb - 3.2],
        [x * 1.3, yHigh + 1, zb - 11],
        [x * 1.5 + 2, 9 + i * 1.5, zb - 19],
        [x * 1.8 + 4, 1.0, zb - 30],
        [x * 2.2 + 6, 1.0, zb - 44],
      ] as Vec3[],
    }));
  }, [a, coilFrontZ, yHigh]);

  // Wire cross-sections seen in the windows when the coil is cut at z = 0.
  const sectionX = {
    primary: tubeOut.w / 2 + tp / 2,
    secondary: secondaryIn.w / 2 + ts / 2,
  };

  const coreSides = (
    <Material
      preset="siliconSteel"
      color="#ffffff"
      map={lamColor}
      roughnessMap={lamRough}
      roughness={0.6}
      metalness={0.85}
      clip
      cutColor="#6d7176"
    />
  );
  const cutFace = (
    <Material preset="siliconSteel" color="#9a9ea4" roughness={0.38} roughnessMap={noise} />
  );
  const coreFace = (
    <Material
      preset="siliconSteel"
      color="#7b8086"
      roughness={0.42}
      roughnessMap={noise}
      clip
      cutColor="#6d7176"
    />
  );

  return (
    <group>
      {/* E laminations (legs up). */}
      <group>
        <mesh geometry={core.eSides}>{coreSides}</mesh>
        <mesh geometry={core.eCaps}>{coreFace}</mesh>
        {cutaway && <mesh geometry={core.eCut}>{cutFace}</mesh>}
        <Anchor name="e" position={[-1.25 * a, a * 0.25, S / 2]} />
      </group>

      {/* I laminations close the magnetic circuit on top. */}
      <Explode offset={[0, 3.7 * a, 0]} delay={0.1}>
        <mesh geometry={core.iSides}>{coreSides}</mesh>
        <mesh geometry={core.iCaps}>{coreFace}</mesh>
        {cutaway && <mesh geometry={core.iCut}>{cutFace}</mesh>}
        <Anchor name="i" position={[a, H, S / 2]} />
      </Explode>

      {/* Bobbin and windings. */}
      <Explode offset={[0, 2.4 * a, 0]}>
        <mesh geometry={coil.tube}>
          <Material preset="pbtBlack" roughness={0.5} clip cutColor="#2a2a2c" />
        </mesh>
        {[a / 2 + 0.1, 2 * a - 1.4].map((y) => (
          <mesh key={y} geometry={coil.flange} position={[0, y, 0]}>
            <Material preset="pbtBlack" roughness={0.5} clip cutColor="#2a2a2c" />
          </mesh>
        ))}
        <Anchor name="bobbin" position={[a * 0.9, 2 * a, coilOut.d / 2 - 2]} />

        <Explode offset={[-2.5 * a, 0, 0]} delay={0.45}>
          <mesh geometry={coil.primary}>
            <Material
              preset="magnetWire"
              color="#ffffff"
              map={primaryMaps.map}
              bumpMap={primaryMaps.bump}
              bumpScale={0.6}
              clip
              cutColor="#9c4a22"
            />
          </mesh>
          {([-1, 1] as const).map((side) => (
            <WireSection
              key={side}
              width={tp}
              height={coilH}
              wire={PRIMARY_WIRE}
              position={[side * sectionX.primary, (yLow + yHigh) / 2, 0.02]}
            />
          ))}
          {leadsPrimary.map((lead, i) => (
            <Lead key={i} points={lead.points} radius={0.75} color={lead.color} clip />
          ))}
          <Anchor
            name="primary"
            position={[-primaryOut.w / 2, (yLow + yHigh) / 2, primaryOut.d / 2 - 3]}
          />
        </Explode>

        <Explode offset={[2.5 * a, 0, 0]} delay={0.45}>
          <mesh geometry={coil.tape}>
            <Material color="#e9cf72" roughness={0.4} clip cutColor="#e2c35a" />
          </mesh>
          <mesh geometry={coil.secondary}>
            <Material
              preset="magnetWire"
              color="#ffffff"
              map={secondaryMaps.map}
              bumpMap={primaryMaps.bump}
              bumpScale={1.2}
              clip
              cutColor="#9c4a22"
            />
          </mesh>
          <mesh geometry={coil.outer}>
            <Material
              color="#e8c234"
              roughness={0.32}
              clearcoat={0.6}
              clearcoatRoughness={0.3}
              clip
              cutColor="#d9b22a"
            />
          </mesh>
          <mesh position={[0, (yLow + yHigh) / 2, coilOut.d / 2 + 0.06]}>
            <planeGeometry args={[labelW, labelH]} />
            <Material color="#ffffff" map={labelMap} roughness={0.7} clip />
          </mesh>
          {([-1, 1] as const).map((side) => (
            <WireSection
              key={side}
              width={ts}
              height={coilH}
              wire={SECONDARY_WIRE}
              tint="#d17b45"
              position={[side * sectionX.secondary, (yLow + yHigh) / 2, 0.02]}
            />
          ))}
          {leadsSecondary.map((lead, i) => (
            <Lead key={i} points={lead.points} radius={0.85} color={lead.color} clip />
          ))}
          <Anchor
            name="secondary"
            position={[coilOut.w / 2, (yLow + yHigh) / 2, coilOut.d / 2 - 3]}
          />
        </Explode>
      </Explode>

      {/* Steel frame halves with the feet, and the rivets. */}
      {([1, -1] as const).map((side) => (
        <Explode key={side} offset={[0, 0, side * 1.6 * a]}>
          <group scale={[1, 1, side]}>
            <mesh geometry={frame.plate}>
              <Material preset="zinc" color="#d3d6d9" roughness={0.3} roughnessMap={noise} clip />
            </mesh>
            <mesh geometry={frame.foot}>
              <Material preset="zinc" color="#d3d6d9" roughness={0.3} roughnessMap={noise} clip />
            </mesh>
            <mesh geometry={frame.lip}>
              <Material preset="zinc" color="#d3d6d9" roughness={0.3} clip />
            </mesh>
          </group>
        </Explode>
      ))}
      <Explode offset={[0, 0, 2.8 * a]} delay={0.2}>
        {[-1.25 * a, 1.25 * a].flatMap((x) =>
          [a / 4, H - a / 4].map((y) => (
            <group key={`${x}|${y}`} position={[x, y, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[1.5, 1.5, S + FRAME_T * 2 + 0.6, 14]} />
                <Material preset="steel" clip />
              </mesh>
              {([1, -1] as const).map((s) => (
                <mesh
                  key={s}
                  position={[0, 0, s * (S / 2 + FRAME_T)]}
                  rotation={[s * (Math.PI / 2), 0, 0]}
                  scale={[1, 0.45, 1]}
                >
                  <sphereGeometry args={[2.5, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <Material preset="zinc" roughness={0.3} clip />
                </mesh>
              ))}
            </group>
          )),
        )}
      </Explode>
    </group>
  );
}

/** E and I lamination stacks. */
function useCoreGeometry(a: number, S: number) {
  return useGeometrySet(() => {
    const e = new Shape();
    const pts: [number, number][] = [
      [-1.5 * a, 0],
      [1.5 * a, 0],
      [1.5 * a, 2 * a],
      [a, 2 * a],
      [a, a / 2],
      [a / 2, a / 2],
      [a / 2, 2 * a],
      [-a / 2, 2 * a],
      [-a / 2, a / 2],
      [-a, a / 2],
      [-a, 2 * a],
      [-1.5 * a, 2 * a],
    ];
    pts.forEach(([x, y], i) => (i === 0 ? e.moveTo(x, y) : e.lineTo(x, y)));
    e.closePath();
    const i = new Shape();
    // Thin seam between the stacks, as on a real core.
    roundedRect(i, 3 * a, a / 2 - 0.08, 0.2, 0, 2 * a + 0.04 + (a / 2 - 0.08) / 2);
    const eStack = stack(e, S);
    const iStack = stack(i, S);
    // Flat faces drawn on the cut plane (the stacks touch, so their own back
    // faces would show the inside of the neighbouring solid), with rivet holes.
    const withRivets = (shape: Shape, y: number) => {
      const face = new Shape().copy(shape);
      for (const x of [-1.25 * a, 1.25 * a]) {
        const hole = new Path();
        hole.absarc(x, y, 1.5, 0, Math.PI * 2, true);
        face.holes.push(hole);
      }
      const g = new ShapeGeometry(face, 4);
      g.translate(0, 0, 0.03);
      return g;
    };
    return {
      eCaps: eStack.caps,
      eSides: eStack.sides,
      iCaps: iStack.caps,
      iSides: iStack.sides,
      eCut: withRivets(e, a / 4),
      iCut: withRivets(i, 2.5 * a - a / 4),
    };
  }, [a, S]);
}

/** Bobbin flange: a plate with the hole of the tube (lies in XZ, 1,3 mm thick, from y = 0). */
function flangeGeometry(a: number, S: number, tube: { w: number; d: number }) {
  const shape = roundedRect(new Shape(), 2 * a - 0.6, S + a - 0.6, 1.6);
  shape.holes.push(roundedRect(new Path(), tube.w - 0.1, tube.d - 0.1, 2));
  const g = new ExtrudeGeometry(shape, { depth: 1.3, bevelEnabled: false, curveSegments: 4 });
  g.rotateX(Math.PI / 2);
  g.translate(0, 1.3, 0);
  return g;
}

/** Front frame plate (the back one is mirrored), foot with mounting holes and the top lip. */
function useFrameGeometry(a: number, S: number) {
  return useGeometrySet(() => {
    const W = 3 * a + 1.2;
    const H = 2.5 * a + FRAME_T;
    const plateShape = roundedRect(new Shape(), W, H, 1.2, 0, H / 2);
    plateShape.holes.push(roundedRect(new Path(), 2 * a + 0.4, 1.5 * a + 0.2, 1.5, 0, 1.25 * a));
    // Rivet holes.
    for (const x of [-1.25 * a, 1.25 * a])
      for (const y of [a / 4, 2.5 * a - a / 4]) {
        const hole = new Path();
        hole.absarc(x, y, 1.6, 0, Math.PI * 2, true);
        plateShape.holes.push(hole);
      }
    const plate = new ExtrudeGeometry(plateShape, {
      depth: FRAME_T,
      bevelEnabled: false,
      curveSegments: 8,
    });
    plate.translate(0, 0, S / 2);

    const footShape = roundedRect(new Shape(), W, FOOT, 1.5, 0, FOOT / 2);
    for (const x of [-(W / 2 - 6), W / 2 - 6]) {
      // Slotted mounting hole.
      const slot = new Path();
      slot.absarc(x - 1, FOOT / 2 + 0.8, 2.1, Math.PI / 2, (Math.PI * 3) / 2, false);
      slot.absarc(x + 1, FOOT / 2 + 0.8, 2.1, (Math.PI * 3) / 2, Math.PI / 2, false);
      footShape.holes.push(slot);
    }
    const foot = new ExtrudeGeometry(footShape, {
      depth: FRAME_T,
      bevelEnabled: false,
      curveSegments: 10,
    });
    // Shape Y becomes +Z (outwards), extrusion becomes +Y (up).
    foot.rotateX(Math.PI / 2);
    foot.translate(0, FRAME_T, S / 2);

    const lipShape = roundedRect(new Shape(), W, 5.5, 0.6, 0, 0);
    const lip = new ExtrudeGeometry(lipShape, {
      depth: FRAME_T,
      bevelEnabled: false,
      curveSegments: 4,
    });
    lip.rotateX(Math.PI / 2);
    lip.translate(0, H, S / 2 + FRAME_T - 2.75);
    return { plate, foot, lip };
  }, [a, S]);
}
