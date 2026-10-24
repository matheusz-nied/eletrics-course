/**
 * Lesson 13.2: how far a 433,92 MHz gate remote reaches, as a link budget.
 * Pure, tested in antena.test.ts; drawn by AntenaAlcance.tsx.
 *
 * Simplified model, with typical numbers (stated as such in the lesson):
 * - Remote: about −10 dBm radiated (EIRP); a weak battery costs about 6 dB.
 * - Receiver: superheterodyne module with −105 dBm sensitivity.
 * - Fading margin of 10 dB, so the range is one that works almost every time.
 * - Receiver antenna: a straight wire over the board's ground. It resonates
 *   about 5 % shorter than λ/4 (end effect); away from resonance, the
 *   mismatch is modelled as a series resonance of Q = 3:
 *   η = 1 / (1 + Q²·(x − 1/x)²), x = length / resonant length,
 *   floored at −30 dB (the board traces alone still pick up something).
 * - Path loss: free space up to 1 m, then the log-distance model
 *   L = L(1 m) + 10·n·log₁₀(d), with n = 2,7 in the open and 3,3 in a street
 *   with houses and trees (typical exponents near the ground at 433 MHz).
 * - Obstacles: typical extra losses in dB; they vary a lot with the material,
 *   the thickness and the angle.
 */
import { C } from './espectro';

export const FREQUENCY = 433.92e6;
export const LAMBDA = C / FREQUENCY;
/** Quarter wave (m): 17,3 cm. */
export const QUARTER = LAMBDA / 4;
/** A real wire resonates about 5 % shorter than the quarter wave. */
export const SHORTENING = 0.95;
export const RESONANT = QUARTER * SHORTENING;
const Q = 3;
const FLOOR_DB = -30;

export const TX_EIRP_DBM = -10;
export const RX_SENSITIVITY_DBM = -105;
export const FADE_MARGIN_DB = 10;
export const WEAK_BATTERY_DB = 6;

export interface Environment {
  id: string;
  label: string;
  /** Path loss exponent. */
  n: number;
}

export const ENVIRONMENTS: Environment[] = [
  { id: 'aberto', label: 'Campo aberto, com visada', n: 2.7 },
  { id: 'rua', label: 'Rua com casas e árvores', n: 3.3 },
];

export interface Obstacle {
  id: string;
  label: string;
  /** Typical extra loss (dB). */
  loss: number;
}

export const OBSTACLES: Obstacle[] = [
  { id: 'nenhum', label: 'Nada no caminho', loss: 0 },
  { id: 'tijolo', label: 'Muro de tijolo', loss: 6 },
  { id: 'concreto', label: 'Laje ou parede de concreto', loss: 12 },
  { id: 'chapa', label: 'Portão de chapa de aço', loss: 18 },
  { id: 'caixa', label: 'Central dentro de caixa de metal', loss: 25 },
];

/** Free-space path loss at 1 m (dB): 20·log₁₀(4π/λ), about 25 dB. */
export const LOSS_1M = 20 * Math.log10((4 * Math.PI) / LAMBDA);

/** Antenna gain relative to a resonant wire (dB, ≤ 0), for a wire of `length` m. */
export function antennaGain(length: number): number {
  if (!(length > 0)) return FLOOR_DB;
  const x = length / RESONANT;
  const eta = 1 / (1 + Q * Q * (x - 1 / x) ** 2);
  return Math.max(10 * Math.log10(eta), FLOOR_DB);
}

/** Path loss (dB) over `d` m in an environment with exponent `n`. */
export function pathLoss(d: number, n: number): number {
  if (d <= 1) return 20 * Math.log10((4 * Math.PI * Math.max(d, 1e-3)) / LAMBDA);
  return LOSS_1M + 10 * n * Math.log10(d);
}

export interface LinkInput {
  /** Antenna wire length (m). */
  length: number;
  environment: string;
  obstacles: string[];
  weakBattery: boolean;
}

export interface LinkResult {
  /** Losses and gains that change the budget (dB, negative = loss). */
  antenna: number;
  obstacles: number;
  battery: number;
  /** Path loss the link can afford (dB). */
  budget: number;
  /** Estimated range (m). */
  range: number;
}

export function solveLink(input: LinkInput): LinkResult {
  const env = ENVIRONMENTS.find((e) => e.id === input.environment) ?? ENVIRONMENTS[1]!;
  const antenna = antennaGain(input.length);
  const obstacles = -input.obstacles
    .map((id) => OBSTACLES.find((o) => o.id === id)?.loss ?? 0)
    .reduce((a, b) => a + b, 0);
  const battery = input.weakBattery ? -WEAK_BATTERY_DB : 0;
  const budget = TX_EIRP_DBM - RX_SENSITIVITY_DBM - FADE_MARGIN_DB + antenna + obstacles + battery;
  const range =
    budget >= LOSS_1M
      ? 10 ** ((budget - LOSS_1M) / (10 * env.n))
      : (LAMBDA / (4 * Math.PI)) * 10 ** (budget / 20);
  return { antenna, obstacles, battery, budget, range };
}

/** Range rounded the way the lesson reads it: 2 significant figures. */
export function roundRange(m: number): number {
  if (m < 1) return Math.round(m * 10) / 10;
  return Number(m.toPrecision(2));
}
