import { defineSymbol, type SymbolDef, Upright } from './_kit';

/** IEC rectangular logic gate (NBR/IEC 60617-12); high inputs and output are highlighted. */
export function gate(type: string, text: string, inverted: boolean): SymbolDef {
  const single = type === 'not';
  return defineSymbol({
    type,
    pins: single ? { a: [-2, 0], y: [2, 0] } : { a: [-3, -1], b: [-3, 1], y: [3, 0] },
    box: single ? [-20, -12, 40, 24] : [-30, -18, 60, 36],
    live: ['a', 'b', 'y'],
    draw: (ctx) => {
      const w = single ? 12 : 16;
      const h = single ? 12 : 18;
      const pinX = single ? 20 : 30;
      const outStart = inverted ? w + 6 : w;
      const high = (k: string) =>
        ctx.live[k] === true || ctx.live[k] === 1 ? 'sym-high' : undefined;
      return (
        <>
          {single ? (
            <path d={`M-20 0H-${w}`} className={high('a')} />
          ) : (
            <>
              <path d={`M-30 -10H-${w}`} className={high('a')} />
              <path d={`M-30 10H-${w}`} className={high('b')} />
            </>
          )}
          <rect x={-w} y={-h} width={2 * w} height={2 * h} className="sym-body" />
          {inverted && <circle cx={w + 3} cy={0} r={3} className="sym-body" />}
          <path d={`M${outStart} 0H${pinX}`} className={high('y')} />
          <Upright x={0} y={single ? 0 : -6} ctx={ctx} size={11} weight={600}>
            {text}
          </Upright>
        </>
      );
    },
  });
}
