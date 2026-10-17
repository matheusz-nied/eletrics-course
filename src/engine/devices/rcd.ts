import { bool, defineDevice, num } from '../device';
import { formatSI } from '../messages';
import { R_OPEN } from '../models/constants';
import { RmsMeter } from '../models/filters';

/** Closed contacts (Ω). */
const R_CLOSED_RCD = 0.005;
/** Trips at 75 % of the rated residual current (the standard allows 50 % to 100 %). */
const K_TRIP = 0.75;
/** Averaging of the residual current, which also gives the trip delay (s). */
const TAU = 0.02;
/** Test resistor: R = this / IΔn, about 1,2·IΔn at 127 V and 2·IΔn at 220 V (V). */
const TEST_VOLTS = 105;

/**
 * Residual current device (DR, IEC 61008): two poles, phase (l1 → l2) and
 * neutral (n1 → n2). It compares the current that goes out on one with the
 * current that comes back on the other; a difference (current leaking to
 * earth, through a person, for example) above 75 % of IΔn trips it in a few
 * tens of milliseconds. The test button draws a leakage through an internal
 * resistor. Tripping moves the lever down (`closed` false).
 */
export default defineDevice({
  info: {
    type: 'rcd',
    label: 'Interruptor diferencial residual (DR)',
    terminals: 'fixed',
    pins: [
      { name: 'l1', offset: [-4, -3], label: 'fase (entrada)' },
      { name: 'n1', offset: [-4, 3], label: 'neutro (entrada)' },
      { name: 'l2', offset: [4, -3], label: 'fase (saída)' },
      { name: 'n2', offset: [4, 3], label: 'neutro (saída)' },
    ],
    params: {
      sensitivity: {
        default: 0.03,
        label: 'Corrente diferencial nominal (IΔn)',
        unit: 'A',
        min: 0.001,
      },
      closed: { default: true, label: 'Ligado (alavanca para cima)' },
      test: { default: false, label: 'Botão de teste pressionado' },
    },
    readouts: ['closed', 'tripped', 'residual', 'current'],
    readoutInfo: {
      closed: { label: 'Ligado' },
      tripped: { label: 'Desarmou' },
      residual: { label: 'Corrente de fuga (diferencial, eficaz)', unit: 'A' },
      current: { label: 'Corrente na fase', unit: 'A' },
    },
  },
  create({ id, params, pins: [l1, n1, l2, n2] }) {
    const residual = new RmsMeter(TAU);
    let tripped = false;
    let iL = 0;
    let iN = 0;
    let iTest = 0;
    const closed = () => bool(params, 'closed') && !tripped;
    const g = () => 1 / (closed() ? R_CLOSED_RCD : R_OPEN);
    const gTest = () =>
      closed() && bool(params, 'test') ? num(params, 'sensitivity') / TEST_VOLTS : 0;
    return {
      stamp(m) {
        m.conductance(l1, l2, g());
        m.conductance(n1, n2, g());
        // The test resistor goes from the protected phase to the incoming neutral.
        if (gTest()) m.conductance(l2, n1, gTest());
      },
      stampAc(m) {
        m.admittance(l1, l2, g());
        m.admittance(n1, n2, g());
        if (gTest()) m.admittance(l2, n1, gTest());
      },
      update(step, x, ctx) {
        iL = g() * (x.v(l1) - x.v(l2));
        iN = g() * (x.v(n1) - x.v(n2));
        iTest = gTest() * (x.v(l2) - x.v(n1));
        if (!ctx.commit || step.dt <= 0) return;
        // Both conductors pass through the core: what does not come back is leaking.
        residual.update(iL + iN, step.dt);
        const sensitivity = num(params, 'sensitivity');
        if (closed() && residual.value >= K_TRIP * sensitivity) {
          tripped = true;
          params.closed = false;
          ctx.emit(
            'tripped',
            `O DR ${id} desarmou: corrente de fuga de ${formatSI(residual.value, 'A')}, sensibilidade ${formatSI(sensitivity, 'A')}.`,
          );
          ctx.discontinuity();
        }
      },
      pinCurrents(_x, out) {
        out[0] = iL;
        out[1] = iN - iTest;
        out[2] = -iL + iTest;
        out[3] = -iN;
      },
      readouts(_x, out) {
        out('closed', closed());
        out('tripped', tripped);
        out('residual', residual.value);
        out('current', iL);
      },
      paramChanged(name) {
        if (name === 'closed') tripped = false;
      },
      reset() {
        if (tripped) params.closed = true;
        residual.reset();
        tripped = false;
        iL = iN = iTest = 0;
      },
    };
  },
});
