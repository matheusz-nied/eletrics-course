/**
 * Inductors (indutores) in their three common forms:
 * - `axial`: colour-coded axial choke, 0410 size: body Ø4,1 × 9,8 mm, leads
 *   Ø0,6 mm (typical "0410" axial choke datasheets). A ferrite dumbbell wound
 *   with fine enamelled wire under a green epoxy coat; four bands give the
 *   value in µH (two digits, multiplier, tolerance), like a resistor.
 * - `tambor`: radial drum-core choke, Ø9 × 12 mm, pins Ø0,65 mm at 5,0 mm
 *   (the 0912 size of radial power chokes), with an optional heat-shrink
 *   sleeve printed with the 3-digit code in µH ("101K" = 100 µH ±10 %).
 * - `toroide`: T-50 size core (OD 12,7 × ID 7,7 × 4,83 mm, the catalogue size
 *   shared by powdered-iron and ferrite toroids) laid flat and wound with
 *   enamelled copper; the scraped and tinned wire ends are the leads.
 * `turns` sets the visible turns of the drum and of the toroid (the wire gets
 * thinner as they grow); `microhenries` sets the printed value.
 */
import { Color, Curve, TubeGeometry, Vector3 } from 'three';
import { BAND_RGB, resistorBands } from '../core/colorCode';
import { formatSI, smdResistorCode } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { axialLathe } from '../shapes/geometry';
import { useDisposable, Wire } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { arc, SectionFace, thicken, type Path2 } from './_passive-common';

export type InductorVariant = 'axial' | 'tambor' | 'toroide';
export type ToroidCore = 'amarelo' | 'vermelho' | 'verde' | 'cinza';

export interface InductorProps {
  variant?: InductorVariant;
  /** Inductance in µH (printed by bands or by the 3-digit code). */
  microhenries?: number;
  /** Visible turns of the drum and the toroid. */
  turns?: number;
  /** Heat-shrink sleeve over the drum winding. */
  heatShrink?: boolean;
  /** Core of the toroid. */
  core?: ToroidCore;
  /** Lead length below the body (along the axis for the axial choke), mm. */
  leadLength?: number;
}

/** Axial choke, 0410 (mm). */
const AX = { L: 9.8, D: 4.1, core: 8.2, flangeR: 1.45, flangeT: 0.55, coreR: 0.75, windR: 1.3 };
/** Radial drum choke, 0912 (mm). */
const DR = { D: 9, H: 12, core: 4.4, flangeB: 1.6, flangeT: 1.3, pitch: 5, pin: 0.65 };
/** T-50 toroid (mm); `gap` is the unwound arc where the leads leave (degrees). */
const TR = { od: 12.7, id: 7.7, h: 4.83, fillet: 0.6, gap: 40 };

const TOROID_CORES: Record<
  ToroidCore,
  { label: string; name: string; color: string; top?: string; roughness: number }
> = {
  amarelo: {
    label: 'Pó de ferro (amarelo e branco)',
    name: 'pó de ferro',
    color: '#c9a227',
    top: '#ecebe4',
    roughness: 0.6,
  },
  vermelho: {
    label: 'Pó de ferro (vermelho)',
    name: 'pó de ferro',
    color: '#a9302a',
    roughness: 0.6,
  },
  verde: {
    label: 'Ferrite com revestimento verde',
    name: 'ferrite',
    color: '#2e6a45',
    roughness: 0.4,
  },
  cinza: {
    label: 'Ferrite sem pintura (cinza)',
    name: 'ferrite',
    color: '#4a4a4d',
    roughness: 0.78,
  },
};

/** Value in henries with SI prefix: `100 µH`, `4,7 mH`. */
export const formatHenries = (microhenries: number) => formatSI(microhenries * 1e-6, 'H');
/** 3-digit code in µH printed on inductors: `101` = 100 µH, `4R7` = 4,7 µH. */
export const inductorCode = (microhenries: number) => smdResistorCode(microhenries);

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const turnsOf = (p: PartProps) => Math.round(clamp(Number(p.turns ?? 24), 6, 48));

/** Drum winding: wire diameter, outer layer radius and winding span. */
function drumWinding(turns: number) {
  const y0 = DR.flangeB + 0.05;
  const y1 = DR.H - DR.flangeT - 0.05;
  const d = (y1 - y0) / (turns + 1.5);
  return { y0, y1, d, rOut: DR.D / 2 - 0.45 - d / 2 };
}

