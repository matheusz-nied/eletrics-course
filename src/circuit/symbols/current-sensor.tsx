import { defineSymbol, Upright } from './_kit';

/** Current sensor: the measured conductor goes through it; the output is below. */
export default defineSymbol({
  type: 'current-sensor',
  pins: { a: [-3, -1], b: [3, -1], out: [-1, 2], gnd: [1, 2] },
  box: [-30, -22, 60, 42],
  draw: (ctx) => (
    <>
      <rect x={-20} y={-18} width={40} height={32} rx={3} className="sym-body" />
      <path d="M-30 -10H30" strokeWidth={2} />
      <circle cx={0} cy={-10} r={5} strokeWidth={1.2} />
      <path d="M-10 14V20M10 14V20" />
      <Upright x={0} y={5} ctx={ctx} size={8} weight={600}>
        I→V
      </Upright>
    </>
  ),
});
