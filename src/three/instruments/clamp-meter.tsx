/**
 * AC clamp meter (alicate amperímetro) with a current-transformer core.
 * Typical sizes: 200–230 × 70–80 × 35–40 mm, jaw opening 30–35 mm (Minipa
 * ET-3200 class, Fluke 323: 207 × 75 × 34 mm, 30 mm jaw). The jaws open with
 * the trigger (`jawOpen`, animated); the LCD and the selector work like the
 * multimeter's.
 *
 * `cable` shows why a clamp meter must hug a single conductor: around one
 * wire it reads the current; around a whole parallel cord the outgoing and
 * returning currents cancel and it reads about zero.
 *
 * Cutaway and exploded view show the laminated iron core inside the jaws
 * and the secondary coil wound on it.
 */
import { useMemo, useRef } from 'react';
import {
  CatmullRomCurve3,
  Curve,
  LineCurve3,
  Quaternion,
  TubeGeometry,
  Vector3,
  type Group,
} from 'three';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { tube } from '../shapes/geometry';
import { useDisposable, Wire } from '../shapes/Wire';
import type { PartMeta, PartProps, Vec3 } from '../types';
import {
  drawBuzzer,
  drawDiode,
  drawFunctionSymbol,
  drawKeyLabel,
  drawMeterLcd,
  type MeterLcdSpec,
} from './_display';
import {
  arcSweep,
  BananaJack,
  BarKnob,
  Decal,
  decalGeometry,
  latheZ,
  normaliseUVs,
  RotatingGroup,
  roundedRectShape,
  roundedSlab,
  useSpring,
  type HoleSpec,
} from './_kit';

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

type Group3 = 'off' | 'aac' | 'vac' | 'vdc' | 'ohm' | 'cont';

interface ClampMode {
  id: string;
  group: Group3;
  range: string;
  unit: string;
  words: string;
}

/** Clockwise from OFF (−120°) to continuity (+120°), 30° apart. */
export const CLAMP_MODES: ClampMode[] = [
  { id: 'off', group: 'off', range: 'OFF', unit: '', words: '' },
  { id: 'A~2', group: 'aac', range: '2', unit: 'A', words: '2 A' },
  { id: 'A~20', group: 'aac', range: '20', unit: 'A', words: '20 A' },
  { id: 'A~200', group: 'aac', range: '200', unit: 'A', words: '200 A' },
  { id: 'A~600', group: 'aac', range: '600', unit: 'A', words: '600 A' },
  { id: 'V~600', group: 'vac', range: '600', unit: 'V', words: '600 V' },
  { id: 'Vdc600', group: 'vdc', range: '600', unit: 'V', words: '600 V' },
  { id: 'ohm2k', group: 'ohm', range: '2k', unit: 'kΩ', words: '2 kΩ' },
  { id: 'continuidade', group: 'cont', range: '', unit: 'Ω', words: '' },
];

const DEG = Math.PI / 180;
const modeAngle = (i: number) => (-120 + 30 * i) * DEG;

const GROUP_COLORS: Record<Group3, string> = {
  off: '#ffffff',
  aac: '#ffd04a',
  vac: '#f2f2ee',
  vdc: '#f2f2ee',
  ohm: '#8fd8a2',
  cont: '#8fd8a2',
};

const GROUP_WORDS: Record<Group3, string> = {
  off: 'desligado (OFF)',
  aac: 'corrente alternada (A~)',
  vac: 'tensão alternada (V~)',
  vdc: 'tensão contínua (V⎓)',
  ohm: 'resistência (Ω)',
  cont: 'continuidade e teste de diodo',
};

function modeIndex(id: string) {
  const i = CLAMP_MODES.findIndex((m) => m.id === id);
  return i < 0 ? 0 : i;
}

// ---------------------------------------------------------------------------
// Dimensions (mm): standing on its base, face towards +Z.
// ---------------------------------------------------------------------------

const BODY = { w: 68, h: 148, d: 36, r: 12 };
const CY = BODY.h / 2;
const FACE_Z = BODY.d / 2;
const COVER_T = 3;
const GUARD = { w: 84, h: 9, d: 42, y: BODY.h };
const JAW = { cx: 0, cy: 184, rIn: 18.5, rOut: 31, depth: 15 };
const R_MID = (JAW.rIn + JAW.rOut) / 2;
/** Where the two jaws meet at the bottom (inside the guard) and at the top. */
const SPLIT_LOW = 250 * DEG;
const SPLIT_TOP = 90 * DEG;
const PIVOT: [number, number] = [-9, 158];
const MAX_OPEN = 0.42;
const LCD = { w: 50, h: 27, y: 120 };
const DISPLAY = { w: 48, h: 23.5 };
const KNOB = { r: 12.5, y: 60 };
const BUTTON = { w: 15, h: 6.6, y: 93, x: 14.5 };
const JACKS = { COM: -12, VΩ: 12 } as const;
const JACK_Y = 18;
const PCB = { w: 60, h: 132, y: 74, z: 1.6, t: 1.6 };

