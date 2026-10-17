/**
 * Pieces shared by the semiconductor parts: the silicon die with a drawn
 * surface (bond pads, metal, Hall plate…), its bond pad positions, and the
 * printed/laser-marked top of moulded packages (colour, roughness and bump
 * maps). Private helper (the `_` prefix keeps it out of the part registry).
 */
import type { ReactNode } from 'react';
import { Material } from '../materials/Material';
import { FONT_MONO, FONT_SANS, fitText, useCanvasTexture } from '../materials/textures';
import type { Vec3 } from '../types';

export type DieKind = 'ic' | 'bjt' | 'power' | 'diode' | 'hall' | 'led';

/** Small deterministic random generator (mulberry32). */
export function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bond pad centres of an IC die of `w` × `d` (mm) as [x, z]: `count` pads
 * spread along the edges counter-clockwise seen from above (left edge from
 * back to front, front edge from left to right, right edge, back edge),
 * starting at fraction `start` of that path (0 = back-left corner).
 */
export function icPads(w: number, d: number, count: number, start = 0): [number, number][] {
  const inset = Math.min(w, d) * 0.1;
  const iw = w - 2 * inset;
  const id = d - 2 * inset;
  const perimeter = 2 * (iw + id);
  const out: [number, number][] = [];
  for (let k = 0; k < count; k++) {
    let s = (((start + (k + 0.5) / count) % 1) + 1) % 1;
    s *= perimeter;
    if (s < id) out.push([-iw / 2, -id / 2 + s]);
    else if ((s -= id) < iw) out.push([-iw / 2 + s, id / 2]);
    else if ((s -= iw) < id) out.push([iw / 2, id / 2 - s]);
    else out.push([iw / 2 - (s - id), -id / 2]);
  }
  return out;
}

interface DieProps {
  /** Die size in its plane (X, Z) and thickness (Y), mm. */
  size: [number, number];
  thickness?: number;
  kind: DieKind;
  pads?: number;
  /** Where pad 1 starts along the edge path (see `icPads`). */
  padStart?: number;
  seed?: number;
  position?: Vec3;
  rotation?: Vec3;
  /** Charred by overload. */
  burned?: boolean;
  children?: ReactNode;
}

/** A silicon die lying in the XZ plane (top face +Y), with its drawn surface. */
export function SiliconDie({
  size,
  thickness = 0.25,
  kind,
  pads = 8,
  padStart = 0,
  seed = 7,
  position,
  rotation,
  burned = false,
  children,
}: DieProps) {
  const [w, d] = size;
  const px = 256;
  const ph = Math.max(Math.round((px * d) / w), 32);
  const key = `${kind}|${pads}|${padStart}|${seed}|${w.toFixed(2)}|${d.toFixed(2)}|${burned}`;
  const map = useCanvasTexture(
    (ctx, cw, ch) => drawDie(ctx, cw, ch, kind, pads, padStart, seed, w, d, burned, false),
    key,
    {
      width: px,
      height: ph,
    },
  );
  const metal = useCanvasTexture(
    (ctx, cw, ch) => drawDie(ctx, cw, ch, kind, pads, padStart, seed, w, d, burned, true),
    key,
    { width: px, height: ph, color: false },
  );
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, thickness / 2, 0]}>
        <boxGeometry args={[w, thickness, d]} />
        <Material color="#4a4d55" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, thickness + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <Material
          color="#ffffff"
          map={map}
          metalness={1}
          metalnessMap={metal}
          roughness={0.36}
          specularIntensity={0.7}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
      {children}
    </group>
  );
}

