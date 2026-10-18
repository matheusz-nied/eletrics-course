import { BoxSymbol, defineSymbol } from './_kit';

/** 555 timer as a block with its pin names. */
export default defineSymbol({
  type: 'timer-555',
  pins: {
    reset: [-1, -5],
    vcc: [1, -5],
    dis: [-4, -2],
    thres: [-4, 0],
    trig: [-4, 2],
    gnd: [-1, 5],
    ctrl: [1, 5],
    out: [4, 0],
  },
  box: [-30, -40, 60, 80],
  draw: (ctx) => <BoxSymbol ctx={ctx} title="555" box={[-30, -40, 60, 80]} />,
});
