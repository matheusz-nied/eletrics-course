import { defineSymbol, num, Upright } from './_kit';

/** Gate mechanics (no electrical pins): shows where the gate is along its travel. */
export default defineSymbol({
  type: 'gate-mechanics',
  box: [-40, -16, 80, 32],
  live: ['position'],
  draw: (ctx) => {
    const pos = Math.max(0, Math.min(1, num(ctx.live.position as number, 0)));
    return (
      <>
        <rect
          x={-40}
          y={-16}
          width={80}
          height={32}
          rx={3}
          className="sym-body"
          strokeDasharray="4 3"
          strokeWidth={1.2}
        />
        <path d="M-32 6H32" strokeWidth={1.2} />
        <rect x={-32 + 40 * pos} y={-6} width={24} height={10} className="sym-fill sym-accent" />
        <Upright x={0} y={-11} ctx={ctx} size={7} weight={600}>
          PORTÃO
        </Upright>
      </>
    );
  },
});
