import { defineSymbol, num } from './_kit';
import { formatNumber } from '../format';

const coil = (x: number, sweep: 0 | 1) => {
  let d = `M${x} -24`;
  for (let y = -24; y < 24; y += 8) d += `A4 4 0 0 ${sweep} ${x} ${y + 8}`;
  return d;
};

/** Transformer: two windings around an iron core (two lines), with polarity dots. */
export default defineSymbol({
  type: 'transformer',
  pins: { p1: [-4, -4], p2: [-4, 4], s1: [4, -4], s2: [4, 4] },
  box: [-40, -40, 80, 80],
  draw: () => (
    <>
      <path d="M-40 -40H-12V-24M-40 40H-12V24M40 -40H12V-24M40 40H12V24" />
      <path d={coil(-12, 1)} />
      <path d={coil(12, 0)} />
      <path d="M-3 -26V26M3 -26V26" strokeWidth={1.6} />
      <circle cx={-19} cy={-20} r={1.8} className="sym-fill" />
      <circle cx={19} cy={-20} r={1.8} className="sym-fill" />
    </>
  ),
  value: (p) => `${formatNumber(num(p.ratio, 10), 2)}:1`,
});
