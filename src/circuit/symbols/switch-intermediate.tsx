import { defineSymbol, isOn, Upright } from './_kit';

/**
 * Intermediate (four-way) switch: two blades that join the left contacts to
 * the right ones straight at rest and crossed when actuated, linked by a
 * dashed line because they move together.
 */
export default defineSymbol({
  type: 'switch-intermediate',
  pins: { a1: [-3, -2], a2: [-3, 2], b1: [3, -2], b2: [3, 2] },
  box: [-30, -24, 60, 48],
  draw: (ctx) => {
    const crossed = isOn(ctx.params.actuated);
    return (
      <>
        <path d="M-30 -20H-12M-30 20H-12M12 -20H30M12 20H30" />
        <circle cx={-12} cy={-20} r={2.2} className="sym-fill" />
        <circle cx={-12} cy={20} r={2.2} className="sym-fill" />
        <circle cx={12} cy={-20} r={2} className="sym-body" />
        <circle cx={12} cy={20} r={2} className="sym-body" />
        <path
          d={crossed ? 'M-12 -20L10.5 18.5M-12 20L10.5 -18.5' : 'M-12 -20L10.5 -20M-12 20L10.5 20'}
          className="sym-blade"
        />
        {!crossed && <path d="M-1 -18V18" strokeDasharray="2 2" />}
        <Upright x={0} y={-29} ctx={ctx} size={8} className="sym-pin-text">
          {crossed ? 'cruzado' : 'direto'}
        </Upright>
      </>
    );
  },
});
