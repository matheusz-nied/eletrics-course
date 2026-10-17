import { defineSymbol, Upright } from './_kit';

/** Operational amplifier (supplies are parameters, not pins). */
export default defineSymbol({
  type: 'opamp',
  pins: { minus: [-4, -2], plus: [-4, 2], out: [4, 0] },
  box: [-40, -30, 80, 60],
  draw: (ctx) => (
    <>
      <path d="M-40 -20H-24M-40 20H-24M24 0H40" />
      <path d="M-24 -30V30L24 0Z" className="sym-body" />
      <Upright x={-17} y={-20} ctx={ctx} size={13} weight={700}>
        −
      </Upright>
      <Upright x={-17} y={20} ctx={ctx} size={13} weight={700}>
        +
      </Upright>
    </>
  ),
});
