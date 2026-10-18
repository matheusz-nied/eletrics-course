/**
 * Permanent magnets used in school demonstrations and hobby projects:
 * - bar ("barra"): painted ferrite, red north half and blue south half,
 *   75 × 15 × 10 mm (the common school set; 50 and 100 mm too);
 * - horseshoe ("ferradura"): red painted steel U with ground pole tips,
 *   75 × 50 mm, 12 × 10 mm legs (school sets; 50 and 100 mm too);
 * - neodymium disc ("neodimio"): sintered NdFeB, Ni-Cu-Ni plated, axially
 *   magnetized, Ø 20 × 5 mm (catalogue sizes Ø 10 × 3 and Ø 30 × 10 mm too).
 * Exploded view: the magnet broken in two; each piece is a whole magnet, with
 * a new pole on the broken end. Cutaway: the inside, with the magnetic domains
 * lined up (schematic) and, on the neodymium disc, the plating layers.
 * Optional field lines computed by `fx/field.ts`.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import {
  type BufferGeometry,
  DoubleSide,
  ExtrudeGeometry,
  LatheGeometry,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  Vector2,
  type Group,
  type Texture,
} from 'three';
import { useReducedMotion } from '../core/motion';
import { Anchor, Explode, useView } from '../core/view';
import { FieldLines } from '../fx/FieldLines';
import type { FieldSource } from '../fx/field';
import { Material } from '../materials/Material';
import { FONT_SANS, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import {
  dropTriangles,
  ExplodeReveal,
  planarUv,
  seeded,
  sharpenProfile,
  useGeometrySet,
} from './_power-shared';

type Variant = 'barra' | 'ferradura' | 'neodimio';
type Size = 'pequeno' | 'medio' | 'grande';

export interface MagnetProps {
  variant?: Variant;
  size?: Size;
  /** Painted N and S marks (bar, horseshoe) or the red north dot (neodymium). */
  showPoles?: boolean;
  /** Draw the magnetic field lines around the magnet. */
  fieldLines?: boolean;
}

const BAR: Record<Size, { L: number; w: number; h: number }> = {
  pequeno: { L: 50, w: 12, h: 8 },
  medio: { L: 75, w: 15, h: 10 },
  grande: { L: 100, w: 20, h: 12 },
};
/** Horseshoe: length (back of the bend to the tips), width, leg width, thickness. */
const HORSESHOE: Record<Size, { length: number; width: number; leg: number; t: number }> = {
  pequeno: { length: 50, width: 35, leg: 8, t: 8 },
  medio: { length: 75, width: 50, leg: 12, t: 10 },
  grande: { length: 100, width: 65, leg: 15, t: 13 },
};
const DISC: Record<Size, { d: number; t: number }> = {
  pequeno: { d: 10, t: 3 },
  medio: { d: 20, t: 5 },
  grande: { d: 30, t: 10 },
};

const RED = '#c4262b';
const BLUE = '#1d4e9e';
const HORSESHOE_RED = '#c42a24';
const FERRITE = '#3e3f42';
const FIELD = '#2a7fd6';

function variantOf(p: PartProps): Variant {
  const v = String(p.variant);
  return v === 'ferradura' || v === 'neodimio' ? v : 'barra';
}
function sizeOf(p: PartProps): Size {
  const s = String(p.size);
  return s === 'pequeno' || s === 'grande' ? s : 'medio';
}
/** Height of the magnet lying on the bench (mm). */
function heightOf(p: PartProps) {
  const v = variantOf(p);
  const s = sizeOf(p);
  return v === 'barra' ? BAR[s].h : v === 'ferradura' ? HORSESHOE[s].t : DISC[s].t;
}

