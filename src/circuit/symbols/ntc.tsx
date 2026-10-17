import { formatSI } from '../format';
import { defineSymbol, num, Upright } from './_kit';

/** NTC thermistor: resistor crossed by the non-linear mark, "−t°". */
export default defineSymbol({
  type: 'ntc',
  body: 32,
  half: 12,
  draw: (ctx) => (
    <>
      <rect x={-16} y={-6} width={32} height={12} rx={1} className="sym-body" />
      <path d="M-16 11L-10 11L12 -11" strokeWidth={1.4} />
      <Upright x={14} y={-14} ctx={ctx} size={8} anchor="start">
        −t°
      </Upright>
    </>
  ),
  value: (p) => formatSI(num(p.resistance, 10000), 'Ω'),
});