const COVER_HOLES: HoleSpec[] = [
  { kind: 'rect', w: LCD.w, h: LCD.h, r: 2, x: 0, y: LCD.y - CY },
  { kind: 'circle', r: 5, x: 0, y: KNOB.y - CY },
  { kind: 'circle', r: 6.2, x: JACKS.COM, y: JACK_Y - CY },
  { kind: 'circle', r: 6.2, x: JACKS['VΩ'], y: JACK_Y - CY },
  ...[-1, 1].map((side): HoleSpec => ({
    kind: 'rect',
    w: BUTTON.w + 0.8,
    h: BUTTON.h + 0.8,
    r: (BUTTON.h + 0.8) / 2,
    x: side * BUTTON.x,
    y: BUTTON.y - CY,
  })),
];

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export type ClampCable = 'nenhum' | 'um-fio' | 'cabo-paralelo';

export interface ClampMeterProps {
  /** Selector position: `off`, `A~2`, `A~20`, `A~200`, `A~600`, `V~600`, `Vdc600`, `ohm2k`, `continuidade`. */
  mode?: string;
  /** LCD text as the meter shows it: `7.86`, `0.00`, `OL`. */
  reading?: string;
  /** Unit override; empty = unit of the selector position. */
  unit?: string;
  /** 0 = closed, 1 = fully open (animated). */
  jawOpen?: number;
  /** Conductor through the jaws. */
  cable?: ClampCable;
  hold?: boolean;
  backlight?: boolean;
}

function modeOf(p: PartProps) {
  return CLAMP_MODES[modeIndex(String(p.mode))]!;
}

export const meta: PartMeta = {
  id: 'clamp-meter',
  label: 'Alicate amperímetro',
  category: 'instrumentos',
  summary:
    'Alicate amperímetro com garras que abrem, visor LCD e seletor, mostrando por que se abraça um único fio para medir corrente.',
  defaults: {
    mode: 'A~20',
    reading: '7.86',
    unit: '',
    jawOpen: 0,
    cable: 'um-fio',
    hold: false,
    backlight: false,
  },
  controls: {
    mode: {
      kind: 'select',
      label: 'Seletor',
      options: CLAMP_MODES.map((m) => ({
        value: m.id,
        label:
          m.group === 'off'
            ? 'OFF (desligado)'
            : m.group === 'cont'
              ? 'Continuidade / diodo'
              : `${{ aac: 'A~', vac: 'V~', vdc: 'V⎓', ohm: 'Ω' }[m.group as 'aac']} ${m.words}`,
      })),
    },
    reading: { kind: 'text', label: 'Leitura no visor', maxLength: 6 },
    unit: {
      kind: 'select',
      label: 'Unidade no visor',
      options: [
        { value: '', label: 'Automática (pelo seletor)' },
        { value: 'A', label: 'A' },
        { value: 'mA', label: 'mA' },
        { value: 'V', label: 'V' },
        { value: 'Ω', label: 'Ω' },
        { value: 'kΩ', label: 'kΩ' },
      ],
    },
    jawOpen: { kind: 'number', label: 'Abertura das garras', min: 0, max: 1, step: 0.05 },
    cable: {
      kind: 'select',
      label: 'Condutor nas garras',
      options: [
        { value: 'um-fio', label: 'Um fio só (fase)' },
        { value: 'cabo-paralelo', label: 'Cabo paralelo inteiro (fase + neutro)' },
        { value: 'nenhum', label: 'Nenhum' },
      ],
    },
    hold: { kind: 'toggle', label: 'HOLD (congelar leitura)' },
    backlight: { kind: 'toggle', label: 'Luz de fundo' },
  },
  annotations: [
    {
      at: [0, JAW.cy + JAW.rOut - 2, 9],
      text: 'Garras: abrace um único fio',
      exploded: false,
    },
    {
      at: [-43, 128, 4],
      text: 'Gatilho: abre as garras',
      exploded: false,
    },
    {
      at: [GUARD.w / 2 - 6, GUARD.y + GUARD.h / 2, GUARD.d / 2],
      text: 'Barreira: mantenha os dedos abaixo dela',
      exploded: false,
    },
    { at: [-14, LCD.y + 6, FACE_Z], text: 'Visor', exploded: false },
    { at: [8, KNOB.y + 6, FACE_Z + 8], text: 'Seletor de função e escala', exploded: false },
    {
      at: [JACKS['VΩ'], JACK_Y - 7, FACE_Z + 1],
      text: 'Bornes para pontas (tensão e resistência)',
      exploded: false,
    },
    {
      at: [0, 0, 0],
      text: 'Núcleo de ferro laminado: concentra o campo do fio',
      anchor: 'core',
      exploded: true,
    },
    {
      at: [0, 0, 0],
      text: 'Bobina: o campo variável induz nela uma corrente (só CA)',
      anchor: 'coil',
      exploded: true,
    },
    { at: [0, 0, 0], text: 'Placa: mede e mostra a leitura', anchor: 'pcb', exploded: true },
  ],
  explode: true,
  cutaway: true,
  describe: (p) => {
    const m = modeOf(p);
    if (m.group === 'off') return 'Alicate amperímetro desligado, com o seletor em OFF.';
    const unit = String(p.unit || m.unit);
    const reading = String(p.reading).trim();
    const value = /^-?\.?OL$/i.test(reading)
      ? 'OL (acima da escala)'
      : `${reading.replace('.', ',')} ${unit}`;
    const open = Number(p.jawOpen) > 0.05 ? ' Garras abertas.' : '';
    const range =
      m.group === 'cont' ? GROUP_WORDS.cont : `${GROUP_WORDS[m.group]}, escala de ${m.words}`;
    const cable =
      p.cable === 'um-fio'
        ? ' As garras abraçam só o fio fase; o neutro passa por fora.'
        : p.cable === 'cabo-paralelo'
          ? ' As garras abraçam o cabo paralelo inteiro: a corrente que vai pela fase volta pelo neutro, os campos se anulam e a leitura fica perto de zero.'
          : '';
    return `Alicate amperímetro no seletor ${range}. O visor mostra ${value}${p.hold ? ' (HOLD)' : ''}.${cable}${open}`;
  },
  view: [0.62, 0.38, 1.2],
};

