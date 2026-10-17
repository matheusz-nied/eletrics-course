/**
 * Two-channel benchtop digital oscilloscope (100 MHz class): 7" screen
 * (800 × 480, 154 × 86 mm active area) with a 10 × 8 division graticule,
 * vertical, horizontal and trigger controls, BNC inputs CH1, CH2 and EXT.
 * Size of the class: 310–360 × 130–210 × 110–150 mm (Siglent SDS1000X-E:
 * 312 × 133 × 151 mm; Rigol DS1000Z: 362 × 208 × 121 mm); here
 * 320 × 150 × 120 mm.
 *
 * The screen is a canvas repainted while `running` (the trace is alive and
 * drifts slowly); the knobs turn to the volts/div and time/div detents.
 * Exploded view: housing, front panel, LCD module, acquisition board and
 * power supply.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { DoubleSide } from 'three';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import {
  FONT_MONO,
  FONT_SANS,
  fitText,
  getNoiseTexture,
  useCanvasTexture,
} from '../materials/textures';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta } from '../types';
import { useLiveCanvasTexture } from './_display';
import { Bnc, Decal, decalGeometry, Knob, PanelLed, roundedSlab, RubberFoot } from './_kit';

export type ScopeWaveform = 'senoide' | 'quadrada' | 'triangular' | 'nenhuma';

export interface OscilloscopeProps {
  waveform?: ScopeWaveform;
  /** Signal frequency (Hz). */
  frequency?: number;
  /** Peak amplitude (V). */
  amplitude?: number;
  voltsPerDiv?: number;
  /** Seconds per division. */
  timePerDiv?: number;
  /** Second channel on (cyan): the same signal delayed and smaller, like a capacitor voltage. */
  ch2?: boolean;
  /** Acquiring: the trace is alive; stopped, the last capture stays frozen. */
  running?: boolean;
}

const VOLTS_PER_DIV = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
const TIME_PER_DIV = [
  1e-6, 2e-6, 5e-6, 1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1,
];

/** Screen-style number with SI prefix and decimal comma: `5,00ms`, `2,00V`, `60,00Hz`. */
export function scopeValue(value: number, unit: string): string {
  if (!Number.isFinite(value)) return `---${unit}`;
  const abs = Math.abs(value);
  const prefixes: [number, string][] = [
    [1e6, 'M'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'µ'],
    [1e-9, 'n'],
  ];
  const [f, p] = prefixes.find(([k]) => abs >= k * 0.9995) ?? [1e-9, 'n'];
  const v = value / f;
  const digits = Math.abs(v) >= 100 ? 1 : 2;
  return `${v.toFixed(digits).replace('.', ',')}${p}${unit}`;
}

