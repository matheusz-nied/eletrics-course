import { defineSymbol } from './_kit';

/** Human body in the circuit (for the electric shock lesson). */
export default defineSymbol({
  type: 'human-body',
  body: 26,
  half: 14,
  live: ['danger'],
  draw: ({ live, rot }) => (
    <>
      <rect
        x={-13}
        y={-13}
        width={26}
        height={26}
        rx={4}
        className={live.danger ? 'sym-danger-fill' : 'sym-body'}
        strokeDasharray="3 2"
        strokeWidth={1.2}
      />
      <g transform={`rotate(${-rot})`}>
        <circle cx={0} cy={-7} r={2.6} className="sym-fill" />
        <path d="M0 -4V4M-6 -1H6M0 4L-4 10M0 4L4 10" />
      </g>
    </>
  ),
});
