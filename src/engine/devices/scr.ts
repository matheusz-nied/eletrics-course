import { defineDevice, num } from '../device';
import { DiodeCore } from '../models/diode';

/**
 * SCR (thyristor): blocks until a gate current above Igt flows into the gate
 * (with the anode positive), or the anode voltage passes the breakover
 * voltage; then it conducts like a diode and stays on, even without gate
 * current, until its current falls below the holding current Ih.
 */
export default defineDevice({
  info: {
    type: 'scr',
    label: 'SCR (tiristor)',
    terminals: 'fixed',
    pins: [
      { name: 'a', offset: [-2, 0], label: 'ânodo (A)' },
      { name: 'k', offset: [2, 0], label: 'cátodo (K)' },
      { name: 'g', offset: [1, 2], label: 'gatilho (G)' },
    ],
    params: {
      igt: { default: 0.005, label: 'Corrente de disparo do gatilho Igt', unit: 'A', min: 1e-6 },
      ih: { default: 0.01, label: 'Corrente de manutenção Ih', unit: 'A', min: 1e-6 },
      vbo: { default: 400, label: 'Tensão de ruptura direta (breakover)', unit: 'V', min: 1 },
    },
    readouts: ['on', 'ia', 'vak', 'ig'],
    readoutInfo: {
      on: { label: 'Conduzindo' },
      ia: { label: 'Corrente de ânodo', unit: 'A' },
      vak: { label: 'Tensão ânodo-cátodo', unit: 'V' },
      ig: { label: 'Corrente de gatilho', unit: 'A' },
    },
  },
  create({ params, pins: [a, k, g], node }) {
    const main = new DiodeCore(a, k, node);
    main.configure({ is: 1e-12, n: 1.5, rs: 0.02 });
    main.off = true;
    const gate = new DiodeCore(g, k, node);
    gate.configure({ is: 1e-13, n: 1, rs: 20 });
    const cores = [main, gate];
    return {
      nonlinear: true,
      beginSolve: () => cores.forEach((c) => c.begin()),
      stamp(m, step, x) {
        main.stamp(m, step.nl, x);
        gate.stamp(m, step.nl, x);
      },
      stampAc(m, _ctx, op) {
        main.stampAc(m, op);
        gate.stampAc(m, op);
      },
      update(_step, x, ctx) {
        main.update(x, ctx.commit);
        gate.update(x, ctx.commit);
        if (!ctx.commit) return;
        const vak = x.v(a) - x.v(k);
        if (main.off) {
          const fired =
            (gate.current >= num(params, 'igt') && vak > 0.6) || vak >= num(params, 'vbo');
          if (fired) {
            main.off = false;
            ctx.discontinuity();
          }
        } else if (main.current < num(params, 'ih')) {
          main.off = true;
          ctx.discontinuity();
        }
      },
      pinCurrents(_x, out) {
        out[0] = main.current;
        out[1] = -main.current - gate.current;
        out[2] = gate.current;
      },
      readouts(x, out) {
        out('on', !main.off);
        out('ia', main.current);
        out('vak', x.v(a) - x.v(k));
        out('ig', gate.current);
      },
      reset() {
        cores.forEach((c) => c.reset());
        main.off = true;
      },
    };
  },
});
