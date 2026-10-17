import { formatSI } from '../format';
import { defineSymbol, isBurned, num } from './_kit';

/** IEC lamp: circle with a cross. Glows with the filament brightness. */
export default defineSymbol({
  type: 'lamp',
  body: 24,
  half: 12,
  live: ['brightness', 'burned', 'damaged'],
  draw: ({ live }) => {
    const b =
      typeof live.brightness === 'number' ? Math.max(0, Math.min(1.3, live.brightness)) / 1.3 : 0;
    const burned = isBurned(live);
    return (
      <>
        <circle r={22} className="sym-glow" style={{ opacity: burned ? 0 : b * 0.9 }} />
        <circle r={11} className="sym-body" />
        <circle r={11} className="sym-glass" style={{ opacity: burned ? 0 : b }} />
        {burned ? (
          <path
            d="M-7.8 -7.8L-2 -2M7.8 7.8L2 2M7.8 -7.8L1.5 -1.5M-7.8 7.8L-1.5 1.5"
            className="sym-muted"
          />
        ) : (
          <path
            d="M-7.8 -7.8L7.8 7.8M7.8 -7.8L-7.8 7.8"
            className={b > 0.05 ? 'sym-filament' : undefined}
          />
        )}
      </>
    );
  },
  value: (p) => `${formatSI(num(p.voltage, 12), 'V')} · ${formatSI(num(p.power, 5), 'W')}`,
});
