/**
 * Canvas drawing shared by the instruments: seven-segment glyphs (reflective
 * LCDs and LED displays), the multimeter / clamp meter LCD layout with its
 * icons, units and bar graph, and a canvas texture that can be repainted
 * every frame (oscilloscope screen).
 *
 * The digits are drawn as real segment polygons (hexagonal bars, slanted like
 * a meter LCD), not with a font, so every glyph looks like the device.
 */
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { CanvasTexture, ClampToEdgeWrapping, SRGBColorSpace } from 'three';
import { FONT_SANS, fitText } from '../materials/textures';

/** Lit segments (a–g) of each character a seven-segment cell can show. */
const SEGMENTS: Record<string, string> = {
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
  _: 'd',
  ' ': '',
  A: 'abcefg',
  b: 'cdefg',
  C: 'adef',
  c: 'deg',
  d: 'bcdeg',
  E: 'adefg',
  F: 'aefg',
  G: 'acdef',
  H: 'bcefg',
  h: 'cefg',
  I: 'ef',
  i: 'c',
  J: 'bcde',
  L: 'def',
  n: 'ceg',
  O: 'abcdef',
  o: 'cdeg',
  P: 'abefg',
  r: 'eg',
  S: 'acdfg',
  t: 'defg',
  U: 'bcdef',
  u: 'cde',
  y: 'bcdfg',
};

export function segmentsFor(ch: string): string {
  return SEGMENTS[ch] ?? SEGMENTS[ch.toUpperCase()] ?? SEGMENTS[ch.toLowerCase()] ?? '';
}

export interface SegmentCell {
  segments: string;
  /** Decimal point lit after this digit. */
  dp: boolean;
}

/**
 * Splits a reading into `digits` cells, right-aligned, with each decimal
 * point attached to the digit before it (`"127.3"` → 1 2 7. 3). With
 * `minusSign`, a leading minus is returned apart (LCDs have a minus icon).
 */
export function layoutSegmentText(
  text: string,
  digits: number,
  minusSign = true,
): { cells: SegmentCell[]; negative: boolean } {
  let t = text.trim().replace(/,/g, '.');
  let negative = false;
  if (minusSign && t.startsWith('-') && t.length > 1) {
    negative = true;
    t = t.slice(1);
  }
  const cells: SegmentCell[] = [];
  for (const ch of t) {
    if (ch === '.') {
      const last = cells[cells.length - 1];
      if (last && !last.dp) last.dp = true;
      else cells.push({ segments: '', dp: true });
    } else {
      cells.push({ segments: segmentsFor(ch), dp: false });
    }
  }
  const visible = cells.slice(-digits);
  while (visible.length < digits) visible.unshift({ segments: '', dp: false });
  return { cells: visible, negative };
}

export interface SegmentStyle {
  /** Colour of lit segments. */
  on: string;
  /** Colour of unlit segments (faint ghost), or none. */
  off?: string;
  /** Segment thickness as a fraction of the digit width. */
  thickness?: number;
  /** Slant (tangent of the angle; 0.12 ≈ 7°). */
  slant?: number;
  /** Glow radius in px around lit segments (LED displays). */
  glow?: number;
  glowColor?: string;
}

type Pt = [number, number];

/** Polygons of the seven segments of a digit box (x, y = top-left). */
function segmentPolygons(x: number, y: number, w: number, h: number, t: number) {
  const g = t * 0.14;
  const ht = t / 2;
  const left = x + ht;
  const right = x + w - ht;
  const top = y + ht;
  const mid = y + h / 2;
  const bottom = y + h - ht;
  const hSeg = (x0: number, x1: number, yc: number): Pt[] => [
    [x0 + g, yc],
    [x0 + g + ht, yc - ht],
    [x1 - g - ht, yc - ht],
    [x1 - g, yc],
    [x1 - g - ht, yc + ht],
    [x0 + g + ht, yc + ht],
  ];
  const vSeg = (xc: number, y0: number, y1: number): Pt[] => [
    [xc, y0 + g],
    [xc + ht, y0 + g + ht],
    [xc + ht, y1 - g - ht],
    [xc, y1 - g],
    [xc - ht, y1 - g - ht],
    [xc - ht, y0 + g + ht],
  ];
  return {
    a: hSeg(left, right, top),
    g: hSeg(left, right, mid),
    d: hSeg(left, right, bottom),
    f: vSeg(left, top, mid),
    b: vSeg(right, top, mid),
    e: vSeg(left, mid, bottom),
    c: vSeg(right, mid, bottom),
  } as Record<string, Pt[]>;
}

