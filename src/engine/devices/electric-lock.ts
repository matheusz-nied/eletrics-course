import { acSquared, defineDevice, num, TWO_PINS } from '../device';

/** The latch releases above this fraction of the rated current. */
const PULL_IN = 0.6;

/**
 * Electromagnetic lock (fechadura elétrica) for gates: a solenoid that pulls
 * the latch while current flows. It releases (opens) above 60 % of its rated
 * current, with DC or AC.
 */
export default defineDevice({
  info: {
    type: 'electric-lock',
    label: 'Trava elétrica',
    terminals: 'two',
    pins: TWO_PINS,
    params: {
      voltage: { default: 12, label: 'Tensão nominal', unit: 'V', min: 1 },
      resistance: { default: 12, label: 'Resistência da bobina', unit: 'Ω', min: 0.1 },
    },
    readouts: ['current', 'voltage', 'power', 'open'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão', unit: 'V' },
      power: { label: 'Potência', unit: 'W' },
      open: { label: 'Destravada' },
    },
  },
  create({ params, pins: [a, b] }) {
    let current = 0;
    let open = false;
    const g = () => 1 / num(params, 'resistance');
    return {
      stamp(m) {
        m.conductance(a, b, g());
      },
      stampAc(m) {
        m.admittance(a, b, g());
      },
      update(step, x, ctx) {
        current = g() * (x.v(a) - x.v(b));
        const rated = num(params, 'voltage') / num(params, 'resistance');
        const now = Math.sqrt(current * current + acSquared(step, 0)) >= PULL_IN * rated;
        if (ctx.commit) open = now;
      },
      pinCurrents(_x, out) {
        out[0] = current;
        out[1] = -current;
      },
      readouts(_x, out) {
        out('open', open);
      },
      reset() {
        current = 0;
        open = false;
      },
    };
  },
});
