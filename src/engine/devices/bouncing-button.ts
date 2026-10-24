import { bool, defineDevice, num, TWO_PINS } from '../device';
import { R_CLOSED, R_OPEN } from '../models/constants';

/** Small seeded generator (mulberry32): the same press always bounces the same way. */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Instants (s after the press or release) at which the contact flips while it
 * bounces: an even number, so it ends where it should. The gaps shrink, as the
 * moving contact loses energy on each bounce.
 */
export function bouncePattern(duration: number, seed: number, release: boolean): number[] {
  if (duration <= 0) return [];
  const rnd = random(seed);
  const pairs = release ? 1 + Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 3);
  const flips: number[] = [];
  // Each bounce: the contact touches, jumps apart and touches again, shorter each time.
  const weights = Array.from({ length: pairs }, (_, k) => (pairs - k) * (0.7 + 0.6 * rnd()));
  const total = weights.reduce((s, w) => s + w, 0);
  let t = 0;
  for (const w of weights) {
    const span = (w / total) * duration;
    const apart = t + span * (0.25 + 0.3 * rnd());
    flips.push(apart, t + span);
    t += span;
  }
  return flips;
}

/**
 * Push button (normally open) whose contact bounces: for `bounce` seconds
 * after it is pressed, the contact touches and jumps apart a few times
 * before it settles, and it bounces less when released. Real contacts
 * bounce for a few milliseconds (typical). Each press bounces in its own
 * way, the same every run (`seed`). The contact follows the button one step
 * late, like the logic devices.
 */
export default defineDevice({
  info: {
    type: 'bouncing-button',
    label: 'Botão pulsador com trepidação',
    terminals: 'two',
    pins: TWO_PINS,
    params: {
      pressed: { default: false, label: 'Apertado' },
      bounce: {
        default: 0.004,
        label: 'Duração da trepidação',
        unit: 's',
        min: 0,
        max: 0.05,
      },
      seed: { default: 1, label: 'Semente (cada valor trepida de um jeito)', min: 0 },
    },
    readouts: ['current', 'voltage', 'pressed', 'closed', 'changes'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão entre os contatos', unit: 'V' },
      pressed: { label: 'Apertado' },
      closed: { label: 'Contato fechado' },
      changes: { label: 'Mudanças do contato desde o início' },
    },
  },
  create({ params, pins: [a, b] }) {
    let target = false;
    let closed = false;
    let start = 0;
    let flips: number[] = [];
    let presses = 0;
    let changes = 0;
    const g = () => 1 / (closed ? R_CLOSED : R_OPEN);
    return {
      stamp(m) {
        m.conductance(a, b, g());
      },
      stampAc(m) {
        m.admittance(a, b, g());
      },
      update(step, _x, ctx) {
        if (!ctx.commit) return;
        const want = bool(params, 'pressed');
        if (want !== target) {
          target = want;
          start = step.t;
          presses++;
          flips = bouncePattern(
            num(params, 'bounce') * (want ? 1 : 0.5),
            Math.round(num(params, 'seed')) * 1000 + presses,
            !want,
          );
        }
        const elapsed = step.t - start;
        const flipped = flips.filter((t) => t <= elapsed).length % 2 === 1;
        const next = flipped ? !target : target;
        if (next !== closed) {
          closed = next;
          changes++;
          ctx.discontinuity();
        }
      },
      pinCurrents(x, out) {
        out[0] = g() * (x.v(a) - x.v(b));
        out[1] = -out[0];
      },
      readouts(_x, out) {
        out('pressed', bool(params, 'pressed'));
        out('closed', closed);
        out('changes', changes);
      },
      reset() {
        target = closed = false;
        start = 0;
        flips = [];
        presses = changes = 0;
      },
    };
  },
});