// ---------------------------------------------------------------------------
// Printed graphics
// ---------------------------------------------------------------------------

const PX = 8;
const fx = (x: number) => (x + BODY.w / 2) * PX;
const fy = (y: number) => (BODY.h - y) * PX;
const mm = (v: number) => v * PX;

function drawFace(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = '#2a2d32';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#1d1f23';
  ctx.beginPath();
  ctx.roundRect(
    fx(-LCD.w / 2 - 2.2),
    fy(LCD.y + LCD.h / 2 + 2.2),
    mm(LCD.w + 4.4),
    mm(LCD.h + 4.4),
    mm(3),
  );
  ctx.fill();
  ctx.strokeStyle = '#7c838c';
  ctx.lineWidth = mm(0.3);
  ctx.stroke();

  ctx.fillStyle = '#e9e9e4';
  fitText(ctx, 'ALICATE AMPERÍMETRO', fx(0), fy(101.6), mm(50), mm(3), {
    weight: 700,
    family: FONT_SANS,
  });

  // Dial.
  const cx = fx(0);
  const cy = fy(KNOB.y);
  ctx.strokeStyle = '#8b9199';
  ctx.lineWidth = mm(0.3);
  ctx.beginPath();
  ctx.arc(cx, cy, mm(KNOB.r + 2), 0, Math.PI * 2);
  ctx.stroke();
  const at = (r: number, a: number): [number, number] => [
    cx + mm(r) * Math.sin(a),
    cy - mm(r) * Math.cos(a),
  ];
  CLAMP_MODES.forEach((m, i) => {
    const a = modeAngle(i);
    const [dx, dy] = at(KNOB.r + 3.8, a);
    ctx.fillStyle = '#cfd3d8';
    ctx.beginPath();
    ctx.arc(dx, dy, mm(0.5), 0, Math.PI * 2);
    ctx.fill();
    const [lx, ly] = at(KNOB.r + 7.6, a);
    ctx.fillStyle = ctx.strokeStyle = GROUP_COLORS[m.group];
    if (m.group === 'cont') {
      drawDiode(ctx, lx - mm(3.4), ly - mm(1.1), mm(3), mm(2.2));
      drawBuzzer(ctx, lx + mm(0.5), ly - mm(1.3), mm(3), mm(2.6));
      return;
    }
    ctx.font = `700 ${m.group === 'off' ? mm(2.8) : mm(2.6)}px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.range, lx, ly);
    if (m.group === 'vac' || m.group === 'vdc' || m.group === 'ohm') {
      const [sx, sy] = at(KNOB.r + 13.6, a);
      drawFunctionSymbol(
        ctx,
        m.group === 'ohm' ? 'Ω' : 'V',
        m.group === 'ohm' ? null : m.group === 'vac' ? 'ac' : 'dc',
        sx,
        sy,
        mm(3.2),
        GROUP_COLORS[m.group],
      );
    }
  });
  // Current ranges bracket.
  ctx.strokeStyle = GROUP_COLORS.aac;
  ctx.lineWidth = mm(0.45);
  ctx.beginPath();
  ctx.arc(
    cx,
    cy,
    mm(KNOB.r + 11.6),
    modeAngle(1) - Math.PI / 2 - 0.1,
    modeAngle(4) - Math.PI / 2 + 0.1,
  );
  ctx.stroke();
  const [ax, ay] = at(KNOB.r + 15, (modeAngle(1) + modeAngle(4)) / 2);
  drawFunctionSymbol(ctx, 'A', 'ac', ax, ay, mm(3.4), GROUP_COLORS.aac);

  // Jacks.
  for (const [label, x] of Object.entries(JACKS)) {
    ctx.fillStyle = '#f2f2ee';
    ctx.font = `700 ${mm(2.8)}px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, fx(x), fy(JACK_Y + 10.4));
  }
  ctx.fillStyle = '#c9cdd2';
  ctx.font = `600 ${mm(1.7)}px ${FONT_SANS}`;
  ctx.fillText('600V MÁX', fx(JACKS['VΩ']), fy(JACK_Y - 9.6));
  ctx.fillStyle = '#ffd04a';
  const tx = fx(-17);
  const ty = fy(5);
  ctx.beginPath();
  ctx.moveTo(tx, ty - mm(1.7));
  ctx.lineTo(tx + mm(1.9), ty + mm(1.5));
  ctx.lineTo(tx - mm(1.9), ty + mm(1.5));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e9e9e4';
  ctx.font = `700 ${mm(2.3)}px ${FONT_SANS}`;
  ctx.textAlign = 'left';
  ctx.fillText('CAT III 600V', fx(-13.5), ty);
}

