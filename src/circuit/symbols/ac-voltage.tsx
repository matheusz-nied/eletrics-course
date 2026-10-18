import { formatSI } from '../format';
import { defineSymbol, num } from './_kit';

/** AC voltage source: circle with a sine wave. */
export default defineSymbol({
  type: 'ac-voltage',
  body: 26,
  half: 13,
  draw: ({ rot }) => (
    <>
      <circle r={12} className="sym-body" />
      {/* the sine stays horizontal on screen */}
      <path d="M-7 0C-5 -8 -2 -8 0 0S5 8 7 0" transform={`rotate(${-rot})`} />
    </>
  ),
  value: (p) =>
    `${formatSI(num(p.amplitude, 10), 'V')} pico · ${formatSI(num(p.frequency, 60), 'Hz')}`,
});
