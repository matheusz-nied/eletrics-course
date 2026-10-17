import { defineSymbol } from './_kit';

/** Electric lock (trava eletromagnética): coil with a lock. */
export default defineSymbol({
  type: 'electric-lock',
  body: 28,
  half: 14,
  live: ['open'],
  draw: ({ live, rot }) => (
    <>
      <rect
        x={-14}
        y={-7}
        width={28}
        height={14}
        className={live.open ? 'sym-energized' : 'sym-body'}
      />
      <path d="M-14 7L14 -7" strokeWidth={1.2} />
      <g transform={`translate(0 -16) rotate(${-rot})`} strokeWidth={1.3}>
        <rect x={-4} y={-2} width={8} height={6} rx={1} />
        <path
          d={
            live.open
              ? 'M-2.5 -2V-5A2.5 2.5 0 0 1 2.5 -5V-6'
              : 'M-2.5 -2V-5A2.5 2.5 0 0 1 2.5 -5V-2'
          }
        />
      </g>
    </>
  ),
});
