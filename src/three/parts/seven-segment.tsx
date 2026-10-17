/**
 * Single-digit 7-segment LED display, 0,56" (14,2 mm digit), common cathode
 * or common anode. Dimensions from typical datasheets (5161AS/5161BS style):
 * body 12,7 × 19,0 × 8,0 mm, 10 pins in two rows 15,24 mm apart at 2,54 mm
 * pitch. Lit segments glow (emission and a halo); unlit ones show the light
 * grey diffusers. Inside: one LED chip at the bottom of each reflector
 * cavity, on a small board, under the diffusing epoxy.
 */
import { useMemo } from 'react';
import { AdditiveBlending, Color } from 'three';
import { Anchor, Explode, useView } from '../core/view';
import { emission, GLOW } from '../fx/glow';
import { Material } from '../materials/Material';
import { FONT_MONO, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { useDisposable, Wire } from '../shapes/Wire';
import type { PartMeta, PartProps, Vec3 } from '../types';
import { LED_COLORS, type LedColor } from './led';
import { loft, mergeAll, moldedBlock, type Pt } from './_semi-geometry';

export interface SevenSegmentProps {
  /** '0'..'9', '-' or 'apagado'. */
  digit?: string | number;
  dp?: boolean;
  color?: LedColor;
  /** 0 = off, 1 = rated current. */
  brightness?: number;
  common?: 'catodo' | 'anodo';
  leadLength?: number;
}

type Seg = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
const SEGMENTS: Seg[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const DIGITS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  apagado: '',
};

/** Package (mm). The face is the top (+Y); the digit reads upright from +Z. */
const BODY_W = 12.7;
const BODY_D = 19.0;
const BODY_H = 8.0;
const ROW = 15.24;
/** Digit box on the face, segment thickness and gap, slant. */
const DW = 7.4;
const DH = 14.2;
const T = 1.55;
const GAP = 0.22;
const SLANT = Math.tan((9 * Math.PI) / 180);
const DIGIT_X = -0.7;
/** Pin of each segment (common: 3 and 8), 1..5 front row left to right, 6..10 back row right to left. */
const PINOUT: Record<string, number> = { e: 1, d: 2, c: 4, dp: 5, b: 6, a: 7, f: 9, g: 10 };

export const meta: PartMeta = {
  id: 'seven-segment',
  label: 'Display de 7 segmentos',
  category: 'saidas',
  summary:
    'Display de 7 segmentos de 0,56" com um dígito: cada segmento é um LED; acende o número escolhido, com o ponto decimal.',
  defaults: {
    digit: '5',
    dp: false,
    color: 'vermelho',
    brightness: 1,
    common: 'catodo',
    leadLength: 5,
  },
  controls: {
    digit: {
      kind: 'select',
      label: 'Dígito',
      options: [
        ...Array.from({ length: 10 }, (_, i) => ({ value: String(i), label: String(i) })),
        { value: '-', label: 'Traço (–)' },
        { value: 'apagado', label: 'Apagado' },
      ],
    },
    dp: { kind: 'toggle', label: 'Ponto decimal aceso' },
    color: {
      kind: 'select',
      label: 'Cor',
      options: (['vermelho', 'verde', 'azul', 'amarelo', 'laranja', 'branco'] as LedColor[]).map(
        (c) => ({
          value: c,
          label: c[0]!.toUpperCase() + c.slice(1),
        }),
      ),
    },
    brightness: { kind: 'number', label: 'Brilho', min: 0, max: 1.5, step: 0.05 },
    common: {
      kind: 'select',
      label: 'Comum',
      options: [
        { value: 'catodo', label: 'Cátodo comum' },
        { value: 'anodo', label: 'Ânodo comum' },
      ],
    },
    leadLength: { kind: 'number', label: 'Terminais', min: 3, max: 10, step: 0.5, unit: 'mm' },
  },
  annotations: (p) => {
    const y0 = Number(p.leadLength);
    const top = y0 + BODY_H;
    const [ax, az] = faceToWorld(segCenter('a'));
    const [bx, bz] = faceToWorld(segCenter('b'));
    const [dpx, dpz] = faceToWorld(dpCenter());
    const common = p.common === 'anodo' ? 'ânodo' : 'cátodo';
    return [
      { at: [ax, top, az] as Vec3, text: 'Segmento a: cada segmento é um LED', exploded: false },
      {
        at: [bx, top, bz] as Vec3,
        text: 'Segmentos de a até g, em sentido horário',
        exploded: false,
      },
      { at: [dpx, top, dpz] as Vec3, text: 'Ponto decimal (dp)', exploded: false },
      { at: [-5.08, y0 * 0.4, ROW / 2] as Vec3, text: 'Pino 1 (segmento e)', exploded: false },
      { at: [0, y0 * 0.4, ROW / 2] as Vec3, text: `Pinos 3 e 8: ${common} comum`, exploded: false },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Chip de LED no fundo de cada segmento',
        anchor: 'chip',
        exploded: true,
      },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Refletor cheio de epóxi difusor',
        anchor: 'pipe',
        exploded: true,
      },
    ];
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const digit = digitOf(p);
    const c = LED_COLORS[(p.color as LedColor) ?? 'vermelho'] ?? LED_COLORS.vermelho;
    const common = p.common === 'anodo' ? 'ânodo comum' : 'cátodo comum';
    const segs = DIGITS[digit] ?? '';
    const lit = Number(p.brightness) > 0 && (segs || p.dp);
    const shows = !lit
      ? 'apagado'
      : `mostrando ${digit === '-' ? 'um traço' : digit === 'apagado' ? 'só o ponto' : `o número ${digit}`}${p.dp ? ' com o ponto decimal' : ''} (segmentos acesos: ${segs.split('').join(', ') || 'nenhum'}${p.dp ? ', dp' : ''})`;
    return `Display de 7 segmentos ${c.label} de 0,56", ${common}, ${shows}. Os pinos 3 e 8 são o comum.`;
  },
  view: [0.3, 1.5, 1.1],
};

