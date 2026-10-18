/**
 * Polyester (PET) film capacitors with radial leads: the boxed MKT type
 * (moulded case sealed with resin, printed "100n J 100V"), the green dipped
 * type with the EIA code ("2A104J") and the old colour-banded "zebrinha"
 * (C280 style, read from the top: two digits, multiplier in pF, tolerance,
 * voltage). Inside: metallised film wound flat, with zinc-sprayed ends where
 * the leads are welded. Box sizes and pitches from typical MKT tables
 * (WIMA MKS 2/MKS 4, EPCOS B32529/B32560 datasheets).
 */
import { Color, ExtrudeGeometry } from 'three';
import { BAND_RGB, resistorBands } from '../core/colorCode';
import { formatFarads, formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { useDisposable, Wire } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import {
  blobBottom,
  blobDecalGeometry,
  blobGeometry,
  ExplodeReveal,
  ribbonGeometry,
  roundedBoxGeometry,
  roundedRectShape,
  SectionFace,
  type BlobShape,
} from './_passive-common';

export type FilmVariant = 'caixa' | 'verde' | 'zebra';
export type FilmBoxColor = 'vermelho' | 'amarelo' | 'azul';

export interface FilmCapacitorProps {
  /** Capacitance in farads (1e-7 = 100 nF). */
  farads?: number;
  /** Rated DC voltage (V). */
  voltage?: number;
  variant?: FilmVariant;
  /** Colour of the MKT box. */
  color?: FilmBoxColor;
  /** Lead length below the body (mm). */
  leadLength?: number;
}

interface Body {
  /** Width along the leads (x), height (y), thickness (z), mm. */
  L: number;
  H: number;
  W: number;
  pitch: number;
  lead: number;
}

/** Grows with capacitance and voltage: film volume ∝ C·V^1,5 or so. */
const sizeIndex = (farads: number, voltage: number) => farads * 1e6 * (voltage / 100) ** 1.5;

const BOX_SIZES: (Body & { k: number })[] = [
  { k: 0.11, L: 7.2, H: 6.5, W: 2.5, pitch: 5, lead: 0.5 },
  { k: 0.25, L: 7.2, H: 8.5, W: 3.5, pitch: 5, lead: 0.5 },
  { k: 0.55, L: 10, H: 9, W: 4, pitch: 7.5, lead: 0.6 },
  { k: 1.2, L: 13, H: 11, W: 5, pitch: 10, lead: 0.6 },
  { k: 2.6, L: 18, H: 12.5, W: 6, pitch: 15, lead: 0.8 },
  { k: 5.5, L: 18, H: 15, W: 8.5, pitch: 15, lead: 0.8 },
  { k: Infinity, L: 26.5, H: 19, W: 10.5, pitch: 22.5, lead: 0.8 },
];

const GREEN_SIZES: (Body & { k: number })[] = [
  { k: 0.05, L: 7, H: 6, W: 3.5, pitch: 5.08, lead: 0.6 },
  { k: 0.15, L: 10, H: 8, W: 4.5, pitch: 5.08, lead: 0.6 },
  { k: 0.5, L: 12.5, H: 10, W: 5.5, pitch: 7.5, lead: 0.6 },
  { k: 1.2, L: 15, H: 12, W: 6.5, pitch: 10, lead: 0.8 },
  { k: Infinity, L: 18, H: 14, W: 8, pitch: 10, lead: 0.8 },
];

const ZEBRA_SIZES: (Body & { k: number })[] = [
  { k: 0.12, L: 10, H: 11, W: 4.5, pitch: 10, lead: 0.7 },
  { k: 0.45, L: 10, H: 13.5, W: 5, pitch: 10, lead: 0.7 },
  { k: 1.3, L: 11, H: 17, W: 6, pitch: 10, lead: 0.7 },
  { k: Infinity, L: 12, H: 21, W: 7, pitch: 10, lead: 0.8 },
];

function bodyOf(p: PartProps): Body {
  const k = sizeIndex(Number(p.farads), Number(p.voltage));
  const table =
    p.variant === 'verde' ? GREEN_SIZES : p.variant === 'zebra' ? ZEBRA_SIZES : BOX_SIZES;
  return table.find((s) => k <= s.k) ?? table[table.length - 1]!;
}

/** Value as printed on film capacitors: `470p`, `4n7`, `100n`, `2µ2`. */
export function filmValueCode(farads: number): string {
  const pf = Number((farads * 1e12).toPrecision(2));
  const fmt = (v: number, unit: string) => {
    const r = Number(v.toPrecision(2));
    if (Number.isInteger(r)) return `${r}${unit}`;
    const [int, dec] = String(r).split('.');
    return int === '0' ? `${unit}${dec}` : `${int}${unit}${dec}`;
  };
  if (pf < 1000) return fmt(pf, 'p');
  if (pf < 1e6) return fmt(pf / 1000, 'n');
  return fmt(pf / 1e6, 'µ');
}

/** EIA voltage code of dipped film capacitors (`2A` = 100 V). */
const VOLTAGE_CODES: Record<number, string> = {
  50: '1H',
  63: '1J',
  100: '2A',
  250: '2E',
  400: '2G',
  630: '2J',
};

/** Bands of the colour-coded "zebra": digits, multiplier (pF), tolerance, voltage. */
export function zebraBands(farads: number, voltage: number) {
  const pf = farads * 1e12;
  const [d1, d2, mult] = resistorBands(Math.max(pf, 10), 5, 4).bands;
  const volt =
    voltage >= 630 ? 'azul' : voltage >= 400 ? 'amarelo' : voltage >= 250 ? 'vermelho' : 'marrom';
  return [d1!, d2!, mult!, 'branco', volt] as const;
}

const BOX_COLORS: Record<FilmBoxColor, { body: string; ink: string; cut: string }> = {
  vermelho: { body: '#c1261d', ink: '#141414', cut: '#7d1a14' },
  amarelo: { body: '#e6b51c', ink: '#141414', cut: '#9a7812' },
  azul: { body: '#2a57b4', ink: '#f2f2f2', cut: '#1b3a78' },
};

export const meta: PartMeta = {
  id: 'film-capacitor',
  label: 'Capacitor de poliéster',
  category: 'passivos',
  summary:
    'Capacitor de filme de poliéster: em caixa (MKT), verde mergulhado ou zebrinha com faixas de cor; por dentro, filme metalizado enrolado.',
  defaults: {
    farads: 1e-7,
    voltage: 100,
    variant: 'caixa',
    color: 'vermelho',
    leadLength: 16,
  },
  controls: {
    farads: { kind: 'number', label: 'Capacitância', min: 1e-10, max: 1e-5, log: true, unit: 'F' },
    voltage: {
      kind: 'select',
      label: 'Tensão máxima',
      options: [63, 100, 250, 400, 630].map((v) => ({ value: v, label: `${v} V` })),
    },
    variant: {
      kind: 'select',
      label: 'Tipo',
      options: [
        { value: 'caixa', label: 'Caixa (MKT)' },
        { value: 'verde', label: 'Verde mergulhado' },
        { value: 'zebra', label: 'Zebrinha (faixas de cor)' },
      ],
    },
    color: {
      kind: 'select',
      label: 'Cor da caixa',
      options: [
        { value: 'vermelho', label: 'Vermelha' },
        { value: 'amarelo', label: 'Amarela' },
        { value: 'azul', label: 'Azul' },
      ],
    },
    leadLength: { kind: 'number', label: 'Terminais', min: 3, max: 25, step: 1, unit: 'mm' },
  },
  annotations: (p) => {
    const b = bodyOf(p);
    const lift = Number(p.leadLength);
    const farads = Number(p.farads);
    const value = formatFarads(farads);
    const notes: PartAnnotation[] = [];
    if (p.variant === 'zebra') {
      notes.push({
        at: [b.L * 0.3, lift + b.H * 0.75, b.W / 2],
        text: 'Faixas de cima para baixo: 2 algarismos, multiplicador (pF), tolerância, tensão',
        exploded: false,
      });
    } else if (p.variant === 'verde') {
      const code = `${VOLTAGE_CODES[Number(p.voltage)] ?? '2A'}${capacitorCodeOf(farads)}J`;
      notes.push({
        at: [0, lift + b.H * 0.55, b.W / 2],
        text: `Código ${code}: ${p.voltage} V, ${value}, ±5 %`,
        exploded: false,
      });
    } else {
      notes.push(
        {
          at: [0, lift + b.H * 0.55, b.W / 2],
          text: `${filmValueCode(farads)} J = ${value}, ±5 %`,
          exploded: false,
        },
        {
          at: [b.L * 0.2, lift + b.H * 0.28, b.W / 2],
          text: 'Tensão máxima (CC)',
          exploded: false,
        },
      );
    }
    notes.push(
      { at: [b.pitch / 2, lift * 0.45, 0], text: 'Sem polaridade', exploded: false },
      { at: [0, 0, 0], text: 'Filme de poliéster metalizado, enrolado', anchor: 'element' },
      {
        at: [0, 0, 0],
        text: 'Ponta metalizada (zinco) soldada ao terminal',
        anchor: 'spray',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: p.variant === 'caixa' ? 'Caixa plástica selada com resina' : 'Revestimento de epóxi',
        anchor: 'case',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: 'Duas tiras de filme: o metal é a placa, o plástico é o dielétrico',
        anchor: 'film',
        exploded: true,
      },
    );
    return notes;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const b = bodyOf(p);
    const farads = Number(p.farads);
    const kind =
      p.variant === 'verde'
        ? 'verde mergulhado'
        : p.variant === 'zebra'
          ? `zebrinha (faixas ${zebraBands(farads, Number(p.voltage)).join(', ')})`
          : 'em caixa (MKT)';
    return `Capacitor de poliéster ${kind} de ${formatFarads(farads)}, ±5 %, ${p.voltage} V, corpo de ${formatNumber(b.L)} × ${formatNumber(b.H)} × ${formatNumber(b.W)} mm, terminais a ${formatNumber(b.pitch)} mm. Não tem polaridade.`;
  },
  view: [0.6, 0.45, 1.5],
};

function capacitorCodeOf(farads: number): string {
  const pf = Math.round(farads * 1e12);
  if (pf < 100) return String(pf);
  const exponent = Math.floor(Math.log10(pf)) - 1;
  return `${Math.round(pf / 10 ** exponent)}${exponent}`;
}

export default function FilmCapacitor(props: FilmCapacitorProps) {
  const p = { ...meta.defaults, ...props } as Required<FilmCapacitorProps>;
  const b = bodyOf(p as PartProps);
  const variant = p.variant;
  const lift = p.leadLength;

  // Wound element (flat), centred at yE, axis along X.
  const dipped = variant !== 'caixa';
  const spray = 0.35;
  // Room at both ends for the spray and the lead welded to it.
  const Le = b.L - 2 * (spray + b.lead + (dipped ? 0.8 : 0.45));
  const He = b.H - (dipped ? 2.8 : 1.8);
  const We = Math.max(b.W - (dipped ? 1.6 : 0.9), 0.9);
  const yE = dipped ? b.H * 0.52 : b.H / 2 + 0.2;

  return (
    <group position={[0, lift, 0]}>
      {variant === 'caixa' ? (
        <BoxCase p={p} b={b} />
      ) : (
        <DippedCase p={p} b={b} zebra={variant === 'zebra'} />
      )}
      <WoundElement Le={Le} He={He} We={We} spray={spray} y={yE} />
      {([-1, 1] as const).map((side) => {
        const xEnd = Le / 2 + spray + b.lead / 2;
        return (
          <group key={side}>
            <Wire
              points={[
                [side * (b.pitch / 2), -lift, 0],
                [side * (b.pitch / 2), dipped ? -0.6 : 0.2, 0],
                [side * xEnd, dipped ? 1.2 : 1.0, 0],
                [side * xEnd, yE - He * 0.15, 0],
              ]}
              radius={b.lead / 2}
              bend={0.8}
            />
            <mesh position={[side * (xEnd - 0.1), yE - He * 0.18, 0]} scale={[0.7, 1.6, 1]}>
              <sphereGeometry args={[b.lead * 0.75, 14, 10]} />
              <Material preset="solder" roughness={0.35} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Moulded MKT box with the printed face; it lifts off in the exploded view. */
function BoxCase({ p, b }: { p: Required<FilmCapacitorProps>; b: Body }) {
  const colors = BOX_COLORS[p.color] ?? BOX_COLORS.vermelho;
  const geometry = useDisposable(() => roundedBoxGeometry(b.L, b.H, b.W, 0.35, 0.5), [b]);
  const value = filmValueCode(p.farads);
  const faceW = b.L - 0.9;
  const faceH = b.H - 0.9;
  const texH = Math.round((512 * faceH) / faceW);
  const print = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = colors.ink;
      const mm = w / faceW;
      const big = Math.min(faceH * 0.26, faceW * 0.26) * mm;
      fitText(ctx, 'MKT', w / 2, h * 0.2, w * 0.5, big * 0.62, { weight: 600, family: FONT_SANS });
      fitText(ctx, `${value} J`, w / 2, h * 0.47, w * 0.92, big, {
        weight: 700,
        family: FONT_SANS,
      });
      fitText(ctx, `${p.voltage}V`, w / 2, h * 0.74, w * 0.7, big * 0.8, {
        weight: 700,
        family: FONT_SANS,
      });
    },
    `${value}|${p.voltage}|${p.color}|${b.L}|${b.H}`,
    { width: 512, height: texH, fonts: [`700 40px ${FONT_SANS}`] },
  );
  const noise = getNoiseTexture();
  return (
    <Explode offset={[0, b.H + 6, 0]}>
      <mesh geometry={geometry} position={[0, b.H / 2, 0]}>
        <Material
          preset="pbtGreen"
          clip
          color={colors.body}
          roughnessMap={noise}
          roughness={0.4}
          clearcoat={0.3}
          clearcoatRoughness={0.4}
          cutColor={colors.cut}
        />
      </mesh>
      <mesh position={[0, b.H / 2, b.W / 2 + 0.006]}>
        <planeGeometry args={[faceW, faceH]} />
        <Material
          preset="epoxyBlack"
          clip
          color="#ffffff"
          map={print}
          transparent
          depthWrite={false}
          roughness={0.45}
        />
      </mesh>
      {/* Resin that seals the open bottom of the case. */}
      <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[b.L - 0.7, b.W - 0.6]} />
        <Material preset="epoxyBlack" color="#4a2a1c" roughness={0.6} />
      </mesh>
      <Anchor name="case" position={[-b.L / 2, b.H * 0.8, 0]} />
    </Explode>
  );
}

/** Dipped epoxy body: green with the EIA code, or colour bands (zebrinha). */
function DippedCase({ p, b, zebra }: { p: Required<FilmCapacitorProps>; b: Body; zebra: boolean }) {
  const shape: BlobShape = zebra
    ? {
        a: b.L / 2,
        b: b.H / 2,
        c: b.W / 2,
        e1: 0.5,
        e2: 0.32,
        drip: 0.05,
        bottom: 0.08,
        taper: 0.04,
      }
    : {
        a: b.L / 2,
        b: b.H / 2,
        c: b.W / 2,
        e1: 0.45,
        e2: 0.42,
        drip: 0.1,
        bottom: 0.12,
        taper: 0.06,
      };
  const cy = -blobBottom(shape);
  const geometry = useDisposable(() => blobGeometry(shape), [shape]);
  const decal = useDisposable(
    () => blobDecalGeometry(shape, { uw: shape.a * 1.8, uh: shape.b * 1.8, reach: 0.85 }),
    [shape],
  );
  const code = `${VOLTAGE_CODES[p.voltage] ?? '2A'}${capacitorCodeOf(p.farads)}J`;
  const bands = zebraBands(p.farads, p.voltage);
  const print = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      if (zebra) return;
      ctx.fillStyle = '#ece6cf';
      fitText(ctx, code, w / 2, h * 0.47, w * 0.78, h * 0.2, { weight: 700, family: FONT_SANS });
    },
    `${code}|${zebra}`,
    { width: 512, height: 512, fonts: [`700 40px ${FONT_SANS}`] },
  );
  // Zebra bands along the height (v): five equal bands, the first one at the top.
  const bandMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#2f6b3d';
      ctx.fillRect(0, 0, w, h);
      if (!zebra) return;
      const top = 0;
      const bottom = h * 0.97;
      bands.forEach((band, i) => {
        ctx.fillStyle = BAND_RGB[band];
        ctx.fillRect(0, top + ((bottom - top) * i) / 5, w, (bottom - top) / 5 + 1);
      });
    },
    `${bands.join(',')}|${zebra}`,
    { width: 8, height: 512 },
  );
  const noise = getNoiseTexture();
  const cut = zebra
    ? `#${new Color(BAND_RGB[bands[2]]).multiplyScalar(0.6).getHexString()}`
    : '#1f4628';
  return (
    <Explode offset={[0, b.H + 5, 0]}>
      <group position={[0, cy - 0.6, 0]}>
        <mesh geometry={geometry}>
          <Material
            preset="epoxyOrange"
            clip
            color="#ffffff"
            map={bandMap}
            roughnessMap={noise}
            roughness={zebra ? 0.5 : 0.35}
            clearcoat={0.6}
            clearcoatRoughness={0.3}
            cutColor={cut}
          />
        </mesh>
        {!zebra && (
          <mesh geometry={decal}>
            <Material
              preset="epoxyBlack"
              clip
              color="#ffffff"
              map={print}
              transparent
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-2}
              roughness={0.4}
            />
          </mesh>
        )}
        <Anchor name="case" position={[-shape.a * 0.8, shape.b * 0.5, shape.c * 0.5]} />
      </group>
    </Explode>
  );
}

