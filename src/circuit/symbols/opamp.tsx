import { defineSymbol, Upright } from './_kit';

/** Operational amplifier. */
export default defineSymbol({
  type: 'opamp',
  pins: { inn: [-3, -1], inp: [-3, 1], out: [3, 0] },
  box: [-30, -22, 60, 44],
  draw: (ctx) => (
    <>
      <path d="M-30 -10H-20M-30 10H-20M22 0H30" />
      <path d="M-20 -22V22L22 0Z" className="sym-body" />
      <Upright x={-14} y={-10} ctx={ctx} size={12} weight={700}>
        −
      </Upright>
      <Upright x={-14} y={10} ctx={ctx} size={12} weight={700}>
        +
      </Upright>
    </>
  ),
});
