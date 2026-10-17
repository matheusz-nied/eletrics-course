import { defineSymbol, isOn, Upright } from './_kit';

/** DIP switch: a row of small slide switches (pins a1/b1, a2/b2…). */
export default defineSymbol({
  type: 'dip-switch',
  draw: (ctx) => {
    const n = Object.keys(ctx.pins).filter((p) => p.startsWith('a')).length;
    const h = Math.max(1, n) * 20;
    return (
      <>
        <rect x={-14} y={-10} width={28} height={h} rx={2} className="sym-body" />
        {Array.from({ length: n }, (_, i) => {
          const y = i * 20;
          const on = isOn(ctx.params[`s${i + 1}`]);
          return (
            <g key={i}>
              <path d={`M-20 ${y}H-14M14 ${y}H20`} />
              <rect x={-8} y={y - 4} width={16} height={8} rx={1} strokeWidth={1.2} />
              <rect x={on ? 1 : -7} y={y - 3} width={6} height={6} className="sym-fill" />
              <Upright x={-11} y={y} ctx={ctx} size={6} anchor="middle">
                {i + 1}
              </Upright>
            </g>
          );
        })}
      </>
    );
  },
});
