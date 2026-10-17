import { formatSI } from '../format';
import { defineSymbol, isBurned, num } from './_kit';

/** Potentiometer: resistor with a sliding wiper; the arrow follows the position. */
export default defineSymbol({
  type: 'potentiometer',
  pins: { a: [-4, 0], w: [0, -3], b: [4, 0] },
  box: [-40, -30, 80, 38],
  live: ['burned'],
  gradientBody: true,
  draw: ({ params, live, gradient }) => {
    const pos = Math.min(1, Math.max(0, num(params.position, 0.5)));
    const xw = -13 + 26 * pos;
    const burned = isBurned(live);
    return (
      <>
        <path d="M-40 0H-16M16 0H40" />
        <rect
          x={-16}
          y={-6}
          width={32}
          height={12}
          rx={1}
          className={burned ? 'sym-burned' : 'sym-body'}
          style={!burned && gradient ? { fill: gradient } : undefined}
        />
        <path d={`M0 -30V-20H${xw}V-12`} className="sym-wiper" />
        <path d={`M${xw - 4} -13L${xw} -7L${xw + 4} -13Z`} className="sym-fill sym-wiper" />
      </>
    );
  },
  value: (p) => formatSI(num(p.resistance, 10000), 'Ω'),
});
