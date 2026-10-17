import { formatSI } from '../format';
import { Upright, defineSymbol, isBurned, isOn, num } from './_kit';

/** Capacitor: two plates. Polarized (electrolytic): the negative plate is filled. */
export default defineSymbol({
  type: 'capacitor',
  body: 10,
  half: 12,
  live: ['burned', 'damaged'],
  draw: (ctx) => {
    const polarized = isOn(ctx.params.polarized);
    const swollen = isBurned(ctx.live);
    return (
      <>
        <path d="M-5 0H-3M3 0H5" />
        <path d="M-3 -11V11" strokeWidth={2.4} />
        {polarized ? (
          <rect x={2} y={-11} width={4} height={22} className="sym-fill" />
        ) : (
          <path d="M3 -11V11" strokeWidth={2.4} />
        )}
        {polarized && (
          <Upright x={-9} y={-12} ctx={ctx} size={10} weight={700}>
            +
          </Upright>
        )}
        {swollen && <path d="M-11 -15Q0 -24 11 -15M-11 15Q0 24 11 15" className="sym-danger" />}
      </>
    );
  },
  value: (p) =>
    isOn(p.polarized)
      ? `${formatSI(num(p.capacitance, 1e-6), 'F')} · ${formatSI(num(p.voltage, 50), 'V')}`
      : formatSI(num(p.capacitance, 1e-6), 'F'),
});
