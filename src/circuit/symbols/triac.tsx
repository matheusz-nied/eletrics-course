import { defineSymbol, isBurned } from './_kit';

/** TRIAC: two anti-parallel thyristors with one gate (near MT1). */
export default defineSymbol({
  type: 'triac',
  pins: { mt2: [-4, 0], mt1: [4, 0], g: [2, 4] },
  box: [-40, -16, 80, 56],
  live: ['damaged'],
  draw: ({ live }) => (
    <g className={isBurned(live) ? 'sym-burned' : undefined}>
      <path d="M-40 0H-8M8 0H40" />
      <path d="M-8 -16V16M8 -16V16" />
      <path d="M-8 -15L8 -7L-8 1Z" className="sym-fill" />
      <path d="M8 -1L-8 7L8 15Z" className="sym-fill" />
      <path d="M8 11L20 23V40" />
    </g>
  ),
});
