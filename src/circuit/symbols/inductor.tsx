import { formatSI } from '../format';
import { defineSymbol, num } from './_kit';

/** Inductor: winding drawn as four arcs. */
export default defineSymbol({
  type: 'inductor',
  body: 40,
  half: 8,
  draw: () => <path d="M-20 0A5 5 0 0 1 -10 0A5 5 0 0 1 0 0A5 5 0 0 1 10 0A5 5 0 0 1 20 0" />,
  value: (p) => formatSI(num(p.inductance, 0.01), 'H'),
});
