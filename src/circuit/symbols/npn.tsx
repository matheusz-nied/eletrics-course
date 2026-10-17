import { Arrow, defineSymbol, isBurned } from './_kit';

/** NPN bipolar transistor: emitter arrow points out. */
export default defineSymbol({
  type: 'npn',
  pins: { b: [-2, 0], c: [1, -2], e: [1, 2] },
  box: [-20, -20, 34, 40],
  live: ['burned', 'damaged'],
  draw: ({ live }) => (
    <>
      <circle cx={2} cy={0} r={13} className={isBurned(live) ? 'sym-burned' : 'sym-body'} />
      <path d="M-20 0H-5" />
      <path d="M-5 -9V9" strokeWidth={3} />
      <path d="M-5 -4L10 -12V-20M10 12V20" />
      <Arrow x1={-5} y1={4} x2={10} y2={12} size={6} />
    </>
  ),
});
