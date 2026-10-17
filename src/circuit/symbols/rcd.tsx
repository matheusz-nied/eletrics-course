import { formatSI } from '../format';
import { defineSymbol, num, Upright } from './_kit';

/** Residual-current device (DR): two poles and the differential sensor. */
export default defineSymbol({
  type: 'rcd',
  pins: { l1: [-3, -1], n1: [-3, 1], l2: [3, -1], n2: [3, 1] },
  box: [-30, -22, 60, 44],
  live: ['tripped'],
  draw: (ctx) => {
    const tripped = ctx.live.tripped === true;
    return (
      <>
        <path d="M-30 -10H-12M-30 10H-12M12 -10H30M12 10H30" />
        <rect
          x={-20}
          y={-22}
          width={40}
          height={44}
          rx={3}
          className="sym-body"
          strokeWidth={1.4}
        />
        <path
          d={tripped ? 'M-12 -10L8 -18M-12 10L8 2' : 'M-12 -10H12M-12 10H12'}
          className="sym-blade"
        />
        <Upright x={0} y={16} ctx={ctx} size={8} weight={600}>
          IΔ
        </Upright>
      </>
    );
  },
  value: (p) => `DR ${formatSI(num(p.sensitivity, 0.03), 'A')}`,
});
