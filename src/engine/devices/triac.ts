import { defineDevice, num, type PhasorView } from '../device';
import { R_OPEN } from '../models/constants';
import { DiodeCore } from '../models/diode';

/** On-state resistance in the quasi-static analysis (Ω). */
const R_ON = 0.05;

/**
 * Fundamental of the voltage a phase-controlled TRIAC lets through, per volt
 * of supply, for a conduction fraction c of each half-cycle (resistive load):
 * the sine kept from the firing angle π(1 − c) to the zero crossing, as a
 * phasor (it lags the supply).
 */
export function phaseControlFactor(c: number): { re: number; im: number } {
  const x = Math.min(1, Math.max(0, c));
  const s = Math.sin(Math.PI * x);
  return { re: x - Math.sin(2 * Math.PI * x) / (2 * Math.PI), im: -(s * s) / Math.PI };
}

/**
 * TRIAC: an SCR for both directions. A gate current above Igt in either
 * direction (gate to MT1) turns it on; it conducts both ways (like two
 * diodes in antiparallel) until the current falls below the holding current,
 * which with AC happens at every zero crossing.
 *
 * Quasi-static analysis: the TRIAC conducts a fraction of every half-cycle.
 * A microcontroller `phase-out` pin wired to the gate sets the fraction
 * (phase control); otherwise a DC gate current above Igt fires it for the
 * whole cycle. For the fundamental at the mains frequency it then holds
 * (1 − K)·Voc, with Voc the voltage it would block and K the share of the
 * supply sine phase control lets through (`phaseControlFactor`).
 */
export default defineDevice({
  info: {
    type: 'triac',
    label: 'TRIAC',
    terminals: 'fixed',
    pins: [
      { name: 'mt2', offset: [-2, 0], label: 'terminal principal 2 (MT2/A2)' },
      { name: 'mt1', offset: [2, 0], label: 'terminal principal 1 (MT1/A1)' },
      { name: 'g', offset: [1, 2], label: 'gatilho (G)' },
    ],
    params: {
      igt: { default: 0.01, label: 'Corrente de disparo do gatilho Igt', unit: 'A', min: 1e-6 },
      ih: { default: 0.015, label: 'Corrente de manutenção Ih', unit: 'A', min: 1e-6 },
      vbo: { default: 600, label: 'Tensão de ruptura (breakover)', unit: 'V', min: 1 },
    },
    readouts: ['on', 'i', 'v', 'ig', 'conduction'],
    readoutInfo: {
      on: { label: 'Conduzindo' },
      i: { label: 'Corrente MT2 → MT1', unit: 'A' },
      v: { label: 'Tensão MT2 − MT1', unit: 'V' },
      ig: { label: 'Corrente de gatilho (entrando)', unit: 'A' },
      conduction: { label: 'Fração de cada semiciclo em condução' },
    },
  },
  create({ params, pins: [mt2, mt1, g], node, branch, analysis, signal }) {
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

    // Quasi-static: a branch for the main path, and the gate's phase-control line.
    const quasi = analysis === 'quasi-static';
    const br = quasi ? branch() : -1;
    const gate = signal(g);
    let ig = 0;
    let acI = 0;
    let acV = 0;
    const conduction = () => {
      if (gate.phase !== undefined) return Math.min(1, Math.max(0, gate.phase));
      return Math.abs(ig) >= num(params, 'igt') ? 1 : 0;
    };
    const blockingVoltage = (first: PhasorView) => ({
      re: first.re(mt2) - first.re(mt1),
      im: first.im(mt2) - first.im(mt1),
    });

    if (quasi) {
      return {
        nonlinear: true,
        beginSolve: () => {
          gateIn.begin();
          gateOut.begin();
        },
        stamp(m, step, x) {
          gateIn.stamp(m, step.nl, x);
          gateOut.stamp(m, step.nl, x);
          m.branch(br, mt2, mt1, 0, conduction() >= 1 ? R_ON : R_OPEN);
        },
        stampAc(m, ctx) {
          const c = conduction();
          if (c >= 0.999) m.branch(br, mt2, mt1, 0, 0, R_ON);
          else if (c <= 0.001 || !ctx.phasor) m.branch(br, mt2, mt1, 0, 0, R_OPEN);
          else if (!ctx.first) {
            // First pass: blocking, to find the voltage it blocks.
            m.branch(br, mt2, mt1, 0, 0, R_OPEN);
            ctx.again?.();
          } else {
            const voc = blockingVoltage(ctx.first);
            const k = phaseControlFactor(c);
            const re = 1 - k.re;
            const im = -k.im;
            m.branch(br, mt2, mt1, re * voc.re - im * voc.im, re * voc.im + im * voc.re, R_ON);
          }
        },
        update(step, x, ctx) {
          gateIn.update(x, ctx.commit);
          gateOut.update(x, ctx.commit);
          ig = gateCurrent();
          const ac = step.ac;
          acI = ac ? Math.hypot(ac.re(br), ac.im(br)) : 0;
          acV = ac ? Math.hypot(ac.re(mt2) - ac.re(mt1), ac.im(mt2) - ac.im(mt1)) : 0;
          if (ctx.commit) on = conduction() > 0;
        },
        pinCurrents(x, out) {
          out[0] = x.x[br];
          out[1] = -x.x[br] - ig;
          out[2] = ig;
        },
        readouts(x, out) {
          const dc = x.x[br];
          out('on', on);
          out('i', Math.sqrt(dc * dc + acI * acI));
          out('v', Math.hypot(x.v(mt2) - x.v(mt1), acV));
          out('ig', ig);
          out('conduction', conduction());
        },
        reset() {
          gateIn.reset();
          gateOut.reset();
          on = false;
          ig = acI = acV = 0;
        },
      };
    }

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
        out('conduction', on ? 1 : 0);
      },
      reset() {
        cores.forEach((c) => c.reset());
        setOn(false);
      },
    };
  },
});
