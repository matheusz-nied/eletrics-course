/**
 * Printed circuit board layouts: a plain, serializable description of a board
 * (outline, copper, mask openings, silkscreen, holes) that
 * `<PrintedCircuitBoard>` turns into a 3D board. Scenes (the gate controller
 * board) and parts write layouts by hand or generate them in code.
 *
 * Coordinates are millimetres as seen from the top side, origin at the
 * top-left corner, x to the right and y down (like a PCB editor with the
 * origin at the corner). In 3D the board is centred on X/Z, rests on y = 0 and
 * a layout point (x, y) lands at X = x − width/2, Z = y − height/2.
 */
import type { Vec3 } from '../types';

export type Point = [number, number];
export type BoardSide = 'top' | 'bottom';

export interface PcbPad {
  /** Name used by `padPosition` and to tell pads apart ("R1.1", "J1.2"). */
  id?: string;
  at: Point;
  shape?: 'round' | 'square' | 'oval' | 'rect' | 'roundrect';
  /** Diameter, or [width, height] before rotation. */
  size: number | Point;
  /** Drill diameter: a through-hole pad on every copper side. Without it, an SMD pad. */
  drill?: number;
  /** Side of an SMD pad (default: the component side). */
  side?: BoardSide;
  /** Rotation in degrees, counter-clockwise as seen from the top. */
  rotation?: number;
  /** Copper pours of the same net connect to the pad instead of keeping clear. */
  net?: string;
  /** A soldered lead: solder fillet and cut lead end on the solder side. */
  solder?: boolean;
  /** Lead diameter for `solder` (default: 60 % of the drill). */
  lead?: number;
}

export interface PcbTrace {
  points: Point[];
  width: number;
  side?: BoardSide;
  net?: string;
}

/** Copper area (ground plane), kept clear around other nets. */
export interface PcbPour {
  outline: Point[];
  side?: BoardSide;
  net?: string;
  /** Gap to copper of other nets (mm). */
  clearance?: number;
}

/** Via: small plated hole joining the copper sides, covered by the mask. */
export interface PcbVia {
  at: Point;
  drill?: number;
  size?: number;
  net?: string;
}

/** Unplated hole (mounting screw). */
export interface PcbHole {
  at: Point;
  drill: number;
}

export type PcbSilk =
  | {
      kind: 'text';
      at: Point;
      text: string;
      /** Character height (mm). */
      size?: number;
      rotation?: number;
      align?: 'left' | 'center' | 'right';
      font?: 'sans' | 'mono';
      side?: BoardSide;
    }
  | { kind: 'line'; points: Point[]; width?: number; closed?: boolean; side?: BoardSide }
  | {
      kind: 'rect';
      /** Centre. */
      at: Point;
      size: Point;
      width?: number;
      fill?: boolean;
      side?: BoardSide;
    }
  | { kind: 'circle'; at: Point; r: number; width?: number; fill?: boolean; side?: BoardSide };

export type MaskColor = 'verde' | 'azul' | 'preta' | 'vermelha' | 'branca' | 'nenhuma';

export interface PcbLayout {
  width: number;
  height: number;
  /** Board thickness (mm): 1,6 is the standard. */
  thickness?: number;
  /** Corner radius of the outline. */
  corner?: number;
  /** FR-4 (fibreglass) or phenolic paper (cheap single-sided boards). */
  substrate?: 'fr4' | 'fenolite';
  /** Copper sides: single-sided boards have copper only on the bottom (solder side). */
  copper?: 'both' | 'top' | 'bottom';
  /** Solder mask colour, or a hex colour. */
  mask?: MaskColor | string;
  /** Sides with solder mask (default: the copper sides). */
  maskSides?: 'both' | 'top' | 'bottom';
  /** Surface finish of the exposed copper. */
  finish?: 'hasl' | 'enig' | 'cobre';
  /** Silkscreen colour (default: white, black on a white mask). */
  silkColor?: string;
  /** Side where the components sit; leads are soldered on the other one. */
  componentSide?: BoardSide;
  pads?: PcbPad[];
  traces?: PcbTrace[];
  pours?: PcbPour[];
  vias?: PcbVia[];
  holes?: PcbHole[];
  silk?: PcbSilk[];
}