export const meta: PartMeta = {
  id: 'magnet',
  label: 'Ímã',
  category: 'magnetismo',
  summary:
    'Ímãs permanentes: em barra, em ferradura e de neodímio, com os polos norte e sul, as linhas de campo e o que acontece quando se quebra um ímã.',
  defaults: { variant: 'barra', size: 'medio', showPoles: true, fieldLines: false },
  controls: {
    variant: {
      kind: 'select',
      label: 'Tipo',
      options: [
        { value: 'barra', label: 'Em barra (ferrite pintado)' },
        { value: 'ferradura', label: 'Em ferradura (aço)' },
        { value: 'neodimio', label: 'Disco de neodímio' },
      ],
    },
    size: {
      kind: 'select',
      label: 'Tamanho',
      options: [
        { value: 'pequeno', label: 'Pequeno' },
        { value: 'medio', label: 'Médio' },
        { value: 'grande', label: 'Grande' },
      ],
    },
    showPoles: { kind: 'toggle', label: 'Marcas dos polos' },
    fieldLines: { kind: 'toggle', label: 'Linhas de campo' },
  },
  annotations: (p) => {
    const v = variantOf(p);
    const s = sizeOf(p);
    const list: PartAnnotation[] = [];
    if (v === 'barra') {
      const { L, w, h } = BAR[s];
      list.push(
        {
          at: [L / 2, h * 0.6, 0],
          text: 'Polo norte (N): as linhas de campo saem daqui',
          exploded: false,
        },
        {
          at: [-L / 2, h * 0.6, 0],
          text: 'Polo sul (S): as linhas de campo entram aqui',
          exploded: false,
        },
        { at: [0, h * 0.5, w / 2], text: 'No meio quase não há atração', exploded: false },
      );
    } else if (v === 'ferradura') {
      const { length, width, leg, t } = HORSESHOE[s];
      const rm = width / 2 - leg / 2;
      list.push(
        { at: [rm, t, length / 2 - 2], text: 'Polo norte (N)', exploded: false },
        { at: [-rm, t, length / 2 - 2], text: 'Polo sul (S)', exploded: false },
        {
          at: [0, t / 2, length / 2 - 4],
          text: 'Entre as pontas o campo é forte',
          exploded: false,
        },
        {
          at: [0, t, -length / 2 + leg / 2],
          text: 'Aço curvado em U: os polos ficam lado a lado',
          exploded: false,
        },
      );
    } else {
      const { d, t } = DISC[s];
      list.push(
        { at: [-d * 0.2, t, -d * 0.1], text: 'Face de cima: polo norte (N)', exploded: false },
        { at: [d * 0.2, 0, d * 0.35], text: 'Face de baixo: polo sul (S)', exploded: false },
        {
          at: [d / 2, t / 2, 0],
          text: 'Banho de níquel: o neodímio enferruja fácil',
          exploded: false,
        },
      );
    }
    if (v === 'neodimio') {
      list.push(
        {
          at: [0, 0, 0],
          text: 'Cada pedaço continua com N em cima e S embaixo',
          anchor: 'right',
          exploded: true,
        },
        { at: [0, 0, 0], text: 'Também é um ímã completo', anchor: 'left', exploded: true },
      );
    } else {
      list.push(
        {
          at: [0, 0, 0],
          text: 'Na quebra surge um polo sul novo',
          anchor: 'new-s',
          exploded: true,
        },
        { at: [0, 0, 0], text: 'E aqui, um polo norte novo', anchor: 'new-n', exploded: true },
        { at: [0, 0, 0], text: 'Não existe ímã com um polo só', anchor: 'right', exploded: true },
      );
    }
    return list;
  },
  explode: true,
  cutaway: true,
  // Bar and horseshoe: cut lengthwise through the middle of the thickness
  // (the domains show from above). Disc: the default vertical cut.
  cut: (p) =>
    variantOf(p) === 'neodimio' ? {} : { normal: [0, -1, 0], through: [0, heightOf(p) / 2, 0] },
  describe: (p) => {
    const v = variantOf(p);
    const s = sizeOf(p);
    const lines = p.fieldLines
      ? ' Linhas de campo azuis saem do polo norte e entram no polo sul.'
      : '';
    if (v === 'barra') {
      const { L, w, h } = BAR[s];
      const marks = p.showPoles
        ? 'metade vermelha com a letra N (polo norte) e metade azul com a letra S (polo sul)'
        : 'cinza-escuro e sem marcas: só uma bússola mostra qual ponta é o norte';
      return `Ímã em barra de ferrite, ${L} × ${w} × ${h} mm, ${marks}.${lines}`;
    }
    if (v === 'ferradura') {
      const { length, width } = HORSESHOE[s];
      const marks = p.showPoles ? ', marcadas N e S' : '';
      return `Ímã em ferradura de aço pintado de vermelho, ${length} × ${width} mm, com as duas pontas de metal polido lado a lado${marks}.${lines}`;
    }
    const { d, t } = DISC[s];
    const dot = p.showPoles ? ' Um ponto vermelho marca a face norte.' : '';
    return `Disco de neodímio niquelado, ${d} mm de diâmetro e ${t} mm de espessura, magnetizado entre as faces: norte em cima, sul embaixo.${dot}${lines} Ímãs de neodímio são muito fortes: podem beliscar a pele e lascar ao se chocar; mantenha longe de crianças, cartões e marca-passos.`;
  },
  view: [0.75, 0.75, 1.2],
};