const PCB_PX = 7;

function drawPcb(ctx: CanvasRenderingContext2D, W: number, H: number, metal: boolean) {
  const px = (x: number) => (x + PCB.w / 2) * PCB_PX;
  const py = (y: number) => (PCB.y + PCB.h / 2 - y) * PCB_PX;
  const s = (v: number) => v * PCB_PX;
  ctx.fillStyle = metal ? '#000000' : '#1c5a35';
  ctx.fillRect(0, 0, W, H);
  if (!metal) {
    ctx.strokeStyle = '#b9a874';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, W, H);
    ctx.strokeStyle = '#2a7748';
    ctx.lineWidth = s(0.5);
    ctx.lineCap = 'round';
    CLAMP_MODES.forEach((_, i) => {
      const a = modeAngle(i);
      ctx.beginPath();
      ctx.moveTo(px(Math.sin(a) * 12), py(KNOB.y + Math.cos(a) * 12));
      ctx.lineTo(px(Math.sin(a) * 18), py(KNOB.y + Math.cos(a) * 18));
      ctx.lineTo(px(Math.sin(a) * 18), py(KNOB.y + 30));
      ctx.stroke();
    });
    for (const [x0, y0, x1, y1] of [
      [-12, 24, -12, 40],
      [12, 24, 20, 40],
      [6, 140, 6, 100],
      [-20, 100, -20, 80],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(px(x0), py(y0));
      ctx.lineTo(px(x1), py(y1));
      ctx.stroke();
    }
  }
  const gold = metal ? '#ffffff' : '#d6ad57';
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.arc(px(0), py(KNOB.y), s(6.8), 0, Math.PI * 2);
  ctx.arc(px(0), py(KNOB.y), s(4.2), 0, Math.PI * 2, true);
  ctx.fill();
  CLAMP_MODES.forEach((_, i) => {
    const a = modeAngle(i) - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(px(0), py(KNOB.y), s(11.6), a - 0.16, a + 0.16);
    ctx.arc(px(0), py(KNOB.y), s(8.4), a + 0.16, a - 0.16, true);
    ctx.closePath();
    ctx.fill();
  });
  for (const [x, y] of [
    [-20, 30],
    [-16, 30],
    [16, 30],
    [20, 34],
    [-22, 72],
    [22, 70],
    [22, 76],
    [-4, 90],
    [4, 92],
  ] as const) {
    ctx.fillStyle = metal ? '#ffffff' : '#c9ccce';
    ctx.fillRect(px(x - 1.6), py(y + 0.7), s(1), s(1.4));
    ctx.fillRect(px(x + 0.6), py(y + 0.7), s(1), s(1.4));
    if (!metal) {
      ctx.fillStyle = '#151515';
      ctx.fillRect(px(x - 0.75), py(y + 0.62), s(1.5), s(1.24));
    }
  }
  if (metal) return;
  ctx.fillStyle = ctx.strokeStyle = '#eceee8';
  ctx.lineWidth = s(0.18);
  ctx.font = `600 ${s(1.8)}px ${FONT_SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SW1', px(16), py(46));
  ctx.fillText('U1', px(-16), py(97));
  ctx.fillText('L1  TC', px(10), py(137));
  for (const x of Object.values(JACKS)) {
    ctx.beginPath();
    ctx.arc(px(x), py(JACK_Y), s(6.6), 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Part
// ---------------------------------------------------------------------------

export default function ClampMeter(props: ClampMeterProps) {
  const p = { ...meta.defaults, ...props } as Required<ClampMeterProps>;
  const mode = modeOf(p);
  const on = mode.group !== 'off';
  const open = Math.min(Math.max(Number(p.jawOpen) || 0, 0), 1);
  const noise = getNoiseTexture();

  const jawRef = useRef<Group>(null);
  const triggerRef = useRef<Group>(null);
  useSpring(
    open,
    (v) => {
      if (jawRef.current) jawRef.current.rotation.z = v * MAX_OPEN;
      if (triggerRef.current) triggerRef.current.rotation.z = -v * 0.2;
    },
    7,
  );

  const lcdSpec: MeterLcdSpec = {
    on,
    text: p.reading,
    digits: 4,
    unit: String(p.unit || mode.unit),
    ac: mode.group === 'aac' || mode.group === 'vac',
    dc: mode.group === 'vdc',
    hold: p.hold,
    diode: mode.group === 'cont',
    buzzer: mode.group === 'cont',
    bar: null,
  };
  const lcdMap = useCanvasTexture(
    (c, w, h) => drawMeterLcd(c, w, h, lcdSpec),
    JSON.stringify(lcdSpec),
    {
      width: 1024,
      height: Math.round((1024 * DISPLAY.h) / DISPLAY.w),
      fonts: [`700 40px ${FONT_SANS}`],
    },
  );
  const faceMap = useCanvasTexture(drawFace, 'clamp-face-v1', {
    width: BODY.w * PX,
    height: BODY.h * PX,
    fonts: [`700 40px ${FONT_SANS}`, `600 40px ${FONT_SANS}`],
  });
  const pcbMap = useCanvasTexture((c, w, h) => drawPcb(c, w, h, false), 'clamp-pcb-v1', {
    width: PCB.w * PCB_PX,
    height: PCB.h * PCB_PX,
    fonts: [`600 40px ${FONT_SANS}`],
  });
  const pcbMetal = useCanvasTexture((c, w, h) => drawPcb(c, w, h, true), 'clamp-pcb-m-v1', {
    width: PCB.w * PCB_PX,
    height: PCB.h * PCB_PX,
    color: false,
  });
  const holdMap = useCanvasTexture((c, w, h) => drawKeyLabel(c, w, h, 'hold'), 'hold', {
    width: 256,
    height: 112,
    fonts: [`800 40px ${FONT_SANS}`],
  });
  const lightMap = useCanvasTexture((c, w, h) => drawKeyLabel(c, w, h, 'luz'), 'luz', {
    width: 256,
    height: 112,
  });

  const walls = useDisposable(() => {
    const g = roundedSlab({
      width: BODY.w,
      height: BODY.h,
      depth: BODY.d - COVER_T - 2,
      radius: BODY.r,
      bevel: 0.6,
      holes: [{ kind: 'rect', w: BODY.w - 4, h: BODY.h - 4, r: BODY.r - 2, x: 0, y: 0 }],
    });
    g.translate(0, CY, -FACE_Z + 2);
    return g;
  }, []);
  const back = useDisposable(() => {
    const g = roundedSlab({
      width: BODY.w,
      height: BODY.h,
      depth: 2.4,
      radius: BODY.r,
      bevel: 1.2,
    });
    g.translate(0, CY, -FACE_Z);
    return g;
  }, []);
  const cover = useDisposable(() => {
    const g = roundedSlab({
      width: BODY.w,
      height: BODY.h,
      depth: COVER_T,
      radius: BODY.r,
      bevel: 1.2,
      holes: COVER_HOLES,
    });
    g.translate(0, CY, FACE_Z - COVER_T);
    return g;
  }, []);
  const faceDecal = useDisposable(() => {
    const g = decalGeometry(BODY.w, BODY.h, BODY.r, COVER_HOLES);
    g.translate(0, CY, 0);
    return g;
  }, []);
  const grip = useDisposable(
    () => roundedSlab({ width: 7, height: 104, depth: 30, radius: 3.4, bevel: 1.6 }),
    [],
  );
  const guard = useDisposable(() => {
    const g = roundedSlab({
      width: GUARD.w,
      height: GUARD.h,
      depth: GUARD.d,
      radius: 4.4,
      bevel: 2.4,
    });
    g.translate(0, GUARD.y + GUARD.h / 2, -GUARD.d / 2);
    return g;
  }, []);
  const button = useDisposable(() => {
    const g = roundedSlab({
      width: BUTTON.w,
      height: BUTTON.h,
      depth: 4,
      radius: BUTTON.h / 2,
      bevel: 0.8,
    });
    normaliseUVs(g, -BUTTON.w / 2, -BUTTON.h / 2, BUTTON.w, BUTTON.h);
    return g;
  }, []);
  const pcb = useDisposable(() => {
    const g = roundedSlab({ width: PCB.w, height: PCB.h, depth: PCB.t, radius: 4, bevel: 0.2 });
    normaliseUVs(g, -PCB.w / 2, -PCB.h / 2, PCB.w, PCB.h);
    g.translate(0, PCB.y, PCB.z);
    return g;
  }, []);

  return (
    <group>
      {/* Back shell, side walls and the rubber side grips. */}
      <Explode offset={[0, 0, -40]}>
        <mesh geometry={walls}>
          <Material preset="absDark" color="#2c2f34" roughness={0.5} roughnessMap={noise} clip />
        </mesh>
        <mesh geometry={back}>
          <Material preset="absDark" color="#2c2f34" roughness={0.5} roughnessMap={noise} clip />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} geometry={grip} position={[side * (BODY.w / 2 - 2.6), 70, -15]}>
            <Material
              preset="rubber"
              color="#d9482b"
              roughness={0.62}
              roughnessMap={noise}
              sheen={0.3}
              sheenColor="#ff9a7a"
              clip
              cutColor="#8f2a16"
            />
          </mesh>
        ))}
      </Explode>

      {/* Two AAA cells behind the board. */}
      <Explode offset={[-70, 0, -18]}>
        {[-6, 6].map((x) => (
          <group key={x} position={[x, 68, -7.2]}>
            <mesh>
              <cylinderGeometry args={[5.2, 5.2, 41, 24]} />
              <Material preset="sleeve" color={x < 0 ? '#1d1d20' : '#1d1d20'} roughness={0.3} />
            </mesh>
            <mesh position={[0, 21.2, 0]}>
              <cylinderGeometry args={[1.8, 2, 1.4, 16]} />
              <Material preset="nickel" />
            </mesh>
            <mesh position={[0, -20.9, 0]}>
              <cylinderGeometry args={[4.6, 4.6, 0.8, 20]} />
              <Material preset="nickel" />
            </mesh>
            <mesh position={[0, 12, 0]}>
              <cylinderGeometry args={[5.24, 5.24, 6, 24, 1, true]} />
              <Material preset="sleeve" color="#c9a43a" roughness={0.3} />
            </mesh>
          </group>
        ))}
      </Explode>

      {/* Board: selector track, rotor, jacks. */}
      <group>
        <mesh geometry={pcb}>
          <Material
            preset="solderMask"
            color="#ffffff"
            map={pcbMap}
            metalness={1}
            metalnessMap={pcbMetal}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[-16, 97, PCB.z + PCB.t]} scale={[1, 1, 0.32]}>
          <sphereGeometry args={[6, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Material preset="epoxyBlack" roughness={0.35} clearcoat={0.5} />
        </mesh>
        <RotatingGroup angle={modeAngle(modeIndex(p.mode))} position={[0, KNOB.y, 0]}>
          <ClampRotor />
        </RotatingGroup>
        {Object.entries(JACKS).map(([label, x]) => (
          <BananaJack
            key={label}
            color={label === 'COM' ? 'preto' : 'vermelho'}
            position={[x, JACK_Y, FACE_Z]}
            depth={FACE_Z - PCB.z - PCB.t}
          />
        ))}
        <Anchor name="pcb" position={[20, 40, PCB.z + 2]} />
      </group>

      {/* LCD module. */}
      <Explode offset={[0, 0, 24]}>
        <group position={[0, LCD.y, 0]}>
          <mesh position={[0, 0, 11.5]}>
            <boxGeometry args={[54, 31, 3]} />
            <Material preset="absBlack" color="#2a2e2c" roughness={0.25} clearcoat={0.8} />
          </mesh>
          <mesh position={[0, 0, 13.02]}>
            <planeGeometry args={[DISPLAY.w, DISPLAY.h]} />
            <Material
              color="#ffffff"
              map={lcdMap}
              roughness={0.3}
              clearcoat={1}
              clearcoatRoughness={0.04}
              emissive={p.backlight && on ? '#a9e4ff' : '#000000'}
              emissiveMap={lcdMap}
              emissiveIntensity={p.backlight && on ? 0.85 : 0}
            />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[0, side * 13.6, 6.5]}>
              <boxGeometry args={[46, 2, 7]} />
              <Material preset="siliconeRubber" color="#c7b9b6" roughness={0.8} />
            </mesh>
          ))}
        </group>
      </Explode>

      {/* Front cover, guard and keys. */}
      <Explode offset={[0, 0, 48]}>
        <mesh geometry={cover}>
          <Material
            preset="absDark"
            color="#2a2d32"
            roughness={0.46}
            roughnessMap={noise}
            clip
            cutColor="#1d1f22"
          />
        </mesh>
        <Decal
          geometry={faceDecal}
          map={faceMap}
          position={[0, 0, FACE_Z + 0.01]}
          clip
          material={{ roughness: 0.46, roughnessMap: noise }}
        />
        {[-1, 1].map((side) => (
          <mesh key={side} geometry={button} position={[side * BUTTON.x, BUTTON.y, FACE_Z - 2.6]}>
            <Material
              preset="siliconeRubber"
              color="#ffffff"
              map={side < 0 ? holdMap : lightMap}
              roughness={0.62}
              clip
              cutColor="#25272a"
            />
          </mesh>
        ))}
      </Explode>
      <Explode offset={[0, -4, 44]}>
        <mesh geometry={guard}>
          <Material
            preset="absBlack"
            color="#222428"
            roughness={0.45}
            roughnessMap={noise}
            clip
            cutColor="#141517"
          />
        </mesh>
      </Explode>
      <Explode offset={[0, 0, 70]}>
        <RotatingGroup angle={modeAngle(modeIndex(p.mode))} position={[0, KNOB.y, FACE_Z + 0.08]}>
          <BarKnob radius={KNOB.r} />
        </RotatingGroup>
      </Explode>

      {/* Trigger on the left side; it pivots inwards to open the jaw. */}
      <Explode offset={[-24, 0, 0]}>
        <group position={[-BODY.w / 2 + 1, 142, 0]}>
          <group ref={triggerRef}>
            <Trigger />
          </group>
        </group>
      </Explode>

      {/* Jaws with the core inside, and the secondary coil. */}
      <FixedJaw />
      <group position={[PIVOT[0], PIVOT[1], 0]}>
        <group ref={jawRef}>
          <group position={[-PIVOT[0], -PIVOT[1], 0]}>
            <MovingJaw />
          </group>
        </group>
      </group>

      {p.cable !== 'nenhum' && <Conductors cable={p.cable} />}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Jaws, core and coil
// ---------------------------------------------------------------------------

const JAW_SECTION = { radial: JAW.rOut - JAW.rIn, depth: JAW.depth };

function jawShellSection() {
  const shape = roundedRectShape(JAW_SECTION.depth, JAW_SECTION.radial, 4.2);
  const hole = roundedRectShape(JAW_SECTION.depth - 4.2, JAW_SECTION.radial - 4.2, 1.2);
  shape.holes.push(hole);
  return shape;
}

const LAMINATIONS = 5;
const LAM = { t: 1.6, gap: 0.2, radial: 6.4 };

function useJawGeometry(a0: number, a1: number) {
  const shell = useDisposable(
    () => arcSweep(jawShellSection(), { cx: JAW.cx, cy: JAW.cy, radius: R_MID, a0, a1 }, 48),
    [a0, a1],
  );
  const lamination = useDisposable(
    () =>
      arcSweep(
        roundedRectShape(LAM.t, LAM.radial, 0.2),
        { cx: JAW.cx, cy: JAW.cy, radius: R_MID, a0: a0 + 0.012, a1: a1 - 0.012 },
        36,
        1,
      ),
    [a0, a1],
  );
  return { shell, lamination };
}

function JawMaterial() {
  return (
    <Material
      preset="absBlack"
      color="#1e2023"
      roughness={0.4}
      roughnessMap={getNoiseTexture()}
      clearcoat={0.2}
      clip
      cutColor="#101113"
    />
  );
}

function Core({ geometry }: { geometry: ReturnType<typeof arcSweep> }) {
  const span = LAMINATIONS * LAM.t + (LAMINATIONS - 1) * LAM.gap;
  return (
    <group>
      {Array.from({ length: LAMINATIONS }, (_, i) => (
        <mesh
          key={i}
          geometry={geometry}
          position={[0, 0, -span / 2 + LAM.t / 2 + i * (LAM.t + LAM.gap)]}
        >
          <Material preset="siliconSteel" roughness={0.42} />
        </mesh>
      ))}
    </group>
  );
}

function FixedJaw() {
  const { shell, lamination } = useJawGeometry(SPLIT_LOW - Math.PI * 2, SPLIT_TOP - 0.004);
  const coil = useDisposable(() => coilGeometry(-62 * DEG, -18 * DEG, 30), []);
  const leadPoints = useMemo((): Vec3[][] => {
    const a = -64 * DEG;
    const x = JAW.cx + Math.cos(a) * R_MID;
    const y = JAW.cy + Math.sin(a) * R_MID;
    return [-1.5, 1.5].map((dz) => [
      [x, y, dz],
      [x - 2, y - 8, dz],
      [8, 142, dz + 2],
      [6, 136, PCB.z + PCB.t + 0.4],
    ]);
  }, []);
  return (
    <group>
      <Explode offset={[26, 30, 0]}>
        <mesh geometry={shell}>
          <JawMaterial />
        </mesh>
      </Explode>
      <Core geometry={lamination} />
      <Anchor
        name="core"
        position={[JAW.cx + Math.cos(30 * DEG) * R_MID, JAW.cy + Math.sin(30 * DEG) * R_MID, 7.5]}
      />
      <mesh geometry={coil}>
        <Material preset="magnetWire" />
      </mesh>
      <Anchor
        name="coil"
        position={[
          JAW.cx + Math.cos(-40 * DEG) * (R_MID + 5),
          JAW.cy + Math.sin(-40 * DEG) * (R_MID + 5),
          6,
        ]}
      />
      {leadPoints.map((points, i) => (
        <Wire key={i} points={points} radius={0.3} smooth material={{ preset: 'magnetWire' }} />
      ))}
    </group>
  );
}

function MovingJaw() {
  const { shell, lamination } = useJawGeometry(SPLIT_TOP + 0.004, SPLIT_LOW);
  return (
    <group>
      <Explode offset={[-26, 30, 0]}>
        <mesh geometry={shell}>
          <JawMaterial />
        </mesh>
      </Explode>
      <Core geometry={lamination} />
      {/* Hinge pin. */}
      <mesh position={[PIVOT[0], PIVOT[1], 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.6, 1.6, 30, 16]} />
        <Material preset="steel" />
      </mesh>
    </group>
  );
}

/** Secondary winding: copper wire wound around the core between two angles. */
function coilGeometry(a0: number, a1: number, turns: number) {
  const halfRadial = LAM.radial / 2 + 0.5;
  const halfDepth = (LAMINATIONS * LAM.t + (LAMINATIONS - 1) * LAM.gap) / 2 + 0.5;
  class CoilCurve extends Curve<Vector3> {
    constructor() {
      super();
    }

    override getPoint(t: number, target = new Vector3()) {
      const a = a0 + (a1 - a0) * t;
      const phi = t * turns * Math.PI * 2;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      const r = R_MID + halfRadial * Math.sign(c) * Math.pow(Math.abs(c), 0.35);
      const z = halfDepth * Math.sign(s) * Math.pow(Math.abs(s), 0.35);
      return target.set(JAW.cx + Math.cos(a) * r, JAW.cy + Math.sin(a) * r, z);
    }
  }
  return new TubeGeometry(new CoilCurve(), turns * 24, 0.36, 6, false);
}

function ClampRotor() {
  const disc = useDisposable(
    () =>
      latheZ(
        [
          [0, PCB.z + PCB.t + 1],
          [11.6, PCB.z + PCB.t + 1],
          [11.6, PCB.z + PCB.t + 3.4],
          [3.6, PCB.z + PCB.t + 3.6],
          [3.6, FACE_Z - 0.3],
          [0, FACE_Z - 0.3],
        ],
        36,
      ),
    [],
  );
  return (
    <group>
      <mesh geometry={disc}>
        <Material preset="nylonNatural" color="#ece6d6" roughness={0.5} />
      </mesh>
      <mesh position={[0, 7.8, PCB.z + PCB.t + 0.65]}>
        <boxGeometry args={[2.6, 7.6, 0.3]} />
        <Material preset="gold" color="#e8c27a" roughness={0.25} />
      </mesh>
    </group>
  );
}

function Trigger() {
  const geometry = useDisposable(() => {
    const g = roundedSlab({
      width: 9,
      height: 34,
      depth: 16,
      radius: 4.4,
      bevel: 1.8,
    });
    g.translate(-4.5, -17, -8);
    return g;
  }, []);
  return (
    <group rotation={[0, 0, -0.12]}>
      <mesh geometry={geometry}>
        <Material
          preset="absBlack"
          color="#222428"
          roughness={0.42}
          roughnessMap={getNoiseTexture()}
          clip
          cutColor="#141517"
        />
      </mesh>
      {/* Grip ribs. */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-9.1, -10 - i * 4.6, 0]}>
          <boxGeometry args={[0.9, 1.6, 13]} />
          <Material preset="absBlack" color="#2a2c30" roughness={0.5} clip />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Conductors through the jaws
// ---------------------------------------------------------------------------

const WIRE_R = 1.7;
const WIRE_Y = JAW.cy - 4;

const INSULATION: Record<string, string> = {
  preto: '#1c1c1e',
  azul: '#2a62c9',
  branco: '#ecebe6',
};

function InsulatedWire({ points, color }: { points: Vec3[]; color: keyof typeof INSULATION }) {
  const curve = useMemo(() => {
    const v = points.map((pt) => new Vector3(...pt));
    return v.length === 2
      ? new LineCurve3(v[0], v[1])
      : new CatmullRomCurve3(v, false, 'centripetal', 0.5);
  }, [points]);
  const insulation = useDisposable(() => tube(curve, WIRE_R, { radial: 14 }), [points]);
  const core = useDisposable(
    () => tube(curve, WIRE_R * 0.55, { radial: 8, segments: Math.ceil(curve.getLength() / 3) }),
    [points],
  );
  const ends = useMemo(
    () =>
      [0, 1].map((t) => {
        const tangent = curve.getTangent(t).normalize();
        if (t === 0) tangent.negate();
        const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tangent);
        return {
          position: curve.getPoint(t).toArray() as Vec3,
          quaternion: q.toArray() as [number, number, number, number],
        };
      }),
    [curve],
  );
  const tint = INSULATION[color]!;
  return (
    <group>
      <mesh geometry={insulation}>
        <Material
          preset="pvc"
          color={tint}
          roughness={0.4}
          clip
          cutColor={color === 'branco' ? '#bdbcb6' : tint}
        />
      </mesh>
      <mesh geometry={core}>
        <Material preset="copper" clip cutColor="#c77b4f" />
      </mesh>
      {ends.map((end, i) => (
        <group key={i} position={end.position} quaternion={end.quaternion}>
          <mesh>
            <ringGeometry args={[WIRE_R * 0.55, WIRE_R, 20]} />
            <Material preset="pvc" color={tint} roughness={0.5} clip />
          </mesh>
          <mesh position={[0, 0, 0.3]}>
            <circleGeometry args={[WIRE_R * 0.55, 16]} />
            <Material preset="copper" roughness={0.45} clip />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Conductors({ cable }: { cable: ClampCable }) {
  const L = 92;
  if (cable === 'cabo-paralelo') {
    return (
      <group>
        {[-1, 1].map((side) => (
          <InsulatedWire
            key={side}
            color="branco"
            points={[
              [side * WIRE_R * 0.98, WIRE_Y, -L],
              [side * WIRE_R * 0.98, WIRE_Y, L],
            ]}
          />
        ))}
        {/* The web joining the two conductors. */}
        <mesh position={[0, WIRE_Y, 0]}>
          <boxGeometry args={[WIRE_R * 1.4, WIRE_R * 0.9, L * 2]} />
          <Material preset="pvc" color={INSULATION.branco} roughness={0.4} clip />
        </mesh>
      </group>
    );
  }
  const out = JAW.rOut + 9;
  return (
    <group>
      <InsulatedWire
        color="preto"
        points={[
          [-WIRE_R, WIRE_Y, -L],
          [-WIRE_R, WIRE_Y, L],
        ]}
      />
      <InsulatedWire
        color="azul"
        points={[
          [WIRE_R, WIRE_Y, -L],
          [WIRE_R, WIRE_Y, -54],
          [WIRE_R + 4, WIRE_Y, -40],
          [out, WIRE_Y + 2, -18],
          [out + 2, WIRE_Y + 2, 0],
          [out, WIRE_Y + 2, 18],
          [WIRE_R + 4, WIRE_Y, 40],
          [WIRE_R, WIRE_Y, 54],
          [WIRE_R, WIRE_Y, L],
        ]}
      />
    </group>
  );
}
