/**
 * Linear bench power supply, 0–30 V / 0–5 A, with two 4-digit LED displays
 * (voltage in red, current in green), coarse and fine knobs for voltage and
 * current limit, CV/CC indicator LEDs, a lit power rocker and three output
 * binding posts (+ red, − black, earth green).
 *
 * Real sizes: 0–30 V / 0–5 A linear supplies measure about
 * 260 × 160 × 110–130 mm (depth × height × width) and weigh 6–8 kg, most of
 * it the mains transformer. Modelled as 120 × 160 × 260 mm.
 *
 * Inside (cutaway and exploded view): EI transformer at the back, bridge
 * rectifier, two filter capacitors, the pass transistors on a finned
 * heatsink, the control board, and the IEC inlet with the 127/220 V
 * selector on the rear panel.
 */
import { useMemo, useRef } from 'react';
import { DoubleSide, ExtrudeGeometry, Shape, type Group } from 'three';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { axialLathe } from '../shapes/geometry';
import { useDisposable, Wire } from '../shapes/Wire';
import type { PartMeta, Vec3 } from '../types';
import { drawLedDisplay } from './_display';
import {
  AssembledOnly,
  BindingPost,
  Decal,
  decalGeometry,
  Knob,
  PanelLed,
  roundedSlab,
  RubberFoot,
  smooth,
  useSpring,
  type HoleSpec,
} from './_kit';

export type SupplyMode = 'CV' | 'CC';

export interface BenchPowerSupplyProps {
  /** Output voltage shown on the red display (V, 0–30). */
  voltage?: number;
  /** Output current shown on the green display (A, 0–5). */
  current?: number;
  on?: boolean;
  /** Which limit is acting: constant voltage or constant current. */
  mode?: SupplyMode;
}

const V_MAX = 30;
const A_MAX = 5;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function br(value: number, decimals: number) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Current limit the knob is set to: the load current in CC, some margin above it in CV. */
function currentLimit(current: number, mode: SupplyMode) {
  return mode === 'CC' ? current : clamp(Math.max(current * 2, 1), 0, A_MAX);
}

export const meta: PartMeta = {
  id: 'bench-power-supply',
  label: 'Fonte de bancada',
  category: 'instrumentos',
  summary:
    'Fonte de alimentação linear de bancada (0–30 V, 0–5 A) com mostradores de tensão e corrente, ajustes grosso e fino, LEDs CV/CC e bornes de saída.',
  defaults: { voltage: 12, current: 0.25, on: true, mode: 'CV' },
  controls: {
    voltage: { kind: 'number', label: 'Tensão de saída', min: 0, max: V_MAX, step: 0.1, unit: 'V' },
    current: {
      kind: 'number',
      label: 'Corrente na carga',
      min: 0,
      max: A_MAX,
      step: 0.01,
      unit: 'A',
    },
    on: { kind: 'toggle', label: 'Ligada' },
    mode: {
      kind: 'select',
      label: 'Modo',
      options: [
        { value: 'CV', label: 'CV: tensão constante' },
        { value: 'CC', label: 'CC: corrente constante (limitando)' },
      ],
    },
  },
  annotations: [
    { at: [-28, 138, 131], text: 'Mostrador de tensão (V)', exploded: false },
    { at: [28, 138, 131], text: 'Mostrador de corrente (A)', exploded: false },
    { at: [-28, 102, 144], text: 'Ajuste de tensão: grosso e fino', exploded: false },
    { at: [28, 102, 144], text: 'Limite de corrente', exploded: false },
    { at: [0, 99, 132], text: 'LEDs CV e CC: qual limite está agindo', exploded: false },
    { at: [22, 30, 150], text: 'Bornes: + vermelho, − preto, terra verde', exploded: false },
    { at: [-36, 30, 136], text: 'Chave liga/desliga', exploded: false },
    {
      at: [0, 0, 0],
      text: 'Transformador: abaixa a tensão da rede',
      anchor: 'trafo',
      exploded: true,
    },
    {
      at: [0, 0, 0],
      text: 'Ponte retificadora: CA vira CC pulsante',
      anchor: 'ponte',
      exploded: true,
    },
    { at: [0, 0, 0], text: 'Capacitores de filtro', anchor: 'filtro', exploded: true },
    {
      at: [0, 0, 0],
      text: 'Transistores de passagem no dissipador',
      anchor: 'passagem',
      exploded: true,
    },
    {
      at: [0, 0, 0],
      text: 'Entrada da rede e seletor 127/220 V',
      anchor: 'entrada',
      exploded: true,
    },
  ],
  explode: true,
  cutaway: true,
  // Cut the cover lengthwise, removing the side that faces the camera.
  cut: { normal: [-1, 0, 0], through: [0, 0, 0] },
  animated: false,
  describe: (p) => {
    const v = clamp(Number(p.voltage) || 0, 0, V_MAX);
    const a = clamp(Number(p.current) || 0, 0, A_MAX);
    const mode: SupplyMode = p.mode === 'CC' ? 'CC' : 'CV';
    if (!p.on)
      return 'Fonte de bancada linear desligada: os mostradores estão apagados e não há tensão nos bornes de saída.';
    const power = `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v * a)} W`;
    if (mode === 'CV')
      return `Fonte de bancada linear ligada em modo CV (tensão constante): mantém ${br(v, 2)} V entre os bornes vermelho (+) e preto (−), e a carga puxa ${br(a, 3)} A, abaixo do limite de corrente ajustado. Potência entregue: ${power}. O LED CV está aceso.`;
    return `Fonte de bancada linear ligada em modo CC (corrente constante): a carga chegou ao limite de ${br(a, 3)} A, e a fonte baixou a tensão para ${br(v, 2)} V para não passar disso. Potência entregue: ${power}. O LED CC aceso avisa que a corrente está sendo limitada.`;
  },
  view: [0.78, 0.46, 1.08],
};