function drawDie(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  kind: DieKind,
  pads: number,
  padStart: number,
  seed: number,
  w: number,
  d: number,
  burned: boolean,
  metal: boolean,
) {
  const rnd = random(seed);
  const sx = cw / w;
  const sz = ch / d;
  // Metalness map: silicon 0.35, aluminium 1.
  const base = metal ? '#2a2a2a' : burned ? '#1b1716' : '#262b36';
  const alu = metal ? '#ffffff' : burned ? '#3a3330' : '#c5c9cf';
  const rect = (x: number, y: number, rw: number, rh: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, rw, rh);
  };
  rect(0, 0, cw, ch, base);
  if (!metal && !burned) {
    // Thin-film colours of the passivation (the purple/green sheen of real dies).
    const g = ctx.createLinearGradient(0, 0, cw, ch);
    g.addColorStop(0, 'rgba(120,80,160,0.22)');
    g.addColorStop(0.5, 'rgba(60,120,110,0.18)');
    g.addColorStop(1, 'rgba(150,110,70,0.2)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
  }
  // Scribe line and seal ring.
  const edge = Math.max(cw, ch) * 0.025;
  ctx.strokeStyle = metal ? '#9a9a9a' : '#8d939d';
  ctx.lineWidth = edge;
  ctx.strokeRect(edge / 2, edge / 2, cw - edge, ch - edge);
  ctx.strokeStyle = alu;
  ctx.lineWidth = edge * 0.5;
  ctx.strokeRect(edge * 1.8, edge * 1.8, cw - edge * 3.6, ch - edge * 3.6);

  const toPx = ([x, z]: [number, number]): [number, number] => [(x + w / 2) * sx, (z + d / 2) * sz];

  if (kind === 'ic') {
    // Functional blocks: memory arrays (fine grids), logic (random cells), analog.
    const inner = Math.min(cw, ch) * 0.2;
    const blocks = 5 + Math.floor(rnd() * 4);
    for (let b = 0; b < blocks; b++) {
      const bx = inner + rnd() * (cw - 2 * inner) * 0.7;
      const by = inner + rnd() * (ch - 2 * inner) * 0.7;
      const bw = (cw - 2 * inner) * (0.18 + rnd() * 0.3);
      const bh = (ch - 2 * inner) * (0.18 + rnd() * 0.3);
      const type = rnd();
      if (type < 0.4) {
        rect(bx, by, bw, bh, metal ? '#808080' : 'rgba(110,90,140,0.55)');
        ctx.strokeStyle = metal ? '#b0b0b0' : 'rgba(200,205,215,0.35)';
        ctx.lineWidth = 0.6;
        for (let x = bx; x < bx + bw; x += 2.2) {
          ctx.beginPath();
          ctx.moveTo(x, by);
          ctx.lineTo(x, by + bh);
          ctx.stroke();
        }
      } else if (type < 0.8) {
        for (let i = 0; i < 60; i++) {
          rect(
            bx + rnd() * bw,
            by + rnd() * bh,
            1 + rnd() * 5,
            1 + rnd() * 3,
            metal ? '#a0a0a0' : `rgba(${150 + rnd() * 60},${150 + rnd() * 50},${170},0.5)`,
          );
        }
      } else {
        rect(bx, by, bw * 0.6, bh * 0.6, metal ? '#c8c8c8' : 'rgba(170,140,90,0.45)');
      }
    }
    // Power rails and the pads.
    ctx.strokeStyle = alu;
    ctx.lineWidth = Math.max(cw, ch) * 0.012;
    ctx.strokeRect(inner * 0.7, inner * 0.7, cw - inner * 1.4, ch - inner * 1.4);
    const padSize = Math.min(cw, ch) * 0.07;
    for (const pad of icPads(w, d, pads, padStart)) {
      const [x, y] = toPx(pad);
      rect(x - padSize / 2, y - padSize / 2, padSize, padSize, alu);
    }
  } else if (kind === 'bjt' || kind === 'power') {
    // Interdigitated emitter (or source) fingers with a base (gate) pad.
    const m = edge * 3;
    if (kind === 'power') {
      rect(m, m, cw - 2 * m, ch - 2 * m, alu);
      rect(m * 1.3, m * 1.3, cw * 0.22, ch * 0.22, base);
      rect(m * 1.6, m * 1.6, cw * 0.22 - m * 0.6, ch * 0.22 - m * 0.6, alu);
      ctx.strokeStyle = metal ? '#707070' : 'rgba(40,45,55,0.8)';
      ctx.lineWidth = 1;
      for (let x = m + cw * 0.28; x < cw - m; x += 5) {
        ctx.beginPath();
        ctx.moveTo(x, m + ch * 0.05);
        ctx.lineTo(x, ch - m - ch * 0.05);
        ctx.stroke();
      }
    } else {
      const fingers = 5;
      for (let i = 0; i < fingers; i++) {
        const y = m + ((ch - 2 * m) * (i + 0.5)) / fingers;
        rect(m, y - ch * 0.03, cw * 0.62, ch * 0.06, alu);
        rect(
          cw * 0.36,
          y + ch * 0.05,
          cw - m - cw * 0.36,
          ch * 0.03,
          metal ? '#9a9a9a' : '#8a919c',
        );
      }
      rect(m, m, cw * 0.3, ch * 0.3, alu); // emitter pad
      rect(cw - m - cw * 0.28, ch - m - ch * 0.28, cw * 0.28, ch * 0.28, alu); // base pad
    }
  } else if (kind === 'diode') {
    // Mesa diode: glass passivation ring and the round top contact.
    ctx.fillStyle = metal ? '#3a3a3a' : burned ? '#2a2420' : '#6d7f7a';
    ctx.fillRect(edge * 2, edge * 2, cw - edge * 4, ch - edge * 4);
    ctx.fillStyle = alu;
    ctx.beginPath();
    ctx.arc(cw / 2, ch / 2, Math.min(cw, ch) * 0.34, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'hall') {
    // Hall plate (cross) in the middle, amplifier and Schmitt trigger around it.
    const c = Math.min(cw, ch);
    ctx.fillStyle = metal ? '#3c3c3c' : 'rgba(40,70,90,0.9)';
    ctx.fillRect(cw / 2 - c * 0.07, ch / 2 - c * 0.2, c * 0.14, c * 0.4);
    ctx.fillRect(cw / 2 - c * 0.2, ch / 2 - c * 0.07, c * 0.4, c * 0.14);
    for (const [x, y] of [
      [0, -0.2],
      [0, 0.2],
      [-0.2, 0],
      [0.2, 0],
    ] as const) {
      rect(cw / 2 + x * c - c * 0.035, ch / 2 + y * c - c * 0.035, c * 0.07, c * 0.07, alu);
    }
    for (let i = 0; i < 40; i++) {
      const x = rnd() < 0.5 ? edge * 4 + rnd() * cw * 0.18 : cw * 0.72 + rnd() * cw * 0.2;
      rect(
        x,
        edge * 4 + rnd() * (ch - edge * 8),
        2 + rnd() * 6,
        1 + rnd() * 3,
        metal ? '#a0a0a0' : 'rgba(160,150,190,0.55)',
      );
    }
    const pad = c * 0.13;
    for (const fx of [0.2, 0.5, 0.8]) rect(cw * fx - pad / 2, ch - edge * 3 - pad, pad, pad, alu);
  } else {
    // LED chip: transparent substrate with the current-spreading contact.
    ctx.fillStyle = alu;
    ctx.beginPath();
    ctx.arc(cw / 2, ch / 2, Math.min(cw, ch) * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  if (burned && !metal) {
    // Burn mark: molten crater.
    const g = ctx.createRadialGradient(
      cw * 0.55,
      ch * 0.45,
      0,
      cw * 0.55,
      ch * 0.45,
      Math.min(cw, ch) * 0.35,
    );
    g.addColorStop(0, 'rgba(5,4,3,1)');
    g.addColorStop(0.6, 'rgba(40,25,15,0.8)');
    g.addColorStop(1, 'rgba(40,25,15,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
  }
}

export interface MarkingLine {
  text: string;
  /** Cap height in mm. */
  size: number;
  weight?: number;
  mono?: boolean;
}

export interface PrintedTopOptions {
  /** Physical size of the printed face (mm): width along canvas X, height along canvas Y. */
  width: number;
  height: number;
  lines: MarkingLine[];
  /** Body colour under the marking. */
  base?: string;
  /** Laser-etched (light grey, matte) or ink (white). */
  ink?: string;
  /** Pin-1 dimple centre (mm from the face's top-left corner) and diameter. */
  dimple?: { x: number; y: number; d: number };
  /** Ejector-pin marks: glossy, slightly sunk circles. */
  ejectors?: { x: number; y: number; d: number }[];
  /** Block centre offset along the face (mm). */
  offset?: [number, number];
  /** Rotate the text 90° (vertical faces read along the long side). */
  rotate?: boolean;
  /** Charred: dark soot and a crack. */
  burned?: boolean;
  /** Extra drawing after the marking (colour pass only). */
  extra?: (ctx: CanvasRenderingContext2D, pxPerMm: number) => void;
  extraKey?: string;
}

/**
 * Colour, roughness and bump maps of a moulded package face with its
 * marking: matte EDM-textured epoxy, laser-etched text, glossy pin-1 dimple
 * and ejector marks.
 */
export function usePrintedTop(o: PrintedTopOptions) {
  const pxPerMm = Math.min(1024 / o.width, 1024 / o.height, 96);
  const cw = Math.max(Math.round(o.width * pxPerMm), 16);
  const ch = Math.max(Math.round(o.height * pxPerMm), 16);
  const base = o.base ?? '#1b1b1d';
  const ink = o.ink ?? '#9fa2a6';
  const key = JSON.stringify([
    o.width,
    o.height,
    o.lines,
    base,
    ink,
    o.dimple,
    o.ejectors,
    o.offset,
    o.rotate,
    o.burned,
    o.extraKey,
  ]);
  const fonts = [`700 40px ${FONT_SANS}`, `600 40px ${FONT_MONO}`];

  const writeLines = (ctx: CanvasRenderingContext2D, color: string) => {
    ctx.save();
    ctx.fillStyle = color;
    const [ox, oy] = o.offset ?? [0, 0];
    ctx.translate(cw / 2 + ox * pxPerMm, ch / 2 + oy * pxPerMm);
    if (o.rotate) ctx.rotate(-Math.PI / 2);
    const spanW = (o.rotate ? o.height : o.width) * pxPerMm;
    const gap = 0.45;
    const total =
      o.lines.reduce((s, l) => s + l.size * (1 + gap), 0) -
      (o.lines.length ? o.lines[o.lines.length - 1]!.size * gap : 0);
    let y = (-total / 2) * pxPerMm;
    for (const line of o.lines) {
      const h = line.size * pxPerMm;
      // Cap height ≈ 0,72 of the font size.
      fitText(ctx, line.text, 0, y + h / 2, spanW * 0.9, h / 0.72, {
        weight: line.weight ?? 600,
        family: line.mono ? FONT_MONO : FONT_SANS,
      });
      y += h * (1 + gap);
    }
    ctx.restore();
  };

  const circle = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    dia: number,
    fill: string | CanvasGradient,
  ) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x * pxPerMm, y * pxPerMm, (dia / 2) * pxPerMm, 0, Math.PI * 2);
    ctx.fill();
  };

  const map = useCanvasTexture(
    (ctx) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, cw, ch);
      for (const e of o.ejectors ?? []) circle(ctx, e.x, e.y, e.d, shade(base, 0.85));
      if (o.dimple) circle(ctx, o.dimple.x, o.dimple.y, o.dimple.d, shade(base, 0.7));
      writeLines(ctx, o.burned ? '#4a4440' : ink);
      o.extra?.(ctx, pxPerMm);
      if (o.burned) drawSoot(ctx, cw, ch);
    },
    key,
    { width: cw, height: ch, fonts },
  );

  const roughnessMap = useCanvasTexture(
    (ctx) => {
      // Spark-eroded (EDM) mould finish: fine random grain.
      const image = ctx.createImageData(cw, ch);
      const rnd = random(99);
      for (let i = 0; i < cw * ch; i++) {
        const v = 140 + rnd() * 34;
        image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = v;
        image.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
      for (const e of o.ejectors ?? []) circle(ctx, e.x, e.y, e.d, '#7c7c7c');
      if (o.dimple) circle(ctx, o.dimple.x, o.dimple.y, o.dimple.d, '#767676');
      writeLines(ctx, '#e6e6e6');
      if (o.burned) drawSoot(ctx, cw, ch, 3, 'roughness');
    },
    key,
    { width: cw, height: ch, color: false, fonts },
  );

  const bumpMap = useCanvasTexture(
    (ctx) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, cw, ch);
      for (const e of o.ejectors ?? []) circle(ctx, e.x, e.y, e.d, '#6c6c6c');
      if (o.dimple) {
        const g = ctx.createRadialGradient(
          o.dimple.x * pxPerMm,
          o.dimple.y * pxPerMm,
          0,
          o.dimple.x * pxPerMm,
          o.dimple.y * pxPerMm,
          (o.dimple.d / 2) * pxPerMm,
        );
        g.addColorStop(0, '#303030');
        g.addColorStop(0.8, '#3a3a3a');
        g.addColorStop(1, '#808080');
        circle(ctx, o.dimple.x, o.dimple.y, o.dimple.d, g);
      }
      writeLines(ctx, '#707070');
      if (o.burned) drawSoot(ctx, cw, ch, 3, 'bump');
    },
    key,
    { width: cw, height: ch, color: false, fonts },
  );

  return { map, roughnessMap, bumpMap, pxPerMm };
}

