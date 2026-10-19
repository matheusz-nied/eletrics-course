import { defineSymbol, isOn, num, Upright } from './_kit';

/** Three-terminal linear regulator: a block with IN, OUT and GND (or ADJ). */
export default defineSymbol({
  type: 'voltage-regulator',
  pins: { in: [-4, 0], out: [4, 0], com: [0, 3] },
  box: [-40, -16, 80, 46],
  live: ['shutdown'],
  draw: (ctx) => {
    const adjustable = isOn(ctx.params.adjustable);
    const vref = num(ctx.params.vref, 12);
    const title = adjustable ? 'LM317' : `78${String(Math.round(vref)).padStart(2, '0')}`;
    const hot = ctx.live.shutdown === true;
    return (
      <>
        <path d="M-40 0H-26M26 0H40M0 16V30" />
        <rect
          x={-26}
          y={-16}
          width={52}
          height={32}
          rx={3}
          className={hot ? 'sym-body sym-danger' : 'sym-body'}
        />
        <Upright x={0} y={-3} ctx={ctx} size={9} weight={600}>
          {title}
        </Upright>
        <Upright x={-23} y={9} ctx={ctx} size={7} anchor="start" className="sym-pin">
          IN
        </Upright>
        <Upright x={23} y={9} ctx={ctx} size={7} anchor="end" className="sym-pin">
          OUT
        </Upright>
        <Upright x={0} y={12} ctx={ctx} size={7} className="sym-pin">
          {adjustable ? 'ADJ' : 'GND'}
        </Upright>
      </>
    );
  },
  value: (p) => (isOn(p.adjustable) ? undefined : `${String(num(p.vref, 12)).replace('.', ',')} V`),
});
