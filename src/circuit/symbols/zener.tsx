import { formatSI } from '../format';
import { defineSymbol, isBurned, num } from './_kit';

/** Zener diode: the cathode bar has bent ends. */
export default defineSymbol({
  type: 'zener',
  body: 18,
  half: 9,
  live: ['burned', 'damaged'],
  draw: ({ live }) => (
    <>
      <path d="M-9 0H9" />
      <path d="M-7 -8L7 0L-7 8Z" className={isBurned(live) ? 'sym-burned' : 'sym-fill'} />
      <path d="M3 -10L7 -8V8L11 10" />
    </>
  ),
  value: (p) => formatSI(num(p.voltage, 5.1), 'V'),
});
