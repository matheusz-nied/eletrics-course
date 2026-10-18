/**
 * Handheld digital multimeter (3¾ digits, manual ranges) in its rubber
 * holster, with test leads. Sizes of a typical CAT III 600 V handheld meter:
 * 183–195 × 90–92 × 50–55 mm with holster (Fluke 17B+: 183 × 91 × 50 mm;
 * Minipa ET-1100A class), 4 mm shrouded jacks 19 mm apart (IEC 61010-031),
 * 9 V battery (6LR61, 26,5 × 17,5 × 48,5 mm), fuses 10 × 38 mm (10 A) and
 * 5 × 20 mm (400 mA).
 *
 * Everything is driven by props: selector position (the knob turns to it),
 * reading and unit on the LCD, HOLD, backlight, low battery, the jack of the
 * red lead. Cutaway removes the front of the housing: the selector track and
 * wiper, the fuses, the shunt, the A/D converter and the LCD stay. The
 * exploded view separates holster, back shell, battery, board, LCD, front
 * cover and knob.
 *
 * For the bench: `MULTIMETER_JACKS` and `multimeterJackMouth()` give the
 * jack positions in part space, and `TestLead` draws a lead to any point.
 */
import { useMemo } from 'react';
import { DoubleSide } from 'three';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { useDisposable, Wire } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import {
  drawBuzzer,
  drawDiode,
  drawFunctionSymbol,
  drawKeyLabel,
  drawMeterLcd,
  type MeterLcdSpec,
} from './_display';
import {
  BananaJack,
  BarKnob,
  decalGeometry,
  Decal,
  latheZ,
  normaliseUVs,
  RotatingGroup,
  roundedSlab,
  type HoleSpec,
} from './_kit';
import { TestLead, type LeadColor } from './_leads';

export { TestLead } from './_leads';

// ---------------------------------------------------------------------------
// Selector positions
// ---------------------------------------------------------------------------

type FunctionGroup = 'off' | 'vdc' | 'vac' | 'ohm' | 'cont' | 'adc' | 'aac' | 'hfe';

interface ModeInfo {
  id: string;
  group: FunctionGroup;
  /** Text printed at the position. */
  range: string;
  /** Unit shown on the LCD. */
  unit: string;
  /** Full scale in that unit (bar graph). */
  full: number;
  /** Range in words (pt-BR). */
  words: string;
}

/** Clockwise from OFF at 12 o'clock, 18° apart. */
export const MULTIMETER_MODES: ModeInfo[] = [
  { id: 'off', group: 'off', range: 'OFF', unit: '', full: 1, words: 'desligado' },
  { id: 'Vdc600', group: 'vdc', range: '600', unit: 'V', full: 600, words: '600 V' },
  { id: 'Vdc200', group: 'vdc', range: '200', unit: 'V', full: 200, words: '200 V' },
  { id: 'Vdc20', group: 'vdc', range: '20', unit: 'V', full: 20, words: '20 V' },
  { id: 'Vdc2', group: 'vdc', range: '2', unit: 'V', full: 2, words: '2 V' },
  { id: 'Vdc200m', group: 'vdc', range: '200m', unit: 'mV', full: 200, words: '200 mV' },
  { id: 'hfe', group: 'hfe', range: 'hFE', unit: 'hFE', full: 1000, words: 'hFE' },
  { id: 'A10', group: 'adc', range: '10A', unit: 'A', full: 10, words: '10 A' },
  { id: 'Adc200m', group: 'adc', range: '200m', unit: 'mA', full: 200, words: '200 mA' },
  { id: 'Adc20m', group: 'adc', range: '20m', unit: 'mA', full: 20, words: '20 mA' },
  { id: 'Adc2m', group: 'adc', range: '2m', unit: 'mA', full: 2, words: '2 mA' },
  { id: 'A~10', group: 'aac', range: '10A', unit: 'A', full: 10, words: '10 A' },
  { id: 'continuidade', group: 'cont', range: '', unit: 'Ω', full: 400, words: '' },
  { id: 'ohm2M', group: 'ohm', range: '2M', unit: 'MΩ', full: 2, words: '2 MΩ' },
  { id: 'ohm200k', group: 'ohm', range: '200k', unit: 'kΩ', full: 200, words: '200 kΩ' },
  { id: 'ohm20k', group: 'ohm', range: '20k', unit: 'kΩ', full: 20, words: '20 kΩ' },
  { id: 'ohm2k', group: 'ohm', range: '2k', unit: 'kΩ', full: 2, words: '2 kΩ' },
  { id: 'ohm200', group: 'ohm', range: '200', unit: 'Ω', full: 200, words: '200 Ω' },
  { id: 'V~200', group: 'vac', range: '200', unit: 'V', full: 200, words: '200 V' },
  { id: 'V~600', group: 'vac', range: '600', unit: 'V', full: 600, words: '600 V' },
];

const STEP = (Math.PI * 2) / MULTIMETER_MODES.length;

function modeIndex(id: string): number {
  const i = MULTIMETER_MODES.findIndex((m) => m.id === id);
  return i < 0 ? 0 : i;
}

const GROUP_WORDS: Record<FunctionGroup, string> = {
  off: 'desligado',
  vdc: 'tensão contínua (V⎓)',
  vac: 'tensão alternada (V~)',
  ohm: 'resistência (Ω)',
  cont: 'continuidade e teste de diodo',
  adc: 'corrente contínua (A⎓)',
  aac: 'corrente alternada (A~)',
  hfe: 'ganho de transistor (hFE)',
};

const GROUP_COLORS: Record<FunctionGroup, string> = {
  off: '#ffffff',
  vdc: '#f2f2ee',
  vac: '#f2f2ee',
  ohm: '#8fd8a2',
  cont: '#8fd8a2',
  adc: '#ffd04a',
  aac: '#ffd04a',
  hfe: '#86cdf2',
};

// ---------------------------------------------------------------------------
// Dimensions (mm). Local frame: face towards +Z, LCD at the top (+Y).
// ---------------------------------------------------------------------------

