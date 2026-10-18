import { formatSI } from '../format';
import { defineSymbol, num } from './_kit';

/** Circuit breaker (disjuntor): switch with a cross on the fixed contact. */
export default defineSymbol({
  type: 'breaker',
  body: 32,
  half: 12,
  live: ['closed', 'tripped'],
  draw: ({ params, live }) => {
    // The engine reports `closed`; tripping opens it until the student re-arms it.
    const on = typeof live.closed === 'boolean' ? live.closed : params.closed !== false;
    return (
      <>
        <circle cx={-14} cy={0} r={2.2} className="sym-fill" />
        <path d="M11 -3L17 3M11 3L17 -3" />
        <path
          d={on ? 'M-14 0L14 0' : 'M-14 0L10 -12'}
          className={live.tripped === true ? 'sym-blade sym-danger' : 'sym-blade'}
        />
        <rect x={-4} y={-14} width={8} height={5} strokeWidth={1.2} />
      </>
    );
  },
  value: (p) => `${formatSI(num(p.rating, 16), 'A')} · curva ${String(p.curve ?? 'C')}`,
});
