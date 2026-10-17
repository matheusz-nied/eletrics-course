import { formatSI } from '../format';
import { Arrow, defineSymbol, num } from './_kit';

/** LDR: resistor that receives light (arrows pointing in). */
export default defineSymbol({
  type: 'ldr',
  body: 32,
  half: 20,
  draw: () => (
    <>
      <rect x={-16} y={-6} width={32} height={12} rx={1} className="sym-body" />
      <g strokeWidth={1.4}>
        <Arrow x1={-12} y1={-20} x2={-5} y2={-9} size={4} />
        <Arrow x1={-3} y1={-20} x2={4} y2={-9} size={4} />
      </g>
    </>
  ),
  value: (p) => `${formatSI(num(p.lux, 100), 'lx')}`,
});