const HOLSTER = { w: 92, h: 194, d: 52, r: 16 };
const BODY = { w: 77, h: 179, r: 9 };
const FACE_Z = 22;
const COVER_T = 2.5;
const DIAL_Y = 2;
const KNOB_R = 16.5;
const LCD = { w: 66, h: 32, y: 69 };
const DISPLAY = { w: 64, h: 28.6 };
const BUTTON = { w: 17, h: 7.4, y: 42, x: 17.5 };
/** The cutaway plane (part space z = 0) falls this deep inside the meter. */
const CUT_DEPTH = 13;
const LIFT = HOLSTER.h / 2;

export type MultimeterJack = '10A' | 'mA' | 'COM' | 'VΩ';

const JACK_Y = -62;
const JACK_X: Record<MultimeterJack, number> = { '10A': -28.5, mA: -9.5, COM: 9.5, VΩ: 28.5 };

/** Meter local → part space. */
const toPart = (x: number, y: number, z: number): Vec3 => [x, y + LIFT, z - CUT_DEPTH];

/** Jack mouths in part space (where a plug enters), plugs point along +Z. */
export const MULTIMETER_JACKS: Record<MultimeterJack, Vec3> = {
  '10A': toPart(JACK_X['10A'], JACK_Y, FACE_Z + 1.2),
  mA: toPart(JACK_X.mA, JACK_Y, FACE_Z + 1.2),
  COM: toPart(JACK_X.COM, JACK_Y, FACE_Z + 1.2),
  VΩ: toPart(JACK_X['VΩ'], JACK_Y, FACE_Z + 1.2),
};

export function multimeterJackMouth(jack: MultimeterJack): { position: Vec3; direction: Vec3 } {
  return { position: MULTIMETER_JACKS[jack], direction: [0, 0, 1] };
}

const COVER_HOLES: HoleSpec[] = [
  { kind: 'rect', w: LCD.w, h: LCD.h, r: 2, x: 0, y: LCD.y },
  { kind: 'circle', r: 6, x: 0, y: DIAL_Y },
  ...(Object.values(JACK_X) as number[]).map((x): HoleSpec => ({
    kind: 'circle',
    r: 6.2,
    x,
    y: JACK_Y,
  })),
  ...[-1, 1].map((side): HoleSpec => ({
    kind: 'rect',
    w: BUTTON.w + 0.8,
    h: BUTTON.h + 0.8,
    r: (BUTTON.h + 0.8) / 2,
    x: side * BUTTON.x,
    y: BUTTON.y,
  })),
];

// ---------------------------------------------------------------------------
// Props and meta
// ---------------------------------------------------------------------------

export interface MultimeterProps {
  /** Selector position id: `off`, `Vdc20`, `V~600`, `ohm2k`, `continuidade`, `A10`… */
  mode?: string;
  /** Text on the LCD, as the meter shows it: `127.3`, `OL`, `-0.512`. */
  reading?: string;
  /** Unit on the LCD; empty = the unit of the selector position. */
  unit?: string;
  backlight?: boolean;
  hold?: boolean;
  lowBattery?: boolean;
  /** Jack of the red lead (the black one is always in COM). */
  redJack?: 'VΩ' | 'mA' | '10A';
  leads?: 'nenhuma' | 'conectadas';
}

function modeOf(p: PartProps): ModeInfo {
  return MULTIMETER_MODES[modeIndex(String(p.mode))]!;
}

function unitOf(p: PartProps): string {
  const override = String(p.unit ?? '').trim();
  return override || modeOf(p).unit;
}

/** `127.3` → `127,3`; `OL` → `OL (fora da escala)`. */
function readingWords(reading: string): string {
  const r = reading.trim();
  if (/^-?\.?OL$/i.test(r)) return 'OL (acima da escala)';
  return r.replace('.', ',');
}

function modeWords(m: ModeInfo): string {
  if (m.group === 'off') return 'desligado (OFF)';
  if (m.group === 'cont' || m.group === 'hfe') return GROUP_WORDS[m.group];
  return `${GROUP_WORDS[m.group]}, escala de ${m.words}`;
}

const LEAD_WARNINGS = (p: PartProps): string => {
  if (p.leads !== 'conectadas') return '';
  const m = modeOf(p);
  const jack = String(p.redJack);
  if ((m.group === 'adc' || m.group === 'aac') && jack === 'VΩ')
    return ' Atenção: para medir corrente, a ponta vermelha vai no borne mA ou 10A.';
  if (m.id === 'A10' || m.id === 'A~10') {
    if (jack === 'mA') return ' Atenção: na escala de 10 A, a ponta vermelha vai no borne 10A.';
  } else if ((m.group === 'adc' || m.group === 'aac') && jack === '10A')
    return ' Atenção: nesta escala de mA, a ponta vermelha vai no borne mA.';
  if (m.group !== 'adc' && m.group !== 'aac' && m.group !== 'off' && jack !== 'VΩ')
    return ' Perigo: ponta vermelha num borne de corrente com o seletor em outra função; medir tensão assim é um curto que queima o fusível.';
  return '';
};

