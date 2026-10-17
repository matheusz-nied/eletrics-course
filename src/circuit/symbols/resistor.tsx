import { formatSI } from '../format';
import { defineSymbol, isBurned, num } from './_kit';

/** IEC resistor: rectangle. Darkens and cracks when burned. */
export default defineSymbol({
  type: 'resistor',
  body: 32,
  half: 7,
  live: ['burned', 'damaged'],
  gradientBody: true,
  draw: ({ live, gradient }) => (
    <>
      <rect
        x={-16}
        y={-6}
        width={32}
        height={12}
        rx={1}
        className={isBurned(live) ? 'sym-burned' : 'sym-body'}
        style={!isBurned(live) && gradient ? { fill: gradient } : undefined}
      />
      {isBurned(live) && <path d="M-6 -6L-2 0L-6 6M4 -6L1 1L5 6" className="sym-crack" />}
    </>
  ),
  value: (p) => formatSI(num(p.resistance, 1000), 'Ω'),
});
