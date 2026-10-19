import { defineSymbol, Upright } from './_kit';

const OUTS = ['q0', 'q1', 'q2', 'q3'] as const;

/** 4-bit binary counter: clock (triangle) and reset on the left, Q0 to Q3 on the right, the count inside. */
export default defineSymbol({
  type: 'counter-4bit',
  pins: { clk: [-4, -2], rst: [-4, 2], q0: [4, -3], q1: [4, -1], q2: [4, 1], q3: [4, 3] },
  box: [-40, -42, 80, 84],
  live: ['count', 'clk', 'rst', ...OUTS],
  draw: (ctx) => {
    const high = (k: string) => (ctx.live[k] === true ? 'sym-high' : undefined);
    const count = typeof ctx.live.count === 'number' ? ctx.live.count : 0;
    return (
      <>
        <path d="M-40 -20H-24" className={high('clk')} />
        <path d="M-40 20H-24" className={high('rst')} />
        {OUTS.map((k, i) => (
          <path key={k} d={`M24 ${-30 + 20 * i}H40`} className={high(k)} />
        ))}
        <rect x={-24} y={-42} width={48} height={84} rx={2} className="sym-body" />
        <path d="M-24 -26L-17 -20L-24 -14" />
        <Upright x={-19} y={20} ctx={ctx} size={7} anchor="start" className="sym-pin">
          RST
        </Upright>
        {OUTS.map((k, i) => (
          <Upright
            key={k}
            x={20}
            y={-30 + 20 * i}
            ctx={ctx}
            size={7}
            anchor="end"
            className="sym-pin"
          >
            {k.toUpperCase()}
          </Upright>
        ))}
        <Upright x={-4} y={-34} ctx={ctx} size={7} className="sym-pin">
          CTR4
        </Upright>
        <Upright x={-4} y={0} ctx={ctx} size={14} weight={700}>
          {count}
        </Upright>
      </>
    );
  },
});