/** Brazilian format for the description: `5 ms`, `2 V`, `60 Hz`. */
function words(value: number, unit: string): string {
  const s = scopeValue(value, unit);
  const m = /^(-?[\d,]+)(\D*)$/.exec(s);
  if (!m) return s;
  const n = Number(m[1]!.replace(',', '.'));
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(n)} ${m[2]}`;
}

const WAVE_WORDS: Record<ScopeWaveform, string> = {
  senoide: 'senoide',
  quadrada: 'onda quadrada',
  triangular: 'onda triangular',
  nenhuma: 'nenhum sinal',
};

export const meta: PartMeta = {
  id: 'oscilloscope',
  label: 'Osciloscópio digital',
  category: 'instrumentos',
  summary:
    'Osciloscópio digital de bancada com dois canais: tela com a forma de onda ao vivo, botões de volts/div e tempo/div e entradas BNC.',
  defaults: {
    waveform: 'senoide',
    frequency: 60,
    amplitude: 5,
    voltsPerDiv: 2,
    timePerDiv: 0.005,
    ch2: false,
    running: true,
  },
  controls: {
    waveform: {
      kind: 'select',
      label: 'Forma de onda',
      options: [
        { value: 'senoide', label: 'Senoide' },
        { value: 'quadrada', label: 'Quadrada' },
        { value: 'triangular', label: 'Triangular' },
        { value: 'nenhuma', label: 'Sem sinal' },
      ],
    },
    frequency: {
      kind: 'number',
      label: 'Frequência',
      min: 1,
      max: 1_000_000,
      log: true,
      unit: 'Hz',
    },
    amplitude: {
      kind: 'number',
      label: 'Amplitude (pico)',
      min: 0,
      max: 400,
      step: 0.1,
      unit: 'V',
    },
    voltsPerDiv: {
      kind: 'select',
      label: 'Volts/div',
      options: VOLTS_PER_DIV.map((v) => ({ value: v, label: `${words(v, 'V')}/div` })),
    },
    timePerDiv: {
      kind: 'select',
      label: 'Tempo/div',
      options: TIME_PER_DIV.map((v) => ({ value: v, label: `${words(v, 's')}/div` })),
    },
    ch2: { kind: 'toggle', label: 'Canal 2 ligado' },
    running: { kind: 'toggle', label: 'Adquirindo (RODAR)' },
  },
  annotations: [
    { at: [-74, 120, 60], text: 'Tela: tensão (vertical) × tempo (horizontal)', exploded: false },
    { at: [48, 84, 70], text: 'Volts/div: altura de cada quadrado', exploded: false },
    { at: [118, 84, 70], text: 'Tempo/div: largura de cada quadrado', exploded: false },
    { at: [48, 30, 72], text: 'Entradas BNC para as pontas de prova', exploded: false },
    { at: [0, 0, 0], text: 'Conversor A/D e processador', anchor: 'adc', exploded: true },
    { at: [0, 0, 0], text: 'Fonte de alimentação interna', anchor: 'psu', exploded: true },
    { at: [0, 0, 0], text: 'Módulo da tela (LCD)', anchor: 'lcd', exploded: true },
  ],
  explode: true,
  cutaway: false,
  animated: (p) => !!p.running && p.waveform !== 'nenhuma',
  describe: (p) => {
    const wave = (p.waveform as ScopeWaveform) ?? 'senoide';
    const state = p.running ? 'adquirindo' : 'parado';
    if (wave === 'nenhuma')
      return `Osciloscópio digital ${state}, sem sinal: o traço é uma linha reta no zero. Escalas de ${words(Number(p.voltsPerDiv), 'V')} por divisão e ${words(Number(p.timePerDiv), 's')} por divisão.`;
    const f = Number(p.frequency);
    const a = Number(p.amplitude);
    const cycles = f * Number(p.timePerDiv) * 10;
    const visible =
      cycles < 0.6
        ? 'menos de um ciclo cabe na tela'
        : cycles > 40
          ? 'os ciclos ficam tão juntos que viram uma faixa'
          : `cerca de ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(cycles)} ciclos aparecem na tela`;
    return `Osciloscópio digital ${state} mostrando no canal 1 uma ${WAVE_WORDS[wave]} de ${words(f, 'Hz')} e ${words(a, 'V')} de pico (${words(a * 2, 'V')} de pico a pico), com ${words(Number(p.voltsPerDiv), 'V')} por divisão e ${words(Number(p.timePerDiv), 's')} por divisão: ${visible}.${p.ch2 ? ' O canal 2 mostra o mesmo sinal atrasado e menor.' : ''}`;
  },
  view: [0.45, 0.42, 1.25],
};

// ---------------------------------------------------------------------------
// Layout (mm): front panel at z = 60, standing on feet.
// ---------------------------------------------------------------------------

const W = 320;
const H = 150;
const D = 120;
const FEET = 6;
const BODY_H = H - FEET;
const CY = FEET + BODY_H / 2;
const FRONT_Z = D / 2;
const BEZEL_T = 16;
const SCREEN = { x: -74, y: 84, w: 152, h: 95 };
const WINDOW = { w: 162, h: 104 };

const SOFT_KEYS = [122, 104, 86, 68, 50].map((y) => ({ x: 14, y }));

// ---------------------------------------------------------------------------
// Screen drawing
// ---------------------------------------------------------------------------

const SCR_W = 1024;
const SCR_H = 640;
const GRID = { x: 16, y: 44, div: 64, nx: 10, ny: 8 };
const CH_COLORS = { ch1: '#ffe14a', ch2: '#33e6ff' };

function wave(kind: ScopeWaveform, phase: number): number {
  const s = Math.sin(phase);
  if (kind === 'quadrada') return s >= 0 ? 1 : -1;
  if (kind === 'triangular') return (2 / Math.PI) * Math.asin(s);
  if (kind === 'nenhuma') return 0;
  return s;
}

/** Deterministic small noise so the trace looks alive but reproducible. */
function noise(i: number, t: number): number {
  const x = Math.sin(i * 12.9898 + t * 78.233) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

function drawScreen(ctx: CanvasRenderingContext2D, p: Required<OscilloscopeProps>, time: number) {
  ctx.fillStyle = '#04060a';
  ctx.fillRect(0, 0, SCR_W, SCR_H);
  const gw = GRID.div * GRID.nx;
  const gh = GRID.div * GRID.ny;
  const { x: gx, y: gy, div } = GRID;

  // Graticule: dotted lines, solid axes with ticks.
  ctx.fillStyle = '#4b5562';
  for (let i = 1; i < GRID.nx; i++) {
    for (let y = gy; y <= gy + gh; y += div / 5) ctx.fillRect(gx + i * div - 1, y - 1, 2, 2);
  }
  for (let j = 1; j < GRID.ny; j++) {
    for (let x = gx; x <= gx + gw; x += div / 5) ctx.fillRect(x - 1, gy + j * div - 1, 2, 2);
  }
  ctx.strokeStyle = '#6b7684';
  ctx.lineWidth = 2;
  ctx.strokeRect(gx, gy, gw, gh);
  ctx.beginPath();
  ctx.moveTo(gx + gw / 2, gy);
  ctx.lineTo(gx + gw / 2, gy + gh);
  ctx.moveTo(gx, gy + gh / 2);
  ctx.lineTo(gx + gw, gy + gh / 2);
  ctx.stroke();
  for (let x = gx; x <= gx + gw; x += div / 5) {
    ctx.fillRect(x - 1, gy + gh / 2 - 5, 2, 10);
  }
  for (let y = gy; y <= gy + gh; y += div / 5) {
    ctx.fillRect(gx + gw / 2 - 5, y - 1, 10, 2);
  }

  const vdiv = Math.max(p.voltsPerDiv, 1e-6);
  const tdiv = Math.max(p.timePerDiv, 1e-9);
  const pxPerVolt = div / vdiv;
  const span = tdiv * GRID.nx;
  const drift = p.running ? time * 0.6 : 0;
  const ch1Pos = p.ch2 ? 1.5 * div : 0;
  const ch2Pos = -2 * div;

  const trace = (color: string, amplitude: number, lag: number, offset: number, seed: number) => {
    const center = gy + gh / 2 - offset;
    const samples = 700;
    const pts: [number, number][] = [];
    for (let i = 0; i <= samples; i++) {
      const t = -span / 2 + (span * i) / samples;
      const phase = 2 * Math.PI * p.frequency * t - lag + drift;
      const jitter = p.running ? noise(i + seed, Math.floor(time * 30)) * 1.6 : 0;
      const v = amplitude * wave(p.waveform, phase);
      const y = center - v * pxPerVolt + jitter;
      pts.push([gx + (gw * i) / samples, Math.min(Math.max(y, gy - 40), gy + gh + 40)]);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(gx, gy, gw, gh);
    ctx.clip();
    for (const [width, alpha] of [
      [9, 0.16],
      [4.5, 0.4],
      [2.2, 1],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // Channel ground marker on the left edge.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(gx - 14, center - 9);
    ctx.lineTo(gx - 2, center);
    ctx.lineTo(gx - 14, center + 9);
    ctx.closePath();
    ctx.fill();
  };
  trace(CH_COLORS.ch1, p.amplitude, 0, ch1Pos, 0);
  if (p.ch2) trace(CH_COLORS.ch2, p.amplitude * 0.62, Math.PI / 3, ch2Pos, 991);

  // Trigger markers: position (top) and level (right).
  ctx.fillStyle = '#ff9a2e';
  ctx.beginPath();
  ctx.moveTo(gx + gw / 2 - 9, gy - 14);
  ctx.lineTo(gx + gw / 2 + 9, gy - 14);
  ctx.lineTo(gx + gw / 2, gy - 2);
  ctx.closePath();
  ctx.fill();
  const level = gy + gh / 2 - ch1Pos;
  ctx.beginPath();
  ctx.moveTo(gx + gw + 14, level - 9);
  ctx.lineTo(gx + gw + 2, level);
  ctx.lineTo(gx + gw + 14, level + 9);
  ctx.closePath();
  ctx.fill();

  // Top bar.
  ctx.font = `700 22px ${FONT_SANS}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = p.running ? '#1f9d55' : '#c9302c';
  ctx.fillRect(gx, 8, 112, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(p.running ? 'RODANDO' : 'PARADO', gx + 56, 23);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#c8d0da';
  ctx.font = `500 20px ${FONT_MONO}`;
  ctx.fillText('1.00GSa/s  14k pts', gx + 128, 23);
  ctx.fillStyle = '#ff9a2e';
  ctx.fillText(`T ↑ CH1 0,00V`, gx + 420, 23);

  // Bottom bar: channel scales and time base.
  const by = gy + gh + 14;
  const box = (x: number, color: string, label: string, text: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, by, 30, 30);
    ctx.fillStyle = '#04060a';
    ctx.font = `800 22px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x + 15, by + 16);
    ctx.fillStyle = color;
    ctx.font = `600 22px ${FONT_MONO}`;
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 38, by + 16);
  };
  box(gx, CH_COLORS.ch1, '1', `${scopeValue(p.voltsPerDiv, 'V')}/`);
  if (p.ch2) box(gx + 190, CH_COLORS.ch2, '2', `${scopeValue(p.voltsPerDiv, 'V')}/`);
  ctx.fillStyle = '#e8edf3';
  ctx.font = `600 22px ${FONT_MONO}`;
  ctx.fillText(`H ${scopeValue(p.timePerDiv, 's')}/`, gx + 380, by + 16);
  ctx.fillText(
    `f=${p.waveform === 'nenhuma' ? '----' : scopeValue(p.frequency, 'Hz')}`,
    gx + 520,
    by + 16,
  );

  // Right panel: measurements and soft-key menu.
  const rx = gx + gw + 30;
  const rw = SCR_W - rx - 10;
  ctx.fillStyle = '#121822';
  ctx.fillRect(rx, gy, rw, gh);
  ctx.fillStyle = '#8fa0b4';
  ctx.font = `700 20px ${FONT_SANS}`;
  ctx.textAlign = 'left';
  ctx.fillText('MEDIDAS · CH1', rx + 14, gy + 22);
  const has = p.waveform !== 'nenhuma';
  const rms =
    p.waveform === 'quadrada'
      ? p.amplitude
      : p.waveform === 'triangular'
        ? p.amplitude / Math.sqrt(3)
        : p.amplitude / Math.SQRT2;
  const rows: [string, string][] = [
    ['Freq', has ? scopeValue(p.frequency, 'Hz') : '----'],
    ['Período', has ? scopeValue(1 / p.frequency, 's') : '----'],
    ['Vpp', has ? scopeValue(p.amplitude * 2, 'V') : '0,00V'],
    ['Vrms', has ? scopeValue(rms, 'V') : '0,00V'],
  ];
  rows.forEach(([k, v], i) => {
    const y = gy + 58 + i * 36;
    ctx.fillStyle = '#9aa7b6';
    ctx.font = `500 20px ${FONT_SANS}`;
    ctx.fillText(k, rx + 14, y);
    ctx.fillStyle = CH_COLORS.ch1;
    ctx.font = `600 21px ${FONT_MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(v, rx + rw - 12, y);
    ctx.textAlign = 'left';
  });
  const menu: [string, string][] = [
    ['Acoplamento', 'CC'],
    ['Ponta', '10X'],
    ['Inverter', 'Não'],
  ];
  menu.forEach(([k, v], i) => {
    const y = gy + 214 + i * 98;
    ctx.fillStyle = '#1c2533';
    ctx.fillRect(rx + 8, y, rw - 16, 84);
    ctx.fillStyle = '#9aa7b6';
    ctx.font = `500 19px ${FONT_SANS}`;
    ctx.fillText(k, rx + 18, y + 26);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 22px ${FONT_SANS}`;
    ctx.fillText(v, rx + 18, y + 58);
  });
}

// ---------------------------------------------------------------------------
// Front panel print
// ---------------------------------------------------------------------------

const PX = 5;
const px = (x: number) => (x + W / 2) * PX;
const py = (y: number) => (H - y) * PX;

const KNOBS = {
  pos1: { x: 48, y: 104, r: 6.5 },
  pos2: { x: 80, y: 104, r: 6.5 },
  vdiv1: { x: 48, y: 78, r: 10 },
  vdiv2: { x: 80, y: 78, r: 10 },
  hpos: { x: 115, y: 104, r: 6.5 },
  tdiv: { x: 115, y: 78, r: 10 },
  level: { x: 145, y: 104, r: 6.5 },
  multi: { x: 145, y: 133, r: 8 },
};

const BUTTONS: { x: number; y: number; w: number; label: string; color?: string }[] = [
  { x: 40, y: 130, w: 13, label: 'AUTO' },
  { x: 60, y: 130, w: 13, label: 'ÚNICO' },
  { x: 84, y: 130, w: 18, label: 'RODAR/PARAR', color: 'run' },
  { x: 108, y: 130, w: 13, label: 'MENU' },
  { x: 48, y: 56, w: 14, label: 'CH1', color: 'ch1' },
  { x: 80, y: 56, w: 14, label: 'CH2', color: 'ch2' },
  { x: 115, y: 56, w: 14, label: 'ZOOM' },
  { x: 145, y: 80, w: 14, label: 'MENU' },
  { x: 145, y: 60, w: 14, label: '50%' },
];

const BNCS = { CH1: 48, CH2: 80, EXT: 115 };
const BNC_Y = 28;

function drawPanel(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#2b2e33';
  ctx.fillRect(0, 0, w, h);
  const s = (v: number) => v * PX;
  const text = (t: string, x: number, y: number, size: number, color = '#d8dde3', weight = 600) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${s(size)}px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, px(x), py(y));
  };
  // Screen surround.
  ctx.fillStyle = '#16181b';
  ctx.beginPath();
  ctx.roundRect(
    px(SCREEN.x - WINDOW.w / 2 - 3),
    py(SCREEN.y + WINDOW.h / 2 + 3),
    s(WINDOW.w + 6),
    s(WINDOW.h + 6),
    s(3),
  );
  ctx.fill();

  ctx.fillStyle = '#eef1f4';
  fitText(ctx, 'OSCILOSCÓPIO DIGITAL', px(-130), py(142), s(80), s(4.2), {
    weight: 800,
    family: FONT_SANS,
    align: 'left',
  });
  ctx.fillStyle = '#9aa4ae';
  fitText(ctx, '2 CANAIS · 100 MHz · 1 GSa/s', px(-14), py(142), s(90), s(3), {
    weight: 600,
    family: FONT_SANS,
    align: 'right',
  });

  // Section frames.
  const frame = (x0: number, y0: number, x1: number, y1: number, title: string) => {
    ctx.strokeStyle = '#59606a';
    ctx.lineWidth = s(0.3);
    ctx.beginPath();
    ctx.roundRect(px(x0), py(y1), s(x1 - x0), s(y1 - y0), s(2));
    ctx.stroke();
    ctx.fillStyle = '#2b2e33';
    const tw = title.length * 2.1 + 4;
    ctx.fillRect(px((x0 + x1) / 2 - tw / 2), py(y1) - s(1.6), s(tw), s(3.2));
    text(title, (x0 + x1) / 2, y1, 2.6, '#aab3bd', 700);
  };
  frame(32, 46, 96, 120, 'VERTICAL');
  frame(100, 46, 130, 120, 'HORIZONTAL');
  frame(134, 46, 156, 120, 'GATILHO');

  for (const k of [KNOBS.pos1, KNOBS.pos2, KNOBS.hpos, KNOBS.level])
    text(k === KNOBS.level ? 'NÍVEL' : 'POSIÇÃO', k.x, k.y + 10.2, 2.1, '#aab3bd');
  text('VOLTS/DIV', KNOBS.vdiv1.x, KNOBS.vdiv1.y + 14, 2.3);
  text('VOLTS/DIV', KNOBS.vdiv2.x, KNOBS.vdiv2.y + 14, 2.3);
  text('TEMPO/DIV', KNOBS.tdiv.x, KNOBS.tdiv.y + 14, 2.3);
  // Detent ticks around the big knobs.
  for (const k of [KNOBS.vdiv1, KNOBS.vdiv2, KNOBS.tdiv]) {
    ctx.strokeStyle = '#7d8590';
    ctx.lineWidth = s(0.3);
    for (let i = -6; i <= 6; i++) {
      const a = (i * 22.5 * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(px(k.x + Math.sin(a) * (k.r + 1.2)), py(k.y + Math.cos(a) * (k.r + 1.2)));
      ctx.lineTo(px(k.x + Math.sin(a) * (k.r + 2.4)), py(k.y + Math.cos(a) * (k.r + 2.4)));
      ctx.stroke();
    }
  }
  for (const b of BUTTONS) {
    const color = b.color === 'ch1' ? CH_COLORS.ch1 : b.color === 'ch2' ? CH_COLORS.ch2 : '#c3cad2';
    text(b.label, b.x, b.y + (b.y < 70 ? -6.6 : 6.2), b.label.length > 6 ? 1.9 : 2.2, color, 700);
  }
  for (const [label, x] of Object.entries(BNCS)) {
    const color = label === 'CH1' ? CH_COLORS.ch1 : label === 'CH2' ? CH_COLORS.ch2 : '#c3cad2';
    ctx.strokeStyle = color;
    ctx.lineWidth = s(0.6);
    ctx.beginPath();
    ctx.arc(px(x), py(BNC_Y), s(9.6), 0, Math.PI * 2);
    ctx.stroke();
    text(label, x, BNC_Y + 13, 2.8, color, 800);
  }
  text('1 MΩ ∥ 15 pF   300 V RMS  CAT II', 82, 12, 2, '#9aa4ae');
  // Probe compensation terminals.
  text('3 V  1 kHz', 145, 40, 2, '#9aa4ae');
  // Power and USB.
  text('LIGA', -146, 33, 2.2, '#c3cad2', 700);
  text('USB', -122, 33, 2.2, '#c3cad2', 700);
  ctx.strokeStyle = '#c3cad2';
  ctx.lineWidth = s(0.5);
  ctx.beginPath();
  ctx.arc(px(-146), py(22), s(2.2), -Math.PI * 0.32, Math.PI * 1.32);
  ctx.moveTo(px(-146), py(25.2));
  ctx.lineTo(px(-146), py(21.8));
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Part
// ---------------------------------------------------------------------------

function nearestIndex(list: number[], value: number) {
  let best = 0;
  list.forEach((v, i) => {
    if (Math.abs(Math.log(v / value)) < Math.abs(Math.log(list[best]! / value))) best = i;
  });
  return best;
}

export default function Oscilloscope(props: OscilloscopeProps) {
  const p = { ...meta.defaults, ...props } as Required<OscilloscopeProps>;
  const params = useMemo(
    () =>
      ({
        ...p,
        frequency: Math.max(Number(p.frequency) || 0, 0.001),
        amplitude: Math.max(Number(p.amplitude) || 0, 0),
        voltsPerDiv: Number(p.voltsPerDiv) || 1,
        timePerDiv: Number(p.timePerDiv) || 1e-3,
      }) as Required<OscilloscopeProps>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.waveform, p.frequency, p.amplitude, p.voltsPerDiv, p.timePerDiv, p.ch2, p.running],
  );
  const noiseMap = getNoiseTexture();
  const screen = useLiveCanvasTexture(SCR_W, SCR_H);
  const clock = useRef({ time: 0, last: -1 });

  useEffect(() => {
    screen.paint((ctx) => drawScreen(ctx, params, clock.current.time));
  }, [screen, params]);

  useFrame((_, dt) => {
    if (!params.running || params.waveform === 'nenhuma') return;
    const c = clock.current;
    c.time += Math.min(dt, 0.1);
    if (c.time - c.last < 1 / 30) return;
    c.last = c.time;
    screen.paint((ctx) => drawScreen(ctx, params, c.time));
  });

  const panelMap = useCanvasTexture(drawPanel, 'scope-panel-v1', {
    width: W * PX,
    height: H * PX,
    fonts: [`800 40px ${FONT_SANS}`, `700 40px ${FONT_SANS}`, `600 40px ${FONT_SANS}`],
  });

  const housing = useDisposable(() => {
    const g = roundedSlab({
      width: W - 6,
      height: BODY_H - 6,
      depth: D - BEZEL_T + 4,
      radius: 10,
      bevel: 4,
    });
    g.translate(0, CY, -FRONT_Z);
    return g;
  }, []);
  const holes = useMemo(
    () => [
      {
        kind: 'rect' as const,
        w: WINDOW.w,
        h: WINDOW.h,
        r: 3,
        x: SCREEN.x,
        y: SCREEN.y - CY,
      },
    ],
    [],
  );
  const bezel = useDisposable(() => {
    const g = roundedSlab({ width: W, height: BODY_H, depth: BEZEL_T, radius: 9, bevel: 3, holes });
    g.translate(0, CY, FRONT_Z - BEZEL_T);
    return g;
  }, []);
  const panelDecal = useDisposable(() => {
    const g = decalGeometry(W - 6, BODY_H - 6, 7, holes);
    // UVs of the decal span the full panel print (W × H from y = 0).
    const pos = g.attributes.position!;
    const uv = g.attributes.uv!;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) + W / 2) / W, (pos.getY(i) + CY) / H);
    }
    g.translate(0, CY, 0);
    return g;
  }, []);
  const button = useDisposable(
    () => roundedSlab({ width: 1, height: 1, depth: 1, radius: 0.25, bevel: 0.12 }),
    [],
  );
  const vIndex = nearestIndex(VOLTS_PER_DIV, params.voltsPerDiv);
  const tIndex = nearestIndex(TIME_PER_DIV, params.timePerDiv);
  const vAngle = ((vIndex - 7) * 22.5 * Math.PI) / 180;
  const tAngle = ((tIndex - 8) * 22.5 * Math.PI) / 180;

  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <RubberFoot key={`${sx}${sz}`} position={[sx * 132, 0, sz * 44]} r={9} h={FEET + 0.5} />
        )),
      )}

      {/* Housing (lifts off in the exploded view). */}
      <Explode offset={[0, 215, -90]}>
        <mesh geometry={housing}>
          <Material preset="absGray" color="#cfd3d8" roughness={0.55} roughnessMap={noiseMap} />
        </mesh>
        <SideVents />
      </Explode>

      {/* Internals (rise above the panel in the exploded view). */}
      <Explode offset={[0, 150, -40]} delay={0.15}>
        <Internals />
      </Explode>

      {/* LCD module behind the window. */}
      <Explode offset={[0, 0, 46]}>
        <group position={[SCREEN.x, SCREEN.y, 0]}>
          <mesh position={[0, 0, FRONT_Z - 12]}>
            <boxGeometry args={[WINDOW.w + 8, WINDOW.h + 8, 6]} />
            <Material preset="steel" color="#8e9399" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0, FRONT_Z - 8.9]}>
            <planeGeometry args={[WINDOW.w + 4, WINDOW.h + 4]} />
            <Material preset="absBlack" color="#050608" roughness={0.2} />
          </mesh>
          <mesh position={[0, 0, FRONT_Z - 8.8]}>
            <planeGeometry args={[SCREEN.w, SCREEN.h]} />
            <Material
              color="#ffffff"
              map={screen.texture}
              emissive="#ffffff"
              emissiveMap={screen.texture}
              emissiveIntensity={2.2}
              roughness={0.15}
              clearcoat={1}
              clearcoatRoughness={0.03}
            />
          </mesh>
          <Anchor name="lcd" position={[-50, 30, FRONT_Z - 8]} />
        </group>
      </Explode>

      {/* Front bezel with the printed panel, keys, knobs and BNC inputs. */}
      <Explode offset={[0, 0, 96]}>
        <mesh geometry={bezel}>
          <Material preset="absDark" color="#2b2e33" roughness={0.5} roughnessMap={noiseMap} />
        </mesh>
        <Decal
          geometry={panelDecal}
          map={panelMap}
          position={[0, 0, FRONT_Z + 0.01]}
          material={{ roughness: 0.5, roughnessMap: noiseMap }}
        />
        {SOFT_KEYS.map((k, i) => (
          <mesh key={i} geometry={button} position={[k.x, k.y, FRONT_Z - 0.5]} scale={[11, 7, 3]}>
            <Material preset="siliconeRubber" color="#5d636b" roughness={0.6} />
          </mesh>
        ))}
        {BUTTONS.map((b, i) => {
          const lit = b.color === 'run' || b.color === 'ch1' || (b.color === 'ch2' && params.ch2);
          const color =
            b.color === 'run'
              ? params.running
                ? '#2bd46a'
                : '#ff3b30'
              : b.color === 'ch1'
                ? CH_COLORS.ch1
                : b.color === 'ch2'
                  ? CH_COLORS.ch2
                  : '#6a7079';
          return (
            <mesh
              key={i}
              geometry={button}
              position={[b.x, b.y, FRONT_Z - 0.5]}
              scale={[b.w, 7, 3.2]}
            >
              <Material
                preset="siliconeRubber"
                color={b.color ? (lit ? color : '#7d828a') : color}
                roughness={0.5}
                emissive={lit ? color : '#000000'}
                emissiveIntensity={lit ? 0.9 : 0}
              />
            </mesh>
          );
        })}
        <Knob
          radius={KNOBS.pos1.r}
          height={9}
          ribs={18}
          position={[KNOBS.pos1.x, KNOBS.pos1.y, FRONT_Z]}
          color="#3a3d42"
        />
        <Knob
          radius={KNOBS.pos2.r}
          height={9}
          ribs={18}
          position={[KNOBS.pos2.x, KNOBS.pos2.y, FRONT_Z]}
          color="#3a3d42"
        />
        <Knob
          radius={KNOBS.hpos.r}
          height={9}
          ribs={18}
          position={[KNOBS.hpos.x, KNOBS.hpos.y, FRONT_Z]}
          color="#3a3d42"
        />
        <Knob
          radius={KNOBS.level.r}
          height={9}
          ribs={18}
          position={[KNOBS.level.x, KNOBS.level.y, FRONT_Z]}
          color="#3a3d42"
        />
        <Knob
          radius={KNOBS.multi.r}
          height={10}
          ribs={22}
          position={[KNOBS.multi.x, KNOBS.multi.y, FRONT_Z]}
          color="#3a3d42"
          capMetal
        />
        <Knob
          radius={KNOBS.vdiv1.r}
          height={13}
          ribs={26}
          angle={vAngle}
          position={[KNOBS.vdiv1.x, KNOBS.vdiv1.y, FRONT_Z]}
          color="#2e3135"
          capColor={CH_COLORS.ch1}
          pointerColor="#1b1b1b"
        />
        <Knob
          radius={KNOBS.vdiv2.r}
          height={13}
          ribs={26}
          angle={vAngle}
          position={[KNOBS.vdiv2.x, KNOBS.vdiv2.y, FRONT_Z]}
          color="#2e3135"
          capColor={CH_COLORS.ch2}
          pointerColor="#1b1b1b"
        />
        <Knob
          radius={KNOBS.tdiv.r}
          height={13}
          ribs={26}
          angle={tAngle}
          position={[KNOBS.tdiv.x, KNOBS.tdiv.y, FRONT_Z]}
          color="#2e3135"
          capMetal
        />
        {Object.values(BNCS).map((x) => (
          <Bnc key={x} position={[x, BNC_Y, FRONT_Z]} />
        ))}
        {/* Probe compensation: signal and ground lugs. */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[145 + side * 4.5, 31, FRONT_Z + 4]}>
            <boxGeometry args={[2.4, 6, 8]} />
            <Material preset="nickel" />
          </mesh>
        ))}
        {/* Power key and USB port. */}
        <mesh geometry={button} position={[-146, 22, FRONT_Z - 0.5]} scale={[11, 11, 3.4]}>
          <Material preset="siliconeRubber" color="#4b5058" roughness={0.5} />
        </mesh>
        <PanelLed position={[-137, 22, FRONT_Z]} color="#2bd46a" lit />
        <mesh position={[-122, 22, FRONT_Z + 0.02]}>
          <planeGeometry args={[12.4, 5]} />
          <Material preset="absBlack" color="#050505" />
        </mesh>
        <mesh position={[-122, 22.6, FRONT_Z - 0.2]}>
          <boxGeometry args={[11.4, 1.8, 1]} />
          <Material preset="nickel" />
        </mesh>
      </Explode>
    </group>
  );
}

function SideVents() {
  const map = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#cfd3d8';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#20242a';
      for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        ctx.roundRect(w * 0.06 + (i * w * 0.88) / 14, h * 0.1, w * 0.03, h * 0.8, w * 0.015);
        ctx.fill();
      }
    },
    'scope-vents',
    { width: 512, height: 256 },
  );
  return (
    <>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (W / 2 - 3 + 0.05), CY + 8, -12]}
          rotation={[0, (side * Math.PI) / 2, 0]}
        >
          <planeGeometry args={[70, 44]} />
          <Material
            color="#ffffff"
            map={map}
            roughness={0.55}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ))}
    </>
  );
}

function Internals() {
  return (
    <group>
      {/* Acquisition board: front end, A/D converter, processor, memory. */}
      <group position={[45, FEET + 8, -6]}>
        <mesh>
          <boxGeometry args={[200, 1.6, 96]} />
          <Material preset="solderMask" color="#1d4a35" roughness={0.45} />
        </mesh>
        {[
          { x: 58, z: -16, w: 26, d: 26, h: 2.2, c: '#1a1a1c' },
          { x: 16, z: -12, w: 17, d: 17, h: 2, c: '#1a1a1c' },
          { x: -28, z: -22, w: 12, d: 10, h: 1.4, c: '#1a1a1c' },
          { x: -28, z: -4, w: 12, d: 10, h: 1.4, c: '#1a1a1c' },
        ].map((chip, i) => (
          <mesh key={i} position={[chip.x, chip.h / 2 + 0.8, chip.z]}>
            <boxGeometry args={[chip.w, chip.h, chip.d]} />
            <Material preset="epoxyBlack" color={chip.c} roughness={0.5} />
          </mesh>
        ))}
        {/* Shield cans over the analogue front end, behind the BNCs. */}
        {[3, 35].map((x) => (
          <mesh key={x} position={[x, 5, 40]}>
            <boxGeometry args={[24, 9, 22]} />
            <Material preset="tin" roughness={0.35} />
          </mesh>
        ))}
        {/* Electrolytic capacitors, crystal and the LCD ribbon connector. */}
        {[
          [-48, -30],
          [-48, -16],
          [-48, -2],
        ].map(([x, z], i) => (
          <mesh key={`c${i}`} position={[x!, 5.3, z!]}>
            <cylinderGeometry args={[3.2, 3.2, 9, 20]} />
            <Material preset="sleeve" color="#24252a" />
          </mesh>
        ))}
        <mesh position={[36, 2, -38]}>
          <boxGeometry args={[11, 2.5, 4.5]} />
          <Material preset="steel" roughness={0.3} />
        </mesh>
        <mesh position={[-2, 3.3, -40]}>
          <boxGeometry args={[34, 5, 6]} />
          <Material preset="absWhite" color="#e8e2d2" roughness={0.6} />
        </mesh>
        <mesh position={[-2, 5.95, -26]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[30, 26]} />
          <Material color="#c9842f" roughness={0.45} metalness={0.2} side={DoubleSide} />
        </mesh>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={`r${i}`} position={[-40 + (i % 7) * 7, 1.2, 18 + Math.floor(i / 7) * 6]}>
            <boxGeometry args={[3.2, 0.8, 1.6]} />
            <Material preset="epoxyBlack" color={i % 3 ? '#2a2a2c' : '#b8a888'} roughness={0.6} />
          </mesh>
        ))}
        <Anchor name="adc" position={[16, 3, -12]} />
      </group>
      {/* Power supply board with transformer and capacitors. */}
      <group position={[-106, FEET + 8, -20]}>
        <mesh>
          <boxGeometry args={[80, 1.6, 70]} />
          <Material preset="fr4" color="#c8b886" roughness={0.6} />
        </mesh>
        <mesh position={[-10, 10, -6]}>
          <boxGeometry args={[24, 18, 20]} />
          <Material preset="ferrite" />
        </mesh>
        {[
          [18, 12],
          [18, -12],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x!, 11, z!]}>
            <cylinderGeometry args={[6, 6, 20, 24]} />
            <Material preset="sleeve" color="#1d2a6e" />
          </mesh>
        ))}
        {/* Switching transistor on an aluminium heatsink. */}
        <mesh position={[20, 13, -26]}>
          <boxGeometry args={[30, 24, 3]} />
          <Material preset="aluminum" roughness={0.5} />
        </mesh>
        <mesh position={[20, 9, -23.5]}>
          <boxGeometry args={[10, 15, 2]} />
          <Material preset="epoxyBlack" />
        </mesh>
        <Anchor name="psu" position={[-10, 20, -6]} />
      </group>
    </group>
  );
}
