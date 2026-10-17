import { formatSI } from '../format';
import { defineSymbol, num, Upright } from './_kit';

/** DC voltage source: circle with the polarity; pin a is positive. */
export default defineSymbol({
  type: 'dc-voltage',
  body: 26,
  half: 13,
  draw: (ctx) => (
    <>
      <circle r={12} className="sym-body" />
      <Upright x={-5.5} y={0} ctx={ctx} size={11} weight={700}>
        +
      </Upright>
      <Upright x={5.5} y={0} ctx={ctx} size={11} weight={700}>
        −
      </Upright>
    </>
  ),
  value: (p) => formatSI(num(p.voltage, 5), 'V'),
});
