import { Arrow, defineSymbol } from './_kit';

/** Optocoupler: LED and phototransistor in the same package, isolated. */
export default defineSymbol({
  type: 'optocoupler',
  pins: { a: [-4, -2], k: [-4, 2], c: [4, -2], e: [4, 2] },
  box: [-40, -28, 80, 56],
  live: ['brightness'],
  draw: ({ live }) => {
    const lit = typeof live.brightness === 'number' && live.brightness > 0.05;
    return (
      <>
        <rect
          x={-28}
          y={-28}
          width={56}
          height={56}
          rx={3}
          strokeDasharray="3 2.5"
          strokeWidth={1.2}
        />
        <path d="M-40 -20H-17V-8M-40 20H-17V7" />
        <path d="M-24 -7H-10L-17 6Z" className={lit ? 'sym-fill sym-accent' : 'sym-fill'} />
        <path d="M-24 7H-10" />
        <Arrow x1={-6} y1={-4} x2={3} y2={-4} size={4} />
        <Arrow x1={-6} y1={4} x2={3} y2={4} size={4} />
        <path d="M9 -11V11" strokeWidth={2.6} />
        <path d="M9 -5L20 -12V-20H40M20 20H40" />
        <Arrow x1={9} y1={5} x2={20} y2={12} size={5} />
        <path d="M20 12V20" />
      </>
    );
  },
});
