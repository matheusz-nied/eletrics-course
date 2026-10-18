import { defineSymbol } from './_kit';

/** TRIAC: two anti-parallel thyristors with one gate (near MT1). */
export default defineSymbol({
  type: 'triac',
  pins: { mt2: [-2, 0], mt1: [2, 0], g: [1, 2] },
  box: [-20, -14, 40, 34],
  draw: () => (
    <>
      <path d="M-20 0H-6M6 0H20" />
      <path d="M-6 -13V13M6 -13V13" />
      <path d="M-6 -12L6 -6L-6 0Z" className="sym-fill" />
      <path d="M6 0L-6 6L6 12Z" className="sym-fill" />
      <path d="M6 9L10 13V20" />
    </>
  ),
});