function fillPolygon(ctx: CanvasRenderingContext2D, points: Pt[], slant: number, baseY: number) {
  ctx.beginPath();
  points.forEach(([px, py], i) => {
    const sx = px + slant * (baseY - py);
    if (i === 0) ctx.moveTo(sx, py);
    else ctx.lineTo(sx, py);
  });
  ctx.closePath();
  ctx.fill();
}

/** One seven-segment digit (and its decimal point) in the box x, y, w, h. */
export function drawSegmentDigit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cell: SegmentCell,
  style: SegmentStyle,
  showDp = true,
) {
  const t = w * (style.thickness ?? 0.17);
  const slant = style.slant ?? 0.1;
  const polys = segmentPolygons(x, y, w, h, t);
  const baseY = y + h;
  const dpSize = t * 1.05;
  const dpX = x + w + t * 0.55;
  const dpY = y + h - dpSize;
  const drawDp = (lit: boolean) => {
    ctx.fillStyle = lit ? style.on : (style.off ?? 'transparent');
    if (!lit && !style.off) return;
    fillPolygon(
      ctx,
      [
        [dpX, dpY],
        [dpX + dpSize, dpY],
        [dpX + dpSize, dpY + dpSize],
        [dpX, dpY + dpSize],
      ],
      slant,
      baseY,
    );
  };
  if (style.off) {
    ctx.fillStyle = style.off;
    for (const key of 'abcdefg')
      if (!cell.segments.includes(key)) fillPolygon(ctx, polys[key]!, slant, baseY);
    if (showDp && !cell.dp) drawDp(false);
  }
  ctx.save();
  if (style.glow) {
    ctx.shadowColor = style.glowColor ?? style.on;
    ctx.shadowBlur = style.glow;
  }
  ctx.fillStyle = style.on;
  for (const key of cell.segments) {
    const poly = polys[key];
    if (poly) fillPolygon(ctx, poly, slant, baseY);
  }
  if (showDp && cell.dp) drawDp(true);
  ctx.restore();
}

/** A row of digits starting at x (digit width w, pitch between digits). */
export function drawSegmentRow(
  ctx: CanvasRenderingContext2D,
  cells: SegmentCell[],
  x: number,
  y: number,
  w: number,
  h: number,
  pitch: number,
  style: SegmentStyle,
) {
  cells.forEach((cell, i) => drawSegmentDigit(ctx, x + i * pitch, y, w, h, cell, style));
}

// ---------------------------------------------------------------------------
// Reflective LCD of handheld meters
// ---------------------------------------------------------------------------

export const LCD_BACKGROUND = '#b4bbab';
export const LCD_INK = '#161a19';
/** Unlit segments of a reflective LCD are barely visible. */
export const LCD_GHOST = 'rgba(20, 28, 24, 0.055)';

export interface MeterLcdSpec {
  /** Powered: when false only the empty glass shows. */
  on: boolean;
  text: string;
  digits: number;
  /** Unit as shown: `mV`, `V`, `kΩ`, `mA`, `A`, `hFE`… */
  unit: string;
  ac?: boolean;
  dc?: boolean;
  auto?: boolean;
  hold?: boolean;
  lowBattery?: boolean;
  diode?: boolean;
  buzzer?: boolean;
  /** Bar graph fill 0..1, or null for an LCD without a bar graph. */
  bar?: number | null;
  /** Text of the bar graph scale. */
  barScale?: string[];
}

