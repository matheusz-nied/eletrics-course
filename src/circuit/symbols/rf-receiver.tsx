import { defineSymbol, Upright } from './_kit';

/** 433 MHz receiver with its antenna. */
export default defineSymbol({
  type: 'rf-receiver',
  pins: { vp: [-3, -1], gnd: [-3, 1], out: [3, 0] },
  box: [-30, -32, 60, 54],
  draw: (ctx) => (
    <>
      <rect x={-22} y={-18} width={44} height={36} rx={3} className="sym-body" />
      <path d="M-30 -10H-22M-30 10H-22M22 0H30" />
      <path d="M8 -18V-30M2 -30L8 -24L14 -30" strokeWidth={1.4} />
      <Upright x={0} y={2} ctx={ctx} size={8} weight={600}>
        433 MHz
      </Upright>
    </>
  ),
});
