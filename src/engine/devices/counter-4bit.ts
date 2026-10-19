import { defineDevice, num } from '../device';

/** Output resistance, as the logic gates (Ω). */
const R_OUT = 50;
/** Input thresholds as fractions of VCC, with hysteresis, as the logic gates. */
const V_IL = 0.4;
const V_IH = 0.6;
const OUTPUTS = ['q0', 'q1', 'q2', 'q3'] as const;

/**
 * 4-bit binary counter (like one half of a CD4520), behavioural: each rising
 * edge of the clock adds one, from 0 to 15 and back to 0; reset high clears
 * the count at once and holds it at zero. Q0 is the least significant bit
 * (weight 1) and Q3 the most (weight 8). Inputs and outputs work like the
 * logic gates (thresholds at 40 % and 60 % of VCC, outputs of 0 or VCC
 * behind 50 Ω, one step after the edge).
 */
export default defineDevice({
  info: {
    type: 'counter-4bit',
    label: 'Contador binário de 4 bits',
    terminals: 'fixed',
    pins: [
      { name: 'clk', offset: [-4, -2], label: 'clock (cada subida conta um)' },
      { name: 'rst', offset: [-4, 2], label: 'reset (em nível alto, zera)' },
      { name: 'q0', offset: [4, -3], label: 'saída Q0 (vale 1)' },
      { name: 'q1', offset: [4, -1], label: 'saída Q1 (vale 2)' },
      { name: 'q2', offset: [4, 1], label: 'saída Q2 (vale 4)' },
      { name: 'q3', offset: [4, 3], label: 'saída Q3 (vale 8)' },
    ],
    params: {
      vcc: { default: 5, label: 'Tensão de alimentação (nível alto)', unit: 'V', min: 1 },
    },
    readouts: ['count', 'clk', 'rst', ...OUTPUTS],
    readoutInfo: {
      count: { label: 'Contagem (0 a 15)' },
      clk: { label: 'Clock em nível alto' },
      rst: { label: 'Reset em nível alto' },
      q0: { label: 'Saída Q0 em nível alto' },
      q1: { label: 'Saída Q1 em nível alto' },
      q2: { label: 'Saída Q2 em nível alto' },
      q3: { label: 'Saída Q3 em nível alto' },
    },
  },
  create({ params, pins: [clk, rst, ...outs], branch }) {
    const branches = outs.map(() => branch());
    const iOut = outs.map(() => 0);
    let clkLevel = false;
    // The first accepted step only reads the inputs: a clock already high at power-up is no edge.
    let primed = false;
    let rstLevel = false;
    let count = 0;
    const level = (v: number, was: boolean) => {
      const vcc = num(params, 'vcc');
      if (v >= V_IH * vcc) return true;
      if (v <= V_IL * vcc) return false;
      return was;
    };
    const bit = (k: number) => ((count >> k) & 1) === 1;
    return {
      stamp(m) {
        const vcc = num(params, 'vcc');
        outs.forEach((pin, k) => m.branch(branches[k], pin, -1, bit(k) ? vcc : 0, R_OUT));
      },
      stampAc(m) {
        outs.forEach((pin, k) => m.branch(branches[k], pin, -1, 0, 0, R_OUT));
      },
      update(_step, x, ctx) {
        branches.forEach((br, k) => (iOut[k] = x.x[br]));
        if (!ctx.commit) return;
        const was = count;
        rstLevel = level(x.v(rst), rstLevel);
        const clkNow = level(x.v(clk), clkLevel);
        if (rstLevel) count = 0;
        else if (primed && clkNow && !clkLevel) count = (count + 1) % 16;
        primed = true;
        clkLevel = clkNow;
        if (count !== was) ctx.discontinuity();
      },
      pinCurrents(_x, out) {
        out.fill(0);
        iOut.forEach((i, k) => (out[2 + k] = i));
      },
      readouts(_x, put) {
        put('count', count);
        put('clk', clkLevel);
        put('rst', rstLevel);
        OUTPUTS.forEach((name, k) => put(name, bit(k)));
      },
      reset() {
        clkLevel = rstLevel = primed = false;
        count = 0;
        iOut.fill(0);
      },
    };
  },
});
