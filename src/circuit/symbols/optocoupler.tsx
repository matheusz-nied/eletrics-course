import { Arrow, defineSymbol } from './_kit';

/** Optocoupler: LED and phototransistor in the same package, isolated. */
export default defineSymbol({
  type: 'optocoupler',
  pins: { a: [-3, -1], k: [-3, 1], c: [3, -1], e: [3, 1] },
  box: [-30, -20, 60, 40],
  draw: () => (
    <>
      <rect
        x={-22}
        y={-20}
        width={44}
        height={40}
        rx={3}
        strokeDasharray="3 2.5"
        strokeWidth={1.2}
      />
      <path d="M-30 -10H-14V-6M-30 10H-14V6" />
      <path d="M-20 -6H-8L-14 5Z" className="sym-fill" />
      <path d="M-20 6H-8" />
      <Arrow x1={-5} y1={-3} x2={3} y2={-3} size={4} />
      <Arrow x1={-5} y1={3} x2={3} y2={3} size={4} />
      <path d="M8 -9V9" strokeWidth={2.6} />
      <path d="M8 -4L16 -10H30M16 10H30" />
      <Arrow x1={8} y1={4} x2={16} y2={10} size={5} />
    </>
  ),
});
