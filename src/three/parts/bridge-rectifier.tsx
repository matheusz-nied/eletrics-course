/**
 * Single-phase bridge rectifiers: the in-line KBP (KBP206 style, 2 A) and
 * GBU (GBU806 style, 8 A, with the screw hole for a heatsink), and the small
 * DIP-4 DB (DB107 style, 1 A). Dimensions from typical datasheets (generic
 * KBP2005–KBP210, GBU8005–GBU810 and DB101–DB107 outlines): KBP body
 * 14,2 × 10,3 × 3,6 mm with Ø 0,8 mm leads 3,8 mm apart; GBU body
 * 21,8 × 18,2 × 3,4 mm, Ø 3,4 mm hole, 1,0 × 0,5 mm leads 5,0 mm apart;
 * DB-1 body 8,3 × 6,5 × 3,2 mm, DIP leads 5,08 mm apart in rows 7,62 mm
 * apart, with + and − on opposite corners. The chamfered corner of the
 * in-line packages marks the + lead. Inside: four glass-passivated diode
 * chips soldered to the copper lead frame and joined by copper clips into a
 * bridge (the lead frame lies in the middle plane of the body).
 */
import { formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture } from '../materials/textures';
import { axialLathe, roundedCylinderProfile } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta, PartProps, Vec3 } from '../types';
import {
  attachPads,
  clipStraps,
  dipLeadRow,
  inlineSlab,
  plates,
  rectOutline,
  type Rect,
} from './_opto-geometry';
import { extrudeOutline, mergeAll, mergeAt, moldedBlock, placed, type Pt } from './_semi-geometry';
import { SiliconDie, usePrintedTop } from './_semi-parts';

type Variant = 'kbp' | 'gbu' | 'db';

export interface BridgeRectifierProps {
  variant?: Variant;
  /** Printed part number; empty = built from the variant, current and voltage. */
  code?: string;
  /** Average forward current (A); 0 = the usual one for the package. */
  amps?: number;
  /** Peak reverse voltage class (V); 0 = the usual one for the package. */
  volts?: number;
}

/** Marks moulded next to each lead, in order along +X (in-line packages). */
const INLINE_MARKS = ['+', '~', '~', '−'] as const;

interface Inner {
  frameT: number;
  die: number;
  dieT: number;
  clip: { w: number; t: number; arch: number };
}

interface InlineSpec extends Inner {
  name: string;
  amps: number;
  volts: number;
  W: number;
  H: number;
  T: number;
  pitch: number;
  radius: number;
  chamfer: number;
  bevel: number;
  leadLength: number;
  hole?: { y: number; r: number };
  text: { code: number; codeV: number; mark: number; markV: number };
  /** Lead-frame plan in face coordinates (u along X, v up from the body bottom). */
  layout: {
    strip: number;
    pads: [number, number];
    padInner: number;
    padOuter: number;
    arm: [number, number];
    bar: [number, number];
    topDie: Pt;
    bottomDie: Pt;
    landV: number;
  };
}

const KBP: InlineSpec = {
  name: 'KBP',
  amps: 2,
  volts: 600,
  W: 14.2,
  H: 10.3,
  T: 3.6,
  pitch: 3.8,
  radius: 0.6,
  chamfer: 1.8,
  bevel: 0.35,
  leadLength: 12.7,
  text: { code: 1.7, codeV: 6.7, mark: 1.5, markV: 2.4 },
  frameT: 0.4,
  die: 1.4,
  dieT: 0.25,
  clip: { w: 0.8, t: 0.15, arch: 0.4 },
  layout: {
    strip: 1.2,
    pads: [1.5, 4.0],
    padInner: 0.25,
    padOuter: 4.4,
    arm: [4.6, 5.4],
    bar: [6.0, 8.4],
    topDie: [2.8, 7.2],
    bottomDie: [1.1, 2.75],
    landV: 2.3,
  },
};