export const meta: PartMeta = {
  id: 'multimeter',
  label: 'Multímetro digital',
  category: 'instrumentos',
  summary:
    'Multímetro digital de 3¾ dígitos na capa de borracha, com seletor de funções, visor LCD, bornes COM, VΩ, mA e 10A e pontas de prova.',
  defaults: {
    mode: 'V~600',
    reading: '127.3',
    unit: '',
    backlight: false,
    hold: false,
    lowBattery: false,
    redJack: 'VΩ',
    leads: 'conectadas',
  },
  controls: {
    mode: {
      kind: 'select',
      label: 'Seletor',
      options: MULTIMETER_MODES.map((m) => ({
        value: m.id,
        label:
          m.group === 'off'
            ? 'OFF (desligado)'
            : m.group === 'cont'
              ? 'Continuidade / diodo'
              : m.group === 'hfe'
                ? 'hFE (transistor)'
                : `${{ vdc: 'V⎓', vac: 'V~', ohm: 'Ω', adc: 'A⎓', aac: 'A~' }[m.group as 'vdc']} ${m.words}`,
      })),
    },
    reading: { kind: 'text', label: 'Leitura no visor', maxLength: 6 },
    unit: {
      kind: 'select',
      label: 'Unidade no visor',
      options: [
        { value: '', label: 'Automática (pelo seletor)' },
        { value: 'mV', label: 'mV' },
        { value: 'V', label: 'V' },
        { value: 'Ω', label: 'Ω' },
        { value: 'kΩ', label: 'kΩ' },
        { value: 'MΩ', label: 'MΩ' },
        { value: 'mA', label: 'mA' },
        { value: 'µA', label: 'µA' },
        { value: 'A', label: 'A' },
        { value: 'hFE', label: 'hFE' },
      ],
    },
    backlight: { kind: 'toggle', label: 'Luz de fundo' },
    hold: { kind: 'toggle', label: 'HOLD (congelar leitura)' },
    lowBattery: { kind: 'toggle', label: 'Bateria fraca' },
    redJack: {
      kind: 'select',
      label: 'Borne da ponta vermelha',
      options: [
        { value: 'VΩ', label: 'VΩ (tensão, resistência)' },
        { value: 'mA', label: 'mA (corrente pequena)' },
        { value: '10A', label: '10A (corrente alta)' },
      ],
    },
    leads: {
      kind: 'select',
      label: 'Pontas de prova',
      options: [
        { value: 'conectadas', label: 'Conectadas' },
        { value: 'nenhuma', label: 'Sem pontas' },
      ],
    },
  },
  annotations: (p) => {
    const list: PartAnnotation[] = [
      {
        at: toPart(-20, LCD.y + 8, FACE_Z),
        text: 'Visor: valor, unidade e símbolos (~ alternada, ⎓ contínua)',
        exploded: false,
      },
      {
        at: toPart(11, DIAL_Y + 12, FACE_Z + 11),
        text: 'Seletor: escolha a grandeza e a escala antes de medir',
        exploded: false,
      },
      {
        at: toPart(-BUTTON.x, BUTTON.y, FACE_Z + 1.5),
        text: 'HOLD congela a leitura no visor',
        exploded: false,
      },
      {
        at: toPart(JACK_X.COM, JACK_Y - 7, FACE_Z + 1),
        text: 'COM: a ponta preta fica sempre aqui',
        exploded: false,
      },
      {
        at: toPart(JACK_X['VΩ'], JACK_Y - 7, FACE_Z + 1),
        text: 'VΩ: tensão, resistência e continuidade',
        exploded: false,
      },
      {
        at: toPart(JACK_X.mA, JACK_Y - 7, FACE_Z + 1),
        text: 'mA: correntes pequenas (fusível de 400 mA)',
        exploded: false,
      },
      {
        at: toPart(JACK_X['10A'], JACK_Y - 7, FACE_Z + 1),
        text: '10A: correntes altas, até 10 A',
        exploded: false,
      },
      {
        at: [0, 0, 0],
        text: 'Trilhas do seletor e cursor de contato',
        anchor: 'pads',
        exploded: true,
      },
      { at: [0, 0, 0], text: 'Fusível de 10 A (borne 10A)', anchor: 'fuse10', exploded: true },
      { at: [0, 0, 0], text: 'Fusível de 400 mA (borne mA)', anchor: 'fuseMa', exploded: true },
      {
        at: [0, 0, 0],
        text: 'Shunt: a corrente vira uma pequena tensão',
        anchor: 'shunt',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: 'Conversor A/D: transforma tensão em números',
        anchor: 'adc',
        exploded: true,
      },
      { at: [0, 0, 0], text: 'Visor de cristal líquido (LCD)', anchor: 'lcd', exploded: true },
      { at: [0, 0, 0], text: 'Bateria de 9 V', anchor: 'battery', exploded: true },
    ];
    void p;
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const m = modeOf(p);
    if (m.group === 'off') return 'Multímetro digital desligado, com o seletor em OFF.';
    const unit = unitOf(p);
    const leads =
      p.leads === 'conectadas'
        ? ` Ponta preta no borne COM e ponta vermelha no borne ${p.redJack}.`
        : ' Sem as pontas de prova.';
    const extras = [
      p.hold ? 'leitura congelada (HOLD)' : '',
      p.backlight ? 'luz de fundo acesa' : '',
      p.lowBattery ? 'aviso de bateria fraca' : '',
    ].filter(Boolean);
    return `Multímetro digital no seletor ${modeWords(m)}. O visor mostra ${readingWords(String(p.reading))}${unit && !/OL/i.test(String(p.reading)) ? ` ${unit}` : ''}${extras.length ? `, com ${extras.join(' e ')}` : ''}.${leads}${LEAD_WARNINGS(p)}`;
  },
  view: [0.42, 0.5, 1.25],
};

// ---------------------------------------------------------------------------
// Printed graphics
// ---------------------------------------------------------------------------

const FACE_PX = 8;
const fx = (x: number) => (x + BODY.w / 2) * FACE_PX;
const fy = (y: number) => (BODY.h / 2 - y) * FACE_PX;
const mm = (v: number) => v * FACE_PX;

function polar(r: number, angle: number): [number, number] {
  return [fx(r * Math.sin(angle)), fy(DIAL_Y + r * Math.cos(angle))];
}

function drawGroupSymbol(
  ctx: CanvasRenderingContext2D,
  group: FunctionGroup,
  x: number,
  y: number,
  size: number,
) {
  const letter = group === 'vdc' || group === 'vac' ? 'V' : group === 'ohm' ? 'Ω' : 'A';
  const kind = group === 'ohm' ? null : group === 'vac' || group === 'aac' ? 'ac' : 'dc';
  drawFunctionSymbol(ctx, letter, kind, x, y, size, GROUP_COLORS[group]);
}