export type ResolvedLayout = Required<
  Omit<PcbLayout, 'silkColor' | 'maskSides'> & { silkColor: string; maskSides: BoardSide[] }
>;

export const MASK_COLORS: Record<Exclude<MaskColor, 'nenhuma'>, string> = {
  verde: '#0b4424',
  azul: '#0f2d5e',
  preta: '#0e1011',
  vermelha: '#6a1213',
  branca: '#d8d7d0',
};

export const MASK_LABELS: Record<MaskColor, string> = {
  verde: 'Verde',
  azul: 'Azul',
  preta: 'Preta',
  vermelha: 'Vermelha',
  branca: 'Branca',
  nenhuma: 'Sem máscara',
};

export const SUBSTRATE_COLORS = { fr4: '#aaa36f', fenolite: '#9a6a32' } as const;

/** Exposed copper by finish: colour (sRGB) and roughness. */
export const FINISHES = {
  hasl: { color: '#d3d6d8', roughness: 0.36, label: 'Estanhada (HASL)' },
  enig: { color: '#f0c45c', roughness: 0.3, label: 'Ouro (ENIG)' },
  cobre: { color: '#e09a74', roughness: 0.36, label: 'Cobre nu' },
} as const;

const sidesOf = (value: 'both' | BoardSide): BoardSide[] =>
  value === 'both' ? ['top', 'bottom'] : [value];

export function resolveLayout(layout: PcbLayout): ResolvedLayout {
  const copper = layout.copper ?? 'both';
  const mask = layout.mask ?? 'verde';
  return {
    width: layout.width,
    height: layout.height,
    thickness: layout.thickness ?? 1.6,
    corner: layout.corner ?? 0.5,
    substrate: layout.substrate ?? 'fr4',
    copper,
    mask,
    maskSides: mask === 'nenhuma' ? [] : sidesOf(layout.maskSides ?? copper),
    finish: layout.finish ?? 'hasl',
    silkColor: layout.silkColor ?? (mask === 'branca' ? '#1b1b1b' : '#f4f4ef'),
    componentSide: layout.componentSide ?? 'top',
    pads: layout.pads ?? [],
    traces: layout.traces ?? [],
    pours: layout.pours ?? [],
    vias: layout.vias ?? [],
    holes: layout.holes ?? [],
    silk: layout.silk ?? [],
  };
}

export const copperSides = (l: ResolvedLayout): BoardSide[] => sidesOf(l.copper);

export const maskColorOf = (l: ResolvedLayout): string | null =>
  l.mask === 'nenhuma' ? null : (MASK_COLORS[l.mask as keyof typeof MASK_COLORS] ?? l.mask);

/** Through-hole pads are plated when the board has copper on both sides. */
export const isPlated = (l: ResolvedLayout) => l.copper === 'both';

export const padDims = (pad: PcbPad): Point =>
  typeof pad.size === 'number' ? [pad.size, pad.size] : pad.size;

/** The pad is on `side`: through-hole pads are on every copper side. */
export function padOnSide(l: ResolvedLayout, pad: PcbPad, side: BoardSide): boolean {
  if (!copperSides(l).includes(side)) return false;
  return pad.drill !== undefined || (pad.side ?? l.componentSide) === side;
}

/** 3D position (part space, mm) of a layout point on the given surface. */
export function boardPoint(
  layout: Pick<PcbLayout, 'width' | 'height' | 'thickness'>,
  [x, y]: Point,
  side: BoardSide = 'top',
): Vec3 {
  const thickness = layout.thickness ?? 1.6;
  return [x - layout.width / 2, side === 'top' ? thickness : 0, y - layout.height / 2];
}

/** 3D position of the pad named `id` on the given surface, or undefined. */
export function padPosition(
  layout: PcbLayout,
  id: string,
  side: BoardSide = 'top',
): Vec3 | undefined {
  const pad = layout.pads?.find((p) => p.id === id);
  return pad ? boardPoint(layout, pad.at, side) : undefined;
}