// ---------------------------------------------------------------------------
// Layout (mm): front panel face at z = 130, feet on y = 0.
// ---------------------------------------------------------------------------

const W = 120;
const H = 160;
const D = 260;
const FEET = 8.5;
const SHEET = 1.2;
const FRONT = D / 2;
const BEZEL_T = 10;
const PANEL_IN = FRONT - BEZEL_T;
const REAR = -D / 2;
const REAR_T = 2;
const FLOOR = FEET + SHEET;
const PANEL_H = H - FEET;
const PANEL_CY = FEET + PANEL_H / 2;

const DISPLAY = { y: 138, w: 46, h: 16, window: { w: 48, h: 18 } };
const DISPLAY_X = { v: -28, a: 28 };
const KNOB = { coarseY: 102, fineY: 74, coarseR: 10, fineR: 7 };
const LED_Y = { cv: 106, cc: 92 };
const OUT_Y = 30;
const POSTS = { neg: 0, gnd: 22, pos: 44 };
const ROCKER = { x: -36, y: OUT_Y };

const PCB = { y: FLOOR + 8, t: 1.6, w: 108, z0: -40, z1: 95 };
const PCB_TOP = PCB.y + PCB.t / 2;
const PCB_CZ = (PCB.z0 + PCB.z1) / 2;
const PCB_D = PCB.z1 - PCB.z0;

const TRAFO = { z: -80, stack: 40, w: 86, h: 72, leg: 14 };
const HEATSINK = { x0: -48, x1: -1, z0: -36, z1: 20, h: 58 };
const CAPS: Vec3[] = [
  [34, PCB_TOP, 72],
  [34, PCB_TOP, 38],
];
const BRIDGE: Vec3 = [-30, PCB_TOP, 78];
const TRANSISTORS = [-22, 6];
const IEC: Vec3 = [32, 112, REAR + REAR_T];
const SELECTOR: Vec3 = [-30, 116, REAR + REAR_T];

const knobAngle = (fraction: number) => ((-135 + 270 * clamp(fraction, 0, 1)) * Math.PI) / 180;

// ---------------------------------------------------------------------------
// Front panel print
// ---------------------------------------------------------------------------

const PX = 8;
const px = (x: number) => (x + W / 2) * PX;
const py = (y: number) => (H - y) * PX;

function drawGround(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const s = size * PX;
  ctx.lineWidth = s * 0.12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px(x), py(y) - s * 0.55);
  ctx.lineTo(px(x), py(y) - s * 0.05);
  for (const [k, half] of [
    [0, 0.5],
    [1, 0.32],
    [2, 0.14],
  ] as const) {
    const yy = py(y) - s * 0.05 + k * s * 0.22;
    ctx.moveTo(px(x) - half * s, yy);
    ctx.lineTo(px(x) + half * s, yy);
  }
  ctx.stroke();
}

