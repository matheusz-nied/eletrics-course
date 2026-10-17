import { formatSI } from '../format';
import { defineSymbol, num, Upright } from './_kit';

/** Three-phase induction motor. */
export default defineSymbol({
  type: 'ac-motor-3ph',
  pins: { u: [-2, -3], v: [0, -3], w: [2, -3] },
  box: [-22, -30, 44, 48],
  live: ['rpm'],
  draw: (ctx) => (
    <>
      <path d="M-20 -30V-18L-11 -11M0 -30V-16M20 -30V-18L11 -11" />
      <circle r={16} className="sym-body" />
      <Upright x={0} y={-4} ctx={ctx} size={12} weight={700}>
        M
      </Upright>
      <Upright x={0} y={8} ctx={ctx} size={8} weight={600}>
        3~
      </Upright>
    </>
  ),
  value: (p) => formatSI(num(p.power, 750), 'W'),
});
