import { defineSymbol, isOn, Upright } from './_kit';

/** Photocell (fotocélula) receiver: infrared beam and an output contact. */
export default defineSymbol({
  type: 'photocell',
  pins: { vp: [-3, -1], gnd: [-3, 1], nc: [3, -2], com: [3, 0], no: [3, 2] },
  box: [-30, -24, 60, 48],
  draw: (ctx) => {
    const blocked = isOn(ctx.params.blocked);
    return (
      <>
        <rect x={-22} y={-24} width={44} height={48} rx={3} className="sym-body" />
        <path d="M-30 -10H-22M-30 10H-22M22 -20H30M22 0H30M22 20H30" />
        <path d="M-18 -4H-12M-18 4H-12" strokeWidth={1.2} />
        {blocked ? (
          <path d="M-12 0H-4M-5 -6L-1 6" className="sym-danger" strokeWidth={1.6} />
        ) : (
          <path d="M-12 0H2" className="sym-beam" strokeDasharray="3 2" strokeWidth={1.6} />
        )}
        <path d="M14 0H18M10 -20H22M10 20H22" strokeWidth={1.2} />
        <path d={blocked ? 'M14 0L10 18' : 'M14 0L10 -18'} className="sym-blade" />
        <Upright x={-14} y={-15} ctx={ctx} size={7} weight={600}>
          FOTO
        </Upright>
      </>
    );
  },
});
