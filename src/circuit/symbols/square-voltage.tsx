import { formatSI } from '../format';
import { defineSymbol, num } from './_kit';

/** Square wave source (function generator, clock): circle with a square wave. */
export default defineSymbol({
  type: 'square-voltage',
  body: 26,
  half: 13,
  live: ['high'],
  draw: ({ rot }) => (
    <>
      <circle r={12} className="sym-body" />
      {/* the wave stays horizontal on screen */}
      <path d="M-7 4H-3.5V-4H0.5V4H4V-4H7" transform={`rotate(${-rot})`} />
    </>
  ),
  value: (p) => {
    const duty = Math.round(num(p.duty, 0.5) * 100);
    return `${formatSI(num(p.high, 5), 'V')} · ${formatSI(num(p.frequency, 1), 'Hz')} · ${duty} %`;
  },
});