const UNIT_TOKENS: { token: string; col: number; row: number }[] = [
  { token: 'm', col: 0, row: 0 },
  { token: 'k', col: 1, row: 0 },
  { token: 'M', col: 2, row: 0 },
  { token: 'V', col: 0, row: 1 },
  { token: 'A', col: 1, row: 1 },
  { token: 'Ω', col: 2, row: 1 },
];

/** Which unit tokens a unit string lights: `kΩ` → k + Ω; `hFE` is a token of its own. */
function unitTokens(unit: string): Set<string> {
  const lit = new Set<string>();
  if (!unit) return lit;
  if (unit === 'hFE') {
    lit.add('hFE');
    return lit;
  }
  const prefix = unit.length > 1 ? unit[0]! : '';
  const base = unit.length > 1 ? unit.slice(1) : unit;
  if (prefix === 'µ' || prefix === 'u') lit.add('µ');
  else if (prefix) lit.add(prefix);
  lit.add(base);
  return lit;
}

/** Sine "~" (AC) or solid-over-dashed "⎓" (DC) symbol. */
export function drawCurrentKind(
  ctx: CanvasRenderingContext2D,
  kind: 'ac' | 'dc',
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.lineWidth = h * 0.16;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  if (kind === 'ac') {
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const px = x + t * w;
      const py = y + h / 2 - Math.sin(t * Math.PI * 2) * h * 0.32;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  } else {
    ctx.moveTo(x, y + h * 0.3);
    ctx.lineTo(x + w, y + h * 0.3);
    ctx.stroke();
    const dash = w / 5;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + i * dash * 2, y + h * 0.62, dash, h * 0.16);
    }
  }
}

