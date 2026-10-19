import { defineSymbol, isOn } from './_kit';

/** Two-pole changeover switch: two SPDT poles moved together (dashed link). */
export default defineSymbol({
  type: 'switch-dpdt',
  pins: {
    com1: [-3, -3],
    nc1: [3, -5],
    no1: [3, -1],
    com2: [-3, 3],
    nc2: [3, 1],
    no2: [3, 5],
  },
  box: [-30, -52, 60, 104],
  draw: (ctx) => {
    const actuated = isOn(ctx.params.actuated);
    const pole = (y: number) => (
      <>
        <path d={`M-30 ${y}H-10M12 ${y - 20}H30M12 ${y + 20}H30`} />
        <circle cx={-10} cy={y} r={2.2} className="sym-fill" />
        <circle cx={12} cy={y - 20} r={2} className="sym-body" />
        <circle cx={12} cy={y + 20} r={2} className="sym-body" />
        <path
          d={actuated ? `M-10 ${y}L10.5 ${y + 17.5}` : `M-10 ${y}L10.5 ${y - 17.5}`}
          className="sym-blade"
        />
      </>
    );
    // The link joins the middle of the two blades.
    const mid = actuated ? 8.75 : -8.75;
    return (
      <>
        {pole(-30)}
        {pole(30)}
        <path d={`M0 ${-30 + mid}V${30 + mid}`} strokeDasharray="3 3" strokeWidth={1.2} />
      </>
    );
  },
});