function drawFace(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = '#2a2d32';
  ctx.fillRect(0, 0, W, H);

  // LCD bezel print.
  ctx.fillStyle = '#1d1f23';
  ctx.beginPath();
  ctx.roundRect(
    fx(-LCD.w / 2 - 2.4),
    fy(LCD.y + LCD.h / 2 + 2.4),
    mm(LCD.w + 4.8),
    mm(LCD.h + 4.8),
    mm(3),
  );
  ctx.fill();
  ctx.strokeStyle = '#7c838c';
  ctx.lineWidth = mm(0.3);
  ctx.stroke();

  ctx.fillStyle = '#e9e9e4';
  fitText(ctx, 'MULTÍMETRO DIGITAL', fx(0), fy(48.9), mm(48), mm(3.1), {
    weight: 700,
    family: FONT_SANS,
  });

  // Selector dial.
  ctx.strokeStyle = '#8b9199';
  ctx.lineWidth = mm(0.3);
  ctx.beginPath();
  ctx.arc(fx(0), fy(DIAL_Y), mm(KNOB_R + 2.2), 0, Math.PI * 2);
  ctx.stroke();

  const groups = new Map<FunctionGroup, number[]>();
  MULTIMETER_MODES.forEach((m, i) => {
    const angle = i * STEP;
    groups.set(m.group, [...(groups.get(m.group) ?? []), angle]);
    const [dx, dy] = polar(KNOB_R + 4, angle);
    ctx.fillStyle = m.group === 'off' ? '#ffffff' : '#cfd3d8';
    ctx.beginPath();
    ctx.arc(dx, dy, mm(0.5), 0, Math.PI * 2);
    ctx.fill();
    const [lx, ly] = polar(KNOB_R + 8.6, angle);
    ctx.fillStyle = ctx.strokeStyle = GROUP_COLORS[m.group];
    if (m.group === 'cont') {
      drawDiode(ctx, lx - mm(3.6), ly - mm(1.1), mm(3.2), mm(2.2));
      drawBuzzer(ctx, lx + mm(0.6), ly - mm(1.3), mm(3.2), mm(2.6));
      return;
    }
    const size = m.group === 'off' ? mm(3) : m.range.length > 3 ? mm(2.35) : mm(2.6);
    ctx.font = `700 ${size}px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.range, lx, ly);
  });

  // Group brackets and symbols.
  ctx.lineWidth = mm(0.45);
  for (const [group, angles] of groups) {
    if (group === 'off' || group === 'cont' || group === 'hfe') continue;
    const a0 = Math.min(...angles);
    const a1 = Math.max(...angles);
    ctx.strokeStyle = GROUP_COLORS[group];
    ctx.beginPath();
    ctx.arc(fx(0), fy(DIAL_Y), mm(KNOB_R + 13.4), a0 - Math.PI / 2 - 0.09, a1 - Math.PI / 2 + 0.09);
    ctx.stroke();
    const mid = (a0 + a1) / 2;
    const [sx, sy] = polar(KNOB_R + 17.4, mid);
    drawGroupSymbol(ctx, group, sx, sy, mm(3.6));
  }

  // Jacks.
  ctx.strokeStyle = '#6f767f';
  ctx.lineWidth = mm(0.3);
  ctx.beginPath();
  ctx.roundRect(fx(-37), fy(-46.5), mm(74), mm(32), mm(3));
  ctx.stroke();
  const jackLabels: [MultimeterJack, string, string, string][] = [
    ['10A', '10A', '10A MÁX', 'C/ FUSÍVEL'],
    ['mA', 'mA', '400mA MÁX', 'C/ FUSÍVEL'],
    ['COM', 'COM', '', ''],
    ['VΩ', 'VΩ', '600V MÁX', ''],
  ];
  for (const [jack, top, line1, line2] of jackLabels) {
    const x = JACK_X[jack];
    ctx.fillStyle = jack === '10A' || jack === 'mA' ? '#ffd04a' : '#f2f2ee';
    ctx.font = `700 ${mm(3)}px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(top, fx(x), fy(-51.4));
    ctx.fillStyle = '#c9cdd2';
    ctx.font = `600 ${mm(1.6)}px ${FONT_SANS}`;
    if (line1) ctx.fillText(line1, fx(x), fy(-71.2));
    if (line2) ctx.fillText(line2, fx(x), fy(-73.4));
  }
  // Diode / continuity marks next to VΩ.
  ctx.fillStyle = ctx.strokeStyle = '#f2f2ee';
  drawDiode(ctx, fx(33.2), fy(-50.6), mm(2.6), mm(1.6));

  // Warning and category.
  const tx = fx(-14);
  const ty = fy(-81);
  ctx.fillStyle = '#ffd04a';
  ctx.beginPath();
  ctx.moveTo(tx, ty - mm(1.8));
  ctx.lineTo(tx + mm(2), ty + mm(1.6));
  ctx.lineTo(tx - mm(2), ty + mm(1.6));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2a2d32';
  ctx.font = `800 ${mm(2.4)}px ${FONT_SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText('!', tx, ty + mm(0.35));
  ctx.fillStyle = '#e9e9e4';
  ctx.font = `700 ${mm(2.4)}px ${FONT_SANS}`;
  ctx.textAlign = 'left';
  ctx.fillText('CAT III 600V', fx(-10.5), ty + mm(0.1));
}

const PCB = { w: 72, h: 172, r: 5, z: 4.4, t: 1.6 };
const PCB_PX = 7;

function drawPcb(ctx: CanvasRenderingContext2D, W: number, H: number, metal: boolean) {
  const px = (x: number) => (x + PCB.w / 2) * PCB_PX;
  const py = (y: number) => (PCB.h / 2 - y) * PCB_PX;
  const s = (v: number) => v * PCB_PX;
  const gold = metal ? '#ffffff' : '#d6ad57';
  const tin = metal ? '#ffffff' : '#c9ccce';
  ctx.fillStyle = metal ? '#000000' : '#1c5a35';
  ctx.fillRect(0, 0, W, H);
  if (!metal) {
    // FR-4 edge seen on the sides of the board.
    ctx.strokeStyle = '#b9a874';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, W, H);
    // Traces under the mask.
    ctx.strokeStyle = '#2a7748';
    ctx.lineWidth = s(0.5);
    ctx.lineCap = 'round';
    MULTIMETER_MODES.forEach((_, i) => {
      const a = i * STEP;
      const r0 = 14.6;
      const x0 = Math.sin(a) * r0;
      const y0 = DIAL_Y + Math.cos(a) * r0;
      const x1 = Math.sin(a) * 19;
      const y1 = DIAL_Y + Math.cos(a) * 19;
      ctx.beginPath();
      ctx.moveTo(px(x0), py(y0));
      ctx.lineTo(px(x1), py(y1));
      ctx.lineTo(px(x1 + (x1 > 0 ? 6 : -6)), py(y1 > DIAL_Y ? y1 + 6 : y1 - 6));
      ctx.stroke();
    });
    for (const [x0, y0, x1, y1] of [
      [-28.5, -56, -28.5, -48],
      [-28.5, -48, -20, -41],
      [-9.5, -56, -9.5, -46],
      [9.5, -56, 14, -30],
      [28.5, -56, 28.5, -30],
      [28.5, -30, 22, 20],
      [-30, -36, -30, 20],
      [-30, 20, -24, 26],
      [24, 22, 24, 46],
      [-12, 46, 12, 46],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(px(x0), py(y0));
      ctx.lineTo(px(x1), py(y1));
      ctx.stroke();
    }
  }
  // Selector track: common ring and one pad per position (gold plated).
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.arc(px(0), py(DIAL_Y), s(8.2), 0, Math.PI * 2);
  ctx.arc(px(0), py(DIAL_Y), s(5.2), 0, Math.PI * 2, true);
  ctx.fill();
  MULTIMETER_MODES.forEach((_, i) => {
    const a = i * STEP - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(px(0), py(DIAL_Y), s(14.3), a - 0.12, a + 0.12);
    ctx.arc(px(0), py(DIAL_Y), s(10.2), a + 0.12, a - 0.12, true);
    ctx.closePath();
    ctx.fill();
  });
  // SMD parts and their pads (flat at this scale).
  const parts: [number, number, number][] = [
    [-8, 24, 0],
    [-4, 24, 0],
    [0, 24, 0],
    [4, 24, 1],
    [8, 26, 0],
    [12, 23, 1],
    [-14, 30, 1],
    [-10, 34, 0],
    [-4, 38, 0],
    [2, 40, 1],
    [8, 38, 0],
    [-18, 42, 0],
    [14, 44, 1],
    [32, 20, 0],
    [32, 14, 1],
    [-32, 12, 0],
    [-32, 6, 0],
    [20, -24, 0],
    [24, -28, 1],
    [-6, -26, 0],
    [4, -24, 1],
    [-16, -24, 0],
  ];
  for (const [x, y, kind] of parts) {
    ctx.fillStyle = tin;
    ctx.fillRect(px(x - 1.6), py(y + 0.7), s(1), s(1.4));
    ctx.fillRect(px(x + 0.6), py(y + 0.7), s(1), s(1.4));
    if (!metal) {
      ctx.fillStyle = kind ? '#a0784a' : '#151515';
      ctx.fillRect(px(x - 0.75), py(y + 0.62), s(1.5), s(1.24));
    }
  }
  if (metal) return;
  // Silkscreen.
  ctx.strokeStyle = ctx.fillStyle = '#eceee8';
  ctx.lineWidth = s(0.18);
  ctx.font = `600 ${s(1.8)}px ${FONT_SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = (text: string, x: number, y: number) => ctx.fillText(text, px(x), py(y));
  ctx.strokeRect(px(-33.5), py(-34), s(42), s(12.5));
  label('F1  10A 600V', -12.5, -32.2);
  ctx.strokeRect(px(9), py(-36.5), s(22), s(7.5));
  label('F2  400mA', 20, -33.2);
  ctx.beginPath();
  ctx.arc(px(23), py(31), s(9), 0, Math.PI * 2);
  ctx.stroke();
  label('U1', 23, 41.5);
  ctx.strokeRect(px(-31), py(35.5), s(8), s(8));
  label('VR1', -27, 38.8);
  label('SW1', 15, -14);
  label('BZ1', -26, -14.5);
  label('RS1', -28, -45);
  for (const jack of Object.keys(JACK_X) as MultimeterJack[]) {
    ctx.beginPath();
    ctx.arc(px(JACK_X[jack]), py(JACK_Y), s(6.6), 0, Math.PI * 2);
    ctx.stroke();
  }
  label('LCD1', 0, 47.5);
}

function drawBatteryLabel(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#1b2a4a');
  g.addColorStop(0.5, '#25406e');
  g.addColorStop(1, '#1b2a4a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#d7a43a';
  ctx.fillRect(0, H * 0.62, W, H * 0.06);
  ctx.fillStyle = '#ffffff';
  fitText(ctx, '9V', W / 2, H * 0.32, W * 0.8, H * 0.24, { weight: 800, family: FONT_SANS });
  ctx.fillStyle = '#dfe6f3';
  fitText(ctx, 'ALCALINA', W / 2, H * 0.52, W * 0.8, H * 0.07, { weight: 700, family: FONT_SANS });
  fitText(ctx, '6LR61', W / 2, H * 0.8, W * 0.6, H * 0.06, { weight: 600, family: FONT_SANS });
}

// ---------------------------------------------------------------------------
// Part
// ---------------------------------------------------------------------------

export default function Multimeter(props: MultimeterProps) {
  const p = { ...meta.defaults, ...props } as Required<MultimeterProps>;
  const mode = modeOf(p);
  const index = modeIndex(p.mode);
  const angle = index * STEP;
  const on = mode.group !== 'off';
  const unit = unitOf(p);
  const value = Number.parseFloat(p.reading.replace(',', '.'));
  const bar = on && Number.isFinite(value) ? Math.abs(value) / mode.full : 0;
  const noise = getNoiseTexture();

  const lcdSpec: MeterLcdSpec = {
    on,
    text: p.reading,
    digits: 4,
    unit,
    ac: mode.group === 'vac' || mode.group === 'aac',
    dc: mode.group === 'vdc' || mode.group === 'adc',
    hold: p.hold,
    lowBattery: p.lowBattery,
    diode: mode.group === 'cont',
    buzzer: mode.group === 'cont',
    bar: mode.group === 'hfe' ? 0 : bar,
  };
  const lcdKey = JSON.stringify(lcdSpec);
  const lcdMap = useCanvasTexture((ctx, w, h) => drawMeterLcd(ctx, w, h, lcdSpec), lcdKey, {
    width: 1024,
    height: Math.round((1024 * DISPLAY.h) / DISPLAY.w),
    fonts: [`700 40px ${FONT_SANS}`],
  });
  const faceMap = useCanvasTexture(drawFace, 'face-v1', {
    width: BODY.w * FACE_PX,
    height: BODY.h * FACE_PX,
    fonts: [`700 40px ${FONT_SANS}`, `600 40px ${FONT_SANS}`, `800 40px ${FONT_SANS}`],
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
  const pcbMap = useCanvasTexture((c, w, h) => drawPcb(c, w, h, false), 'pcb-v1', {
    width: PCB.w * PCB_PX,
    height: PCB.h * PCB_PX,
    fonts: [`600 40px ${FONT_SANS}`],
  });
  const pcbMetal = useCanvasTexture((c, w, h) => drawPcb(c, w, h, true), 'pcb-metal-v1', {
    width: PCB.w * PCB_PX,
    height: PCB.h * PCB_PX,
    color: false,
  });
  const batteryMap = useCanvasTexture(drawBatteryLabel, 'bat-v1', {
    width: 256,
    height: 512,
    fonts: [`800 40px ${FONT_SANS}`],
  });

  // Geometry.
  const holster = useDisposable(() => {
    const g = roundedSlab({
      width: HOLSTER.w,
      height: HOLSTER.h,
      depth: HOLSTER.d,
      radius: HOLSTER.r,
      bevel: 2.4,
      curveSegments: 10,
      holes: [{ kind: 'rect', w: BODY.w + 1.6, h: BODY.h + 1.6, r: BODY.r + 1.4, x: 0, y: 0 }],
    });
    g.translate(0, 0, -HOLSTER.d / 2);
    return g;
  }, []);
  const stand = useDisposable(
    () => roundedSlab({ width: 50, height: 104, depth: 2.6, radius: 8, bevel: 0.8 }),
    [],
  );
  const walls = useDisposable(() => {
    const g = roundedSlab({
      width: BODY.w,
      height: BODY.h,
      depth: FACE_Z - COVER_T + 20,
      radius: BODY.r,
      bevel: 0.6,
      holes: [{ kind: 'rect', w: BODY.w - 4, h: BODY.h - 4, r: BODY.r - 2, x: 0, y: 0 }],
    });
    g.translate(0, 0, -20);
    return g;
  }, []);
  const floor = useDisposable(() => {
    const g = roundedSlab({ width: BODY.w, height: BODY.h, depth: 2, radius: BODY.r, bevel: 0.8 });
    g.translate(0, 0, -22);
    return g;
  }, []);
  const cover = useDisposable(() => {
    const g = roundedSlab({
      width: BODY.w,
      height: BODY.h,
      depth: COVER_T,
      radius: BODY.r,
      bevel: 0.7,
      holes: COVER_HOLES,
    });
    g.translate(0, 0, FACE_Z - COVER_T);
    return g;
  }, []);
  const faceDecal = useDisposable(() => decalGeometry(BODY.w, BODY.h, BODY.r, COVER_HOLES), []);
  const button = useDisposable(() => {
    const g = roundedSlab({
      width: BUTTON.w,
      height: BUTTON.h,
      depth: 4,
      radius: BUTTON.h / 2,
      bevel: 0.9,
    });
    normaliseUVs(g, -BUTTON.w / 2, -BUTTON.h / 2, BUTTON.w, BUTTON.h);
    return g;
  }, []);
  const pcb = useDisposable(() => {
    const g = roundedSlab({ width: PCB.w, height: PCB.h, depth: PCB.t, radius: PCB.r, bevel: 0.2 });
    normaliseUVs(g, -PCB.w / 2, -PCB.h / 2, PCB.w, PCB.h);
    g.translate(0, 0, PCB.z);
    return g;
  }, []);
  const battery = useDisposable(() => {
    const g = roundedSlab({ width: 26.5, height: 48.5, depth: 17.5, radius: 2.2, bevel: 1 });
    normaliseUVs(g, -13.25, -24.25, 26.5, 48.5);
    return g;
  }, []);

  return (
    <group>
      <group position={[0, LIFT, -CUT_DEPTH]}>
        {/* Rubber holster with the tilt stand folded on the back. */}
        <Explode offset={[96, 0, -100]}>
          <mesh geometry={holster}>
            <Material
              preset="rubber"
              color="#f2a01a"
              roughness={0.66}
              roughnessMap={noise}
              sheen={0.35}
              sheenColor="#ffd08a"
              sheenRoughness={0.6}
              clip
              cutColor="#b8700c"
            />
          </mesh>
          <mesh geometry={stand} position={[0, 12, -25.4]}>
            <Material preset="rubber" color="#e3930f" roughness={0.6} clip cutColor="#b8700c" />
          </mesh>
          <mesh position={[0, 64, -24]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[1.6, 1.6, 52, 16]} />
            <Material preset="rubber" color="#e3930f" roughness={0.6} clip />
          </mesh>
        </Explode>

        {/* Back shell: floor and side walls. */}
        <Explode offset={[50, 0, -52]}>
          <mesh geometry={floor}>
            <Material preset="absDark" color="#2c2f34" roughness={0.52} roughnessMap={noise} clip />
          </mesh>
          <mesh geometry={walls}>
            <Material preset="absDark" color="#2c2f34" roughness={0.52} roughnessMap={noise} clip />
          </mesh>
        </Explode>

        {/* 9 V battery and its snap, behind the board. */}
        <Explode offset={[150, -46, -40]}>
          <group position={[0, -50, -19.8]}>
            <mesh geometry={battery}>
              <Material preset="absBlack" color="#ffffff" map={batteryMap} roughness={0.45} />
            </mesh>
            <mesh position={[0, 26.4, 8.75]}>
              <boxGeometry args={[22, 4.6, 15]} />
              <Material preset="absBlack" roughness={0.55} />
            </mesh>
            {[-6.3, 6.3].map((x) => (
              <mesh key={x} position={[x, 24.6, 8.75]} rotation={[0, 0, 0]}>
                <cylinderGeometry args={[3, 3, 1.2, 6]} />
                <Material preset="nickel" />
              </mesh>
            ))}
            <Anchor name="battery" position={[0, 0, 17.5]} />
          </group>
        </Explode>

        {/* Main board: selector track, fuses, shunt, A/D, jacks. */}
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
          <BoardParts />
          <RotatingGroup angle={angle} position={[0, DIAL_Y, 0]}>
            <Rotor />
          </RotatingGroup>
          <Anchor name="pads" position={[-11, DIAL_Y + 3, 7]} />
          {(Object.keys(JACK_X) as MultimeterJack[]).map((jack) => (
            <BananaJack
              key={jack}
              color={jack === 'COM' ? 'preto' : 'vermelho'}
              position={[JACK_X[jack], JACK_Y, FACE_Z]}
              depth={FACE_Z - PCB.z - PCB.t}
            />
          ))}
        </group>

        {/* LCD module: glass, zebra connectors, holder. */}
        <Explode offset={[-34, 14, 40]}>
          <group position={[0, LCD.y, 0]}>
            <mesh position={[0, 0, 16.6]}>
              <boxGeometry args={[70, 36, 2.6]} />
              <Material preset="absBlack" color="#2a2e2c" roughness={0.25} clearcoat={0.8} />
            </mesh>
            <mesh position={[0, 0, 17.92]}>
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
              <group key={side}>
                <mesh position={[0, side * 16.4, 10.65]}>
                  <boxGeometry args={[62, 2, 9.3]} />
                  <Material preset="siliconeRubber" color="#c7b9b6" roughness={0.8} />
                </mesh>
                <mesh position={[side * 33.6, 0, 10.65]}>
                  <boxGeometry args={[2.8, 36, 9.3]} />
                  <Material preset="absBlack" roughness={0.6} />
                </mesh>
              </group>
            ))}
            <Anchor name="lcd" position={[-24, 12, 18]} />
          </group>
        </Explode>

        {/* Front cover with printed face and the rubber buttons. */}
        <Explode offset={[-70, 0, 80]}>
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
            <group key={side} position={[side * BUTTON.x, BUTTON.y, FACE_Z - 2.6]}>
              <mesh geometry={button}>
                <Material
                  preset="siliconeRubber"
                  color="#ffffff"
                  map={side < 0 ? holdMap : lightMap}
                  roughness={0.62}
                  clip
                  cutColor="#25272a"
                />
              </mesh>
            </group>
          ))}
        </Explode>

        {/* Selector knob. */}
        <Explode offset={[-112, 0, 122]}>
          <RotatingGroup angle={angle} position={[0, DIAL_Y, FACE_Z + 0.08]}>
            <BarKnob radius={KNOB_R} />
          </RotatingGroup>
        </Explode>
      </group>

      {p.leads === 'conectadas' && (
        <Explode offset={[-70, 0, 80]}>
          <Leads redJack={p.redJack} />
        </Explode>
      )}
    </group>
  );
}

