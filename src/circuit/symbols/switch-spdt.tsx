import { defineSymbol, isOn } from './_kit';

/** Changeover switch: common pivot, NF contact on top, NA contact below. */
export default defineSymbol({
  type: 'switch-spdt',
  pins: { com: [-3, 0], nc: [3, -2], no: [3, 2] },
  box: [-30, -24, 60, 48],
  draw: ({ params }) => {
    const actuated = isOn(params.actuated);
    return (
      <>
        <path d="M-30 0H-10M12 -20H30M12 20H30" />
        <circle cx={-10} cy={0} r={2.2} className="sym-fill" />
        <circle cx={12} cy={-20} r={2} className="sym-body" />
        <circle cx={12} cy={20} r={2} className="sym-body" />
        <path d={actuated ? 'M-10 0L10.5 17.5' : 'M-10 0L10.5 -17.5'} className="sym-blade" />
        <text x={18} y={-25} fontSize={8} className="sym-pin-text">
          NF
        </text>
        <text x={18} y={31} fontSize={8} className="sym-pin-text">
          NA
        </text>
      </>
    );
  },
});