const GBU: InlineSpec = {
  name: 'GBU',
  amps: 8,
  volts: 600,
  W: 21.8,
  H: 18.2,
  T: 3.4,
  pitch: 5.0,
  radius: 0.8,
  chamfer: 2.2,
  bevel: 0.4,
  leadLength: 17.5,
  hole: { y: 15.0, r: 1.7 },
  text: { code: 2.4, codeV: 9.6, mark: 2.2, markV: 3.4 },
  frameT: 0.5,
  die: 2.6,
  dieT: 0.3,
  clip: { w: 1.3, t: 0.2, arch: 0.55 },
  layout: {
    strip: 1.8,
    pads: [1.8, 6.2],
    padInner: 0.3,
    padOuter: 5.7,
    arm: [6.9, 8.1],
    bar: [8.8, 12.2],
    topDie: [4.1, 10.5],
    bottomDie: [1.8, 4.0],
    landV: 2.9,
  },
};

/** DB-1 (DIP-4) package. */
const DB = {
  name: 'DB, DIP-4',
  amps: 1,
  volts: 1000,
  L: 8.3,
  W: 6.5,
  H: 3.2,
  pitch: 5.08,
  row: 7.62,
  standoff: 0.5,
  pinL: 3.3,
  parting: 1.4,
  leadT: 0.25,
  shoulder: 1.2,
  pin: 0.5,
  frameT: 0.25,
  die: 1.0,
  dieT: 0.22,
  clip: { w: 0.55, t: 0.12, arch: 0.3 },
};
const DB_BODY_Y = DB.pinL + DB.standoff;
const DB_FRAME_Y = DB_BODY_Y + DB.parting;
/** DB pins in plan: + front-left, ~ front-right, − back-right, ~ back-left. */
const DB_PINS: { x: number; z: number; mark: string }[] = [
  { x: -DB.pitch / 2, z: 1, mark: '+' },
  { x: DB.pitch / 2, z: 1, mark: '~' },
  { x: DB.pitch / 2, z: -1, mark: '−' },
  { x: -DB.pitch / 2, z: -1, mark: '~' },
];

const VOLT_CLASSES = [50, 100, 200, 400, 600, 800, 1000];
const VOLT_SUFFIX: Record<number, string> = {
  50: '005',
  100: '01',
  200: '02',
  400: '04',
  600: '06',
  800: '08',
  1000: '10',
};