function digitOf(p: PartProps): string {
  const d = String(p.digit ?? '5');
  return d in DIGITS ? d : '5';
}

/** Centre line positions of the segments on the face (x right, y up). */
const HW = DW / 2 - T / 2;
const HH = DH / 2 - T / 2;
function segCenter(s: Seg): [number, number] {
  switch (s) {
    case 'a':
      return [0, HH];
    case 'g':
      return [0, 0];
    case 'd':
      return [0, -HH];
    case 'f':
      return [-HW, HH / 2];
    case 'b':
      return [HW, HH / 2];
    case 'e':
      return [-HW, -HH / 2];
    case 'c':
      return [HW, -HH / 2];
  }
}
const dpCenter = (): [number, number] => [HW + T * 1.45, -HH];

/** Face coordinates (with slant) to world X/Z. */
function faceToWorld([x, y]: [number, number]): [number, number] {
  return [DIGIT_X + x + y * SLANT, -y - 0.3];
}

/** Hexagonal segment outline (world X/Z), shrunk towards its centre by `k`. */
function segOutline(s: Seg, k = 1): Pt[] {
  const [cx, cy] = segCenter(s);
  const horizontal = s === 'a' || s === 'g' || s === 'd';
  const len = (horizontal ? 2 * HW : HH) - 2 * GAP;
  const h = T / 2;
  const l = len / 2;
  const local: Pt[] = [
    [-l, 0],
    [-l + h, -h],
    [l - h, -h],
    [l, 0],
    [l - h, h],
    [-l + h, h],
  ];
  return local.map(([u, v]) => {
    const [x, y] = horizontal ? [u * k, v * k] : [v * k, u * k];
    return faceToWorld([cx + x, cy + y]);
  });
}

function dpOutline(k = 1): Pt[] {
  const [cx, cy] = dpCenter();
  const r = T * 0.55 * k;
  return Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2;
    return faceToWorld([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  });
}

/** Light pipe: loft from the small chip end to the full segment at the face. */
function pipe(outline: (k: number) => Pt[], bottom: number, top: number) {
  return loft([
    { y: bottom, pts: outline(0.4) },
    { y: top - 0.6, pts: outline(0.92) },
    { y: top, pts: outline(1) },
  ]);
}

