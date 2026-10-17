import { formatSI } from '../format';
import { defineSymbol, num, Upright } from './_kit';

/** Single-phase capacitor motor: two windings (ABRE/FECHA) and the common. */
export default defineSymbol({
  type: 'ac-motor-1ph-cap',
  pins: { w1: [-2, -3], w2: [2, -3], common: [0, 3] },
  box: [-22, -30, 44, 60],
  live: ['rpm', 'direction', 'humming'],
  draw: (ctx) => {
    const rpm = typeof ctx.live.rpm === 'number' ? ctx.live.rpm : 0;
    const dir = typeof ctx.live.direction === 'number' ? ctx.live.direction : Math.sign(rpm);
    const period = Math.abs(rpm) > 1 ? Math.max(0.15, 60 / Math.abs(rpm)) * 6 : 0;
    return (
      <>
        <path d="M-20 -30V-18L-11 -11M20 -30V-18L11 -11M0 30V16" />
        <circle r={16} className="sym-body" />
        {ctx.live.humming === true && (
          <path
            d="M-22 -6Q-25 0 -22 6M22 -6Q25 0 22 6M-26 -9Q-30 0 -26 9M26 -9Q30 0 26 9"
            className="sym-danger sym-hum"
            strokeWidth={1.4}
          />
        )}
        <Upright x={0} y={-4} ctx={ctx} size={12} weight={700}>
          M
        </Upright>
        <Upright x={0} y={8} ctx={ctx} size={8} weight={600}>
          1~
        </Upright>
        {period > 0 && (
          <g
            className="sym-spin"
            style={{
              animationDuration: `${period}s`,
              animationDirection: dir < 0 ? 'reverse' : 'normal',
            }}
          >
            <circle cx={0} cy={-13} r={1.6} className="sym-fill sym-accent" />
          </g>
        )}
      </>
    );
  },
  value: (p) => formatSI(num(p.power, 250), 'W'),
});
