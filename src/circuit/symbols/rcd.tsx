import { formatSI } from '../format';
import { defineSymbol, num, Upright } from './_kit';

/** Residual-current device (DR): two poles, the differential sensor and the test button. */
export default defineSymbol({
  type: 'rcd',
  pins: { l1: [-4, -3], n1: [-4, 3], l2: [4, -3], n2: [4, 3] },
  box: [-40, -40, 80, 80],
  live: ['closed', 'tripped'],
  draw: (ctx) => {
    const open =
      ctx.live.closed === false || ctx.live.tripped === true || ctx.params.closed === false;
    return (
      <>
        <path d="M-40 -30H-16M-40 30H-16M16 -30H40M16 30H40" />
        <rect
          x={-26}
          y={-40}
          width={52}
          height={80}
          rx={3}
          className="sym-body"
          strokeWidth={1.4}
        />
        <path
          d={open ? 'M-16 -30L12 -40M-16 30L12 20' : 'M-16 -30H16M-16 30H16'}
          className={ctx.live.tripped === true ? 'sym-blade sym-danger' : 'sym-blade'}
        />
        <circle cx={0} cy={0} r={9} strokeWidth={1.2} />
        <Upright x={0} y={0} ctx={ctx} size={8} weight={600}>
          IΔ
        </Upright>
      </>
    );
  },
  value: (p) => `DR ${formatSI(num(p.sensitivity, 0.03), 'A')}`,
});
