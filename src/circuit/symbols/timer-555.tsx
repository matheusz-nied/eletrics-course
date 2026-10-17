import { BoxSymbol, defineSymbol } from './_kit';

/** 555 timer as a block with its pin names. */
export default defineSymbol({
  type: 'timer-555',
  pins: {
    vcc: [-2, -5],
    reset: [2, -5],
    trig: [-5, -2],
    thr: [-5, 0],
    dis: [-5, 2],
    out: [5, -1],
    ctrl: [5, 2],
    gnd: [0, 5],
  },
  box: [-36, -36, 72, 72],
  live: ['high'],
  draw: (ctx) => <BoxSymbol ctx={ctx} title="555" box={[-36, -36, 72, 72]} />,
});