export const meta: PartMeta = {
  id: 'bridge-rectifier',
  label: 'Ponte retificadora',
  category: 'semicondutores',
  summary:
    'Ponte retificadora monofásica (KBP, GBU com furo ou DB em DIP-4): quatro diodos num só corpo, com as marcas + ~ ~ − e, por dentro, os chips ligados em ponte.',
  defaults: { variant: 'kbp', code: '', amps: 0, volts: 0 },
  controls: {
    variant: {
      kind: 'select',
      label: 'Encapsulamento',
      options: [
        { value: 'kbp', label: 'KBP, em linha (2 A, como a KBP206)' },
        { value: 'gbu', label: 'GBU, em linha com furo (8 A, como a GBU806)' },
        { value: 'db', label: 'DB, DIP-4 (1 A, como a DB107)' },
      ],
    },
    code: {
      kind: 'text',
      label: 'Código impresso (vazio = pela corrente e tensão)',
      maxLength: 10,
    },
    amps: {
      kind: 'number',
      label: 'Corrente média (0 = a típica)',
      min: 0,
      max: 25,
      step: 1,
      unit: 'A',
    },
    volts: {
      kind: 'select',
      label: 'Tensão reversa máxima',
      options: [
        { value: 0, label: 'A típica do encapsulamento' },
        ...VOLT_CLASSES.map((v) => ({ value: v, label: `${formatNumber(v)} V` })),
      ],
    },
  },
  annotations: (p) => {
    const variant = variantOf(p);
    if (variant === 'db') {
      const texts = [
        '+: saída positiva (contínua)',
        '~: entrada de corrente alternada',
        '−: saída negativa (contínua)',
        '~: a outra entrada alternada',
      ];
      return [
        ...DB_PINS.map((pin, i) => ({
          at: [pin.x, 1, (pin.z * DB.row) / 2] as Vec3,
          text: texts[i]!,
          exploded: false,
        })),
        { at: [0, 0, 0] as Vec3, text: 'Quatro chips de diodo ligados em ponte', anchor: 'dies' },
        {
          at: [0, 0, 0] as Vec3,
          text: 'Pontes de cobre ligam cada chip ao pino vizinho',
          anchor: 'clips',
          exploded: true,
        },
        {
          at: [0, 0, 0] as Vec3,
          text: 'Estrutura de cobre: uma parte por pino',
          anchor: 'frame',
          exploded: true,
        },
        { at: [0, 0, 0] as Vec3, text: 'Corpo de epóxi moldado', anchor: 'body', exploded: true },
      ];
    }
    const s = variant === 'gbu' ? GBU : KBP;
    const texts = [
      '+: saída positiva (contínua)',
      '~: entrada de corrente alternada',
      '~: a outra entrada alternada',
      '−: saída negativa (contínua)',
    ];
    const list = [
      ...INLINE_MARKS.map((_, i) => ({
        at: [(i - 1.5) * s.pitch, s.leadLength * 0.45, 0] as Vec3,
        text: texts[i]!,
        exploded: false,
      })),
      {
        at: [-s.W / 2 + s.chamfer * 0.35, s.leadLength + s.H - s.chamfer * 0.35, s.T / 2] as Vec3,
        text: 'Canto chanfrado: lado do terminal +',
        exploded: false,
      },
      { at: [0, 0, 0] as Vec3, text: 'Quatro chips de diodo ligados em ponte', anchor: 'dies' },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Pontes de cobre ligam cada chip ao terminal vizinho',
        anchor: 'clips',
        exploded: true,
      },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Estrutura de cobre: uma parte por terminal',
        anchor: 'frame',
        exploded: true,
      },
      { at: [0, 0, 0] as Vec3, text: 'Corpo de epóxi moldado', anchor: 'body', exploded: true },
    ];
    if (s.hole) {
      list.push({
        at: [s.hole.r * 0.75, s.leadLength + s.hole.y + s.hole.r * 0.75, s.T / 2] as Vec3,
        text: 'Furo para parafusar num dissipador',
        exploded: false,
      });
    }
    return list;
  },
  explode: true,
  cutaway: true,
  cut: (p) =>
    variantOf(p) === 'db'
      ? { normal: [0, -1, 0], through: [0, DB_FRAME_Y + 0.05, 0] }
      : { normal: [0, 0, -1], through: [0, 0, 0] },
  describe: (p) => {
    const variant = variantOf(p);
    const { amps, volts } = ratingOf(p);
    const name = variant === 'db' ? DB.name : variant === 'gbu' ? GBU.name : KBP.name;
    const marks =
      variant === 'db'
        ? ' As marcas + − ~ ~ ficam impressas ao lado de cada pino; + e − ficam em cantos opostos.'
        : ' O canto chanfrado fica do lado do terminal +.';
    return `Ponte retificadora ${codeOf(p)} (${name}, ${formatNumber(amps)} A, ${formatNumber(volts)} V): quatro diodos num só componente. Os terminais ~ recebem a tensão alternada; + e − entregam a tensão contínua pulsante.${marks}`;
  },
  view: [0.5, 0.8, 1.45],
};

function variantOf(p: PartProps): Variant {
  const v = String(p.variant);
  return v === 'gbu' || v === 'db' ? v : 'kbp';
}

function ratingOf(p: PartProps): { amps: number; volts: number } {
  const variant = variantOf(p);
  const typical = variant === 'db' ? DB : variant === 'gbu' ? GBU : KBP;
  const a = Number(p.amps);
  const v = Number(p.volts);
  return {
    amps: Number.isFinite(a) && a > 0 ? a : typical.amps,
    volts: VOLT_CLASSES.includes(v) ? v : typical.volts,
  };
}

/** Generic part number from the ratings: KBP206, GBU806, DB107. */
function codeOf(p: PartProps): string {
  const custom = String(p.code ?? '').trim();
  if (custom) return custom;
  const { amps, volts } = ratingOf(p);
  const a = Math.max(Math.round(amps), 1);
  const variant = variantOf(p);
  if (variant === 'db') return `DB${a}0${VOLT_CLASSES.indexOf(volts) + 1}`;
  return `${variant.toUpperCase()}${a}${VOLT_SUFFIX[volts]}`;
}

/** Chip size grows with the rated current (area ∝ current), within the pads. */
function dieScale(p: PartProps, typical: number): number {
  const k = Math.sqrt(ratingOf(p).amps / typical);
  return Math.min(Math.max(k, 0.75), 1.15);
}

