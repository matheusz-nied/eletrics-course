import { BoxSymbol, boxAround, defineSymbol, type SymbolDef, Upright } from './_kit';

/** Fallback for a device type that has no symbol yet: a labelled box. */
export function unknownSymbol(type: string): SymbolDef {
  return defineSymbol({
    type,
    body: 30,
    half: 9,
    draw: (ctx) =>
      ctx.el.a && ctx.el.b ? (
        <>
          <rect
            x={-15}
            y={-8}
            width={30}
            height={16}
            rx={2}
            className="sym-body"
            strokeDasharray="3 2"
          />
          <Upright x={0} y={0} ctx={ctx} size={7}>
            ?
          </Upright>
        </>
      ) : (
        <BoxSymbol ctx={ctx} title={type} box={boxAround(ctx.pins)} />
      ),
  });
}