function drawBattery(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.lineWidth = h * 0.12;
  ctx.strokeRect(x, y, w * 0.88, h);
  ctx.fillRect(x + w * 0.88, y + h * 0.3, w * 0.12, h * 0.4);
  ctx.fillRect(x + w * 0.1, y + h * 0.2, w * 0.18, h * 0.6);
  ctx.font = `700 ${h * 0.55}px ${FONT_SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('−', x + w * 0.42, y + h * 0.52);
  ctx.fillText('+', x + w * 0.7, y + h * 0.52);
}

export function drawDiode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.lineWidth = h * 0.12;
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.28, y + h * 0.1);
  ctx.lineTo(x + w * 0.66, y + h / 2);
  ctx.lineTo(x + w * 0.28, y + h * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x + w * 0.66, y + h * 0.1, h * 0.12, h * 0.8);
}

export function drawBuzzer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.35);
  ctx.lineTo(x + w * 0.18, y + h * 0.35);
  ctx.lineTo(x + w * 0.42, y + h * 0.1);
  ctx.lineTo(x + w * 0.42, y + h * 0.9);
  ctx.lineTo(x + w * 0.18, y + h * 0.65);
  ctx.lineTo(x, y + h * 0.65);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = h * 0.1;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(x + w * 0.42, y + h / 2, w * 0.15 * i, -0.7, 0.7);
    ctx.stroke();
  }
}

/**
 * Draws a handheld meter LCD: icon row, minus sign, digits, units and an
 * optional bar graph. The canvas should be about 2.3 : 1.
 */
export function drawMeterLcd(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  spec: MeterLcdSpec,
) {
  // Glass: slightly lighter in the middle, darker at the edges (polariser).
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#a9b0a1');
  bg.addColorStop(0.18, LCD_BACKGROUND);
  bg.addColorStop(0.82, LCD_BACKGROUND);
  bg.addColorStop(1, '#a5ac9d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const on = spec.on;
  const ink = (lit: boolean | undefined) => (on && lit ? LCD_INK : LCD_GHOST);
  const hasBar = spec.bar !== null && spec.bar !== undefined;

  // Icon row.
  const iconY = H * 0.06;
  const iconH = H * 0.1;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `700 ${iconH * 0.95}px ${FONT_SANS}`;
  ctx.fillStyle = ink(spec.auto);
  ctx.fillText('AUTO', W * 0.035, iconY + iconH / 2);
  ctx.fillStyle = ink(spec.hold);
  ctx.fillText('HOLD', W * 0.2, iconY + iconH / 2);
  ctx.fillStyle = ctx.strokeStyle = ink(spec.ac);
  drawCurrentKind(ctx, 'ac', W * 0.37, iconY, W * 0.06, iconH);
  ctx.fillStyle = ctx.strokeStyle = ink(spec.dc);
  drawCurrentKind(ctx, 'dc', W * 0.46, iconY, W * 0.06, iconH);
  ctx.fillStyle = ctx.strokeStyle = ink(spec.diode);
  drawDiode(ctx, W * 0.6, iconY, W * 0.065, iconH);
  ctx.fillStyle = ctx.strokeStyle = ink(spec.buzzer);
  drawBuzzer(ctx, W * 0.7, iconY - iconH * 0.05, W * 0.06, iconH * 1.1);
  ctx.fillStyle = ctx.strokeStyle = ink(spec.lowBattery);
  drawBattery(ctx, W * 0.85, iconY, W * 0.1, iconH);

  // Digits.
  const digitTop = H * (hasBar ? 0.22 : 0.24);
  const digitH = H * (hasBar ? 0.5 : 0.6);
  const digitW = digitH * 0.5;
  const pitch = digitW * 1.32;
  const digitsX = W * 0.115;
  const { cells, negative } = layoutSegmentText(on ? spec.text : '', spec.digits);
  drawSegmentRow(ctx, cells, digitsX, digitTop, digitW, digitH, pitch, {
    on: LCD_INK,
    off: LCD_GHOST,
    thickness: 0.17,
    slant: 0.09,
  });
  // Minus sign.
  ctx.fillStyle = ink(negative);
  ctx.fillRect(W * 0.03, digitTop + digitH * 0.46, W * 0.055, digitH * 0.085);

  // Unit tokens (two rows of three) or hFE.
  const lit = unitTokens(on ? spec.unit : '');
  const unitX = digitsX + pitch * spec.digits + W * 0.01;
  const colW = (W * 0.985 - unitX) / 3;
  const rowY = [digitTop + digitH * 0.2, digitTop + digitH * 0.68];
  ctx.textAlign = 'center';
  for (const { token, col, row } of UNIT_TOKENS) {
    const size = row === 0 ? digitH * 0.3 : digitH * 0.44;
    ctx.font = `700 ${size}px ${FONT_SANS}`;
    ctx.fillStyle = ink(lit.has(token));
    ctx.fillText(token, unitX + colW * (col + 0.5), rowY[row]!);
  }
  ctx.font = `700 ${digitH * 0.2}px ${FONT_SANS}`;
  ctx.fillStyle = ink(lit.has('µ'));
  ctx.fillText('µ', unitX + colW * 0.5, digitTop - digitH * 0.04);
  ctx.fillStyle = ink(lit.has('hFE'));
  ctx.fillText('hFE', unitX + colW * 1.9, digitTop - digitH * 0.04);

  // Bar graph.
  if (hasBar) {
    const segments = 30;
    const barX = W * 0.06;
    const barW = W * 0.88;
    const barY = H * 0.8;
    const barH = H * 0.06;
    const fill = on ? Math.round(Math.min(Math.max(spec.bar ?? 0, 0), 1) * segments) : 0;
    const segW = barW / segments;
    for (let i = 0; i < segments; i++) {
      ctx.fillStyle = i < fill ? LCD_INK : LCD_GHOST;
      ctx.fillRect(barX + i * segW + segW * 0.12, barY, segW * 0.76, barH);
    }
    const scale = spec.barScale ?? ['0', '1', '2', '3', '4', '5', '6'];
    ctx.font = `600 ${H * 0.065}px ${FONT_SANS}`;
    ctx.fillStyle = ink(true);
    ctx.textAlign = 'center';
    scale.forEach((label, i) => {
      const px = barX + (barW * i) / (scale.length - 1);
      ctx.fillRect(px - 1.5, barY + barH + H * 0.008, 3, H * 0.025);
      ctx.fillText(label, px, barY + barH + H * 0.075);
    });
  }

  // Glass edge: the seal of the LCD cell darkens the border.
  ctx.strokeStyle = 'rgba(40, 46, 40, 0.35)';
  ctx.lineWidth = Math.max(W, H) * 0.008;
  ctx.strokeRect(0, 0, W, H);
}

/**
 * Function symbol printed around a selector: a letter with the AC "~" or DC
 * "⎓" mark after it (`V~`, `A⎓`), or the letter alone (`Ω`).
 */
export function drawFunctionSymbol(
  ctx: CanvasRenderingContext2D,
  letter: string,
  kind: 'ac' | 'dc' | null,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.font = `700 ${size}px ${FONT_SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (!kind) {
    ctx.fillText(letter, x, y);
    return;
  }
  ctx.fillText(letter, x - size * 0.35, y);
  drawCurrentKind(ctx, kind, x + size * 0.12, y - size * 0.32, size * 0.7, size * 0.55);
}

/** Printed top of a rubber key: yellow HOLD or the backlight symbol. */
export function drawKeyLabel(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  kind: 'hold' | 'luz',
) {
  ctx.fillStyle = '#34373c';
  ctx.fillRect(0, 0, W, H);
  if (kind === 'hold') {
    ctx.fillStyle = '#ffd04a';
    fitText(ctx, 'HOLD', W / 2, H / 2 + 2, W * 0.7, H * 0.5, { weight: 800, family: FONT_SANS });
    return;
  }
  // Sun symbol of the backlight key.
  ctx.strokeStyle = ctx.fillStyle = '#f2f2ee';
  const cx = W / 2;
  const cy = H / 2;
  const r = H * 0.14;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = H * 0.06;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 1.5);
    ctx.lineTo(cx + Math.cos(a) * r * 2.3, cy + Math.sin(a) * r * 2.3);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// LED seven-segment displays (bench power supply)
// ---------------------------------------------------------------------------

export const LED_DISPLAY_COLORS = {
  vermelho: { on: '#ff3a26', core: '#ffd2c8', off: '#2a0c0a', bg: '#100505' },
  verde: { on: '#3dff6a', core: '#d9ffe2', off: '#0a2210', bg: '#040d06' },
} as const;

export type LedDisplayColor = keyof typeof LED_DISPLAY_COLORS;

/**
 * A row of LED seven-segment digits behind a tinted filter. The canvas is
 * used as map and emissive map, so lit segments glow and the rest stays dark.
 */
export function drawLedDisplay(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  text: string,
  digits: number,
  color: LedDisplayColor,
  on: boolean,
) {
  const c = LED_DISPLAY_COLORS[color];
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  const digitH = H * 0.74;
  const digitW = digitH * 0.56;
  const pitch = (W * 0.86) / digits;
  const x0 = W * 0.07 + (pitch - digitW) * 0.35;
  const y0 = (H - digitH) / 2;
  const { cells } = layoutSegmentText(on ? text : '', digits, false);
  drawSegmentRow(ctx, cells, x0, y0, digitW, digitH, pitch, {
    on: c.on,
    off: c.off,
    thickness: 0.2,
    slant: 0.08,
    glow: on ? H * 0.06 : 0,
  });
  if (on) {
    // Hot centre of each lit segment.
    ctx.globalAlpha = 0.55;
    drawSegmentRow(
      ctx,
      cells.map((cell) => ({ ...cell, dp: cell.dp })),
      x0,
      y0,
      digitW,
      digitH,
      pitch,
      { on: c.core, thickness: 0.07, slant: 0.08 },
    );
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// Live canvas (repainted from useFrame)
// ---------------------------------------------------------------------------

/**
 * A canvas texture owned by the caller and repainted at will (call `paint`
 * from useFrame). Unlike `useCanvasTexture`, nothing re-renders React.
 */
export function useLiveCanvasTexture(width: number, height: number) {
  const invalidate = useThree((s) => s.invalidate);
  const live = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
    texture.anisotropy = 8;
    const paint = (draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) => {
      draw(ctx, width, height);
      texture.needsUpdate = true;
    };
    return { texture, paint };
  }, [width, height]);
  useEffect(() => {
    invalidate();
    return () => live.texture.dispose();
  }, [live, invalidate]);
  return live;
}