export default function BridgeRectifier(props: BridgeRectifierProps) {
  const p = { ...meta.defaults, ...props } as Required<BridgeRectifierProps>;
  const pp = p as unknown as PartProps;
  const variant = variantOf(pp);
  const code = codeOf(pp);
  if (variant === 'db') return <DipBridge code={code} scale={dieScale(pp, DB.amps)} />;
  const spec = variant === 'gbu' ? GBU : KBP;
  return (
    <InlineBridge
      spec={spec}
      flat={variant === 'gbu'}
      code={code}
      scale={dieScale(pp, spec.amps)}
    />
  );
}

/** Lead frame, chips and clips, laid out in a local plan (x, z) with +Y up. */
interface InsideLayout extends Inner {
  plates: Pt[][];
  /** Chip centres: D1 and D3 (cathode on +), then D2 and D4 (anode to −). */
  dies: Pt[];
  /** Where each chip's clip lands (same order as `dies`). */
  lands: Pt[];
  anchors: { dies: Vec3; clips: Vec3; frame: Vec3 };
}

function BridgeInside({ layout }: { layout: InsideLayout }) {
  const { frameT, die, dieT, clip } = layout;
  const top = frameT / 2;
  const dieTop = top + 0.04 + dieT;
  const frame = useDisposable(() => plates(layout.plates, frameT), [layout]);
  const solder = useDisposable(
    () =>
      attachPads(
        layout.dies.map((at) => ({ at, size: [die + 0.14, die + 0.14] as [number, number] })),
        top + 0.02,
        0.04,
      ),
    [layout],
  );
  const clips = useDisposable(
    () =>
      clipStraps(
        layout.dies.map((from, i) => ({
          from,
          to: layout.lands[i]!,
          fromY: dieTop,
          toY: top,
          arch: dieTop + clip.arch,
        })),
        clip.t,
        clip.w,
      ),
    [layout],
  );
  return (
    <group>
      <mesh geometry={frame}>
        <Material preset="copper" color="#c98a64" roughness={0.35} />
      </mesh>
      <mesh geometry={solder}>
        <Material preset="solder" roughness={0.45} />
      </mesh>
      {layout.dies.map((at, i) => (
        <SiliconDie
          key={i}
          size={[die, die]}
          thickness={dieT}
          kind="diode"
          seed={5 + i}
          position={[at[0], top + 0.04, at[1]]}
        />
      ))}
      <mesh geometry={clips}>
        <Material preset="copper" color="#d59c76" roughness={0.3} />
      </mesh>
      <Anchor name="dies" position={layout.anchors.dies} />
      <Anchor name="clips" position={layout.anchors.clips} />
      <Anchor name="frame" position={layout.anchors.frame} />
    </group>
  );
}

/** Plan of the in-line lead frame: face (u, v) → local plan (x = u, z = −v). */
function inlineLayout(s: InlineSpec, scale: number): InsideLayout {
  const L = s.layout;
  const h = L.strip / 2;
  const x0 = -1.5 * s.pitch;
  const x1 = -0.5 * s.pitch;
  const x2 = 0.5 * s.pitch;
  const x3 = 1.5 * s.pitch;
  const box = (u0: number, v0: number, u1: number, v1: number) =>
    rectOutline([u0, -v1, u1, -v0] as Rect);
  const at = (u: number, v: number): Pt => [u, -v];
  const [tu, tv] = L.topDie;
  const [bu, bv] = L.bottomDie;
  const armV = (L.arm[0] + L.arm[1]) / 2;
  const dieTop = s.frameT / 2 + 0.04 + s.dieT;
  return {
    frameT: s.frameT,
    die: s.die * scale,
    dieT: s.dieT,
    clip: s.clip,
    plates: [
      box(x0 - h, 0, x0 + h, L.bar[0]), // + lead, up the left side
      box(x0 - h, L.bar[0], x3 + h, L.bar[1]), // + bar: carries D1 and D3
      box(x1 - h, 0, x1 + h, L.pads[0]), // ~ lead
      box(-L.padOuter, L.pads[0], -L.padInner, L.pads[1]), // ~ pad: carries D2
      box(x2 - h, 0, x2 + h, L.pads[0]),
      box(L.padInner, L.pads[0], L.padOuter, L.pads[1]), // the other ~ pad: carries D4
      box(x3 - h, 0, x3 + h, L.arm[0]), // − lead, up the right side
      box(-L.padOuter, L.arm[0], x3 + h, L.arm[1]), // − arm: the clips of D2 and D4
    ],
    dies: [at(-tu, tv), at(tu, tv), at(-bu, bv), at(bu, bv)],
    lands: [at(-tu, L.landV), at(tu, L.landV), at(-bu, armV), at(bu, armV)],
    anchors: {
      dies: [0, dieTop + 0.2, -(tv + bv) / 2],
      clips: [-tu, dieTop + s.clip.arch + s.clip.t, -(tv + L.landV) / 2],
      frame: [x0 - h, s.frameT / 2, -(L.bar[0] + L.bar[1]) / 2],
    },
  };
}

