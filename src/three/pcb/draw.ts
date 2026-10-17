/**
 * Paints the layers of a board into canvases: copper, mask openings and
 * silkscreen as white shapes, then composed into the maps of each side
 * (colour, roughness/metalness/clearcoat and bump) and, for the exploded
 * view, one alpha map per layer. Canvas pixels follow layout coordinates
 * (x right, y down), `k` pixels per millimetre.
 */
import { FONT_MONO, FONT_SANS } from '../materials/textures';
import {
  FINISHES,
  SUBSTRATE_COLORS,
  copperSides,
  maskColorOf,
  padDims,
  padOnSide,
  type BoardSide,
  type PcbPad,
  type Point,
  type ResolvedLayout,
} from './layout';

type Ctx = CanvasRenderingContext2D;

export interface SideMaps {
  color: HTMLCanvasElement;
  /** R = clearcoat, G = roughness, B = metalness (linear). */
  orm: HTMLCanvasElement;
  bump: HTMLCanvasElement;
}

export interface LayerMaps {
  copper: HTMLCanvasElement | null;
  mask: HTMLCanvasElement | null;
  silk: HTMLCanvasElement | null;
}

/** Texture resolution: as sharp as allowed, at most `max` pixels per side. */
export function pixelsPerMm(l: ResolvedLayout, max = 2048, ceiling = 12): number {
  return Math.min(ceiling, max / Math.max(l.width, l.height));
}

function canvas(l: ResolvedLayout, k: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(4, Math.round(l.width * k));
  c.height = Math.max(4, Math.round(l.height * k));
  return c;
}

const context = (c: HTMLCanvasElement) => c.getContext('2d')!;

function outlinePath(ctx: Ctx, l: ResolvedLayout, k: number) {
  ctx.beginPath();
  ctx.roundRect(0, 0, l.width * k, l.height * k, l.corner * k);
}

function padPath(ctx: Ctx, pad: PcbPad, k: number, grow = 0) {
  const [w0, h0] = padDims(pad);
  const w = (w0 + grow * 2) * k;
  const h = (h0 + grow * 2) * k;
  const shape = pad.shape ?? (pad.drill !== undefined ? 'round' : 'rect');
  ctx.save();
  ctx.translate(pad.at[0] * k, pad.at[1] * k);
  // Counter-clockwise as seen from the top: canvas y points down.
  ctx.rotate((-(pad.rotation ?? 0) * Math.PI) / 180);
  ctx.beginPath();
  if (shape === 'round' && w === h) ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
  else if (shape === 'round' || shape === 'oval')
    ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) / 2);
  else if (shape === 'roundrect') ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.25);
  else ctx.rect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

function circle(ctx: Ctx, [x, y]: Point, r: number, k: number) {
  ctx.beginPath();
  ctx.arc(x * k, y * k, r * k, 0, Math.PI * 2);
}

function polyline(ctx: Ctx, points: Point[], k: number, closed = false) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * k, y * k) : ctx.lineTo(x * k, y * k)));
  if (closed) ctx.closePath();
}

function strokeTrace(ctx: Ctx, points: Point[], width: number, k: number) {
  ctx.lineWidth = width * k;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (points.length === 1) {
    circle(ctx, points[0]!, width / 2, k);
    ctx.fill();
    return;
  }
  polyline(ctx, points, k);
  ctx.stroke();
}

/** Every drilled hole, cut out of what is already drawn. */
function cutHoles(ctx: Ctx, l: ResolvedLayout, k: number, { vias = true } = {}) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#fff';
  for (const pad of l.pads) {
    if (pad.drill === undefined) continue;
    circle(ctx, pad.at, pad.drill / 2, k);
    ctx.fill();
  }
  for (const hole of l.holes) {
    circle(ctx, hole.at, hole.drill / 2, k);
    ctx.fill();
  }
  if (vias)
    for (const via of l.vias) {
      circle(ctx, via.at, (via.drill ?? 0.4) / 2, k);
      ctx.fill();
    }
  ctx.restore();
}

const onSide = (item: { side?: BoardSide }, side: BoardSide, fallback: BoardSide) =>
  (item.side ?? fallback) === side;

