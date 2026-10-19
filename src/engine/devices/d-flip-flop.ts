import { defineDevice, num } from '../device';

/** Output resistance, as the logic gates (Ω). */
const R_OUT = 50;
/** Input thresholds as fractions of VCC, with hysteresis, as the logic gates. */
const V_IL = 0.4;
const V_IH = 0.6;

/**
 * D flip-flop (one half of a 74HC74), behavioural, rising-edge triggered:
 * when the clock goes from low to high, Q copies D and keeps it until the
 * next rising edge; Q̄ is always the opposite. Inputs read like the logic
 * gates (high above 60 % of VCC, low below 40 %, no current) and the outputs
 * are 0 or VCC behind 50 Ω, referred to ground, changing one step after the
 * edge. Q starts low.
 */
export default defineDevice({
  info: {
    type: 'd-flip-flop',
    label: 'Flip-flop tipo D',
    terminals: 'fixed',
    pins: [
      { name: 'd', offset: [-4, -2], label: 'entrada de dado D' },
      { name: 'clk', offset: [-4, 2], label: 'clock (sobe: Q copia D)' },
      { name: 'q', offset: [4, -2], label: 'saída Q' },
      { name: 'nq', offset: [4, 2], label: 'saída Q barrado (o inverso de Q)' },
    ],
    params: {
      vcc: { default: 5, label: 'Tensão de alimentação (nível alto)', unit: 'V', min: 1 },
    },
    readouts: ['d', 'clk', 'q'],
    readoutInfo: {
      d: { label: 'Entrada D em nível alto' },
      clk: { label: 'Clock em nível alto' },
      q: { label: 'Saída Q em nível alto' },
    },
  },
  create({ params, pins: [d, clk, q, nq], branch }) {
    const bq = branch();
    const bnq = branch();
    let dLevel = false;
    let clkLevel = false;
    // The first accepted step only reads the inputs: a clock already high at power-up is no edge.
    let primed = false;
    let state = false;
    const iOut = [0, 0];
    const level = (v: number, was: boolean) => {
      const vcc = num(params, 'vcc');
      if (v >= V_IH * vcc) return true;
      if (v <= V_IL * vcc) return false;
      return was;
    };
    return {
      stamp(m) {
        const vcc = num(params, 'vcc');
        m.branch(bq, q, -1, state ? vcc : 0, R_OUT);
        m.branch(bnq, nq, -1, state ? 0 : vcc, R_OUT);
      },
      stampAc(m) {
        m.branch(bq, q, -1, 0, 0, R_OUT);
        m.branch(bnq, nq, -1, 0, 0, R_OUT);
      },
      update(_step, x, ctx) {
        iOut[0] = x.x[bq];
        iOut[1] = x.x[bnq];
        if (!ctx.commit) return;
        dLevel = level(x.v(d), dLevel);
        const clkNow = level(x.v(clk), clkLevel);
        // D is the level it had before the edge: outputs only change one step later.
        if (primed && clkNow && !clkLevel && state !== dLevel) {
          state = dLevel;
          ctx.discontinuity();
        }
        clkLevel = clkNow;
        primed = true;
      },
      pinCurrents(_x, out) {
        out.fill(0);
        out[2] = iOut[0];
        out[3] = iOut[1];
      },
      readouts(_x, put) {
        put('d', dLevel);
        put('clk', clkLevel);
        put('q', state);
      },
      reset() {
        dLevel = clkLevel = state = primed = false;
        iOut.fill(0);
      },
    };
  },
});