/** Rotor under the cover: shaft, disc and the two wiper springs. */
function Rotor() {
  const disc = useDisposable(
    () =>
      latheZ(
        [
          [0, 7.7],
          [14.2, 7.7],
          [14.2, 10],
          [4, 10.2],
          [4, FACE_Z - 0.3],
          [0, FACE_Z - 0.3],
        ],
        40,
      ),
    [],
  );
  return (
    <group>
      <mesh geometry={disc}>
        <Material preset="nylonNatural" color="#ece6d6" roughness={0.5} />
      </mesh>
      {[6.7, 12.2].map((r) => (
        <group key={r} position={[0, r, 6.9]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.9, 0, 0]} rotation={[0.35, 0, 0]}>
              <boxGeometry args={[0.9, 4.2, 0.25]} />
              <Material preset="gold" color="#e8c27a" roughness={0.25} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 9.4, 7.35]}>
        <boxGeometry args={[3.4, 9.4, 0.3]} />
        <Material preset="gold" color="#e8c27a" roughness={0.25} />
      </mesh>
    </group>
  );
}

/** Fuses with clips, shunt, A/D blob, trimmer, buzzer on the board. */
function BoardParts() {
  const top = PCB.z + PCB.t;
  const ceramic = useDisposable(
    () =>
      latheZ(
        [
          [0, -13],
          [4.9, -13],
          [5, -12.5],
          [5, 12.5],
          [4.9, 13],
          [0, 13],
        ],
        32,
      ),
    [],
  );
  const capProfile = (r: number, l: number) =>
    latheZ(
      [
        [0, -l / 2],
        [r - 0.3, -l / 2],
        [r, -l / 2 + 0.3],
        [r, l / 2],
        [0, l / 2],
      ],
      28,
    );
  const bigCap = useDisposable(() => capProfile(5.25, 6.4), []);
  const smallCap = useDisposable(() => capProfile(2.75, 4.4), []);
  const fuse10: Vec3 = [-12.5, -40, top + 1.5 + 5];
  const fuseMa: Vec3 = [20, -40, top + 1.5 + 2.6];
  const shuntPath = useMemo(
    (): Vec3[] => [
      [-34, -49.5, top],
      [-34, -49.5, top + 4],
      [-22, -49.5, top + 4],
      [-22, -49.5, top],
    ],
    [top],
  );
  return (
    <group>
      {/* 10 A ceramic fuse (10 × 38 mm) along X. */}
      <group position={fuse10} rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={ceramic}>
          <Material preset="ceramicWhite" color="#efebe2" roughness={0.6} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} geometry={bigCap} position={[0, 0, side * 15.8]}>
            <Material preset="nickel" roughness={0.25} />
          </mesh>
        ))}
      </group>
      <Anchor name="fuse10" position={[fuse10[0] - 6, fuse10[1] + 3, fuse10[2] + 5]} />
      {/* 400 mA glass fuse (5 × 20 mm) with its thin wire. */}
      <group position={fuseMa} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <cylinderGeometry args={[2.5, 2.5, 12, 24, 1, true]} />
          <Material preset="glass" side={DoubleSide} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 12, 6]} />
          <Material preset="tin" />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} geometry={smallCap} position={[0, 0, side * 7.8]}>
            <Material preset="nickel" roughness={0.25} />
          </mesh>
        ))}
      </group>
      <Anchor name="fuseMa" position={[fuseMa[0] + 4, fuseMa[1] + 2, fuseMa[2] + 3]} />
      {/* Fuse clips. */}
      {[
        [fuse10[0] - 15.8, fuse10[1], 5.3, 6.4],
        [fuse10[0] + 15.8, fuse10[1], 5.3, 6.4],
        [fuseMa[0] - 7.8, fuseMa[1], 2.9, 4],
        [fuseMa[0] + 7.8, fuseMa[1], 2.9, 4],
      ].map(([x, y, r, l], i) => (
        <group key={i} position={[x!, y!, top]}>
          <mesh position={[0, 0, 0.3]}>
            <boxGeometry args={[l! * 0.8, r! * 2.4, 0.6]} />
            <Material preset="tin" roughness={0.3} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[0, side * (r! + 0.25), r! * 0.9]}
              rotation={[side * 0.12, 0, 0]}
            >
              <boxGeometry args={[l! * 0.7, 0.4, r! * 1.7]} />
              <Material preset="tin" roughness={0.3} />
            </mesh>
          ))}
        </group>
      ))}
      {/* 10 A shunt: a thick bent wire of resistance alloy. */}
      <Wire
        points={shuntPath}
        radius={0.8}
        bend={1.6}
        material={{ preset: 'copper', color: '#c9a585', roughness: 0.3 }}
      />
      <Anchor name="shunt" position={[-28, -49.5, top + 5]} />
      {/* A/D converter under its epoxy blob (chip on board). */}
      <mesh position={[23, 31, top]} scale={[1, 1, 0.3]}>
        <sphereGeometry args={[8, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Material preset="epoxyBlack" roughness={0.35} clearcoat={0.5} />
      </mesh>
      <Anchor name="adc" position={[23, 31, top + 2.6]} />
      {/* Calibration trimmer. */}
      <group position={[-27, 31.5, top]}>
        <mesh position={[0, 0, 2.3]}>
          <boxGeometry args={[6.6, 6.6, 4.6]} />
          <Material preset="pbtBlue" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0, 4.7]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[2.3, 2.3, 0.6, 20]} />
          <Material preset="nylonNatural" color="#f2efe6" />
        </mesh>
        <mesh position={[0, 0, 5.02]} rotation={[0, 0, 0.6]}>
          <boxGeometry args={[3.4, 0.5, 0.1]} />
          <Material preset="absBlack" />
        </mesh>
      </group>
      {/* Continuity buzzer. */}
      <group position={[-26, -24, top]}>
        <mesh position={[0, 0, 2.6]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[6, 6, 5.2, 32]} />
          <Material preset="absBlack" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 5.22]}>
          <circleGeometry args={[1, 16]} />
          <Material preset="absBlack" color="#050505" />
        </mesh>
      </group>
    </group>
  );
}