/**
 * Burn damage on a moulded package face: dull brownish haze, a blown-out
 * crater with a charred rim and cracks running from it. `mask` draws the
 * same shapes in grey levels for roughness or bump maps.
 */
export function drawSoot(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  seed = 3,
  mask?: 'bump' | 'roughness',
) {
  const rnd = random(seed);
  const cx = cw * (0.42 + rnd() * 0.16);
  const cy = ch * (0.4 + rnd() * 0.2);
  const size = Math.min(cw, ch);
  const crater: [number, number][] = [];
  const r0 = size * 0.15;
  const [p1, p2, p3] = [rnd() * 6, rnd() * 6, rnd() * 6];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r =
      r0 *
      (1 + 0.2 * Math.sin(3 * a + p1) + 0.12 * Math.sin(5 * a + p2) + 0.07 * Math.sin(9 * a + p3));
    crater.push([cx + Math.cos(a) * r * 1.15, cy + Math.sin(a) * r]);
  }
  const cracks: [number, number][][] = [];
  for (let k = 0; k < 4; k++) {
    const a = rnd() * Math.PI * 2;
    let x = cx + Math.cos(a) * r0;
    let y = cy + Math.sin(a) * r0;
    const line: [number, number][] = [[x, y]];
    for (let i = 0; i < 7; i++) {
      x += Math.cos(a + (rnd() - 0.5)) * size * 0.06;
      y += Math.sin(a + (rnd() - 0.5)) * size * 0.06;
      line.push([x, y]);
    }
    cracks.push(line);
  }
  const path = (pts: [number, number][], scale = 1) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const px = cx + (x - cx) * scale;
      const py = cy + (y - cy) * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  };
  const strokeCracks = (color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const line of cracks) {
      ctx.beginPath();
      line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
  };
  if (mask === 'bump') {
    ctx.fillStyle = '#505050';
    path(crater, 1.15);
    ctx.fill();
    ctx.fillStyle = '#202020';
    path(crater, 0.75);
    ctx.fill();
    strokeCracks('#404040', size * 0.012);
    return;
  }
  if (mask === 'roughness') {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#ffffff';
    path(crater, 1.3);
    ctx.fill();
    return;
  }
  const haze = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.75);
  haze.addColorStop(0, 'rgba(120,100,80,0.55)');
  haze.addColorStop(0.5, 'rgba(90,75,62,0.3)');
  haze.addColorStop(1, 'rgba(70,60,50,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, cw, ch);
  ctx.filter = `blur(${Math.max(size * 0.012, 1)}px)`;
  ctx.fillStyle = '#5c4d40';
  path(crater, 1.3);
  ctx.fill();
  strokeCracks('#6a5a4c', size * 0.02);
  ctx.filter = `blur(${Math.max(size * 0.006, 0.5)}px)`;
  ctx.fillStyle = '#2e241d';
  path(crater, 1.0);
  ctx.fill();
  ctx.fillStyle = '#0b0807';
  path(crater, 0.68);
  ctx.fill();
  ctx.filter = 'none';
  strokeCracks('#0a0807', size * 0.007);
}

/** `#rrggbb` scaled by `k` (darker below 1). */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * k)))
      .toString(16)
      .padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}
