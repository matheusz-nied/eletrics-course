import { defineSymbol, isBurned, num } from './_kit';

export const LED_COLORS: Record<string, { label: string; css: string }> = {
  red: { label: 'vermelho', css: '#ff3b30' },
  vermelho: { label: 'vermelho', css: '#ff3b30' },
  green: { label: 'verde', css: '#34c759' },
  verde: { label: 'verde', css: '#34c759' },
  blue: { label: 'azul', css: '#3b82ff' },
  azul: { label: 'azul', css: '#3b82ff' },
  yellow: { label: 'amarelo', css: '#ffcc00' },
  amarelo: { label: 'amarelo', css: '#ffcc00' },
  white: { label: 'branco', css: '#f5f7ff' },
  branco: { label: 'branco', css: '#f5f7ff' },
};

/** LED: diode with two arrows of emitted light; glows in its color. */
export default defineSymbol({
  type: 'led',
  body: 18,
  half: 17,
  live: ['brightness', 'burned', 'damaged'],
  draw: ({ live, params }) => {
    const color = LED_COLORS[String(params.color ?? 'red')] ?? LED_COLORS.red!;
    const b = isBurned(live) ? 0 : Math.max(0, Math.min(1, num(live.brightness as number, 0)));
    return (
      <>
        <circle r={16} fill={color.css} className="sym-led-glow" style={{ opacity: b * 0.75 }} />
        <path d="M-9 0H9" />
        <path
          d="M-7 -8L7 0L-7 8Z"
          className={isBurned(live) ? 'sym-burned' : 'sym-body'}
          style={b > 0.02 ? { fill: color.css, fillOpacity: 0.35 + 0.65 * b } : undefined}
        />
        <path d="M7 -8V8" />
        <path d="M0 -9L5 -16M4 -6L9 -13" strokeWidth={1.4} />
        <path
          d="M5 -16L1.6 -14.8M5 -16L4.6 -12.4M9 -13L5.6 -11.8M9 -13L8.6 -9.4"
          strokeWidth={1.4}
        />
      </>
    );
  },
  value: (p) => `LED ${LED_COLORS[String(p.color ?? 'red')]?.label ?? ''}`.trim(),
});