function InlineBridge({
  spec: s,
  flat,
  code,
  scale,
}: {
  spec: InlineSpec;
  flat: boolean;
  code: string;
  scale: number;
}) {
  const body = useDisposable(
    () =>
      inlineSlab({
        width: s.W,
        height: s.H,
        thickness: s.T,
        radius: s.radius,
        chamfer: s.chamfer,
        bevel: s.bevel,
        hole: s.hole ? { x: 0, y: s.hole.y, r: s.hole.r } : undefined,
      }),
    [s],
  );

  // Leads: Ø 0,8 mm round wire (KBP) or flat 1,0 × 0,5 mm with a wider shoulder (GBU).
  const leads = useDisposable(() => {
    const top = s.leadLength + 0.8;
    let one;
    if (flat) {
      const L = s.leadLength;
      one = extrudeOutline(
        [
          [-0.35, 0],
          [0.35, 0],
          [0.5, 0.3],
          [0.5, L - 2.8],
          [0.8, L - 2.3],
          [0.8, top],
          [-0.8, top],
          [-0.8, L - 2.3],
          [-0.5, L - 2.8],
          [-0.5, 0.3],
        ],
        0.5,
        0.05,
      );
    } else {
      one = axialLathe(roundedCylinderProfile(0.4, 0, top, 0.14, 4), 16);
    }
    const all = mergeAt(
      one,
      INLINE_MARKS.map((_, i) => placed([(i - 1.5) * s.pitch, 0, 0])),
    );
    one.dispose();
    return all;
  }, [s, flat]);

  const layout = inlineLayout(s, scale);
  const ink = '#d9d9d5';
  const face = usePrintedTop({
    width: s.W,
    height: s.H,
    lines: [{ text: code, size: s.text.code, weight: 700 }],
    ink,
    offset: [0, s.H / 2 - s.text.codeV],
    extra: (ctx, k) => {
      ctx.fillStyle = ink;
      INLINE_MARKS.forEach((mark, i) => {
        const x = (s.W / 2 + (i - 1.5) * s.pitch) * k;
        const y = (s.H - s.text.markV) * k;
        fitText(ctx, mark, x, y, s.pitch * 0.8 * k, (s.text.mark / 0.72) * k, {
          weight: 700,
          family: FONT_SANS,
        });
      });
    },
    extraKey: `${s.name}|marks`,
  });
  const noise = getNoiseTexture();

  return (
    <group>
      <Explode offset={[0, s.H + 4, 0]}>
        <mesh geometry={body} position={[0, s.leadLength, 0]}>
          <Material
            attach="material-0"
            preset="epoxyBlack"
            clip
            roughnessMap={noise}
            roughness={0.6}
            color="#1b1b1d"
            cutColor="#2a2a2c"
          />
          <Material
            attach="material-1"
            preset="epoxyBlack"
            clip
            color="#ffffff"
            map={face.map}
            roughness={1}
            roughnessMap={face.roughnessMap}
            bumpMap={face.bumpMap}
            bumpScale={0.5}
            specularIntensity={0.55}
            cutColor="#2a2a2c"
          />
        </mesh>
        <Anchor name="body" position={[s.W / 2 - 2, s.leadLength + s.H - 1, s.T / 2]} />
      </Explode>

      {/* Lead frame in the middle plane, chips facing the front. */}
      <group position={[0, s.leadLength, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <BridgeInside layout={layout} />
      </group>

      <mesh geometry={leads}>
        <Material preset="tin" roughness={flat ? 0.42 : 0.3} />
      </mesh>
    </group>
  );
}

function dbLayout(scale: number): InsideLayout {
  const e = DB.W / 2 - 0.05;
  const f = 0.5; // half width of the fingers
  const px = DB.pitch / 2;
  const dieTop = DB.frameT / 2 + 0.04 + DB.dieT;
  const rects: Rect[] = [
    [-3.6, 0.3, -0.3, 2.7], // + pad (front left): D1 and D3
    [-px - f, 2.7, -px + f, e],
    [0.3, 0.3, 3.6, 2.7], // ~ pad (front right): D2
    [px - f, 2.7, px + f, e],
    [0.3, -2.7, 3.6, -0.3], // − pad (back right): clip landings
    [px - f, -e, px + f, -2.7],
    [-3.6, -2.7, -0.3, -0.3], // ~ pad (back left): D4
    [-px - f, -e, -px + f, -2.7],
  ];
  return {
    frameT: DB.frameT,
    die: DB.die * scale,
    dieT: DB.dieT,
    clip: DB.clip,
    plates: rects.map(rectOutline),
    // D1 (+ ← ~ front), D3 (+ ← ~ back), D2 (~ front ← −), D4 (~ back ← −).
    dies: [
      [-1.05, 1.8],
      [-2.5, 1.0],
      [2.5, 1.0],
      [-1.05, -1.8],
    ],
    lands: [
      [1.35, 1.8],
      [-2.5, -1.35],
      [2.5, -1.35],
      [1.35, -1.8],
    ],
    anchors: {
      dies: [-1.05, dieTop + 0.15, 1.8],
      clips: [0.15, dieTop + DB.clip.arch + DB.clip.t, 1.8],
      frame: [3.3, DB.frameT / 2, -2.4],
    },
  };
}

function DipBridge({ code, scale }: { code: string; scale: number }) {
  const body = useDisposable(
    () =>
      moldedBlock({
        width: DB.L,
        depth: DB.W,
        height: DB.H,
        corner: 0.3,
        fillet: 0.3,
        bottomFillet: 0.25,
        draft: 0.08,
        parting: DB.parting,
      }),
    [],
  );
  const leads = useDisposable(
    () =>
      mergeAll(
        ([1, -1] as const).map((side) =>
          dipLeadRow({
            xs: [-DB.pitch / 2, DB.pitch / 2],
            side,
            edge: DB.W / 2 - 0.05,
            row: DB.row,
            frameY: DB_FRAME_Y,
            seat: DB.pinL,
            thickness: DB.leadT,
            shoulder: DB.shoulder,
            pin: DB.pin,
          }),
        ),
      ),
    [],
  );

  const layout = dbLayout(scale);
  const ink = '#d9d9d5';
  const top = usePrintedTop({
    width: DB.L,
    height: DB.W,
    lines: [{ text: code, size: 1.15, weight: 700 }],
    ink,
    extra: (ctx, k) => {
      ctx.fillStyle = ink;
      for (const pin of DB_PINS) {
        const x = (DB.L / 2 + pin.x) * k;
        const y = (DB.W / 2 + pin.z * (DB.W / 2 - 0.95)) * k;
        fitText(ctx, pin.mark, x, y, 1.6 * k, (1.0 / 0.72) * k, {
          weight: 700,
          family: FONT_SANS,
        });
      }
    },
    extraKey: 'db|marks',
  });
  const noise = getNoiseTexture();

  return (
    <group>
      <Explode offset={[0, DB.H * 2.2 + 2, 0]}>
        <mesh geometry={body} position={[0, DB_BODY_Y, 0]}>
          <Material
            attach="material-0"
            preset="epoxyBlack"
            clip
            roughnessMap={noise}
            roughness={0.6}
            color="#1b1b1d"
            cutColor="#2a2a2c"
          />
          <Material
            attach="material-1"
            preset="epoxyBlack"
            clip
            color="#ffffff"
            map={top.map}
            roughness={1}
            roughnessMap={top.roughnessMap}
            bumpMap={top.bumpMap}
            bumpScale={0.6}
            specularIntensity={0.55}
            cutColor="#2a2a2c"
          />
        </mesh>
        <Anchor name="body" position={[DB.L / 2 - 1.2, DB_BODY_Y + DB.H, -1.5]} />
      </Explode>

      <group position={[0, DB_FRAME_Y, 0]}>
        <BridgeInside layout={layout} />
      </group>

      <mesh geometry={leads}>
        <Material preset="tin" roughness={0.35} />
      </mesh>
    </group>
  );
}
