import { defineSymbol, Upright } from './_kit';

/** D flip-flop (IEC style box): D and clock (triangle) on the left, Q and Q̄ on the right. */
export default defineSymbol({
  type: 'd-flip-flop',
  pins: { d: [-4, -2], clk: [-4, 2], q: [4, -2], nq: [4, 2] },
  box: [-40, -32, 80, 64],
  live: ['d', 'clk', 'q'],
  draw: (ctx) => {
    const high = (on: boolean) => (on ? 'sym-high' : undefined);
    const q = ctx.live.q === true;
    return (
      <>
        <path d="M-40 -20H-24" className={high(ctx.live.d === true)} />
        <path d="M-40 20H-24" className={high(ctx.live.clk === true)} />
        <path d="M24 -20H40" className={high(q)} />
        <path d="M24 20H40" className={high(ctx.live.q === false)} />
        <rect x={-24} y={-32} width={48} height={64} rx={2} className="sym-body" />
        <path d="M-24 14L-17 20L-24 26" />
        <Upright x={-19} y={-20} ctx={ctx} size={9} anchor="start" weight={600}>
          D
        </Upright>
        <Upright x={19} y={-20} ctx={ctx} size={9} anchor="end" weight={600}>
          Q
        </Upright>
        <Upright x={19} y={20} ctx={ctx} size={9} anchor="end" weight={600}>
          Q̄
        </Upright>
        <Upright x={0} y={0} ctx={ctx} size={8} className="sym-pin">
          FF-D
        </Upright>
      </>
    );
  },
});
