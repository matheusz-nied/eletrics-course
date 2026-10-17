import { formatSI } from '../format';
import { defineSymbol, num, Upright } from './_kit';

/** IEC battery: two cells; the long thin plate is the positive pole (pin a). */
export default defineSymbol({
  type: 'battery',
  body: 24,
  half: 12,
  draw: (ctx) => (
    <>
      <path d="M-10 -11V11M2 -11V11" />
      <path d="M-4 -5.5V5.5M8 -5.5V5.5" strokeWidth={4} strokeLinecap="butt" />
      <path d="M-4 0H2" strokeDasharray="2 2" strokeWidth={1} />
      <Upright x={-15} y={-12} ctx={ctx} size={10} weight={700}>
        +
      </Upright>
    </>
  ),
  value: (p) => formatSI(num(p.voltage, 9), 'V'),
});
