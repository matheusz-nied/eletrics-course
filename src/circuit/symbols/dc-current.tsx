import { formatSI } from '../format';
import { Arrow, defineSymbol, num } from './_kit';

/** DC current source: circle with an arrow; current leaves through pin b. */
export default defineSymbol({
  type: 'dc-current',
  body: 26,
  half: 13,
  draw: () => (
    <>
      <circle r={12} className="sym-body" />
      <Arrow x1={-7} y1={0} x2={7} y2={0} size={5} />
    </>
  ),
  value: (p) => formatSI(num(p.current, 0.01), 'A'),
});
