import { defineDevice, type SolutionView } from '../device';
import { R_OPEN } from '../models/constants';

/** Each resistor of the internal divider (Ω): ctrl sits at 2/3 of the supply. */
const R_DIVIDER = 5000;
/** Quiescent supply current path (Ω): about 3 mA at 5 V, with the divider. */
const R_QUIESCENT = 2000;
/** Output high sits this far below VCC (bipolar 555) (V). */
const V_HIGH_DROP = 1.7;
/** Output low level (V) and output resistance (Ω). */
const V_LOW = 0.1;
const R_OUT = 10;
/** Discharge transistor on (Ω). */
const R_DISCHARGE = 10;
/** Reset pin threshold (V) and the lowest supply the chip runs on (V). */
const V_RESET = 0.7;
const V_MIN_SUPPLY = 3;

/**
 * 555 timer, behavioural, with the 8 pins of the DIP package. Inside: the
 * three-resistor divider (ctrl at 2/3 of VCC, the trigger reference at 1/3),
 * two comparators and the flip-flop: the output goes high when the trigger
 * falls below 1/3 VCC and low when the threshold passes 2/3 VCC (or reset is
 * low); while low, the discharge pin is shorted to ground. The output drives
 * from VCC, so its current shows on the supply.
 */
export default defineDevice({
  info: {
    type: 'timer-555',
    label: 'Temporizador 555',
    terminals: 'fixed',
    pins: [
      { name: 'gnd', offset: [0, 5], label: '1 · terra (GND)' },
      { name: 'trig', offset: [-5, -2], label: '2 · disparo (TRIG)' },
      { name: 'out', offset: [5, -1], label: '3 · saída (OUT)' },
      { name: 'reset', offset: [2, -5], label: '4 · reset (RST)' },
      { name: 'ctrl', offset: [5, 2], label: '5 · controle (CTRL)' },
      { name: 'thr', offset: [-5, 0], label: '6 · limiar (THR)' },
      { name: 'dis', offset: [-5, 2], label: '7 · descarga (DIS)' },
      { name: 'vcc', offset: [-2, -5], label: '8 · alimentação (VCC)' },
    ],
    params: {},
    readouts: ['high', 'discharging', 'vout'],
    readoutInfo: {
      high: { label: 'Saída em nível alto' },
      discharging: { label: 'Descarga ligada' },
      vout: { label: 'Tensão de saída', unit: 'V' },
    },
  },
  create({ pins: [gnd, trig, output, reset, ctrl, thr, dis, vcc], node, branch }) {
    const third = node(); // 1/3 VCC: the trigger comparator's reference
    const br = branch(); // output stage current, into the out pin
    let high = false;
    let supplied = false;
    let iDis = 0;
    // The output is high only with a working supply.
    const driving = () => high && supplied;
    const gDis = () => 1 / (!driving() ? R_DISCHARGE : R_OPEN);
    const rel = (x: SolutionView, pin: number) => x.v(pin) - x.v(gnd);
    return {
      stamp(m) {
        m.conductance(vcc, ctrl, 1 / R_DIVIDER);
        m.conductance(ctrl, third, 1 / R_DIVIDER);
        m.conductance(third, gnd, 1 / R_DIVIDER);
        m.conductance(vcc, gnd, 1 / R_QUIESCENT);
        m.conductance(dis, gnd, gDis());
        // Output stage: from VCC when high (V(out) = V(vcc) − 1,7), to GND when low.
        const ref = driving() ? vcc : gnd;
        m.branch(br, output, ref, driving() ? -V_HIGH_DROP : V_LOW, R_OUT);
      },
      stampAc(m) {
        m.admittance(vcc, ctrl, 1 / R_DIVIDER);
        m.admittance(ctrl, third, 1 / R_DIVIDER);
        m.admittance(third, gnd, 1 / R_DIVIDER);
        m.admittance(vcc, gnd, 1 / R_QUIESCENT);
        m.admittance(dis, gnd, gDis());
        m.branch(br, output, driving() ? vcc : gnd, 0, 0, R_OUT);
      },
      update(_step, x, ctx) {
        iDis = gDis() * rel(x, dis);
        if (!ctx.commit) return;
        const was = driving();
        supplied = rel(x, vcc) >= V_MIN_SUPPLY;
        if (rel(x, reset) < V_RESET) high = false;
        else if (rel(x, trig) < rel(x, third)) high = true;
        else if (rel(x, thr) > rel(x, ctrl)) high = false;
        if (driving() !== was) ctx.discontinuity();
      },
      pinCurrents(x, out) {
        const iOut = x.x[br];
        const iVcc = (x.v(vcc) - x.v(ctrl)) / R_DIVIDER + (x.v(vcc) - x.v(gnd)) / R_QUIESCENT;
        const iGndDivider = (x.v(third) - x.v(gnd)) / R_DIVIDER;
        out.fill(0);
        out[0] = -iGndDivider - (x.v(vcc) - x.v(gnd)) / R_QUIESCENT - iDis;
        out[2] = iOut;
        out[4] = (x.v(ctrl) - x.v(third)) / R_DIVIDER - (x.v(vcc) - x.v(ctrl)) / R_DIVIDER;
        out[6] = iDis;
        out[7] = iVcc;
        // The output current returns through VCC (high) or GND (low).
        if (driving()) out[7] -= iOut;
        else out[0] -= iOut;
      },
      readouts(x, out) {
        out('high', driving());
        out('discharging', !driving());
        out('vout', rel(x, output));
      },
      reset() {
        high = supplied = false;
        iDis = 0;
      },
    };
  },
});
