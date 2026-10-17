import { defineSymbol, num } from './_kit';
import { formatNumber } from '../format';

/** Transformer: two windings around an iron core (two lines). */
export default defineSymbol({
  type: 'transformer',
  pins: { p1: [-2, -2], p2: [-2, 2], s1: [2, -2], s2: [2, 2] },
  box: [-20, -20, 40, 40],
  draw: () => (
    <>
      <path d="M-20 -20H-9V-16M-20 20H-9V16M20 -20H9V-16M20 20H9V16" />
      <path d="M-9 -16A4 4 0 0 1 -9 -8A4 4 0 0 1 -9 0A4 4 0 0 1 -9 8A4 4 0 0 1 -9 16" />
      <path d="M9 -16A4 4 0 0 0 9 -8A4 4 0 0 0 9 0A4 4 0 0 0 9 8A4 4 0 0 0 9 16" />
      <path d="M-2 -17V17M2 -17V17" strokeWidth={1.6} />
      <circle cx={-14} cy={-14} r={1.6} className="sym-fill" />
      <circle cx={14} cy={-14} r={1.6} className="sym-fill" />
    </>
  ),
  value: (p) => `${formatNumber(num(p.ratio, 10), 2)}:1`,
});
