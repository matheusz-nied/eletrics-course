/**
 * A random gate motor for the "find the common wire" exercise: three wire
 * colors and two nearly equal windings. Deterministic for a seed, so the
 * page renders the same motor on the server and in the browser.
 */

export interface WireColor {
  name: string;
  css: string;
}

export interface WindingMotor {
  colors: WireColor[];
  /** Index of the common wire. */
  common: number;
  /** Resistance of each winding, common to ABRE and common to FECHA (Ω). */
  windings: [number, number];
  /** Both windings in series, as read between ABRE and FECHA (Ω). */
  full: number;
  /** Reading with the probes touching each other: the probe leads (Ω). */
  leads: number;
  /** What the meter reads between two wires (Ω). */
  between(a: number, b: number): number;
}

const COLORS: WireColor[] = [
  { name: 'preto', css: '#1f2328' },
  { name: 'branco', css: '#f4f4f2' },
  { name: 'vermelho', css: '#c62828' },
  { name: 'azul', css: '#1e5bb8' },
  { name: 'marrom', css: '#6d4c2f' },
  { name: 'cinza', css: '#8a9099' },
  { name: 'amarelo', css: '#e7b416' },
  { name: 'laranja', css: '#e06a1b' },
];

/**
 * Resistance of each winding (Ω). No manufacturer publishes it; this is the
 * order of magnitude estimated from rated power and current in FONTES.md
 * (1/4 CV motor: about 3–7 Ω at 127 V, 7–14 Ω at 220 V), so the lesson calls
 * it an estimate.
 */
export const WINDING_RANGE: Record<127 | 220, [number, number]> = {
  127: [3, 7],
  220: [7, 14],
};

const LEADS = 0.2;

function random(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export function windingMotor(seed: number, voltage: 127 | 220): WindingMotor {
  const rnd = random(seed * 31 + voltage);
  const pool = [...COLORS];
  const colors: WireColor[] = [];
  for (let i = 0; i < 3; i++) colors.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]!);
  const common = Math.floor(rnd() * 3);
  const [lo, hi] = WINDING_RANGE[voltage];
  const base = lo + rnd() * (hi - lo);
  // Gate motors have two equal windings; real ones differ by a few percent.
  const windings: [number, number] = [round1(base), round1(base * (0.97 + rnd() * 0.06))];
  const ends = [0, 1, 2].filter((i) => i !== common);
  const full = round1(windings[0] + windings[1]);
  return {
    colors,
    common,
    windings,
    full: round1(full + LEADS),
    leads: LEADS,
    between(a, b) {
      if (a === b) return LEADS;
      if (a !== common && b !== common) return round1(full + LEADS);
      const end = a === common ? b : a;
      return round1(windings[ends.indexOf(end)]! + LEADS);
    },
  };
}
