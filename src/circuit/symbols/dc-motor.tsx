import { defineSymbol, Upright } from './_kit';

/** DC motor: circle with M and the DC sign; a marker turns with the shaft. */
export default defineSymbol({
  type: 'dc-motor',
  body: 30,
  half: 15,
  live: ['rpm'],
  draw: (ctx) => {
    const rpm = typeof ctx.live.rpm === 'number' ? ctx.live.rpm : 0;
    const period = Math.abs(rpm) > 1 ? Math.max(0.12, 60 / Math.abs(rpm)) * 4 : 0;
    return (
      <>
        <circle r={14} className="sym-body" />
        <Upright x={0} y={-2} ctx={ctx} size={11} weight={700}>
          M
        </Upright>
        <path d="M-5 6.5H5" transform={`rotate(${-ctx.rot})`} strokeWidth={1.4} />
        {period > 0 && (
          <g
            className="sym-spin"
            style={{
              animationDuration: `${period}s`,
              animationDirection: rpm < 0 ? 'reverse' : 'normal',
            }}
          >
            <circle cx={0} cy={-11} r={1.6} className="sym-fill sym-accent" />
          </g>
        )}
      </>
    );
  },
});
