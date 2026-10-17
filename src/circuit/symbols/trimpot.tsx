import { formatSI } from '../format';
import { defineSymbol, num } from './_kit';

/** Trimpot: preset resistor (the wiper ends in a T, adjusted with a screwdriver). */
export default defineSymbol({
  type: 'trimpot',
  pins: { a: [-4, 0], w: [0, -3], b: [4, 0] },
  box: [-40, -30, 80, 38],
  draw: ({ params }) => {
    const pos = Math.min(1, Math.max(0, num(params.position, 0.5)));
    const xw = -13 + 26 * pos;
    return (
      <>
        <path d="M-40 0H-16M16 0H40" />
        <rect x={-16} y={-6} width={32} height={12} rx={1} className="sym-body" />
        <path d={`M0 -30V-20H${xw}V-8M${xw - 4} -8H${xw + 4}`} className="sym-wiper" />
      </>
    );
  },
  value: (p) => formatSI(num(p.resistance, 10000), 'Ω'),
});