export default function SevenSegment(props: SevenSegmentProps) {
  const p = { ...meta.defaults, ...props } as Required<SevenSegmentProps>;
  const digit = digitOf(p as unknown as PartProps);
  const litSet = new Set((DIGITS[digit] ?? '').split(''));
  const colors = LED_COLORS[p.color] ?? LED_COLORS.vermelho;
  const level = Math.max(p.brightness, 0);
  const y0 = Math.max(p.leadLength, 2);
  const boardY = 0.9; // internal board, above the body bottom
  const faceY = BODY_H;
  const litKey = `${digit}`;

  const housing = useDisposable(
    () =>
      moldedBlock({
        width: BODY_W,
        depth: BODY_D,
        height: BODY_H,
        corner: 0.3,
        fillet: 0.15,
        bottomFillet: 0.1,
        draft: 0.005,
        parting: 0,
      }),
    [],
  );

  const pipes = useDisposable(() => {
    const lit = SEGMENTS.filter((s) => litSet.has(s)).map((s) =>
      pipe((k) => segOutline(s, k), boardY + 0.25, faceY + 0.012),
    );
    return lit.length
      ? mergeAll(lit)
      : mergeAll([pipe((k) => segOutline('g', k * 0.001), 0, 0.001)]);
  }, [litKey]);
  const darkPipes = useDisposable(() => {
    const dark = SEGMENTS.filter((s) => !litSet.has(s)).map((s) =>
      pipe((k) => segOutline(s, k), boardY + 0.25, faceY + 0.012),
    );
    return dark.length
      ? mergeAll(dark)
      : mergeAll([pipe((k) => segOutline('g', k * 0.001), 0, 0.001)]);
  }, [litKey]);
  const dpPipe = useDisposable(() => pipe(dpOutline, boardY + 0.25, faceY + 0.012), []);

  // The diffusers are large: a modest emission keeps the colour saturated
  // (tone mapping turns strong emission white); the tiny chips use GLOW.
  const glow = emission(colors.light, Math.min(level, 1.5) * 2.4, 1);
  const chipGlow = emission(colors.light, Math.min(level, 1.5), GLOW);
  const off = { color: '#c9c7c0', roughness: 0.55 };

  // Light spilling onto the black face around the lit segments (soft halo).
  const spill = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const k = w / BODY_W;
      const toCanvas = ([x, z]: Pt): Pt => [(x + BODY_W / 2) * k, (z + BODY_D / 2) * k];
      const shapes = SEGMENTS.filter((s) => litSet.has(s)).map((s) => segOutline(s, 1.15));
      if (p.dp) shapes.push(dpOutline(1.3));
      ctx.fillStyle = colors.light;
      for (const [blur, alpha] of [
        [2.2, 0.35],
        [0.7, 0.35],
      ] as const) {
        ctx.filter = `blur(${blur * k}px)`;
        ctx.globalAlpha = alpha;
        for (const shape of shapes) {
          ctx.beginPath();
          shape.map(toCanvas).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
    },
    `${litKey}|${p.dp}|${colors.light}`,
    { width: 256, height: Math.round((256 * BODY_D) / BODY_W) },
  );
  const litColor = colors.lens;
  const litCut = useMemo(
    () => `#${new Color(colors.lens).multiplyScalar(0.85).getHexString()}`,
    [colors.lens],
  );
  const noise = getNoiseTexture();

  // Part number on the front side, small dark print.
  const label = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#2a2a2c';
      fitText(ctx, p.common === 'anodo' ? '5161BS' : '5161AS', w / 2, h / 2, w * 0.9, h * 0.7, {
        weight: 600,
        family: FONT_MONO,
      });
    },
    p.common,
    { width: 512, height: 64, fonts: [`600 40px ${FONT_MONO}`] },
  );

  const pinPositions = useMemo(() => {
    const list: { n: number; x: number; z: number }[] = [];
    for (let i = 0; i < 5; i++) list.push({ n: i + 1, x: -5.08 + i * 2.54, z: ROW / 2 });
    for (let i = 0; i < 5; i++) list.push({ n: i + 6, x: 5.08 - i * 2.54, z: -ROW / 2 });
    return list;
  }, []);

  // One chip per segment (two in the long ones are common; one is enough here).
  const chips = useMemo(() => {
    const list: { s: Seg | 'dp'; at: [number, number]; lit: boolean }[] = SEGMENTS.map((s) => ({
      s,
      at: faceToWorld(segCenter(s)),
      lit: litSet.has(s),
    }));
    list.push({ s: 'dp', at: faceToWorld(dpCenter()), lit: p.dp });
    return list;
  }, [litKey, p.dp]); // eslint-disable-line react-hooks/exhaustive-deps

  const lit = level > 0;
  const { cutaway } = useView();
  const pipeAnchor = faceToWorld(segCenter('f'));
  return (
    <group position={[0, y0, 0]}>
      {/* Housing, black face and the diffusers move up together. */}
      <Explode offset={[0, BODY_H + 6, 0]}>
        <mesh geometry={housing}>
          <Material
            attach="material-0"
            preset="absWhite"
            color="#e3e1db"
            roughness={0.6}
            clip
            cutColor="#cfccc4"
          />
          <Material
            attach="material-1"
            preset="absBlack"
            color="#141416"
            roughness={0.62}
            roughnessMap={noise}
            clip
            cutColor="#cfccc4"
          />
        </mesh>
        <mesh position={[0, BODY_H * 0.45, BODY_D / 2 + 0.01]}>
          <planeGeometry args={[BODY_W * 0.6, BODY_W * 0.075]} />
          <Material color="#ffffff" map={label} transparent alphaTest={0.3} roughness={0.7} clip />
        </mesh>
        <mesh geometry={pipes}>
          <Material
            clip
            cutColor={lit ? litCut : '#c9c6bd'}
            color={lit ? litColor : off.color}
            roughness={0.45}
            emissive={lit ? glow.emissive : '#000000'}
            emissiveIntensity={lit ? glow.emissiveIntensity : 0}
          />
        </mesh>
        <mesh geometry={darkPipes}>
          <Material color={off.color} roughness={off.roughness} clip cutColor="#c9c6bd" />
        </mesh>
        <mesh geometry={dpPipe}>
          {p.dp && lit ? (
            <Material
              clip
              cutColor={litCut}
              color={litColor}
              roughness={0.45}
              emissive={glow.emissive}
              emissiveIntensity={glow.emissiveIntensity}
            />
          ) : (
            <Material color={off.color} roughness={off.roughness} clip cutColor="#c9c6bd" />
          )}
        </mesh>
        <Anchor name="pipe" position={[pipeAnchor[0], BODY_H * 0.6, pipeAnchor[1]]} />
        {lit && !cutaway && (
          <mesh position={[0, faceY + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[BODY_W, BODY_D]} />
            <meshBasicMaterial
              map={spill}
              transparent
              opacity={Math.min(level, 1.2) * 0.75}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        )}
      </Explode>

      {/* Internal board with one LED chip under each segment. */}
      <mesh position={[0, boardY - 0.3, 0]}>
        <boxGeometry args={[BODY_W - 1.2, 0.6, BODY_D - 1.2]} />
        <Material preset="fr4" color="#9c9677" roughness={0.7} clip cutColor="#7d7860" />
      </mesh>
      {chips.map((c) => (
        <group key={c.s} position={[c.at[0], boardY, c.at[1]]}>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.9, 0.04, 0.9]} />
            <Material preset="gold" roughness={0.3} clip />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <boxGeometry args={[0.32, 0.22, 0.32]} />
            <Material
              clip
              color={c.lit && lit ? litColor : '#3a3a40'}
              roughness={0.4}
              emissive={c.lit && lit ? chipGlow.emissive : '#000000'}
              emissiveIntensity={c.lit && lit ? chipGlow.emissiveIntensity : 0}
            />
          </mesh>
        </group>
      ))}
      <Anchor
        name="chip"
        position={[faceToWorld(segCenter('e'))[0], boardY + 0.3, faceToWorld(segCenter('e'))[1]]}
      />

      {/* Pins (tinned), from inside the body to the tips. */}
      {pinPositions.map((pin) => (
        <Wire
          key={pin.n}
          points={[
            [pin.x, boardY - 0.2, pin.z],
            [pin.x, -y0, pin.z],
          ]}
          radius={0.25}
          radial={8}
          material={{ preset: 'tin', clip: true }}
        />
      ))}
    </group>
  );
}

export { PINOUT as SEVEN_SEGMENT_PINOUT };
