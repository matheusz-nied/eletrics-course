/**
 * Shared types and drawing helpers for schematic symbols. Each symbol file in
 * this folder (except files starting with "_") registers one device type.
 *
 * Drawing conventions (px, 1 grid unit = 10 px):
 * - Two-terminal symbols draw their body centred on the origin along +x, from
 *   -body/2 to +body/2; the renderer draws the leads up to pins a (left) and b (right).
 * - Fixed symbols draw in their own frame with pins at `pins` (grid units, rotation 0).
 * - Strokes use `currentColor` (ink); live state comes in `ctx.live`.
 */
import type { ReactNode } from 'react';
import type { ElementDoc, ParamValue, Vec2 } from '../../engine/contract';

export interface SymbolCtx {
  el: ElementDoc;
  /** Current parameters (document + defaults + changes made by the student). */
  params: Record<string, ParamValue>;
  /** Live readouts of this element, without the id prefix: { brightness: 0.8 }. */
  live: Record<string, number | boolean | string>;
  /** Rotation and mirror of the element on screen (for upright text). */
  rot: number;
  flip: boolean;
  /** Pins reported by the engine for this instance (grid units, rotation 0). */
  pins: Record<string, Vec2>;
  /** Fill for bodies that show the voltage gradient (two-terminal), or undefined. */
  gradient?: string;
}

export interface SymbolDef {
  type: string;
  /** Two-terminal: body length in px (the rest of a–b is lead). */
  body?: number;
  /** Two-terminal: half thickness of the body in px (labels and hit area). */
  half?: number;
  /** Fixed: pin positions this drawing was made for (grid units, rotation 0). */
  pins?: Record<string, Vec2>;
  /** Fixed: local bounding box [x, y, w, h] in px. */
  box?: [number, number, number, number];
  /** Readouts the drawing reacts to ("brightness", "closed", "damaged"…). */
  live?: string[];
  /** Hides the id/value label (ground). */
  noLabel?: boolean;
  /** Body takes the voltage gradient between a and b (two-terminal). */
  gradientBody?: boolean;
  draw(ctx: SymbolCtx): ReactNode;
  /** Value printed next to the label: "4,7 kΩ". */
  value?(params: Record<string, ParamValue>): string | undefined;
}

export const num = (p: ParamValue | undefined, d: number): number =>
  typeof p === 'number'
    ? p
    : typeof p === 'string' && p.trim() !== '' && !isNaN(Number(p))
      ? Number(p)
      : d;

export const isOn = (p: ParamValue | undefined): boolean => p === true || p === 'true' || p === 1;

/** Burned or otherwise destroyed: the engine reports `burned` (or `damaged` for some devices). */
export const isBurned = (live: SymbolCtx['live']): boolean =>
  live.burned === true || live.damaged === true;

/** Text that stays upright whatever the element rotation/mirror. */
export function Upright({
  x,
  y,
  ctx,
  children,
  size = 10,
  anchor = 'middle',
  weight,
  className,
}: {
  x: number;
  y: number;
  ctx: Pick<SymbolCtx, 'rot' | 'flip'>;
  children: ReactNode;
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
  weight?: number;
  className?: string;
}) {
  const t = `translate(${x} ${y}) scale(${ctx.flip ? -1 : 1} 1) rotate(${-ctx.rot})`;
  return (
    <text
      transform={t}
      fontSize={size}
      textAnchor={anchor}
      dominantBaseline="central"
      fontWeight={weight}
      className={className ?? 'sym-text'}
    >
      {children}
    </text>
  );
}

/** Straight line. */
export const L = ({ d, w, className }: { d: string; w?: number; className?: string }) => (
  <path d={d} strokeWidth={w} className={className} />
);

/** Small arrowhead pointing from (x1,y1) to (x2,y2), drawn at (x2,y2). */
export function Arrow({
  x1,
  y1,
  x2,
  y2,
  size = 5,
  filled = true,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  size?: number;
  filled?: boolean;
}) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  // Rounded so the server and the browser print the same path: their sin/cos
  // can differ in the last digit, which React reports as a hydration mismatch.
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const p1 = [r(x2 - size * Math.cos(a - 0.45)), r(y2 - size * Math.sin(a - 0.45))];
  const p2 = [r(x2 - size * Math.cos(a + 0.45)), r(y2 - size * Math.sin(a + 0.45))];
  return (
    <>
      <path d={`M${x1} ${y1}L${x2} ${y2}`} />
      <path
        d={`M${p1[0]} ${p1[1]}L${x2} ${y2}L${p2[0]} ${p2[1]}${filled ? 'Z' : ''}`}
        className={filled ? 'sym-fill' : undefined}
      />
    </>
  );
}

/** Lead from a pin to a body point (grid pin → px). */
export const lead = ([px, py]: Vec2, x: number, y: number) => `M${px * 10} ${py * 10}L${x} ${y}`;

/** Generic box symbol with pin names, used for unknown types and block devices. */
export function BoxSymbol({
  ctx,
  title,
  box,
  pinLabels = true,
}: {
  ctx: SymbolCtx;
  title: string;
  box: [number, number, number, number];
  pinLabels?: boolean;
}) {
  const [x, y, w, h] = box;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={3} className="sym-body" />
      {Object.entries(ctx.pins).map(([name, [gx, gy]]) => {
        const px = gx * 10;
        const py = gy * 10;
        // lead from the pin to the nearest box edge
        const ex = Math.min(Math.max(px, x), x + w);
        const ey = Math.min(Math.max(py, y), y + h);
        const inside = px > x && px < x + w && py > y && py < y + h;
        const lx = px <= x ? x + 3 : px >= x + w ? x + w - 3 : px;
        const ly = py <= y ? y + 6 : py >= y + h ? y + h - 6 : py;
        const anchor = px <= x ? 'start' : px >= x + w ? 'end' : 'middle';
        return (
          <g key={name}>
            {!inside && <path d={`M${px} ${py}L${ex} ${ey}`} />}
            {pinLabels && (
              <Upright x={lx} y={ly} ctx={ctx} size={7} anchor={anchor} className="sym-pin">
                {name.toUpperCase()}
              </Upright>
            )}
          </g>
        );
      })}
      <Upright x={x + w / 2} y={y + h / 2} ctx={ctx} size={9} weight={600}>
        {title}
      </Upright>
    </>
  );
}

/** Pin-derived box covering every pin (for instance-dependent devices). */
export function boxAround(pins: Record<string, Vec2>, pad = 10): [number, number, number, number] {
  const pts = Object.values(pins);
  if (pts.length === 0) return [-30, -20, 60, 40];
  const xs = pts.map((p) => p[0] * 10);
  const ys = pts.map((p) => p[1] * 10);
  const minX = Math.min(...xs) + pad;
  const maxX = Math.max(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  return [
    Math.min(minX, -20),
    Math.min(minY, -20),
    Math.max(maxX - minX, 40),
    Math.max(maxY - minY, 40),
  ];
}

export function defineSymbol(def: SymbolDef): SymbolDef {
  return def;
}
