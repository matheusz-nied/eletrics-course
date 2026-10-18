/**
 * Lesson 5.1: the field of bar magnets in a plane, for the CampoMagnetico
 * figure. Each magnet is modelled by magnetic "charges" spread over its two
 * end faces (positive on the north face, negative on the south face), each
 * with the 1/r² falloff of a point source. Outside the magnets this gives the
 * familiar picture of a bar magnet; it is a drawing model, not a measurement.
 * Lengths are in the figure's units (the plane is WIDTH × HEIGHT); a field of
 * 1 is the field just outside the north face of a lone magnet.
 */

export const WIDTH = 100;
export const HEIGHT = 60;

/** A bar magnet lying horizontally; `north` says which end is the north pole. */
export interface Magnet {
  x: number;
  y: number;
  north: 'left' | 'right';
}

export const MAGNET_LENGTH = 24;
export const MAGNET_WIDTH = 7;

export type PresetId = 'um' | 'atraem' | 'repelem';

export const PRESETS: Record<PresetId, { label: string; magnets: Magnet[] }> = {
  um: { label: 'Um ímã', magnets: [{ x: 50, y: 30, north: 'right' }] },
  atraem: {
    label: 'Polos opostos (atraem)',
    magnets: [
      { x: 26, y: 30, north: 'right' },
      { x: 74, y: 30, north: 'right' },
    ],
  },
  repelem: {
    label: 'Polos iguais (repelem)',
    magnets: [
      { x: 26, y: 30, north: 'right' },
      { x: 74, y: 30, north: 'left' },
    ],
  },
};

export interface Vec {
  x: number;
  y: number;
}

interface Charge extends Vec {
  q: number;
}

/** Charges across each end face of the magnet. */
const FACE_OFFSETS = [-2.4, -1.2, 0, 1.2, 2.4];

function charges(magnets: Magnet[]): Charge[] {
  const out: Charge[] = [];
  for (const m of magnets) {
    const half = MAGNET_LENGTH / 2;
    const nx = m.north === 'right' ? m.x + half : m.x - half;
    const sx = m.north === 'right' ? m.x - half : m.x + half;
    const q = 1 / FACE_OFFSETS.length;
    for (const dy of FACE_OFFSETS) {
      out.push({ x: nx, y: m.y + dy, q });
      out.push({ x: sx, y: m.y + dy, q: -q });
    }
  }
  return out;
}

function rawField(cs: Charge[], p: Vec): Vec {
  let x = 0;
  let y = 0;
  for (const c of cs) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const r2 = dx * dx + dy * dy + 1e-6;
    const k = c.q / (r2 * Math.sqrt(r2));
    x += k * dx;
    y += k * dy;
  }
  return { x, y };
}

/** Distance from the north face at which a lone magnet's field counts as 1. */
const REFERENCE_GAP = 1;
const REFERENCE = (() => {
  const m = PRESETS.um.magnets[0]!;
  const b = rawField(charges([m]), { x: m.x + MAGNET_LENGTH / 2 + REFERENCE_GAP, y: m.y });
  return Math.hypot(b.x, b.y);
})();

/** The field at `p`, scaled so 1 is the field right next to a lone magnet's north face. */
export function fieldAt(magnets: Magnet[], p: Vec): Vec {
  const b = rawField(charges(magnets), p);
  return { x: b.x / REFERENCE, y: b.y / REFERENCE };
}

export function strength(b: Vec): number {
  return Math.hypot(b.x, b.y);
}

/** Whether `p` is inside (or within `margin` of) one of the magnets. */
export function insideMagnet(magnets: Magnet[], p: Vec, margin = 0): boolean {
  return magnets.some(
    (m) =>
      Math.abs(p.x - m.x) <= MAGNET_LENGTH / 2 + margin &&
      Math.abs(p.y - m.y) <= MAGNET_WIDTH / 2 + margin,
  );
}

/**
 * Field lines: each starts just outside a north face and follows the field
 * (RK2, fixed step) until it reaches a magnet, leaves the plane or runs too
 * long. Points are in figure units.
 */
export function fieldLines(magnets: Magnet[], perFace = 12): Vec[][] {
  const cs = charges(magnets);
  const lines: Vec[][] = [];
  const step = 0.6;
  /** Unit vector along the field (`sense` 1) or against it (−1). */
  const dir = (p: Vec, sense: number): Vec | undefined => {
    const b = rawField(cs, p);
    const n = Math.hypot(b.x, b.y);
    return n > 1e-12 ? { x: (sense * b.x) / n, y: (sense * b.y) / n } : undefined;
  };
  /** Follows the field from `seed`; whether it ended on a magnet. */
  const trace = (seed: Vec, sense: number): { line: Vec[]; landed: boolean } => {
    const line: Vec[] = [seed];
    let p = seed;
    for (let n = 0; n < 900; n++) {
      const d1 = dir(p, sense);
      if (!d1) break;
      const d2 = dir({ x: p.x + (d1.x * step) / 2, y: p.y + (d1.y * step) / 2 }, sense);
      if (!d2) break;
      p = { x: p.x + d2.x * step, y: p.y + d2.y * step };
      line.push(p);
      if (insideMagnet(magnets, p)) return { line, landed: true };
      if (p.x < -20 || p.x > WIDTH + 20 || p.y < -20 || p.y > HEIGHT + 20) break;
    }
    return { line, landed: false };
  };
  // Seeds: in front of each face and around its corners, a little outside the magnet.
  const seeds = (m: Magnet, pole: 'north' | 'south'): Vec[] => {
    const right = (m.north === 'right') === (pole === 'north');
    const sign = right ? 1 : -1;
    const faceX = m.x + (sign * MAGNET_LENGTH) / 2;
    return Array.from({ length: perFace }, (_, i) => {
      const angle = (-0.5 + (i + 0.5) / perFace) * Math.PI * 0.94;
      return {
        x: faceX + sign * (0.4 + Math.cos(angle) * 0.6),
        y: m.y + Math.sin(angle) * (MAGNET_WIDTH / 2 + 0.4),
      };
    });
  };
  for (const m of magnets) {
    for (const seed of seeds(m, 'north')) {
      const { line } = trace(seed, 1);
      if (line.length > 3) lines.push(line);
    }
  }
  // Lines that come into a south face from far away (the ones that left a
  // north face and closed on another magnet are already drawn).
  for (const m of magnets) {
    for (const seed of seeds(m, 'south')) {
      const { line, landed } = trace(seed, -1);
      if (!landed && line.length > 3) lines.push(line.reverse());
    }
  }
  return lines;
}

const DIRECTIONS = [
  'para a direita',
  'para a direita e para cima',
  'para cima',
  'para a esquerda e para cima',
  'para a esquerda',
  'para a esquerda e para baixo',
  'para baixo',
  'para a direita e para baixo',
];

/** Where a compass needle's north end points, in words (y grows downwards in the figure). */
export function directionWords(b: Vec): string {
  const angle = Math.atan2(-b.y, b.x);
  const k = Math.round(angle / (Math.PI / 4));
  return DIRECTIONS[((k % 8) + 8) % 8]!;
}