/** Toroid wire diameter: the turns must fit side by side inside the hole. */
function toroidWire(turns: number) {
  const usable = 2 * Math.PI * (TR.id / 2 - 0.45) * (1 - TR.gap / 360);
  return clamp((usable / turns) * 0.86, 0.25, 0.8);
}

export const meta: PartMeta = {
  id: 'inductor',
  label: 'Indutor',
  category: 'passivos',
  summary:
    'Indutores axial com faixas de cor, radial de tambor e toroidal, com o fio esmaltado e o núcleo à mostra.',
  defaults: {
    variant: 'tambor',
    microhenries: 100,
    turns: 24,
    heatShrink: false,
    core: 'amarelo',
    leadLength: 10,
  },
  controls: {
    variant: {
      kind: 'select',
      label: 'Tipo',
      options: [
        { value: 'tambor', label: 'Radial de tambor (ferrite)' },
        { value: 'axial', label: 'Axial com faixas de cor' },
        { value: 'toroide', label: 'Toroidal' },
      ],
    },
    microhenries: {
      kind: 'number',
      label: 'Indutância',
      min: 1,
      max: 10_000,
      log: true,
      unit: 'µH',
    },
    turns: { kind: 'number', label: 'Espiras (tambor e toroide)', min: 6, max: 48, step: 1 },
    heatShrink: { kind: 'toggle', label: 'Capa termorretrátil (tambor)' },
    core: {
      kind: 'select',
      label: 'Núcleo do toroide',
      options: (Object.keys(TOROID_CORES) as ToroidCore[]).map((value) => ({
        value,
        label: TOROID_CORES[value].label,
      })),
    },
    leadLength: { kind: 'number', label: 'Terminais', min: 3, max: 25, step: 1, unit: 'mm' },
  },
  annotations: (p) => {
    const lift = Number(p.leadLength);
    const uH = Number(p.microhenries);
    const notes: PartAnnotation[] = [];
    if (p.variant === 'axial') {
      const R = AX.D / 2;
      notes.push(
        {
          at: [-AX.L * 0.12, AX.D, 0],
          text: 'Faixas: valor em µH (2 algarismos e multiplicador) e tolerância',
          exploded: false,
        },
        {
          at: [AX.L / 2 + Math.min(lift, 8) * 0.6, R + 0.3, 0],
          text: 'Terminal de cobre estanhado',
          exploded: false,
        },
        { at: [0, 0, 0], text: 'Revestimento de epóxi', anchor: 'shell', exploded: true },
        {
          at: [0, 0, 0],
          text: 'Centenas de espiras de fio esmaltado',
          anchor: 'winding',
          exploded: true,
        },
        { at: [0, 0, 0], text: 'Núcleo de ferrite em carretel', anchor: 'core', exploded: true },
      );
      return notes;
    }
    if (p.variant === 'toroide') {
      const core = TOROID_CORES[p.core as ToroidCore] ?? TOROID_CORES.amarelo;
      notes.push(
        {
          at: [0, 0, 0],
          text: `Núcleo toroidal de ${core.name}: o campo fica preso no anel`,
          anchor: 'core',
        },
        { at: [0, 0, 0], text: `${turnsOf(p)} espiras de fio esmaltado`, anchor: 'coil' },
        { at: [0, 0, 0], text: 'Pontas raspadas e estanhadas', anchor: 'tip', exploded: false },
      );
      return notes;
    }
    const R = DR.D / 2;
    const w = drumWinding(turnsOf(p));
    if (p.heatShrink) {
      notes.push({
        at: [0, lift + DR.H / 2, R + 0.25],
        text: `Código ${inductorCode(uH)}K: ${formatHenries(uH)}, ±10 %`,
        exploded: false,
      });
    } else {
      notes.push({
        at: [0, lift + DR.H * 0.55, w.rOut + w.d / 2],
        text: 'Fio de cobre esmaltado: o verniz isola uma volta da outra',
        exploded: false,
      });
    }
    notes.push(
      { at: [0, 0, 0], text: 'Núcleo de ferrite em forma de tambor', anchor: 'core' },
      { at: [0, 0, 0], text: 'Ponta do fio soldada ao pino', anchor: 'pin', exploded: false },
      {
        at: [0, 0, 0],
        text: `Bobina: ${turnsOf(p)} espiras por camada, várias camadas`,
        anchor: 'winding',
        exploded: true,
      },
    );
    if (p.heatShrink) {
      notes.push({
        at: [0, 0, 0],
        text: 'Capa termorretrátil impressa',
        anchor: 'sleeve',
        exploded: true,
      });
    }
    return notes;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const uH = Number(p.microhenries);
    const value = formatHenries(uH);
    if (p.variant === 'axial') {
      const { bands } = resistorBands(uH, 10, 4);
      return `Indutor axial de ${value} (±10 %), faixas ${bands.join(', ')}. Parece um resistor mais gordo, mas por dentro é uma bobina de fio esmaltado sobre um núcleo de ferrite.`;
    }
    if (p.variant === 'toroide') {
      const core = TOROID_CORES[p.core as ToroidCore] ?? TOROID_CORES.amarelo;
      return `Indutor toroidal de ${value}: ${turnsOf(p)} espiras de fio de cobre esmaltado em volta de um anel de ${core.name} (${core.label.toLowerCase()}). As duas pontas do fio, raspadas e estanhadas, são os terminais.`;
    }
    const sleeve = p.heatShrink
      ? `, coberto por capa termorretrátil marcada ${inductorCode(uH)}K`
      : ', com o fio esmaltado à mostra';
    return `Indutor radial de tambor de ${value}: fio de cobre esmaltado enrolado em um carretel de ferrite${sleeve}. As pontas do fio são soldadas a dois pinos a 5 mm um do outro.`;
  },
  view: [0.55, 0.8, 1.45],
};

