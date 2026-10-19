import { formatSI } from '../format';
import { defineSymbol, num } from './_kit';

/** DIAC: two bars with two triangles pointing opposite ways, no gate. */
export default defineSymbol({
  type: 'diac',
  body: 16,
  half: 13,
  draw: () => (
    <>
      <path d="M-8 0H-6M6 0H8" />
      <path d="M-6 -13V13M6 -13V13" />
      <path d="M-6 -12L6 -6L-6 0Z" className="sym-fill" />
      <path d="M6 0L-6 6L6 12Z" className="sym-fill" />
    </>
  ),
  value: (p) => formatSI(num(p.vbo, 32), 'V'),
});