/** Copper of one side (white on transparent). */
export function drawCopper(l: ResolvedLayout, side: BoardSide, k: number): HTMLCanvasElement {
  const c = canvas(l, k);
  const ctx = context(c);
  if (!copperSides(l).includes(side)) return c;
  const fallback = copperSides(l).length === 1 ? copperSides(l)[0]! : l.componentSide;
  ctx.fillStyle = ctx.strokeStyle = '#fff';

  const pads = l.pads.filter((p) => padOnSide(l, p, side));
  const traces = l.traces.filter((t) => onSide(t, side, fallback));
  const vias = l.vias;

  for (const pour of l.pours.filter((p) => onSide(p, side, fallback))) {
    // Each pour on its own canvas, so clearances only cut that pour.
    const layer = canvas(l, k);
    const lc = context(layer);
    lc.fillStyle = lc.strokeStyle = '#fff';
    polyline(lc, pour.outline, k, true);
    lc.fill();
    const gap = pour.clearance ?? 0.4;
    lc.globalCompositeOperation = 'destination-out';
    for (const pad of pads) {
      if (pour.net && pad.net === pour.net) continue;
      padPath(lc, pad, k, gap);
      lc.fill();
    }
    for (const trace of traces) {
      if (pour.net && trace.net === pour.net) continue;
      strokeTrace(lc, trace.points, trace.width + gap * 2, k);
    }
    for (const via of vias) {
      if (pour.net && via.net === pour.net) continue;
      circle(lc, via.at, (via.size ?? 0.8) / 2 + gap, k);
      lc.fill();
    }
    for (const hole of l.holes) {
      circle(lc, hole.at, hole.drill / 2 + gap * 1.5, k);
      lc.fill();
    }
    // Pull the pour back from the board edge.
    lc.lineWidth = gap * 2 * k;
    outlinePath(lc, l, k);
    lc.stroke();
    ctx.drawImage(layer, 0, 0);
  }

  for (const trace of traces) strokeTrace(ctx, trace.points, trace.width, k);
  for (const pad of pads) {
    padPath(ctx, pad, k);
    ctx.fill();
  }
  for (const via of vias) {
    circle(ctx, via.at, (via.size ?? 0.8) / 2, k);
    ctx.fill();
  }
  cutHoles(ctx, l, k);
  return c;
}

/** Openings in the solder mask of one side: pads and unplated holes. */
export function drawOpenings(l: ResolvedLayout, side: BoardSide, k: number): HTMLCanvasElement {
  const c = canvas(l, k);
  const ctx = context(c);
  ctx.fillStyle = '#fff';
  for (const pad of l.pads) {
    if (!padOnSide(l, pad, side)) continue;
    padPath(ctx, pad, k, 0.05);
    ctx.fill();
  }
  for (const hole of l.holes) {
    circle(ctx, hole.at, hole.drill / 2 + 0.25, k);
    ctx.fill();
  }
  return c;
}

/** Silkscreen of one side, clipped by the mask openings. */
export function drawSilk(
  l: ResolvedLayout,
  side: BoardSide,
  k: number,
  openings: HTMLCanvasElement,
): HTMLCanvasElement {
  const c = canvas(l, k);
  const ctx = context(c);
  const items = l.silk.filter((s) => onSide(s, side, l.componentSide));
  if (items.length === 0) return c;
  ctx.fillStyle = ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const item of items) {
    const width = ('width' in item && item.width) || 0.15;
    ctx.lineWidth = width * k;
    if (item.kind === 'line') {
      polyline(ctx, item.points, k, item.closed);
      ctx.stroke();
    } else if (item.kind === 'rect') {
      const [w, h] = item.size;
      ctx.beginPath();
      ctx.rect((item.at[0] - w / 2) * k, (item.at[1] - h / 2) * k, w * k, h * k);
      if (item.fill) ctx.fill();
      else ctx.stroke();
    } else if (item.kind === 'circle') {
      circle(ctx, item.at, item.r, k);
      if (item.fill) ctx.fill();
      else ctx.stroke();
    } else {
      const size = item.size ?? 1;
      ctx.save();
      ctx.translate(item.at[0] * k, item.at[1] * k);
      // Bottom-side text is mirrored so it reads correctly from below.
      if (side === 'bottom') ctx.scale(-1, 1);
      ctx.rotate((-(item.rotation ?? 0) * Math.PI) / 180);
      const family = item.font === 'mono' ? FONT_MONO : FONT_SANS;
      // Cap height is ~0,72 of the font size.
      ctx.font = `600 ${(size / 0.72) * k}px ${family}`;
      ctx.textAlign = item.align ?? 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.text, 0, 0);
      ctx.restore();
    }
  }
  if (l.maskSides.includes(side)) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(openings, 0, 0);
  }
  cutHoles(ctx, l, k);
  return c;
}

let scratch: HTMLCanvasElement | null = null;

/** Draws `mask` (white on transparent) filled with `color`. */
function tint(ctx: Ctx, mask: HTMLCanvasElement, color: string) {
  scratch ??= document.createElement('canvas');
  if (scratch.width !== mask.width || scratch.height !== mask.height) {
    scratch.width = mask.width;
    scratch.height = mask.height;
  }
  const s = context(scratch);
  s.globalCompositeOperation = 'copy';
  s.drawImage(mask, 0, 0);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = color;
  s.fillRect(0, 0, scratch.width, scratch.height);
  ctx.drawImage(scratch, 0, 0);
}