export default function Magnet(props: MagnetProps) {
  const p = { ...meta.defaults, ...props } as Required<MagnetProps>;
  const v = variantOf(p as PartProps);
  const s = sizeOf(p as PartProps);
  if (v === 'ferradura')
    return <Horseshoe size={s} showPoles={p.showPoles} fieldLines={p.fieldLines} />;
  if (v === 'neodimio') return <Disc size={s} showPoles={p.showPoles} fieldLines={p.fieldLines} />;
  return <Bar size={s} showPoles={p.showPoles} fieldLines={p.fieldLines} />;
}

interface VariantProps {
  size: Size;
  showPoles: boolean;
  fieldLines: boolean;
}

// ---------------------------------------------------------------------------
// Shared pieces

/** A painted letter (or the outline of a new pole) on a transparent canvas. */
function useLetterTexture(letter: string, style: 'pintada' | 'nova') {
  return useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (style === 'nova') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = w * 0.05;
        ctx.setLineDash([w * 0.09, w * 0.06]);
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w * 0.44, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = `800 ${h * 0.56}px ${FONT_SANS}`;
      } else {
        ctx.font = `800 ${h * 0.86}px ${FONT_SANS}`;
      }
      ctx.fillText(letter, w / 2, h * 0.54);
    },
    `magnet-letter|${letter}|${style}`,
    { width: 128, height: 128, fonts: [`800 40px ${FONT_SANS}`] },
  );
}

function Letter({
  map,
  size,
  position,
  rotation,
}: {
  map: Texture;
  size: number;
  position: Vec3;
  rotation: Vec3;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size, size]} />
      <Material
        color="#f4f2ec"
        map={map}
        alphaTest={0.45}
        roughness={0.5}
        clearcoat={0.4}
        polygonOffset
        polygonOffsetFactor={-2}
        clip
      />
    </mesh>
  );
}