function drawPanel(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#26282c';
  ctx.fillRect(0, 0, w, h);
  const text = (
    str: string,
    x: number,
    y: number,
    size: number,
    color = '#d7dbe0',
    weight = 700,
    align: CanvasTextAlign = 'center',
  ) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size * PX}px ${FONT_SANS}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, px(x), py(y));
  };

  text('FONTE DE ALIMENTAÇÃO  ·  0–30 V  0–5 A', 0, 154.2, 2.9, '#eef0f2', 800);

  // Display surrounds.
  ctx.strokeStyle = '#646b74';
  ctx.lineWidth = 0.35 * PX;
  for (const x of [DISPLAY_X.v, DISPLAY_X.a]) {
    ctx.beginPath();
    ctx.roundRect(px(x - 26), py(DISPLAY.y + 11.5), 52 * PX, 23 * PX, 2.2 * PX);
    ctx.stroke();
  }
  text('TENSÃO (V)', DISPLAY_X.v, 123.6, 2.7, '#ff8a7a');
  text('CORRENTE (A)', DISPLAY_X.a, 123.6, 2.7, '#8af5a6');

  // Knob scales.
  ctx.strokeStyle = '#c3c8ce';
  for (const [x, max] of [
    [DISPLAY_X.v, '30'],
    [DISPLAY_X.a, '5'],
  ] as const) {
    const r = KNOB.coarseR;
    for (let i = 0; i <= 10; i++) {
      const a = knobAngle(i / 10);
      const long = i % 5 === 0;
      ctx.lineWidth = (long ? 0.45 : 0.3) * PX;
      ctx.beginPath();
      ctx.moveTo(px(x + Math.sin(a) * (r + 1.6)), py(KNOB.coarseY + Math.cos(a) * (r + 1.6)));
      ctx.lineTo(
        px(x + Math.sin(a) * (r + (long ? 3.8 : 3))),
        py(KNOB.coarseY + Math.cos(a) * (r + (long ? 3.8 : 3))),
      );
      ctx.stroke();
    }
    const a0 = knobAngle(0);
    const a1 = knobAngle(1);
    text('0', x + Math.sin(a0) * (r + 6.4), KNOB.coarseY + Math.cos(a0) * (r + 6.4), 2.3);
    text(max, x + Math.sin(a1) * (r + 6.6), KNOB.coarseY + Math.cos(a1) * (r + 6.6), 2.3);
    text('GROSSO', x, KNOB.coarseY - r - 6.4, 2.3, '#aab1b9');
    text('FINO', x, KNOB.fineY - KNOB.fineR - 4.6, 2.3, '#aab1b9');
    // Fine scale: a short arc of dots.
    for (let i = 0; i <= 6; i++) {
      const a = knobAngle(i / 6);
      ctx.fillStyle = '#9aa1a9';
      ctx.beginPath();
      ctx.arc(
        px(x + Math.sin(a) * (KNOB.fineR + 2)),
        py(KNOB.fineY + Math.cos(a) * (KNOB.fineR + 2)),
        0.28 * PX,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  text('CV', 0, LED_Y.cv - 5.4, 2.4, '#d7dbe0', 800);
  text('CC', 0, LED_Y.cc - 5.4, 2.4, '#d7dbe0', 800);

  // Output zone.
  ctx.strokeStyle = '#4a5058';
  ctx.lineWidth = 0.3 * PX;
  ctx.beginPath();
  ctx.moveTo(px(-54), py(57));
  ctx.lineTo(px(54), py(57));
  ctx.stroke();
  text('LIGA', ROCKER.x, 45.4, 2.5);
  text('SAÍDA', POSTS.gnd, 51.5, 2.6, '#eef0f2', 800);
  text('−', POSTS.neg, 43.6, 4.4, '#eef0f2', 800);
  text('+', POSTS.pos, 43.6, 4.4, '#ff7b6b', 800);
  ctx.strokeStyle = '#7ee08f';
  drawGround(ctx, POSTS.gnd, 43.6, 4.4);
  text('0–30 V  ·  5 A máx.', POSTS.gnd, 15.5, 2.2, '#9aa1a9', 600);
}

// ---------------------------------------------------------------------------
// Main board print (top view: canvas top = rear)
// ---------------------------------------------------------------------------

const PXB = 6;
const bx = (x: number) => (x + PCB.w / 2) * PXB;
const bz = (z: number) => (z - PCB.z0) * PXB;

function drawBoard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#1d5e37';
  ctx.fillRect(0, 0, w, h);
  // Wide power traces: terminal block → bridge → capacitors → transistors.
  ctx.strokeStyle = '#2a7a49';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const trace = (pts: [number, number][], width: number) => {
    ctx.lineWidth = width * PXB;
    ctx.beginPath();
    pts.forEach(([x, z], i) => (i ? ctx.lineTo(bx(x), bz(z)) : ctx.moveTo(bx(x), bz(z))));
    ctx.stroke();
  };
  trace(
    [
      [36, -25],
      [46, -10],
      [46, 92],
      [-30, 92],
      [-30, 78],
    ],
    3,
  );
  trace(
    [
      [-30, 78],
      [-10, 60],
      [34, 55],
    ],
    3.4,
  );
  trace(
    [
      [34, 55],
      [12, 20],
      [4, -8],
    ],
    3,
  );
  trace(
    [
      [4, -8],
      [4, 90],
      [44, 94],
    ],
    2.4,
  );
  // Signal traces.
  ctx.lineWidth = 0.6 * PXB;
  for (let i = 0; i < 9; i++) {
    trace(
      [
        [-40 + i * 4, 30],
        [-40 + i * 4, 46 + (i % 3) * 3],
        [-26 + i * 3, 62],
      ],
      0.6,
    );
  }
  // Pads.
  ctx.fillStyle = '#c9c4b5';
  for (let i = 0; i < 40; i++) {
    const x = -48 + ((i * 37) % 96);
    const z = -30 + ((i * 53) % 120);
    ctx.beginPath();
    ctx.arc(bx(x), bz(z), 0.7 * PXB, 0, Math.PI * 2);
    ctx.fill();
  }
  // Silkscreen outlines and designators.
  ctx.strokeStyle = '#f2f2ea';
  ctx.fillStyle = '#f2f2ea';
  ctx.lineWidth = 0.3 * PXB;
  ctx.font = `600 ${2.4 * PXB}px ${FONT_SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [x, , z] of CAPS) {
    ctx.beginPath();
    ctx.arc(bx(x), bz(z), 15.6 * PXB, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillText('C1', bx(14), bz(72));
  ctx.fillText('C2', bx(14), bz(38));
  ctx.fillText('BR1', bx(-30), bz(62));
  ctx.fillText('U1', bx(-28), bz(34));
  ctx.fillText('U2', bx(-14), bz(34));
  ctx.fillText('K1', bx(-2), bz(92));
  ctx.fillText('J1  ~ 24 V', bx(36), bz(-15));
  ctx.fillText('R SHUNT', bx(13), bz(66));
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** U-shaped sheet-steel cover (top and sides), extruded front to back. */
function coverGeometry() {
  const half = W / 2;
  const r = 5;
  const t = SHEET;
  const yb = FEET;
  const s = new Shape();
  s.moveTo(-half, yb);
  s.lineTo(-half, H - r);
  s.absarc(-half + r, H - r, r, Math.PI, Math.PI / 2, true);
  s.lineTo(half - r, H);
  s.absarc(half - r, H - r, r, Math.PI / 2, 0, true);
  s.lineTo(half, yb);
  s.lineTo(half - t, yb);
  s.lineTo(half - t, H - r);
  s.absarc(half - r, H - r, r - t, 0, Math.PI / 2, false);
  s.lineTo(-half + r, H - t);
  s.absarc(-half + r, H - r, r - t, Math.PI / 2, Math.PI, false);
  s.lineTo(-half + t, yb);
  s.closePath();
  const length = PANEL_IN - (REAR + REAR_T);
  const g = new ExtrudeGeometry(s, { depth: length, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, REAR + REAR_T);
  return smooth(g);
}

function drawVents(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#121315';
  const cols = 9;
  const rows = 4;
  const sw = w / cols;
  const sh = h / rows;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      ctx.beginPath();
      ctx.roundRect(c * sw + sw * 0.3, r * sh + sh * 0.12, sw * 0.4, sh * 0.76, sw * 0.2);
      ctx.fill();
    }
  }
}

function Rocker({ on }: { on: boolean }) {
  const frame = useDisposable(
    () => roundedSlab({ width: 16, height: 22, depth: 3, radius: 1.6, bevel: 0.6 }),
    [],
  );
  const rocker = useDisposable(
    () => roundedSlab({ width: 12.4, height: 18, depth: 5, radius: 1.2, bevel: 0.9 }),
    [],
  );
  const marks = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(w * 0.46, h * 0.1, w * 0.08, h * 0.22);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = w * 0.07;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.78, w * 0.14, 0, Math.PI * 2);
      ctx.stroke();
    },
    'psu-rocker-marks',
    { width: 128, height: 192 },
  );
  const tilt = useRef<Group>(null);
  useSpring(on ? -0.14 : 0.14, (value) => {
    if (tilt.current) tilt.current.rotation.x = value;
  });
  const red = on ? '#e3301f' : '#8c2219';
  return (
    <group position={[ROCKER.x, ROCKER.y, FRONT]}>
      <mesh geometry={frame}>
        <Material preset="absBlack" roughness={0.45} />
      </mesh>
      <group ref={tilt} position={[0, 0, 0.6]}>
        <mesh geometry={rocker} position={[0, 0, -1]}>
          <Material
            preset="absRed"
            color={red}
            roughness={0.3}
            clearcoat={0.6}
            emissive={on ? '#ff2a14' : '#000000'}
            emissiveIntensity={on ? 0.9 : 0}
          />
        </mesh>
        <mesh position={[0, 0, 4.02]}>
          <planeGeometry args={[11, 16.6]} />
          <Material
            color="#ffffff"
            map={marks}
            transparent
            alphaTest={0.5}
            roughness={0.4}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </mesh>
      </group>
    </group>
  );
}

function Display({
  x,
  text,
  color,
  on,
}: {
  x: number;
  text: string;
  color: 'vermelho' | 'verde';
  on: boolean;
}) {
  const map = useCanvasTexture(
    (ctx, w, h) => drawLedDisplay(ctx, w, h, text, 4, color, on),
    `psu-display-${color}-${on ? text : 'off'}`,
    { width: 576, height: 200 },
  );
  return (
    <group position={[x, DISPLAY.y, 0]}>
      {/* LED module filling the window. */}
      <mesh position={[0, 0, PANEL_IN + 3.5]}>
        <boxGeometry args={[DISPLAY.window.w - 0.4, DISPLAY.window.h - 0.4, 7]} />
        <Material preset="absBlack" color="#0b0b0c" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, PANEL_IN + 7.02]}>
        <planeGeometry args={[DISPLAY.w, DISPLAY.h]} />
        <Material
          color="#ffffff"
          map={map}
          emissive="#ffffff"
          emissiveMap={map}
          emissiveIntensity={on ? 2.2 : 0}
          roughness={0.12}
          clearcoat={1}
          clearcoatRoughness={0.04}
        />
      </mesh>
    </group>
  );
}

function FrontPanel({ p }: { p: Required<BenchPowerSupplyProps> }) {
  const noise = getNoiseTexture();
  const holes = useMemo<HoleSpec[]>(
    () =>
      [DISPLAY_X.v, DISPLAY_X.a].map((x) => ({
        kind: 'rect' as const,
        w: DISPLAY.window.w,
        h: DISPLAY.window.h,
        r: 1.4,
        x,
        y: DISPLAY.y - PANEL_CY,
      })),
    [],
  );
  const bezel = useDisposable(() => {
    const g = roundedSlab({
      width: W,
      height: PANEL_H,
      depth: BEZEL_T,
      radius: 6,
      bevel: 2,
      holes,
    });
    g.translate(0, PANEL_CY, PANEL_IN);
    return g;
  }, []);
  const print = useDisposable(() => {
    const g = decalGeometry(W - 4, PANEL_H - 4, 4, holes);
    const pos = g.attributes.position!;
    const uv = g.attributes.uv!;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) + W / 2) / W, (pos.getY(i) + PANEL_CY) / H);
    }
    g.translate(0, PANEL_CY, 0);
    return g;
  }, []);
  const panelMap = useCanvasTexture(drawPanel, 'psu-panel-v1', {
    width: W * PX,
    height: H * PX,
    fonts: [`800 40px ${FONT_SANS}`, `700 40px ${FONT_SANS}`, `600 40px ${FONT_SANS}`],
  });
  const potCan = useDisposable(
    () =>
      axialLathe(
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0.92, 1.06],
          [0, 1.06],
        ],
        28,
      ),
    [],
  );
  const vText = clamp(p.voltage, 0, V_MAX).toFixed(2);
  const aText = clamp(p.current, 0, A_MAX).toFixed(3);
  const limit = currentLimit(clamp(p.current, 0, A_MAX), p.mode);

  return (
    <group>
      <mesh geometry={bezel}>
        <Material preset="absDark" color="#25272b" roughness={0.5} roughnessMap={noise} />
      </mesh>
      <Decal
        geometry={print}
        map={panelMap}
        position={[0, 0, FRONT + 0.02]}
        material={{ roughness: 0.48, roughnessMap: noise }}
      />
      <Display x={DISPLAY_X.v} text={vText} color="vermelho" on={p.on} />
      <Display x={DISPLAY_X.a} text={aText} color="verde" on={p.on} />

      {/* Knobs: coarse (large, metal cap) and fine (small). */}
      <Knob
        radius={KNOB.coarseR}
        height={13}
        ribs={26}
        angle={knobAngle(clamp(p.voltage, 0, V_MAX) / V_MAX)}
        position={[DISPLAY_X.v, KNOB.coarseY, FRONT]}
        color="#1e2023"
        capMetal
        pointerColor="#ff5a46"
      />
      <Knob
        radius={KNOB.fineR}
        height={11}
        ribs={20}
        angle={0}
        position={[DISPLAY_X.v, KNOB.fineY, FRONT]}
        color="#1e2023"
      />
      <Knob
        radius={KNOB.coarseR}
        height={13}
        ribs={26}
        angle={knobAngle(limit / A_MAX)}
        position={[DISPLAY_X.a, KNOB.coarseY, FRONT]}
        color="#1e2023"
        capMetal
        pointerColor="#4fe07a"
      />
      <Knob
        radius={KNOB.fineR}
        height={11}
        ribs={20}
        angle={0}
        position={[DISPLAY_X.a, KNOB.fineY, FRONT]}
        color="#1e2023"
      />

      <PanelLed position={[0, LED_Y.cv, FRONT]} color="#3dff6a" lit={p.on && p.mode === 'CV'} />
      <PanelLed position={[0, LED_Y.cc, FRONT]} color="#ff3a22" lit={p.on && p.mode === 'CC'} />

      <BindingPost color="preto" position={[POSTS.neg, OUT_Y, FRONT]} />
      <BindingPost color="verde" position={[POSTS.gnd, OUT_Y, FRONT]} />
      <BindingPost color="vermelho" position={[POSTS.pos, OUT_Y, FRONT]} />
      <Rocker on={p.on} />

      {/* Behind the panel: display board, potentiometers, post studs. */}
      <mesh position={[0, DISPLAY.y, PANEL_IN - 0.8]}>
        <boxGeometry args={[W - 10, 30, 1.6]} />
        <Material preset="solderMask" color="#1d5e37" roughness={0.45} />
      </mesh>
      {[DISPLAY_X.v, DISPLAY_X.a].flatMap((x) =>
        (
          [
            [KNOB.coarseY, 8.5],
            [KNOB.fineY, 6.2],
          ] as const
        ).map(([y, r]) => (
          <group key={`${x}${y}`} position={[x, y, PANEL_IN]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh geometry={potCan} scale={[r, 8, r]}>
              <Material preset="steel" color="#b9bcc0" roughness={0.35} />
            </mesh>
            {[-1, 0, 1].map((k) => (
              <mesh key={k} position={[k * r * 0.55, 1, r + 2]}>
                <boxGeometry args={[1.2, 0.4, 4]} />
                <Material preset="tin" />
              </mesh>
            ))}
          </group>
        )),
      )}
      {[POSTS.neg, POSTS.gnd, POSTS.pos].map((x) => (
        <group key={x} position={[x, OUT_Y, PANEL_IN]}>
          <mesh position={[0, 0, -7]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[2.5, 2.5, 14, 16]} />
            <Material preset="brass" roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, -2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[4.6, 4.6, 3, 6]} />
            <Material preset="nickel" roughness={0.3} />
          </mesh>
        </group>
      ))}
      <mesh position={[ROCKER.x, ROCKER.y, PANEL_IN - 9]}>
        <boxGeometry args={[13, 19, 18]} />
        <Material preset="absBlack" roughness={0.5} />
      </mesh>
    </group>
  );
}

function Transformer() {
  const stripesU = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#8d9196';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#5d6166';
      for (let i = 0; i < 80; i++) ctx.fillRect((i * w) / 80, 0, w / 220, h);
    },
    'psu-lam-u',
    { width: 512, height: 64 },
  );
  const stripesV = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#8d9196';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#5d6166';
      for (let i = 0; i < 80; i++) ctx.fillRect(0, (i * h) / 80, w, h / 220);
    },
    'psu-lam-v',
    { width: 64, height: 512 },
  );
  const coil = useDisposable(() => {
    // Turns go around the vertical centre leg: rounded corners seen from above.
    const g = roundedSlab({ width: 56, height: 66, depth: 44, radius: 9, bevel: 2.5 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -22, 0);
    return g;
  }, []);
  const { stack, w, h, leg } = TRAFO;
  const steel = (key: string) => (
    <>
      <Material attach="material-0" preset="siliconSteel" map={stripesU} key={`${key}0`} />
      <Material attach="material-1" preset="siliconSteel" map={stripesU} key={`${key}1`} />
      <Material attach="material-2" preset="siliconSteel" map={stripesV} key={`${key}2`} />
      <Material attach="material-3" preset="siliconSteel" map={stripesV} key={`${key}3`} />
      <Material attach="material-4" preset="siliconSteel" color="#7d8187" key={`${key}4`} />
      <Material attach="material-5" preset="siliconSteel" color="#7d8187" key={`${key}5`} />
    </>
  );
  return (
    <group position={[0, FLOOR, TRAFO.z]}>
      {/* Laminated E-I core: yokes and outer legs (the centre leg hides in the coil). */}
      {[leg / 2, h - leg / 2].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[w, leg, stack]} />
          {steel(`y${y}`)}
        </mesh>
      ))}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (w / 2 - leg / 2), h / 2, 0]}>
          <boxGeometry args={[leg, h - 2 * leg, stack]} />
          {steel(`l${sx}`)}
        </mesh>
      ))}
      {/* Winding wrapped in polyester tape. */}
      <mesh geometry={coil} position={[0, h / 2, 0]}>
        <Material color="#d8b443" roughness={0.55} clearcoat={0.3} />
      </mesh>
      {/* Clamping frames with mounting feet. */}
      {[-1, 1].flatMap((sz) =>
        [leg / 2, h - leg / 2].map((y) => (
          <mesh key={`${sz}${y}`} position={[0, y, sz * (stack / 2 + 0.8)]}>
            <boxGeometry args={[w + 2, leg, 1.6]} />
            <Material preset="zinc" roughness={0.4} />
          </mesh>
        )),
      )}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * (w / 2 + 6), 0.8, 0]}>
          <mesh>
            <boxGeometry args={[12, 1.6, stack + 3.2]} />
            <Material preset="zinc" roughness={0.4} />
          </mesh>
          {[-1, 1].map((sz) => (
            <mesh key={sz} position={[0, 2, sz * 13]}>
              <cylinderGeometry args={[3.4, 3.4, 2.6, 6]} />
              <Material preset="steel" roughness={0.3} />
            </mesh>
          ))}
        </group>
      ))}
      <Anchor name="trafo" position={[0, h + 2, 0]} />
    </group>
  );
}

function Capacitor({ position }: { position: Vec3 }) {
  const body = useDisposable(
    () =>
      axialLathe(
        [
          [0, 0],
          [15, 0],
          [15, 47.5],
          [14.3, 49.2],
          [12.6, 49.8],
          [0, 49.8],
        ],
        40,
      ),
    [],
  );
  return (
    <group position={position}>
      <mesh geometry={body}>
        <Material preset="sleeve" color="#1f2d66" roughness={0.38} clearcoat={0.5} />
      </mesh>
      {/* Negative stripe. */}
      <mesh position={[-14.6, 25, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[1.2, 46, 7]} />
        <Material preset="sleeve" color="#c9cfdc" roughness={0.4} />
      </mesh>
      <mesh position={[0, 49.85, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[12.6, 36]} />
        <Material preset="aluminum" roughness={0.35} />
      </mesh>
      {[0, Math.PI / 2].map((a) => (
        <mesh key={a} position={[0, 49.9, 0]} rotation={[0, a, 0]}>
          <boxGeometry args={[16, 0.2, 0.8]} />
          <Material preset="aluminum" color="#6d7177" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Heatsink() {
  const { x0, x1, z0, z1, h } = HEATSINK;
  const len = z1 - z0;
  const fins = 9;
  return (
    <group position={[0, PCB_TOP, 0]}>
      <mesh position={[x1 - 1.6, h / 2, (z0 + z1) / 2]}>
        <boxGeometry args={[3.2, h, len]} />
        <Material preset="aluminum" color="#c9ccd0" roughness={0.42} />
      </mesh>
      <mesh position={[(x0 + x1) / 2, 1.5, (z0 + z1) / 2]}>
        <boxGeometry args={[x1 - x0, 3, len]} />
        <Material preset="aluminum" color="#c9ccd0" roughness={0.42} />
      </mesh>
      {Array.from({ length: fins }, (_, i) => (
        <mesh
          key={i}
          position={[(x0 + x1 - 3.2) / 2, h / 2, z0 + 1 + (i * (len - 2)) / (fins - 1)]}
        >
          <boxGeometry args={[x1 - x0 - 3.2, h, 1.6]} />
          <Material preset="aluminum" color="#c3c6ca" roughness={0.45} />
        </mesh>
      ))}
      {/* Pass transistors (TO-247) bolted to the heatsink. */}
      {TRANSISTORS.map((z, i) => (
        <group key={z} position={[x1, 14, z]}>
          <mesh position={[0.75, 10.5, 0]}>
            <boxGeometry args={[1.5, 21, 15.6]} />
            <Material preset="nickel" roughness={0.3} />
          </mesh>
          <mesh position={[3.25, 10.25, 0]}>
            <boxGeometry args={[3.5, 20.5, 15.6]} />
            <Material preset="epoxyBlack" roughness={0.5} />
          </mesh>
          <mesh position={[5.6, 15, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[3.2, 3.2, 1.6, 16]} />
            <Material preset="steel" roughness={0.3} />
          </mesh>
          {[-5.45, 0, 5.45].map((dz) => (
            <mesh key={dz} position={[3.2, -7, dz]}>
              <boxGeometry args={[0.6, 14, 1.2]} />
              <Material preset="tin" />
            </mesh>
          ))}
          {i === 0 && <Anchor name="passagem" position={[5.2, 12, 0]} />}
        </group>
      ))}
    </group>
  );
}

function MainBoard() {
  const map = useCanvasTexture(drawBoard, 'psu-board-v1', {
    width: PCB.w * PXB,
    height: PCB_D * PXB,
    fonts: [`600 20px ${FONT_SANS}`],
  });
  return (
    <group>
      <mesh position={[0, PCB.y, PCB_CZ]}>
        <boxGeometry args={[PCB.w, PCB.t, PCB_D]} />
        <Material preset="solderMask" color="#1d5e37" roughness={0.45} />
      </mesh>
      <mesh position={[0, PCB_TOP + 0.01, PCB_CZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PCB.w, PCB_D]} />
        <Material color="#ffffff" map={map} roughness={0.4} clearcoat={0.3} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [PCB.z0 + 5, PCB.z1 - 5].map((z) => (
          <mesh key={`${sx}${z}`} position={[sx * (PCB.w / 2 - 5), FLOOR + 3.6, z]}>
            <cylinderGeometry args={[2.5, 2.5, 7.2, 6]} />
            <Material preset="brass" roughness={0.35} />
          </mesh>
        )),
      )}
      {CAPS.map((c, i) => (
        <group key={i}>
          <Capacitor position={c} />
          {i === 0 && <Anchor name="filtro" position={[c[0], c[1] + 52, c[2]]} />}
        </group>
      ))}
      {/* Bridge rectifier (KBPC, 28,6 mm square). */}
      <group position={BRIDGE}>
        <mesh position={[0, 5, 0]}>
          <boxGeometry args={[28.6, 10, 28.6]} />
          <Material preset="epoxyBlack" roughness={0.55} />
        </mesh>
        <mesh position={[0, 10.2, 0]}>
          <cylinderGeometry args={[3, 3, 1, 6]} />
          <Material preset="steel" roughness={0.3} />
        </mesh>
        {[
          [-10, -10],
          [10, -10],
          [-10, 10],
          [10, 10],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x!, 13, z!]}>
            <boxGeometry args={[6.3, 7, 0.8]} />
            <Material preset="tin" />
          </mesh>
        ))}
        <Anchor name="ponte" position={[0, 12, 0]} />
      </group>
      {/* Relay for the transformer taps, op-amps, trimmer, shunt, terminal block. */}
      <mesh position={[-2, PCB_TOP + 7.75, 86]}>
        <boxGeometry args={[19, 15.5, 15]} />
        <Material preset="pbtBlue" color="#2556c4" roughness={0.45} />
      </mesh>
      {[-28, -14].map((x) => (
        <mesh key={x} position={[x, PCB_TOP + 1.9, 40]}>
          <boxGeometry args={[6.4, 3.3, 9.6]} />
          <Material preset="epoxyBlack" />
        </mesh>
      ))}
      <mesh position={[0, PCB_TOP + 2.5, 40]}>
        <boxGeometry args={[6.5, 5, 6.5]} />
        <Material preset="pbtBlue" color="#2f62d6" roughness={0.5} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[-40 + i * 6, PCB_TOP + 1.3, 54]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.2, 1.2, 6.3, 12]} />
          <Material preset="carbonFilm" color={i % 2 ? '#c8b48c' : '#7fa7c8'} roughness={0.5} />
        </mesh>
      ))}
      <Wire
        points={[
          [8, PCB_TOP, 60],
          [8, PCB_TOP + 7, 60],
          [18, PCB_TOP + 7, 60],
          [18, PCB_TOP, 60],
        ]}
        radius={0.9}
        bend={2}
        material={{ preset: 'copper', roughness: 0.35 }}
      />
      <group position={[36, PCB_TOP, -25]}>
        <mesh position={[0, 5, 0]}>
          <boxGeometry args={[15, 10, 8]} />
          <Material preset="pbtGreen" color="#2e9a4c" roughness={0.5} />
        </mesh>
        {[-5, 0, 5].map((x) => (
          <mesh key={x} position={[x, 10.1, -1]}>
            <cylinderGeometry args={[1.6, 1.6, 0.6, 12]} />
            <Material preset="nickel" roughness={0.3} />
          </mesh>
        ))}
      </group>
      <Heatsink />
    </group>
  );
}

function RearPanel() {
  const plate = useDisposable(() => {
    const g = roundedSlab({ width: W, height: PANEL_H, depth: REAR_T, radius: 4, bevel: 0.6 });
    g.translate(0, PANEL_CY, REAR);
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={plate}>
        <Material preset="brushedAluminum" roughness={0.38} />
      </mesh>
      {/* IEC inlet with fuse drawer: body inside, frame outside. */}
      <group position={IEC}>
        <mesh position={[0, 0, 11]}>
          <boxGeometry args={[27, 32, 22]} />
          <Material preset="absBlack" roughness={0.5} />
        </mesh>
        {[-7, 0, 7].map((x) => (
          <mesh key={x} position={[x, x === 0 ? 6 : -4, 25]}>
            <boxGeometry args={[4.8, 0.8, 6]} />
            <Material preset="brass" roughness={0.3} />
          </mesh>
        ))}
        <mesh position={[0, 0, -REAR_T - 1.2]}>
          <boxGeometry args={[31, 37, 2.4]} />
          <Material preset="absBlack" roughness={0.45} />
        </mesh>
        <Anchor name="entrada" position={[-4, 18, 12]} />
      </group>
      {/* 127/220 V slide selector. */}
      <group position={SELECTOR}>
        <mesh position={[0, 0, 7]}>
          <boxGeometry args={[12, 22, 14]} />
          <Material preset="absBlack" roughness={0.5} />
        </mesh>
        <mesh position={[0, 3, -REAR_T - 1]}>
          <boxGeometry args={[5, 6, 2]} />
          <Material preset="absRed" roughness={0.45} />
        </mesh>
      </group>
    </group>
  );
}

/** Wires between the boards, the panels and the transformer (hidden in the exploded view). */
function Wiring() {
  const ins = (color: string) => ({ preset: 'pvc' as const, color, roughness: 0.5 });
  const lift = PCB_TOP;
  return (
    <AssembledOnly>
      {/* Mains: inlet → front switch (brown phase, blue neutral), along the right wall. */}
      {(
        [
          ['#6b3a1f', 0],
          ['#2f6fd6', 3],
        ] as const
      ).map(([color, d]) => (
        <Wire
          key={color}
          smooth
          radius={1.3}
          points={[
            [IEC[0] - 4 + d, IEC[1] - 6, IEC[2] + 25],
            [44 + d, 100, -66],
            [55 - d * 0.3, 40, -50],
            [55.5 - d * 0.3, 14, 0],
            [55 - d * 0.3, 14, 100],
            [30, 13 + d, 108],
            [ROCKER.x + 2, 14 + d, 110],
            [ROCKER.x + 3 - d, ROCKER.y - 6, PANEL_IN - 18],
          ]}
          material={ins(color)}
        />
      ))}
      {/* Switch → selector (left wall) and selector → primary. */}
      {(
        [
          ['#1a1a1a', 0],
          ['#d22f24', 3],
        ] as const
      ).map(([color, d]) => (
        <Wire
          key={color}
          smooth
          radius={1.1}
          points={[
            [ROCKER.x - 3 + d, ROCKER.y - 8, PANEL_IN - 18],
            [-50, 13 + d, 100],
            [-55.5 + d * 0.3, 13, 40],
            [-55.5 + d * 0.3, 20, -40],
            [-55 + d * 0.3, 100, -100],
            [SELECTOR[0] - 3 + d * 2, SELECTOR[1] - 11, SELECTOR[2] + 15],
          ]}
          material={ins(color)}
        />
      ))}
      {(['#1a1a1a', '#d22f24', '#f2f2f2'] as const).map((color, i) => (
        <Wire
          key={color}
          smooth
          radius={0.8}
          points={[
            [SELECTOR[0] - 3 + i * 3, SELECTOR[1] - 11, SELECTOR[2] + 14],
            [-14 + i * 6, 96, -108],
            [-10 + i * 6, FLOOR + 50, TRAFO.z - 33.5],
          ]}
          material={ins(color)}
        />
      ))}
      {/* Secondary → terminal block on the main board. */}
      {(['#e3801f', '#e8c52a'] as const).map((color, i) => (
        <Wire
          key={color}
          smooth
          radius={1}
          points={[
            [-6 + i * 10, FLOOR + 46, TRAFO.z + 33],
            [14 + i * 6, FLOOR + 50, -40],
            [31 + i * 10, lift + 14, -28],
            [31 + i * 10, lift + 10, -25],
          ]}
          material={ins(color)}
        />
      ))}
      {/* Outputs: board → binding posts, and earth from the chassis. */}
      <Wire
        smooth
        radius={1.3}
        points={[
          [44, lift, 92],
          [46, lift + 8, 100],
          [POSTS.pos, OUT_Y - 2, PANEL_IN - 16],
          [POSTS.pos, OUT_Y, PANEL_IN - 13],
        ]}
        material={ins('#d22f24')}
      />
      <Wire
        smooth
        radius={1.3}
        points={[
          [12, lift, 93],
          [6, lift + 8, 100],
          [POSTS.neg, OUT_Y - 2, PANEL_IN - 16],
          [POSTS.neg, OUT_Y, PANEL_IN - 13],
        ]}
        material={ins('#1a1a1a')}
      />
      <Wire
        smooth
        radius={1.1}
        points={[
          [POSTS.gnd, FLOOR, 106],
          [POSTS.gnd + 1, FLOOR + 6, 108],
          [POSTS.gnd, OUT_Y - 2, PANEL_IN - 16],
          [POSTS.gnd, OUT_Y, PANEL_IN - 13],
        ]}
        material={ins('#3aa35a')}
      />
      {/* Control wires: knobs and displays → main board. */}
      {[-1, 1].flatMap((sx) =>
        (['#d22f24', '#e8c52a', '#f2f2f2', '#1a1a1a'] as const).map((color, i) => (
          <Wire
            key={`${sx}${color}`}
            smooth
            radius={0.45}
            points={[
              [sx * 28 + (i - 1.5) * 1.1, KNOB.fineY - 4, PANEL_IN - 9],
              [sx * 30 + (i - 1.5) * 1.1, 50, PANEL_IN - 14],
              [sx * 22 + (i - 1.5) * 1.1, lift + 6, 100],
              [sx * 20 + (i - 1.5) * 1.1, lift, 93],
            ]}
            material={ins(color)}
          />
        )),
      )}
    </AssembledOnly>
  );
}

// ---------------------------------------------------------------------------
// Part
// ---------------------------------------------------------------------------

export default function BenchPowerSupply(props: BenchPowerSupplyProps) {
  const merged = { ...meta.defaults, ...props };
  const p: Required<BenchPowerSupplyProps> = {
    voltage: Number(merged.voltage) || 0,
    current: Number(merged.current) || 0,
    on: !!merged.on,
    mode: merged.mode === 'CC' ? 'CC' : 'CV',
  };
  const noise = getNoiseTexture();
  const cover = useDisposable(coverGeometry, []);
  const vents = useCanvasTexture(drawVents, 'psu-vents', { width: 512, height: 256 });

  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <RubberFoot key={`${sx}${sz}`} position={[sx * 46, 0, sz * 108]} r={7} h={FEET} />
        )),
      )}

      {/* Chassis floor. */}
      <mesh position={[0, FEET + SHEET / 2, (PANEL_IN + REAR + REAR_T) / 2]}>
        <boxGeometry args={[W - 2 * SHEET, SHEET, PANEL_IN - REAR - REAR_T]} />
        <Material preset="zinc" roughness={0.45} />
      </mesh>

      {/* Cover (cut lengthwise in the cutaway, lifted in the exploded view). */}
      <Explode offset={[0, 135, 0]}>
        <mesh geometry={cover}>
          <Material
            preset="absGray"
            color="#7b7f7a"
            roughness={0.62}
            roughnessMap={noise}
            clip
            cutColor="#6f746f"
          />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh
            key={sx}
            position={[sx * (W / 2 + 0.03), 92, -82]}
            rotation={[0, (sx * Math.PI) / 2, 0]}
          >
            <planeGeometry args={[84, 42]} />
            <Material
              color="#ffffff"
              map={vents}
              transparent
              alphaTest={0.5}
              roughness={0.6}
              clip
              side={DoubleSide}
            />
          </mesh>
        ))}
        <mesh position={[0, H + 0.03, -82]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <planeGeometry args={[84, 70]} />
          <Material color="#ffffff" map={vents} transparent alphaTest={0.5} roughness={0.6} clip />
        </mesh>
      </Explode>

      <Explode offset={[0, 0, 85]}>
        <FrontPanel p={p} />
      </Explode>

      <Explode offset={[0, 0, -75]}>
        <RearPanel />
      </Explode>

      <Explode offset={[0, 45, -45]} delay={0.1}>
        <Transformer />
      </Explode>

      <MainBoard />
      <Wiring />
    </group>
  );
}