function intersect(a: HTMLCanvasElement, b: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = a.width;
  c.height = a.height;
  const ctx = context(c);
  ctx.drawImage(a, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(b, 0, 0);
  return c;
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, shift: number) => (p >> shift) & 255;
  const out = [16, 8, 0].map((s) => Math.round(ch(pa, s) * (1 - t) + ch(pb, s) * t));
  return `rgb(${out.join(',')})`;
}

const gray = (v: number) => `rgb(${v},${v},${v})`;
const orm = (clearcoat: number, roughness: number, metalness: number) =>
  `rgb(${Math.round(clearcoat * 255)},${Math.round(roughness * 255)},${Math.round(metalness * 255)})`;

const COPPER = '#c98a4e';

/** True when the side has anything printed or plated on it. */
export function sideHasDetail(l: ResolvedLayout, side: BoardSide): boolean {
  return (
    copperSides(l).includes(side) ||
    l.maskSides.includes(side) ||
    l.silk.some((s) => onSide(s, side, l.componentSide))
  );
}

export interface SideLayers {
  copper: HTMLCanvasElement;
  openings: HTMLCanvasElement;
  silk: HTMLCanvasElement;
}

export function drawSideLayers(l: ResolvedLayout, side: BoardSide, k: number): SideLayers {
  const copper = drawCopper(l, side, k);
  const openings = drawOpenings(l, side, k);
  const silk = drawSilk(l, side, k, openings);
  return { copper, openings, silk };
}

/** Colour, ORM and bump maps of one side. */
export function composeSide(l: ResolvedLayout, side: BoardSide, layers: SideLayers): SideMaps {
  const { copper, openings, silk } = layers;
  const w = copper.width;
  const h = copper.height;
  const make = () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  const substrate = SUBSTRATE_COLORS[l.substrate];
  const maskColor = l.maskSides.includes(side) ? maskColorOf(l) : null;
  const finish = FINISHES[l.finish];
  const hasCopper = copperSides(l).includes(side);
  const exposed = maskColor ? intersect(openings, copper) : copper;
  const k = w / l.width;

  const color = make();
  const cc = context(color);
  cc.fillStyle = maskColor ? mix(maskColor, substrate, 0.1) : substrate;
  cc.fillRect(0, 0, w, h);
  if (hasCopper) {
    // Copper under the mask shows through as a lighter, warmer shade.
    tint(cc, copper, maskColor ? mix(maskColor, COPPER, 0.3) : finish.color);
    if (maskColor) tint(cc, exposed, finish.color);
  }
  tint(cc, silk, l.silkColor);
  if (maskColor && hasCopper) {
    // Tented vias: a small dimple in the mask.
    cc.fillStyle = mix(maskColor, '#000000', 0.45);
    for (const via of l.vias) {
      circle(cc, via.at, (via.drill ?? 0.4) / 2, k);
      cc.fill();
    }
  }

  const ormMap = make();
  const oc = context(ormMap);
  oc.fillStyle = maskColor ? orm(1, 0.6, 0) : orm(0, l.substrate === 'fr4' ? 0.55 : 0.68, 0);
  oc.fillRect(0, 0, w, h);
  if (hasCopper) tint(oc, exposed, orm(0, finish.roughness, 1));
  tint(oc, silk, orm(0, 0.78, 0));

  const bumpRaw = make();
  const bc = context(bumpRaw);
  bc.fillStyle = '#000';
  bc.fillRect(0, 0, w, h);
  if (hasCopper) {
    tint(bc, copper, gray(maskColor ? 80 : 70));
    tint(bc, exposed, gray(l.finish === 'hasl' ? 120 : 80));
  }
  tint(bc, silk, gray(maskColor ? 150 : 100));
  const bump = make();
  const bb = context(bump);
  bb.filter = `blur(${Math.max(0.6, k * 0.04)}px)`;
  bb.drawImage(bumpRaw, 0, 0);

  return { color, orm: ormMap, bump };
}

/** White-on-black alpha maps of each layer, for the exploded view. */
export function layerAlphaMaps(l: ResolvedLayout, side: BoardSide, layers: SideLayers): LayerMaps {
  const { copper, openings, silk } = layers;
  const k = copper.width / l.width;
  const onBlack = (source: HTMLCanvasElement) => {
    const c = document.createElement('canvas');
    c.width = source.width;
    c.height = source.height;
    const ctx = context(c);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(source, 0, 0);
    return c;
  };
  let mask: HTMLCanvasElement | null = null;
  if (l.maskSides.includes(side)) {
    const m = document.createElement('canvas');
    m.width = copper.width;
    m.height = copper.height;
    const ctx = context(m);
    ctx.fillStyle = '#fff';
    outlinePath(ctx, l, k);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(openings, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    cutHoles(ctx, l, k, { vias: false });
    mask = onBlack(m);
  }
  const hasSilk = l.silk.some((s) => onSide(s, side, l.componentSide));
  return {
    copper: copperSides(l).includes(side) ? onBlack(copper) : null,
    mask,
    silk: hasSilk ? onBlack(silk) : null,
  };
}
