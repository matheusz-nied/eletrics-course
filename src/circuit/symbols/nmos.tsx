import { Arrow, defineSymbol, isBurned } from './_kit';

/** N-channel enhancement MOSFET: arrow towards the channel, body tied to the source. */
export default defineSymbol({
  type: 'nmos',
  pins: { g: [-4, 0], d: [2, -4], s: [2, 4] },
  box: [-40, -40, 62, 80],
  live: ['damaged'],
  draw: ({ live }) => (
    <g className={isBurned(live) ? 'sym-burned' : undefined}>
      <path d="M-40 0H-10M-10 -14V14" />
      <path d="M-4 -17V-7M-4 -4V4M-4 7V17" strokeWidth={2.6} />
      <path d="M-4 -12H20V-40M-4 12H20V40M20 0V12" />
      <Arrow x1={20} y1={0} x2={-2} y2={0} size={6} />
    </g>
  ),
});
