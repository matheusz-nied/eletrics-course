import { BoxSymbol, boxAround, defineSymbol } from './_kit';

/** Microcontroller: a block whose pins come from the instance (firmware). */
export default defineSymbol({
  type: 'mcu',
  draw: (ctx) => <BoxSymbol ctx={ctx} title="MCU" box={boxAround(ctx.pins)} />,
});
