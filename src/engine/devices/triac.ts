import { defineDevice, num } from '../device';
import { DiodeCore } from '../models/diode';

/**
 * TRIAC: an SCR for both directions. A gate current above Igt in either
 * direction (gate to MT1) turns it on; it conducts both ways (like two
 * diodes in antiparallel) until the current falls below the holding current,
 * which with AC happens at every zero crossing.
 */
export default defineDevice({
  info: {
    type: 'triac',
    label: 'TRIAC',
    terminals: 'fixed',
    pins: [
      { name: 'mt2', offset: [-4, 0], label: 'terminal principal 2 (MT2/A2)' },
      { name: 'mt1', offset: [4, 0], label: 'terminal principal 1 (MT1/A1)' },
      { name: 'g', offset: [2, 4], label: 'gatilho (G)' },
    ],
    params: {
      igt: { default: 0.01, label: 'Corrente de disparo do gatilho Igt', unit: 'A', min: 1e-6 },
      ih: { default: 0.015, label: 'Corrente de manutenção Ih', unit: 'A', min: 1e-6 },
      vbo: { default: 600, label: 'Tensão de ruptura (breakover)', unit: 'V', min: 1 },
    },
    readouts: ['on', 'i', 'v', 'ig'],
    readoutInfo: {
      on: { label: 'Conduzindo' },
      i: { label: 'Corrente MT2 → MT1', unit: 'A' },
      v: { label: 'Tensão MT2 − MT1', unit: 'V' },
      ig: { label: 'Corrente de gatilho (entrando)', unit: 'A' },
    },
  },
  create({ params, pins: [mt2, mt1, g], node }) {
    const forward = new DiodeCore(mt2, mt1, node);
    const backward = new DiodeCore(mt1, mt2, node);
    const gateIn = new DiodeCore(g, mt1, node);
    const gateOut = new DiodeCore(mt1, g, node);
    for (const c of [forward, backward]) c.configure({ is: 1e-12, n: 1.5, rs: 0.03 });
    for (const c of [gateIn, gateOut]) c.configure({ is: 1e-13, n: 1, rs: 20 });
    const cores = [forward, backward, gateIn, gateOut];
    let on = false;
    const setOn = (value: boolean) => {
      on = value;
      forward.off = backward.off = !value;
    };
    setOn(false);
    const current = () => forward.current - backward.current;
    const gateCurrent = () => gateIn.current - gateOut.current;
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
        const v = x.v(mt2) - x.v(mt1);
        if (!on) {
          const fired =
            (Math.abs(gateCurrent()) >= num(params, 'igt') && Math.abs(v) > 0.6) ||
            Math.abs(v) >= num(params, 'vbo');
          if (fired) {
            setOn(true);
            ctx.discontinuity();
          }
        } else if (Math.abs(current()) < num(params, 'ih')) {
          setOn(false);
          ctx.discontinuity();
        }
      },
      pinCurrents(_x, out) {
        out[0] = current();
        out[1] = -current() - gateCurrent();
        out[2] = gateCurrent();
      },
      readouts(x, out) {
        out('on', on);
        out('i', current());
        out('v', x.v(mt2) - x.v(mt1));
        out('ig', gateCurrent());
      },
      reset() {
        cores.forEach((c) => c.reset());
        setOn(false);
      },
    };
  },
});
