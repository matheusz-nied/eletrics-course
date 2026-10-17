import { defineSymbol } from './_kit';

/** SCR (thyristor): diode with a gate on the cathode side. */
export default defineSymbol({
  type: 'scr',
  pins: { a: [-2, 0], k: [2, 0], g: [1, 2] },
  box: [-20, -10, 40, 30],
  draw: () => (
    <>
      <path d="M-20 0H-7M7 0H20" />
      <path d="M-7 -8L7 0L-7 8Z" className="sym-fill" />
      <path d="M7 -8V8M7 4L10 10V20" />
    </>
  ),
});