/** Flat winding of metallised film with zinc-sprayed ends (axis along X). */
function WoundElement({
  Le,
  He,
  We,
  spray,
  y,
}: {
  Le: number;
  He: number;
  We: number;
  spray: number;
  y: number;
}) {
  const geometry = useDisposable(() => {
    const shape = roundedRectShape(We, He, We * 0.48);
    const g = new ExtrudeGeometry(shape, { depth: Le, bevelEnabled: false, curveSegments: 8 });
    g.translate(0, 0, -Le / 2);
    g.rotateY(Math.PI / 2);
    return g;
  }, [Le, He, We]);
  const endGeometry = useDisposable(() => {
    const shape = roundedRectShape(We + 0.05, He + 0.05, We * 0.5);
    const g = new ExtrudeGeometry(shape, {
      depth: spray,
      bevelEnabled: true,
      bevelSize: 0.05,
      bevelThickness: 0.05,
      bevelSegments: 1,
      curveSegments: 8,
    });
    g.translate(0, 0, -spray / 2);
    g.rotateY(Math.PI / 2);
    return g;
  }, [We, He, spray]);
  // Unrolled outer turns in the exploded view: two films peeling off the top.
  const peel = useDisposable(() => {
    const path: [number, number][] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      path.push([-He * 0.1 + He * 0.6 * t, We / 2 + 0.02]);
    }
    for (let i = 1; i <= 16; i++) {
      const t = i / 16;
      path.push([He * 0.5 + t * He * 0.9, We / 2 + 0.02 + t * t * He * 0.9]);
    }
    return ribbonGeometry(path, -Le / 2 + 0.2, Le / 2 - 0.2);
  }, [He, We, Le]);
  const peel2 = useDisposable(() => {
    const path: [number, number][] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      path.push([-He * 0.1 + He * 0.55 * t, We / 2 + 0.1]);
    }
    for (let i = 1; i <= 16; i++) {
      const t = i / 16;
      path.push([He * 0.45 + t * He * 0.75, We / 2 + 0.1 + t * t * He * 1.1]);
    }
    return ribbonGeometry(path, -Le / 2 + 0.5, Le / 2 + 0.1);
  }, [He, We, Le]);
  const sectionMap = useCanvasTexture(
    (ctx, w, h) => {
      // Layers stacked from the flattened core outwards (horizontal stripes).
      ctx.fillStyle = '#d9cfa9';
      ctx.fillRect(0, 0, w, h);
      const layers = Math.round(Math.min(Math.max(He * 2.2, 10), 30));
      const half = h / 2;
      const pitch = (half * 0.96) / layers;
      for (const side of [-1, 1]) {
        for (let i = 0; i < layers; i++) {
          const y = half + side * (pitch * (i + 0.5));
          ctx.fillStyle = i % 2 === 0 ? '#a2a7ad' : '#c2c6cb';
          // Metallisation stops short of one end (free margin), alternating.
          const margin = w * 0.04;
          ctx.fillRect(i % 2 === 0 ? 0 : margin, y - pitch * 0.18, w - margin, pitch * 0.36);
        }
      }
      ctx.fillStyle = '#5b5446';
      ctx.fillRect(0, half - 1.5, w, 3);
      const spr = (w * spray) / (Le + 2 * spray);
      ctx.fillStyle = '#8f9296';
      ctx.fillRect(0, 0, spr, h);
      ctx.fillRect(w - spr, 0, spr, h);
    },
    `${He}|${Le}`,
    { width: 512, height: 256 },
  );
  const filmMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#c4c3bc';
      ctx.fillRect(0, 0, w, h);
      // Free margin: clear PET along one edge.
      ctx.fillStyle = '#e7dfc4';
      ctx.fillRect(0, 0, w, h * 0.07);
    },
    'pet-film',
    { width: 64, height: 256 },
  );
  const noise = getNoiseTexture();
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={geometry}>
        <Material
          preset="aluminum"
          clip
          color="#cfc9b6"
          roughness={0.28}
          clearcoat={0.7}
          clearcoatRoughness={0.2}
          cutColor="#a8a594"
        />
      </mesh>
      {([-1, 1] as const).map((side) => (
        <mesh key={side} geometry={endGeometry} position={[side * (Le / 2 + spray / 2), 0, 0]}>
          <Material preset="zinc" clip roughnessMap={noise} roughness={0.85} cutColor="#7d8084" />
        </mesh>
      ))}
      <SectionFace width={Le + spray * 2} height={He - 0.1} center={[0, 0]} map={sectionMap} />
      <Anchor name="element" position={[-Le * 0.2, He / 2, We / 2] as Vec3} />
      <Anchor name="spray" position={[Le / 2 + spray, He * 0.25, 0]} />
      <ExplodeReveal from={0.4} axis="all" rotation={[0, 0, Math.PI / 2]}>
        <mesh geometry={peel}>
          <Material preset="aluminum" color="#ffffff" map={filmMap} roughness={0.25} side={2} />
        </mesh>
        <mesh geometry={peel2}>
          <Material preset="aluminum" color="#ffffff" map={filmMap} roughness={0.3} side={2} />
        </mesh>
        <Anchor name="film" position={[He * 1.2, 0, We / 2 + He * 0.6]} />
      </ExplodeReveal>
    </group>
  );
}
