import { Arrow, defineSymbol, isBurned } from './_kit';

/** NPN bipolar transistor: emitter arrow points out. */
export default defineSymbol({
  type: 'npn',
  pins: { b: [-4, 0], c: [2, -4], e: [2, 4] },
  box: [-40, -40, 62, 80],
  live: ['burned', 'damaged'],
  draw: ({ live }) => (
    <>
      <circle cx={4} cy={0} r={18} className={isBurned(live) ? 'sym-burned' : 'sym-body'} />
      <path d="M-40 0H-6" />
      <path d="M-6 -11V11" strokeWidth={3} />
      <path d="M-6 -5L20 -16V-40M20 16V40" />
      <Arrow x1={-6} y1={5} x2={20} y2={16} size={7} />
    </>
  ),
});
