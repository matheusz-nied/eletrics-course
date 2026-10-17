import { Arrow, defineSymbol, isBurned } from './_kit';

/** PNP bipolar transistor: emitter (on top) with the arrow pointing in. */
export default defineSymbol({
  type: 'pnp',
  pins: { b: [-4, 0], e: [2, -4], c: [2, 4] },
  box: [-40, -40, 62, 80],
  live: ['burned', 'damaged'],
  draw: ({ live }) => (
    <>
      <circle cx={4} cy={0} r={18} className={isBurned(live) ? 'sym-burned' : 'sym-body'} />
      <path d="M-40 0H-6" />
      <path d="M-6 -11V11" strokeWidth={3} />
      <path d="M20 -16V-40M-6 5L20 16V40" />
      <Arrow x1={20} y1={-16} x2={-4} y2={-6} size={7} />
    </>
  ),
});
