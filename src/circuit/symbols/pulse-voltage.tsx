import { formatSI } from '../format';
import { defineSymbol, num } from './_kit';

/** Square-wave (PWM) source: circle with a square wave. */
export default defineSymbol({
  type: 'pulse-voltage',
  body: 26,
  half: 13,
  draw: ({ rot }) => (
    <>
      <circle r={12} className="sym-body" />
      {/* the wave stays horizontal on screen */}
      <path d="M-8 4H-5V-4H0V4H5V-4H8" transform={`rotate(${-rot})`} />
    </>
  ),
  value: (p) =>
    `${formatSI(num(p.frequency, 1000), 'Hz')} · ${Math.round(num(p.duty, 0.5) * 100)} %`,
});
