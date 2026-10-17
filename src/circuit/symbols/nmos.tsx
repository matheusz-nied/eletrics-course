import { Arrow, defineSymbol } from './_kit';

/** N-channel enhancement MOSFET: arrow towards the channel. */
export default defineSymbol({
  type: 'nmos',
  pins: { g: [-2, 0], d: [1, -2], s: [1, 2] },
  box: [-20, -20, 32, 40],
  draw: () => (
    <>
      <path d="M-20 0H-8M-8 -10V10" />
      <path d="M-3 -13V-6M-3 -3V3M-3 6V13" strokeWidth={2.6} />
      <path d="M-3 -9H10V-20M-3 9H10V20M10 0V9" />
      <Arrow x1={10} y1={0} x2={-2} y2={0} size={5} />
    </>
  ),
});