/** Rough broken face on the plane x = 0, facing −X (the +X piece), `w` along Z and `h` along Y. */
function fractureFace(w: number, h: number, depth: number, seed: number): BufferGeometry {
  const nw = Math.max(6, Math.round(w / 1.2));
  const nh = Math.max(4, Math.round(h / 1.2));
  const g = new PlaneGeometry(w, h, nw, nh);
  const random = seeded(seed);
  const position = g.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const edge = Math.min(w / 2 - Math.abs(x), h / 2 - Math.abs(y));
    if (edge < 1e-3) continue;
    // Conchoidal ridges plus grain.
    const ridge = Math.sin(x * 0.45 + y * 0.3) * 0.5 + Math.sin(y * 0.9 - x * 0.2) * 0.3;
    position.setZ(i, (ridge + (random() - 0.5) * 0.7) * depth * Math.min(edge / 1.2, 1));
  }
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** Arrows of the lined-up domains on a cut face, drawn in millimetres. */
function drawDomains(
  ctx: CanvasRenderingContext2D,
  pxPerMm: number,
  [x0, x1]: [number, number],
  [y0, y1]: [number, number],
  inside: (x: number, y: number) => boolean,
  direction: (x: number, y: number) => [number, number],
  { background = FERRITE, spacing = 3.2, seed = 3 } = {},
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, w, h);
  // Grain of the sintered material.
  const random = seeded(seed);
  for (let i = 0; i < (w * h) / 60; i++) {
    const g = 40 + random() * 40;
    ctx.fillStyle = `rgba(${g},${g + 2},${g + 6},0.5)`;
    ctx.fillRect(random() * w, random() * h, 2, 2);
  }
  const toPx = (x: number, y: number): [number, number] => [
    ((x - x0) / (x1 - x0)) * w,
    (1 - (y - y0) / (y1 - y0)) * h,
  ];
  ctx.strokeStyle = 'rgba(214,226,240,0.85)';
  ctx.fillStyle = 'rgba(214,226,240,0.85)';
  ctx.lineWidth = Math.max(1.5, pxPerMm * 0.16);
  const len = spacing * 0.62;
  for (let y = y0 + spacing / 2; y < y1; y += spacing) {
    for (let x = x0 + spacing / 2; x < x1; x += spacing) {
      const jx = x + (random() - 0.5) * spacing * 0.2;
      const jy = y + (random() - 0.5) * spacing * 0.2;
      if (!inside(jx, jy)) continue;
      const [dx, dy] = direction(jx, jy);
      const wobble = (random() - 0.5) * 0.3;
      const c = Math.cos(wobble);
      const sn = Math.sin(wobble);
      const ux = dx * c - dy * sn;
      const uy = dx * sn + dy * c;
      const [ax, ay] = toPx(jx - (ux * len) / 2, jy - (uy * len) / 2);
      const [bx, by] = toPx(jx + (ux * len) / 2, jy + (uy * len) / 2);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      const angle = Math.atan2(by - ay, bx - ax);
      const head = pxPerMm * 0.7;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(angle) * head * 0.3, by + Math.sin(angle) * head * 0.3);
      ctx.lineTo(bx - Math.cos(angle - 0.5) * head, by - Math.sin(angle - 0.5) * head);
      ctx.lineTo(bx - Math.cos(angle + 0.5) * head, by - Math.sin(angle + 0.5) * head);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** Field lines, hidden while the magnet is broken apart or cut open. */
function Field({
  sources,
  plane,
  center,
  extent,
  count,
}: {
  sources: FieldSource[];
  plane: Vec3;
  center: Vec3;
  extent: number;
  count: number;
}) {
  const { explode, cutaway } = useView();
  const reduced = useReducedMotion();
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = (explode.current ?? 0) < 0.02;
  });
  if (cutaway) return null;
  return (
    <group ref={ref}>
      <FieldLines
        sources={sources}
        count={count}
        layout="plano"
        planeNormal={plane}
        center={center}
        extent={extent}
        color={FIELD}
        opacity={0.8}
        flow={reduced ? 0 : extent * 0.12}
      />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bar magnet: lies along X, north at +X; the pieces break at x = 0.

function Bar({ size, showPoles, fieldLines }: VariantProps) {
  const { L, w, h } = BAR[size];
  const r = Math.min(1, h * 0.12);
  const noise = getNoiseTexture();
  const geo = useGeometrySet(() => {
    // Rounded-rectangle section in (Z, Y), extruded along X from the break.
    const shape = new Shape();
    const x = w / 2;
    shape.moveTo(-x + r, 0);
    shape.lineTo(x - r, 0);
    shape.quadraticCurveTo(x, 0, x, r);
    shape.lineTo(x, h - r);
    shape.quadraticCurveTo(x, h, x - r, h);
    shape.lineTo(-x + r, h);
    shape.quadraticCurveTo(-x, h, -x, h - r);
    shape.lineTo(-x, r);
    shape.quadraticCurveTo(-x, 0, -x + r, 0);
    const body = new ExtrudeGeometry(shape, {
      depth: L / 2,
      bevelEnabled: false,
      curveSegments: 4,
    });
    body.rotateY(Math.PI / 2);
    const open = dropTriangles(
      body,
      (a, b, c) => Math.max(Math.abs(a.x), Math.abs(b.x), Math.abs(c.x)) < 1e-4,
    );
    const fracture = fractureFace(w - 0.05, h - 0.05, Math.min(0.9, h * 0.08), 5);
    fracture.translate(0, h / 2, 0);
    const section = new PlaneGeometry(L / 2 - 0.05, w - 0.1);
    section.rotateX(-Math.PI / 2);
    section.translate(L / 4, h / 2 - 0.01, 0);
    return { body: open, fracture, section };
  }, [L, w, h, r]);

  const pxPerMm = 1024 / (L / 2);
  const drawSection = (reverse: boolean) => (ctx: CanvasRenderingContext2D) =>
    drawDomains(
      ctx,
      pxPerMm,
      [0, L / 2],
      [-w / 2, w / 2],
      () => true,
      () => [reverse ? -1 : 1, 0],
      { spacing: Math.max(2.4, w / 5) },
    );
  const sectionN = useCanvasTexture(drawSection(false), `bar-domains|${L}|${w}|n`, {
    width: 1024,
    height: Math.round(1024 * (w / (L / 2))),
  });
  const sectionS = useCanvasTexture(drawSection(true), `bar-domains|${L}|${w}|s`, {
    width: 1024,
    height: Math.round(1024 * (w / (L / 2))),
  });
  const letterN = useLetterTexture('N', 'pintada');
  const letterS = useLetterTexture('S', 'pintada');
  const newN = useLetterTexture('N', 'nova');
  const newS = useLetterTexture('S', 'nova');

  const top = Math.min(w - 2 * r, L * 0.16) * 0.78;
  const front = (h - 2 * r) * 0.78;
  const xLetter = L / 2 - Math.max(top, L * 0.09);
  const xNew = Math.max(top * 0.8, L * 0.07);

  const half = (north: boolean) => {
    const color = showPoles ? (north ? RED : BLUE) : FERRITE;
    return (
      <>
        <group scale={[north ? 1 : -1, 1, 1]}>
          <mesh geometry={geo.body}>
            <Material
              color={color}
              roughness={showPoles ? 0.38 : 0.72}
              roughnessMap={noise}
              clearcoat={showPoles ? 0.5 : 0}
              clearcoatRoughness={0.35}
              metalness={showPoles ? 0 : 0.15}
              clip
              cutColor="#2f3033"
            />
          </mesh>
          <mesh geometry={geo.fracture}>
            <Material
              color="#4b4c50"
              roughness={0.88}
              metalness={0.2}
              roughnessMap={noise}
              clip
              cutColor="#2f3033"
            />
          </mesh>
          <SectionFace geometry={geo.section} map={north ? sectionN : sectionS} />
        </group>
        {showPoles && (
          <>
            <Letter
              map={north ? letterN : letterS}
              size={top}
              position={[(north ? 1 : -1) * xLetter, h + 0.02, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            />
            <Letter
              map={north ? letterN : letterS}
              size={front}
              position={[(north ? 1 : -1) * xLetter, h / 2, w / 2 + 0.02]}
              rotation={[0, 0, 0]}
            />
          </>
        )}
        <ExplodeReveal position={[(north ? 1 : -1) * xNew, h + 0.05, 0]}>
          <Letter
            map={north ? newS : newN}
            size={top * 0.95}
            position={[0, 0, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        </ExplodeReveal>
        <Anchor name={north ? 'new-s' : 'new-n'} position={[(north ? 1 : -1) * xNew, h, 0]} />
        <Anchor
          name={north ? 'right' : 'left'}
          position={[(north ? 1 : -1) * L * 0.38, h, w / 2]}
        />
      </>
    );
  };

  return (
    <group>
      <Explode offset={[L * 0.3, 0, L * 0.04]} rotate={[0, 0.16, 0]}>
        {half(true)}
      </Explode>
      <Explode offset={[-L * 0.3, 0, -L * 0.02]} rotate={[0, 0.1, 0]}>
        {half(false)}
      </Explode>
      {fieldLines && (
        <Field
          sources={[{ kind: 'bar', length: L * 0.84, axis: [1, 0, 0], position: [0, h / 2, 0] }]}
          plane={[0, 1, 0]}
          center={[0, h / 2, 0]}
          extent={L * 1.05}
          count={14}
        />
      )}
    </group>
  );
}

/** The face left by the cutaway, with the domains (shown only while cut). */
function SectionFace({ geometry, map }: { geometry: BufferGeometry; map: Texture }) {
  const { cutaway } = useView();
  if (!cutaway) return null;
  return (
    <mesh geometry={geometry}>
      <Material color="#ffffff" map={map} roughness={0.75} metalness={0.1} side={DoubleSide} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Horseshoe: lies flat, the bend at the back (−Z), the tips towards +Z;
// north tip at +X. The pieces break at the top of the bend (x = 0).

function Horseshoe({ size, showPoles, fieldLines }: VariantProps) {
  const { length, width, leg, t } = HORSESHOE[size];
  const ro = width / 2;
  const ri = ro - leg;
  const rm = (ro + ri) / 2;
  const zc = -length / 2 + ro;
  const zTip = length / 2;
  const tipLen = Math.min(leg * 0.7, 8);
  const zPaint = zTip - tipLen;
  const noise = getNoiseTexture();

  const geo = useGeometrySet(() => {
    // Half of the U (x ≥ 0) in shape coordinates (x, z).
    const halfU = (end: number) => {
      const shape = new Shape();
      const steps = 20;
      shape.moveTo(0, zc - ro);
      for (let i = 1; i <= steps; i++) {
        const a = -Math.PI / 2 + (Math.PI / 2) * (i / steps);
        shape.lineTo(Math.cos(a) * ro, zc + Math.sin(a) * ro);
      }
      shape.lineTo(ro, end);
      shape.lineTo(ri, end);
      shape.lineTo(ri, zc);
      for (let i = 1; i <= steps; i++) {
        const a = -(Math.PI / 2) * (i / steps);
        shape.lineTo(Math.cos(a) * ri, zc + Math.sin(a) * ri);
      }
      shape.closePath();
      return shape;
    };
    // Shape (x, z) extruded by t, then laid flat: shape Y → +Z, depth → down from y = t.
    const flat = (g: BufferGeometry) => {
      g.rotateX(Math.PI / 2);
      g.translate(0, t, 0);
      return g;
    };
    const painted = flat(
      new ExtrudeGeometry(halfU(zPaint), { depth: t, bevelEnabled: false, curveSegments: 4 }),
    );
    const body = dropTriangles(
      painted,
      (a, b, c) => Math.max(Math.abs(a.x), Math.abs(b.x), Math.abs(c.x)) < 1e-4,
    );
    const tipShape = new Shape();
    tipShape.moveTo(ri, zPaint);
    tipShape.lineTo(ro, zPaint);
    tipShape.lineTo(ro, zTip - 0.4);
    tipShape.lineTo(ro - 0.4, zTip);
    tipShape.lineTo(ri + 0.4, zTip);
    tipShape.lineTo(ri, zTip - 0.4);
    tipShape.closePath();
    const tip = flat(
      new ExtrudeGeometry(tipShape, { depth: t, bevelEnabled: false, curveSegments: 2 }),
    );
    const fracture = fractureFace(leg - 0.05, t - 0.05, Math.min(0.9, t * 0.08), 9);
    fracture.translate(0, t / 2, zc - rm);
    // Cut face at mid-thickness, mapped onto the domain drawing (x 0..ro, z).
    const section = planarUv(new ShapeGeometry(halfU(zTip), 4), [0, ro], [zc - ro, zTip]);
    section.rotateX(Math.PI / 2);
    section.translate(0, t / 2 - 0.01, 0);
    return { body, tip, fracture, section };
  }, [length, width, leg, t]);

  const H = 1024;
  const W = Math.round((H * ro) / (zTip - (zc - ro)));
  const pxPerMm = H / (zTip - (zc - ro));
  const inside = (x: number, z: number) => {
    if (z >= zc) return x >= ri && x <= ro;
    const d = Math.hypot(x, z - zc);
    return d >= ri && d <= ro;
  };
  // Magnetization runs from the south tip, round the bend, to the north tip.
  const along =
    (reverse: boolean) =>
    (x: number, z: number): [number, number] => {
      const k = reverse ? -1 : 1;
      if (z >= zc) return [0, k];
      const a = Math.atan2(z - zc, x);
      return [-Math.sin(a) * k, Math.cos(a) * k];
    };
  const drawSection = (reverse: boolean) => (ctx: CanvasRenderingContext2D) =>
    drawDomains(ctx, pxPerMm, [0, ro], [zc - ro, zTip], inside, along(reverse), {
      background: '#55575b',
      spacing: Math.max(2.6, leg / 3.6),
    });
  const sectionN = useCanvasTexture(drawSection(false), `hs-domains|${length}|n`, {
    width: W,
    height: H,
  });
  const sectionS = useCanvasTexture(drawSection(true), `hs-domains|${length}|s`, {
    width: W,
    height: H,
  });
  const letterN = useLetterTexture('N', 'pintada');
  const letterS = useLetterTexture('S', 'pintada');
  const newN = useLetterTexture('N', 'nova');
  const newS = useLetterTexture('S', 'nova');
  const letter = leg * 0.72;

  const half = (north: boolean) => {
    const sx = north ? 1 : -1;
    return (
      <>
        <group scale={[sx, 1, 1]}>
          <mesh geometry={geo.body}>
            <Material
              color={HORSESHOE_RED}
              roughness={0.36}
              roughnessMap={noise}
              clearcoat={0.55}
              clearcoatRoughness={0.3}
              clip
              cutColor="#4a4c50"
            />
          </mesh>
          <mesh geometry={geo.tip}>
            <Material
              preset="steel"
              color="#c3c6ca"
              roughness={0.3}
              roughnessMap={noise}
              clip
              cutColor="#5d6064"
            />
          </mesh>
          <mesh geometry={geo.fracture}>
            <Material
              color="#6a6c70"
              roughness={0.7}
              metalness={0.7}
              roughnessMap={noise}
              clip
              cutColor="#4a4c50"
            />
          </mesh>
          <SectionFace geometry={geo.section} map={north ? sectionN : sectionS} />
        </group>
        {showPoles && (
          <Letter
            map={north ? letterN : letterS}
            size={letter}
            position={[sx * rm, t + 0.02, zPaint - letter * 0.75]}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        )}
        <ExplodeReveal position={[sx * leg * 0.15, t + 0.05, zc - rm - leg * 0.05]}>
          <Letter
            map={north ? newS : newN}
            size={leg * 0.9}
            position={[sx * leg * 0.45, 0, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        </ExplodeReveal>
        <Anchor name={north ? 'new-s' : 'new-n'} position={[sx * leg * 0.6, t, zc - rm]} />
        <Anchor name={north ? 'right' : 'left'} position={[sx * ro, t / 2, zc + leg]} />
      </>
    );
  };

  return (
    <group>
      <Explode offset={[width * 0.32, 0, 0]} rotate={[0, -0.18, 0]}>
        {half(true)}
      </Explode>
      <Explode offset={[-width * 0.32, 0, 0]} rotate={[0, 0.18, 0]}>
        {half(false)}
      </Explode>
      {fieldLines && (
        <Field
          sources={[
            {
              kind: 'bar',
              length: 2 * rm,
              axis: [1, 0, 0],
              position: [0, t / 2, zTip - tipLen / 2],
            },
          ]}
          plane={[0, 1, 0]}
          center={[0, t / 2, zTip - tipLen]}
          extent={length * 0.75}
          count={14}
        />
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Neodymium disc: lies flat, north face up. Breaks along a diameter (x = 0).

function Disc({ size, showPoles, fieldLines }: VariantProps) {
  const { d, t } = DISC[size];
  const R = d / 2;
  const c = Math.min(0.35, t * 0.08);
  const plating = Math.max(R * 0.018, 0.08);

  const geo = useGeometrySet(() => {
    const profile = sharpenProfile([
      [0, 0],
      [R - c, 0],
      [R, c],
      [R, t - c],
      [R - c, t],
      [0, t],
    ]);
    const body = new LatheGeometry(
      profile.map(([r, y]) => new Vector2(r, y)),
      48,
      0,
      Math.PI,
    );
    // Section outline in (u, y), u along the cut: the whole width or only u ≥ 0.
    const outline = (whole: boolean) => {
      const shape = new Shape();
      shape.moveTo(whole ? -R + c : 0, 0);
      shape.lineTo(R - c, 0);
      shape.lineTo(R, c);
      shape.lineTo(R, t - c);
      shape.lineTo(R - c, t);
      if (whole) {
        shape.lineTo(-R + c, t);
        shape.lineTo(-R, t - c);
        shape.lineTo(-R, c);
      } else {
        shape.lineTo(0, t);
      }
      shape.closePath();
      return shape;
    };
    // Broken face on x = 0 (u → Z), facing −X.
    const fracture = planarUv(new ShapeGeometry(outline(true)), [-R, R], [0, t]);
    fracture.rotateY(-Math.PI / 2);
    // Cutaway face on z = 0 (u → X), x ≥ 0.
    const section = planarUv(new ShapeGeometry(outline(false)), [-R, R], [0, t]);
    section.translate(0, 0, -0.01);
    return { body, fracture, section };
  }, [R, t, c]);

  const drawLayers =
    (domains: boolean) => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const sx = w / d;
      const sy = h / t;
      const band = (inset: number, color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        const pts: [number, number][] = [
          [-R + c + inset * 0.6, inset],
          [R - c - inset * 0.6, inset],
          [R - inset, c + inset * 0.6],
          [R - inset, t - c - inset * 0.6],
          [R - c - inset * 0.6, t - inset],
          [-R + c + inset * 0.6, t - inset],
          [-R + inset, t - c - inset * 0.6],
          [-R + inset, c + inset * 0.6],
        ];
        pts.forEach(([x, y], i) => {
          const px = (x + R) * sx;
          const py = h - y * sy;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fill();
      };
      // Exaggerated layers: nickel, copper, nickel over the NdFeB core.
      ctx.fillStyle = '#5a5c60';
      ctx.fillRect(0, 0, w, h);
      band(0, '#cfccc5');
      band(plating, '#c77b4a');
      band(plating * 2, '#bdbab3');
      ctx.save();
      ctx.beginPath();
      const inner = plating * 3;
      ctx.rect(inner * sx, inner * sy, w - 2 * inner * sx, h - 2 * inner * sy);
      ctx.clip();
      if (domains) {
        drawDomains(
          ctx,
          sx,
          [-R, R],
          [0, t],
          (x, y) => Math.abs(x) < R - inner * 1.5 && y > inner * 1.5 && y < t - inner * 1.5,
          () => [0, 1],
          { background: '#56585c', spacing: Math.max(t / 3.2, 0.9) },
        );
      } else {
        // Fracture: grey crystalline grain.
        ctx.fillStyle = '#5c5e62';
        ctx.fillRect(0, 0, w, h);
        const random = seeded(17);
        for (let i = 0; i < (w * h) / 30; i++) {
          const g = 70 + random() * 70;
          ctx.fillStyle = `rgba(${g},${g + 2},${g + 5},0.6)`;
          ctx.fillRect(random() * w, random() * h, 2 + random() * 3, 2 + random() * 2);
        }
      }
      ctx.restore();
    };
  const texW = 1024;
  const texH = Math.max(64, Math.round((texW * t) / d));
  const sectionMap = useCanvasTexture(drawLayers(true), `disc-section|${d}|${t}`, {
    width: texW,
    height: texH,
  });
  const fractureMap = useCanvasTexture(drawLayers(false), `disc-fracture|${d}|${t}`, {
    width: texW,
    height: texH,
  });

  const half = (right: boolean) => (
    <>
      <group scale={[right ? 1 : -1, 1, 1]}>
        <mesh geometry={geo.body}>
          <Material preset="nickel" color="#d6d4cf" roughness={0.16} clip cutColor="#4f5155" />
        </mesh>
        <mesh geometry={geo.fracture}>
          <Material
            color="#ffffff"
            map={fractureMap}
            roughness={0.6}
            metalness={0.5}
            clip
            cutColor="#4f5155"
          />
        </mesh>
        <SectionFace geometry={geo.section} map={sectionMap} />
      </group>
      {showPoles && right && (
        <mesh position={[R * 0.5, t + 0.015, -R * 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[Math.max(R * 0.13, 0.6), 24]} />
          <Material
            color="#c8211d"
            roughness={0.45}
            clearcoat={0.3}
            polygonOffset
            polygonOffsetFactor={-2}
            clip
          />
        </mesh>
      )}
      <Anchor name={right ? 'right' : 'left'} position={[(right ? 1 : -1) * R * 0.5, t, 0]} />
    </>
  );

  return (
    <group>
      <Explode offset={[d * 0.42, 0, d * 0.05]} rotate={[0, -0.25, 0]}>
        {half(true)}
      </Explode>
      <Explode offset={[-d * 0.42, 0, -d * 0.03]} rotate={[0, 0.2, 0]}>
        {half(false)}
      </Explode>
      {fieldLines && (
        <Field
          sources={[
            {
              kind: 'solenoid',
              radius: R,
              length: t,
              turns: 10,
              axis: [0, 1, 0],
              position: [0, t / 2, 0],
            },
          ]}
          plane={[0, 0, 1]}
          center={[0, t / 2, 0]}
          extent={d * 1.5}
          count={10}
        />
      )}
    </group>
  );
}
