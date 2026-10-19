import { defineDevice, num } from '../device';
import { DiodeCore } from '../models/diode';

/**
 * DIAC (DB3 type): blocks in both directions until the voltage across it
 * reaches the breakover voltage (about 32 V), then conducts like two diodes
 * in antiparallel until its current falls below the holding current. In a
 * dimmer it dumps the timing capacitor into the TRIAC gate as one pulse.
 *
 * Simplified: a real DIAC keeps about 5 V less than the breakover voltage
 * while it conducts; this one drops to a diode drop, which only makes the
 * gate pulse a little stronger.
 */
export default defineDevice({
  info: {
    type: 'diac',
    label: 'DIAC',
    terminals: 'two',
    pins: [
      { name: 'a', offset: [0, 0], label: 'terminal 1' },
      { name: 'b', offset: [0, 0], label: 'terminal 2' },
    ],
    params: {
      vbo: { default: 32, label: 'Tensão de disparo (breakover)', unit: 'V', min: 1 },
      ih: { default: 0.001, label: 'Corrente de manutenção Ih', unit: 'A', min: 1e-6 },
    },
    readouts: ['on', 'current', 'voltage'],
    readoutInfo: {
      on: { label: 'Conduzindo' },
      current: { label: 'Corrente (terminal 1 → terminal 2)', unit: 'A' },
      voltage: { label: 'Tensão entre os terminais', unit: 'V' },
    },
  },
  analyses: ['dc', 'transient', 'ac-sweep'],
  create({ params, pins: [a, b], node }) {
    const forward = new DiodeCore(a, b, node);
    const backward = new DiodeCore(b, a, node);
    const cores = [forward, backward];
    for (const c of cores) c.configure({ is: 1e-12, n: 1.5, rs: 1 });
    let on = false;
    const setOn = (value: boolean) => {
      on = value;
      forward.off = backward.off = !value;
    };
    setOn(false);
    const current = () => forward.current - backward.current;
    return {
      nonlinear: true,
      beginSolve: () => cores.forEach((c) => c.begin()),
      stamp(m, step, x) {
        for (const c of cores) c.stamp(m, step.nl, x);
      },
      stampAc(m, _ctx, op) {
        for (const c of cores) c.stampAc(m, op);
      },
      update(_step, x, ctx) {
        for (const c of cores) c.update(x, ctx.commit);
        if (!ctx.commit) return;
        const v = x.v(a) - x.v(b);
        if (!on && Math.abs(v) >= num(params, 'vbo')) {
          setOn(true);
          ctx.discontinuity();
        } else if (on && Math.abs(current()) < num(params, 'ih')) {
          setOn(false);
          ctx.discontinuity();
        }
      },
      pinCurrents(_x, out) {
        out[0] = current();
        out[1] = -current();
      },
      readouts(x, out) {
        out('on', on);
        out('current', current());
        out('voltage', x.v(a) - x.v(b));
      },
      reset() {
        cores.forEach((c) => c.reset());
        setOn(false);
      },
    };
  },
});
