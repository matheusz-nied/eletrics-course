import { defineSymbol, isBurned } from './_kit';

/** Diode: the triangle points from anode (a) to cathode (b). */
export default defineSymbol({
  type: 'diode',
  body: 18,
  half: 9,
  live: ['burned', 'damaged'],
  draw: ({ live }) => (
    <>
      <path d="M-9 0H9" />
      <path d="M-7 -8L7 0L-7 8Z" className={isBurned(live) ? 'sym-burned' : 'sym-fill'} />
      <path d="M7 -8V8" />
    </>
  ),
});