/** The two test leads, routed from the jacks to the probes lying in front. */
function Leads({ redJack }: { redJack: 'VΩ' | 'mA' | '10A' }) {
  const routes = useMemo(() => {
    const black = multimeterJackMouth('COM');
    const red = multimeterJackMouth(redJack);
    const r0 = red.position;
    const crossing = redJack !== 'VΩ';
    const probeY = 8.6;
    const tilt = 0.037;
    const blackProbe = { tip: [-14, probeY, 40] as Vec3, direction: [0.45, tilt, -0.892] as Vec3 };
    const redProbe = { tip: [16, probeY, 44] as Vec3, direction: [-0.45, tilt, -0.892] as Vec3 };
    const b0 = black.position;
    const leads: {
      color: LeadColor;
      plug: { position: Vec3; direction: Vec3 };
      probe: { tip: Vec3; direction: Vec3 };
      via: Vec3[];
    }[] = [
      {
        color: 'preto',
        plug: black,
        probe: blackProbe,
        via: [
          [b0[0] - 2, 22, b0[2] + 72],
          [-2, 2, 104],
          [-24, 2, 176],
          [-58, 2, 196],
          [-88, 2, 188],
        ],
      },
      {
        color: 'vermelho',
        plug: red,
        probe: redProbe,
        via: [
          ...(crossing
            ? ([
                [r0[0], 30, r0[2] + 68],
                [12, 12, 112],
              ] as Vec3[])
            : ([
                [r0[0] + 2, 22, r0[2] + 72],
                [20, 2, 108],
              ] as Vec3[])),
          [28, 2, 180],
          [62, 2, 200],
          [92, 2, 192],
        ],
      },
    ];
    return leads;
  }, [redJack]);
  return (
    <group>
      {routes.map((lead) => (
        <TestLead key={lead.color} {...lead} />
      ))}
    </group>
  );
}