export default function Inductor(props: InductorProps) {
  const p = { ...meta.defaults, ...props } as Required<InductorProps>;
  if (p.variant === 'axial') return <AxialInductor {...p} />;
  if (p.variant === 'toroide') return <ToroidInductor {...p} />;
  return <DrumInductor {...p} />;
}

/* ------------------------------------------------------------------ */
/* Shared drawings.                                                   */
/* ------------------------------------------------------------------ */

/**
 * Section of a coil cut along its axis: the core in the middle and the round
 * wires in staggered layers on both sides. `horizontal` lays the axis along X.
 */
function drawCoilSection(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  {
    core,
    wire,
    coreColor,
    horizontal = false,
  }: {
    /** Core width as a fraction of the face width across the axis. */
    core: number;
    /** Wire diameter as a fraction of the face length along the axis. */
    wire: number;
    coreColor: string;
    horizontal?: boolean;
  },
) {
  const across = horizontal ? h : w;
  const along = horizontal ? w : h;
  const at = (a: number, l: number): [number, number] => (horizontal ? [l, a] : [a, l]);
  ctx.fillStyle = '#2b1810';
  ctx.fillRect(0, 0, w, h);
  const d = wire * along;
  const coreHalf = (core * across) / 2;
  const rows = Math.max(1, Math.floor(along / d));
  const start = (along - rows * d) / 2 + d / 2;
  const step = d * 0.88;
  const layers = Math.max(1, Math.floor((across / 2 - coreHalf - d * 0.1) / step));
  for (const side of [-1, 1]) {
    for (let j = 0; j < layers; j++) {
      const a = across / 2 + side * (coreHalf + d / 2 + j * step);
      const odd = j % 2 === 1;
      for (let i = 0; i < rows - (odd ? 1 : 0); i++) {
        const [x, y] = at(a, start + i * d + (odd ? d / 2 : 0));
        ctx.fillStyle = '#6b2f17';
        ctx.beginPath();
        ctx.arc(x, y, d * 0.49, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#dc8f5e';
        ctx.beginPath();
        ctx.arc(x, y, d * 0.37, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.fillStyle = coreColor;
  const [cx, cy] = at(across / 2 - coreHalf, 0);
  ctx.fillRect(cx, cy, horizontal ? w : coreHalf * 2, horizontal ? coreHalf * 2 : h);
  const [gx, gy] = at(across, 0);
  const shade = ctx.createLinearGradient(0, 0, gx, gy);
  shade.addColorStop(0, 'rgba(0,0,0,0.22)');
  shade.addColorStop(0.5, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
}

/** Fine turns of a winding seen from outside (stripes across the axis, V = height). */
function drawTurns(ctx: CanvasRenderingContext2D, w: number, h: number, count: number) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const pitch = h / count;
  for (let i = 0; i < count; i++) {
    const y = i * pitch;
    const g = ctx.createLinearGradient(0, y, 0, y + pitch);
    g.addColorStop(0, '#6e6e6e');
    g.addColorStop(0.25, '#ffffff');
    g.addColorStop(0.75, '#e6e6e6');
    g.addColorStop(1, '#6e6e6e');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, w, pitch);
  }
}

/** A helix around Y: radius `r`, from `y0` to `y1`, `turns` turns from angle `a0`. */
class HelixCurve extends Curve<Vector3> {
  constructor(
    private readonly r: number,
    private readonly y0: number,
    private readonly y1: number,
    private readonly turns: number,
    private readonly a0 = 0,
  ) {
    super();
  }

  override getPoint(t: number, target = new Vector3()): Vector3 {
    const a = this.a0 + t * this.turns * Math.PI * 2;
    return target.set(
      this.r * Math.cos(a),
      this.y0 + (this.y1 - this.y0) * t,
      -this.r * Math.sin(a),
    );
  }
}

/* ------------------------------------------------------------------ */
/* Axial choke.                                                       */
/* ------------------------------------------------------------------ */

const AXIAL_BANDS = [0.22, 0.36, 0.5, 0.77];
const AXIAL_BAND_WIDTH = 0.09;

function AxialInductor(p: Required<InductorProps>) {
  const { L, D, core: c, flangeR: fr, flangeT: ft, coreR: cr, windR } = AX;
  const R = D / 2;
  const { bands } = resistorBands(p.microhenries, 10, 4);
  const body = '#55996c';

  const shellGeometry = useDisposable(() => {
    const profile: [number, number][] = [];
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const y = -L / 2 + (L * i) / steps;
      const fromEnd = L / 2 - Math.abs(y);
      const round = R * 0.7;
      const end =
        fromEnd < round ? Math.sqrt(Math.max(0, 1 - ((round - fromEnd) / round) ** 2)) : 1;
      // Bulged in the middle, over the winding.
      const bulge = 0.88 + 0.12 * (1 - ((2 * y) / L) ** 2);
      profile.push([R * bulge * (0.45 + 0.55 * end), y]);
    }
    profile.unshift([0, -L / 2]);
    profile.push([0, L / 2]);
    return axialLathe(profile, 48);
  }, []);

  // Ferrite dumbbell along Y (turned to lie along X).
  const coreGeometry = useDisposable(() => {
    const e = 0.15;
    const profile: [number, number][] = [
      [0, -c / 2],
      [fr - e, -c / 2],
      [fr, -c / 2 + e],
      [fr, -c / 2 + ft],
      [cr, -c / 2 + ft],
      [cr, c / 2 - ft],
      [fr, c / 2 - ft],
      [fr, c / 2 - e],
      [fr - e, c / 2],
      [0, c / 2],
    ];
    return axialLathe(profile, 32);
  }, []);
  const windLength = c - 2 * ft;
  const windingGeometry = useDisposable(
    () =>
      axialLathe(
        [
          [cr, -windLength / 2],
          [windR, -windLength / 2],
          [windR, windLength / 2],
          [cr, windLength / 2],
          [cr, -windLength / 2],
        ],
        40,
      ),
    [],
  );

  const bandMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = body;
      ctx.fillRect(0, 0, w, h);
      bands.forEach((band, i) => {
        ctx.fillStyle = `#${new Color(BAND_RGB[band]).getHexString()}`;
        const y = (1 - AXIAL_BANDS[i]! - AXIAL_BAND_WIDTH / 2) * h;
        ctx.fillRect(0, y, w, AXIAL_BAND_WIDTH * h);
      });
    },
    `${body}|${bands.join(',')}`,
    { width: 8, height: 512 },
  );
  const metalMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      bands.forEach((band, i) => {
        if (band !== 'dourado' && band !== 'prateado') return;
        ctx.fillStyle = '#d0d0d0';
        ctx.fillRect(0, (1 - AXIAL_BANDS[i]! - AXIAL_BAND_WIDTH / 2) * h, w, AXIAL_BAND_WIDTH * h);
      });
    },
    bands.join(','),
    { width: 8, height: 512, color: false },
  );
  const turnsMap = useCanvasTexture((ctx, w, h) => drawTurns(ctx, w, h, 56), 'axial-turns', {
    width: 8,
    height: 1024,
  });
  const scale = 128;
  const section = useCanvasTexture(
    (ctx, w, h) =>
      drawCoilSection(ctx, w, h, {
        core: cr / windR,
        wire: 0.12 / windLength,
        coreColor: '#3a3a3d',
        horizontal: true,
      }),
    'axial-section',
    { width: Math.round(windLength * scale), height: Math.round(2 * windR * scale) },
  );
  const noise = getNoiseTexture();

  return (
    <group position={[0, R, 0]}>
      {/* Epoxy coat with the bands. */}
      <Explode offset={[0, D * 2.6, 0]}>
        <mesh geometry={shellGeometry} rotation={[0, 0, -Math.PI / 2]}>
          <Material
            preset="lacquer"
            clip
            color="#ffffff"
            map={bandMap}
            metalness={1}
            metalnessMap={metalMap}
            roughnessMap={noise}
            roughness={0.45}
            clearcoat={0.5}
            cutColor="#3f6a4d"
          />
        </mesh>
        <Anchor name="shell" position={[0, R, 0]} />
      </Explode>

      {/* Ferrite dumbbell and its winding. */}
      <mesh geometry={coreGeometry} rotation={[0, 0, -Math.PI / 2]}>
        <Material preset="ferrite" clip roughnessMap={noise} cutColor="#38383b" />
      </mesh>
      <mesh geometry={windingGeometry} rotation={[0, 0, -Math.PI / 2]}>
        <Material
          preset="magnetWire"
          clip
          map={turnsMap}
          bumpMap={turnsMap}
          bumpScale={1.5}
          cutColor="#c9733f"
        />
      </mesh>
      <SectionFace width={windLength} height={2 * windR} center={[0, 0]} map={section} />
      <Anchor name="winding" position={[-windLength * 0.2, windR, 0]} />
      <Anchor name="core" position={[c / 2 - ft / 2, fr, 0]} />

      {/* Leads: nail heads pressed into the core ends. */}
      {([-1, 1] as const).map((side) => (
        <Explode key={side} offset={[side * L * 0.35, 0, 0]}>
          <mesh position={[side * (c / 2 + 0.12), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.7, 0.7, 0.24, 24]} />
            <Material preset="tin" />
          </mesh>
          <Wire
            points={[
              [side * (c / 2 - 0.6), 0, 0],
              [side * (L / 2 + p.leadLength), 0, 0],
            ]}
            radius={0.3}
          />
        </Explode>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Radial drum choke.                                                 */
/* ------------------------------------------------------------------ */

function DrumInductor(p: Required<InductorProps>) {
  const { D, H, flangeB: fb, flangeT: ft, pitch } = DR;
  const R = D / 2;
  const cr = DR.core / 2;
  const lift = p.leadLength;
  const turns = Math.round(clamp(p.turns, 6, 48));
  const { y0, y1, d, rOut } = drumWinding(turns);
  const rw = (d / 2) * 0.96;
  const pinX = pitch / 2;
  const code = `${inductorCode(p.microhenries)}K`;

  const drum = useDisposable(() => {
    const f = 0.3;
    const g = 0.25;
    const h = Math.PI / 2;
    const profile: Path2 = [
      [0, 0],
      ...arc(R - f, f, f, -h, 0),
      ...arc(R - g, fb - g, g, 0, h),
      ...arc(cr + g, fb + g, g, -h, -Math.PI),
      ...arc(cr + g, H - ft - g, g, Math.PI, h),
      ...arc(R - g, H - ft + g, g, -h, 0),
      ...arc(R - f, H - f, f, 0, h),
      [0, H],
    ];
    return axialLathe(profile, 64);
  }, []);
  const fill = useDisposable(() => {
    const r = rOut - d * 0.2;
    return axialLathe(
      [
        [cr, y0],
        [r, y0],
        [r, y1],
        [cr, y1],
        [cr, y0],
      ],
      48,
    );
  }, [turns]);
  const helix = useDisposable(() => {
    const curve = new HelixCurve(rOut, y0 + d / 2, y1 - d / 2, turns + 0.5);
    return new TubeGeometry(curve, Math.ceil((turns + 0.5) * 22), rw, 8, false);
  }, [turns]);

  const ys = y0 + d / 2;
  const ye = y1 - d / 2;
  const under = -rw - 0.05;
  const rim = R + rw + 0.03;
  // Start of the winding (+X) and its end (−X, brought down over the outside).
  const startLead: Vec3[] = [
    [pinX + 0.4, -1.3, 0],
    [pinX + 0.45, under, 0],
    [rim, under, 0],
    [rim, fb + rw + 0.03, 0],
    [rOut + 0.15, ys, 0.9],
    [rOut, ys, 0],
  ];
  const outside = rOut + d + 0.05;
  const endLead: Vec3[] = [
    [-rOut, ye, 0],
    [-(rOut + 0.2), ye, 0.9],
    [-outside, ye - 0.9, 0.6],
    [-outside, fb + 0.7, 0.3],
    [-rim, fb + rw + 0.03, 0],
    [-rim, under, 0],
    [-(pinX + 0.45), under, 0],
    [-(pinX + 0.4), -1.3, 0],
  ];

  // Heat-shrink sleeve: hugs both flanges and sinks a little over the winding.
  const sleeveGap = 0.1 + 2 * rw;
  const sleeveSpan = { min: -0.2 - sleeveGap, max: H + 0.2 + sleeveGap };
  const sleeve = useDisposable(() => {
    // Clear of the wire ends that run around the bottom flange.
    const o = sleeveGap;
    const f = 0.3;
    const h = Math.PI / 2;
    const side: Path2 = [];
    for (let k = 1; k < 16; k++) {
      const y = f + ((H - 2 * f) * k) / 16;
      const t = (y - fb) / (H - fb - ft);
      const waist = t > 0 && t < 1 ? 0.22 * Math.sin(Math.PI * t) : 0;
      side.push([R + o - waist, y]);
    }
    const mid: Path2 = [
      [R - 1.0, -o],
      ...arc(R - f, f, f + o, -h, 0, 5),
      ...side,
      ...arc(R - f, H - f, f + o, 0, h, 5),
      [R - 1.1, H + o],
    ];
    return axialLathe(thicken(mid, 0.16), 64);
  }, [sleeveGap]);
  const circumference = 2 * Math.PI * (R + sleeveGap);
  const sleeveH = Math.round((1024 * (sleeveSpan.max - sleeveSpan.min)) / circumference);
  const sleevePrint = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#232325';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ecebe6';
      fitText(ctx, code, w * 0.5, h * 0.5, w * 0.17, h * 0.2, { weight: 700, family: FONT_SANS });
    },
    code,
    { width: 1024, height: sleeveH, fonts: [`700 40px ${FONT_SANS}`] },
  );
  const scale = 64;
  const sectionW = 2 * (rOut + d / 2);
  const section = useCanvasTexture(
    (ctx, w, h) =>
      drawCoilSection(ctx, w, h, {
        core: (2 * cr) / sectionW,
        wire: d / (y1 - y0),
        coreColor: '#3a3a3d',
      }),
    `drum-section|${turns}`,
    { width: Math.round(sectionW * scale), height: Math.round((y1 - y0) * scale) },
  );
  const noise = getNoiseTexture();

  return (
    <group position={[0, lift, 0]}>
      {/* Ferrite drum (bobbin core). */}
      <mesh geometry={drum}>
        <Material
          preset="ferrite"
          clip
          color="#3a3a3d"
          roughnessMap={noise}
          roughness={0.7}
          cutColor="#2e2e31"
        />
      </mesh>
      <Anchor name="core" position={[R, H - ft / 2, 0]} />

      {/* Winding: inner layers, the visible outer layer and the two wire ends. */}
      <Explode offset={[-(D + 3), 0, 0]}>
        <mesh geometry={fill}>
          <Material preset="magnetWire" clip color="#8a3f1c" roughness={0.35} cutColor="#c9733f" />
        </mesh>
        <mesh geometry={helix}>
          <Material preset="magnetWire" clip cutColor="#d88a5a" />
        </mesh>
        <Wire points={startLead} radius={rw} bend={0.35} material={{ preset: 'magnetWire' }} />
        <Wire points={endLead} radius={rw} bend={0.35} material={{ preset: 'magnetWire' }} />
        <Anchor name="winding" position={[0, H * 0.55, rOut + d / 2]} />
      </Explode>
      <SectionFace width={sectionW} height={y1 - y0} center={[0, (y0 + y1) / 2]} map={section} />

      {/* Pins pressed into the bottom flange, with the solder joints. */}
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <Wire
            points={[
              [side * pinX, 1.0, 0],
              [side * pinX, -lift, 0],
            ]}
            radius={DR.pin / 2}
          />
          <mesh position={[side * pinX, -1.15, 0]} scale={[1, 1.35, 1]}>
            <sphereGeometry args={[0.72, 20, 14]} />
            <Material preset="solder" roughness={0.25} />
          </mesh>
        </group>
      ))}
      <Anchor name="pin" position={[pinX + 0.6, -1.15, 0]} />

      {p.heatShrink && (
        <Explode offset={[0, H + 5, 0]} delay={0.15}>
          <mesh geometry={sleeve} rotation={[0, Math.PI, 0]}>
            <Material
              preset="sleeve"
              clip
              color="#ffffff"
              map={sleevePrint}
              roughness={0.5}
              clearcoat={0.35}
              clearcoatRoughness={0.4}
              cutColor="#151516"
            />
          </mesh>
          <Anchor name="sleeve" position={[0, H * 0.7, R + 0.2]} />
        </Explode>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Toroid.                                                            */
/* ------------------------------------------------------------------ */

/** Closed polyline with its cumulative length, sampled by fraction 0..1. */
function loopSampler(points: Path2) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const [r0, y0] = points[i - 1]!;
    const [r1, y1] = points[i]!;
    lengths.push(lengths[i - 1]! + Math.hypot(r1 - r0, y1 - y0));
  }
  const total = lengths[lengths.length - 1]!;
  return {
    total,
    lengths,
    at(s: number): [number, number] {
      const target = (((s % 1) + 1) % 1) * total;
      let i = 1;
      while (i < lengths.length - 1 && lengths[i]! < target) i++;
      const t = (target - lengths[i - 1]!) / (lengths[i]! - lengths[i - 1]! || 1);
      const [r0, y0] = points[i - 1]!;
      const [r1, y1] = points[i]!;
      return [r0 + (r1 - r0) * t, y0 + (y1 - y0) * t];
    },
  };
}

/** Rounded rectangle around the core section, starting at the outer side going up. */
function windingLoop(ri: number, ro: number, yb: number, yt: number, corner: number, o: number) {
  const h = Math.PI / 2;
  const c = corner + o;
  const loop: Path2 = [
    [ro + o, yb + corner],
    ...arc(ro - corner, yt - corner, c, 0, h, 8),
    ...arc(ri + corner, yt - corner, c, h, Math.PI, 8),
    ...arc(ri + corner, yb + corner, c, Math.PI, Math.PI + h, 8),
    ...arc(ro - corner, yb + corner, c, -h, 0, 8),
  ];
  return loop;
}

/** The winding around the toroid: `turns` loops advancing around the ring. */
class ToroidWindingCurve extends Curve<Vector3> {
  private readonly sampler: ReturnType<typeof loopSampler>;
  private readonly outerWall: number;

  /** `length` (in turns, ≤ `turns`) stops the wire before the last loop closes. */
  constructor(
    loop: Path2,
    private readonly turns: number,
    private readonly a0: number,
    private readonly span: number,
    private readonly length = turns,
  ) {
    super();
    this.sampler = loopSampler(loop);
    // The loop starts with the straight outer wall (its first segment).
    this.outerWall = (this.sampler.lengths[1] ?? 0) / this.sampler.total;
    this.arcLengthDivisions = Math.ceil(turns * 64);
  }

  override getPoint(t: number, target = new Vector3()): Vector3 {
    const x = t * this.length;
    const k = Math.floor(x);
    const s = x - k;
    const [r, y] = this.sampler.at(s);
    // Each turn lies in a radial plane across the faces and the inner wall and
    // crosses the outer wall diagonally to the next position, pulled taut.
    const u = Math.min(s / this.outerWall, 1);
    const a = this.a0 + (this.span * (k + u)) / this.turns;
    return target.set(r * Math.cos(a), y, -r * Math.sin(a));
  }
}

function ToroidInductor(p: Required<InductorProps>) {
  const turns = Math.round(clamp(p.turns, 6, 48));
  const coreStyle = TOROID_CORES[p.core] ?? TOROID_CORES.amarelo;
  const d = toroidWire(turns);
  const rw = d / 2;
  const ri = TR.id / 2;
  const ro = TR.od / 2;
  const f = TR.fillet;
  const o = rw + 0.03;
  const yb = o + 0.02;
  const yt = yb + TR.h;
  const lift = p.leadLength;
  const deg = Math.PI / 180;
  // Gap toward the back right, where the two leads leave.
  const gapCentre = 25 * deg;
  const a0 = gapCentre + (TR.gap / 2) * deg;
  const span = (360 - TR.gap) * deg;

  const coreGeometry = useDisposable(() => {
    const h = Math.PI / 2;
    const loop: Path2 = [
      ...arc(ri + f, yb + f, f, Math.PI, Math.PI + h, 6),
      ...arc(ro - f, yb + f, f, -h, 0, 6),
      ...arc(ro - f, yt - f, f, 0, h, 6),
      ...arc(ri + f, yt - f, f, h, Math.PI, 6),
    ];
    loop.push(loop[0]!);
    return axialLathe(loop, 96);
  }, []);

  // The last turn stops on the bottom face, moving outwards, so the end lead
  // can turn down; the first one starts on the outer side, going up.
  const loop = windingLoop(ri, ro, yb, yt, f, o);
  const sampler = loopSampler(loop);
  const cornerLength = (Math.PI / 2) * (f + o);
  const lastTurn = turns - cornerLength / sampler.total;
  const winding = useDisposable(() => {
    const curve = new ToroidWindingCurve(loop, turns, a0, span, lastTurn);
    return new TubeGeometry(curve, Math.ceil(turns * 28), rw, 8, false);
  }, [turns]);

  const aEnd = a0 + span;
  const at = (r: number, y: number, a: number): Vec3 => [r * Math.cos(a), y, -r * Math.sin(a)];
  const tinTop = -1.4;
  const startR = ro + o;
  const endR = ro + o + 0.35;
  const startEnamel: Vec3[] = [
    at(startR, tinTop, a0),
    at(startR, yb - 0.4, a0),
    at(startR, yb + f, a0),
  ];
  const endEnamel: Vec3[] = [
    at(ro - f, yb - o, aEnd),
    at(endR, yb - o - 0.1, aEnd),
    at(endR, tinTop, aEnd),
  ];

  const coreMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = coreStyle.color;
      ctx.fillRect(0, 0, w, h);
      if (coreStyle.top) {
        // Mix-26 cores: the top face is painted white.
        ctx.fillStyle = coreStyle.top;
        ctx.fillRect(0, 0, w, h * 0.05);
      }
    },
    `${coreStyle.color}|${coreStyle.top ?? ''}`,
    { width: 8, height: 256 },
  );
  const noise = getNoiseTexture();
  const cutCore = `#${new Color(coreStyle.color).multiplyScalar(0.7).getHexString()}`;
  const coilFront: Vec3 = [0, yt + o, (ri + ro) / 2];
  const gapMid = at((ri + ro) / 2, yt, gapCentre);

  return (
    <group position={[0, lift, 0]}>
      <mesh geometry={coreGeometry}>
        <Material
          preset="lacquer"
          clip
          color="#ffffff"
          map={coreMap}
          roughnessMap={noise}
          roughness={coreStyle.roughness}
          clearcoat={p.core === 'cinza' ? 0 : 0.25}
          cutColor={p.core === 'cinza' ? '#3a3a3d' : cutCore}
        />
      </mesh>
      <Anchor name="core" position={gapMid} />

      <Explode offset={[0, TR.h + 7, 0]}>
        <mesh geometry={winding}>
          <Material preset="magnetWire" clip cutColor="#d88a5a" />
        </mesh>
        <Wire points={startEnamel} radius={rw} bend={0.6} material={{ preset: 'magnetWire' }} />
        <Wire points={endEnamel} radius={rw} bend={0.6} material={{ preset: 'magnetWire' }} />
        {/* Scraped and tinned ends. */}
        {[
          [startR, a0],
          [endR, aEnd],
        ].map(([r, a]) => (
          <Wire
            key={a}
            points={[at(r!, tinTop + 0.3, a!), at(r!, -lift, a!)]}
            radius={rw + 0.03}
            material={{ preset: 'tin', roughness: 0.3 }}
          />
        ))}
        <Anchor name="coil" position={coilFront} />
        <Anchor name="tip" position={at(endR, Math.max(-lift + 2, tinTop - 1), aEnd)} />
      </Explode>
    </group>
  );
}
