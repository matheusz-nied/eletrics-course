import { defineSymbol } from './_kit';

/** Zones of IEC 60479-1 where the current is dangerous (cannot let go, fibrillation). */
const DANGER = new Set(['AC-3', 'AC-4', 'DC-3', 'DC-4']);

/** Human body in the circuit (for the electric shock lesson). */
export default defineSymbol({
  type: 'human-body',
  body: 26,
  half: 14,
  live: ['zone', 'worst'],
  draw: ({ live, rot }) => {
    const zone = String(live.zone ?? '');
    const danger = DANGER.has(zone) || [...DANGER].some((z) => zone.startsWith(z));
    return (
      <>
        <rect
          x={-13}
          y={-13}
          width={26}
          height={26}
          rx={4}
          className={danger ? 'sym-danger-fill' : 'sym-body'}
          strokeDasharray="3 2"
          strokeWidth={1.2}
        />
        <g transform={`rotate(${-rot})`}>
          <circle cx={0} cy={-7} r={2.6} className="sym-fill" />
          <path d="M0 -4V4M-6 -1H6M0 4L-4 10M0 4L4 10" />
        </g>
      </>
    );
  },
});
