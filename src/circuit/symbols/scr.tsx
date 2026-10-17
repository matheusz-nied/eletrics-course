import { defineSymbol, isBurned } from './_kit';

/** SCR (thyristor): diode with a gate on the cathode side. */
export default defineSymbol({
  type: 'scr',
  pins: { a: [-4, 0], k: [4, 0], g: [2, 4] },
  box: [-40, -12, 80, 52],
  live: ['damaged'],
  draw: ({ live }) => (
    <g className={isBurned(live) ? 'sym-burned' : undefined}>
      <path d="M-40 0H-9M9 0H40" />
      <path d="M-9 -10L9 0L-9 10Z" className="sym-fill" />
      <path d="M9 -10V10M9 5L20 16V40" />
    </g>
  ),
});
