import { defineDevice, num, rms, type PhasorView } from '../device';
import { reportHeating } from '../messages';
import { R_OPEN } from '../models/constants';
import { ResistiveHeating } from '../models/heating';

/** Thermal time constant of a small mains transformer (s). */
const THERMAL_TAU = 120;

/**
 * Transformer as two coupled windings: primary magnetizing inductance Lp,
 * secondary Lp/n² (n = turns ratio), mutual k·√(Lp·Ls), and the resistance
 * of each winding. The dots are on p1 and s1. The copper losses heat it
 * against its VA rating: overloaded it warns, then burns open (connecting
 * one to DC does that quickly, since only the wire resistance limits the
 * current). In the quasi-static analysis the readouts and the heating use the
 * true RMS of the DC part and the phasor.
 */
export default defineDevice({
  info: {
    type: 'transformer',
    label: 'Transformador',
    terminals: 'fixed',
    pins: [
      { name: 'p1', offset: [-2, -2], label: 'primário (ponto)' },
      { name: 'p2', offset: [-2, 2], label: 'primário' },
      { name: 's1', offset: [2, -2], label: 'secundário (ponto)' },
      { name: 's2', offset: [2, 2], label: 'secundário' },
    ],
    params: {
      ratio: { default: 10, label: 'Relação de espiras (primário : secundário)', min: 0.01 },
      inductance: { default: 20, label: 'Indutância do primário', unit: 'H', min: 1e-6 },
      coupling: { default: 0.998, label: 'Acoplamento k', min: 0.5, max: 0.99999 },
      rPrimary: { default: 20, label: 'Resistência do primário', unit: 'Ω', min: 1e-3 },
      rSecondary: { default: 0.2, label: 'Resistência do secundário', unit: 'Ω', min: 1e-4 },
      voltage: { default: 127, label: 'Tensão nominal do primário (eficaz)', unit: 'V', min: 1 },
      power: { default: 20, label: 'Potência nominal', unit: 'VA', min: 0.1 },
    },
    readouts: [
      'vPrimary',
      'vSecondary',
      'iPrimary',
      'iSecondary',
      'losses',
      'temperature',
      'burned',
    ],
    readoutInfo: {
      vPrimary: { label: 'Tensão no primário', unit: 'V' },
      vSecondary: { label: 'Tensão no secundário', unit: 'V' },
      iPrimary: { label: 'Corrente no primário (entra no ponto)', unit: 'A' },
      iSecondary: { label: 'Corrente no secundário (sai do ponto)', unit: 'A' },
      losses: { label: 'Perdas no cobre', unit: 'W' },
      temperature: { label: 'Temperatura dos enrolamentos', unit: '°C' },
      burned: { label: 'Queimado (enrolamento aberto)' },
    },
  },
  create({ id, params, pins: [p1, p2, s1, s2], branch }) {
    const bp = branch();
    const bs = branch();
    // Rated copper losses: the rated currents through each winding.
    const ratedLosses = () => {
      const ip = num(params, 'power') / num(params, 'voltage');
      const is = ip * num(params, 'ratio');
      return num(params, 'rPrimary') * ip * ip + num(params, 'rSecondary') * is * is;
    };
    const heat = new ResistiveHeating(ratedLosses, THERMAL_TAU);
    const inductances = () => {
      const lp = num(params, 'inductance');
      const ls = lp / num(params, 'ratio') ** 2;
      return { lp, ls, m: num(params, 'coupling') * Math.sqrt(lp * ls) };
    };
    const rp = () => (heat.burned ? R_OPEN : num(params, 'rPrimary'));
    const rs = () => (heat.burned ? R_OPEN : num(params, 'rSecondary'));
    // State at the last accepted step: currents (into the dots) and inductive voltages.
    let ip0 = 0;
    let is0 = 0;
    let ep0 = 0;
    let es0 = 0;
    let ip = 0;
    let is = 0;
    /** Square of the AC current (RMS) in a winding's branch; 0 outside the quasi-static analysis. */
    const acSquared = (ac: PhasorView | undefined, br: number) =>
      ac ? ac.re(br) ** 2 + ac.im(br) ** 2 : 0;
    /** True RMS signed like the DC part (the convention of quasi-static readouts). */
    const signed = (dc: number, re: number, im: number) => Math.sign(dc || 1) * rms(dc, re, im);
    const copperLosses = (ac: PhasorView | undefined) =>
      rp() * (ip * ip + acSquared(ac, bp)) + rs() * (is * is + acSquared(ac, bs));
    return {
      stamp(m, step) {
        const { lp, ls, m: mu } = inductances();
        if (step.mode === 'dc') {
          m.branch(bp, p1, p2, 0, rp());
          m.branch(bs, s1, s2, 0, rs());
          return;
        }
        const dt = step.dt > 0 ? step.dt : 1e-9;
        const k = step.method === 'be' ? 1 / dt : 2 / dt;
        // Flux linkages λ = L·i + M·i' at the last step; the trapezoidal rule also uses e = dλ/dt.
        const lambdaP = lp * ip0 + mu * is0;
        const lambdaS = ls * is0 + mu * ip0;
        const trap = step.method === 'trap';
        m.branch(bp, p1, p2, -k * lambdaP - (trap ? ep0 : 0), rp() + k * lp);
        m.add(bp, bs, -k * mu);
        m.branch(bs, s1, s2, -k * lambdaS - (trap ? es0 : 0), rs() + k * ls);
        m.add(bs, bp, -k * mu);
      },
      stampAc(m, { omega }) {
        const { lp, ls, m: mu } = inductances();
        m.branch(bp, p1, p2, 0, 0, rp(), omega * lp);
        m.add(bp, bs, 0, -omega * mu);
        m.branch(bs, s1, s2, 0, 0, rs(), omega * ls);
        m.add(bs, bp, 0, -omega * mu);
      },
      update(step, x, ctx) {
        ip = x.x[bp];
        is = x.x[bs];
        if (!ctx.commit) return;
        ip0 = ip;
        is0 = is;
        ep0 = x.v(p1) - x.v(p2) - rp() * ip;
        es0 = x.v(s1) - x.v(s2) - rs() * is;
        if (step.mode === 'dc') ep0 = es0 = 0;
        reportHeating(
          ctx,
          heat.burned ? 'ok' : heat.step(copperLosses(step.ac), step.dt),
          `O transformador ${id}`,
          heat.power,
          ratedLosses(),
          'e o enrolamento abriu',
        );
      },
      pinCurrents(_x, out) {
        out[0] = ip;
        out[1] = -ip;
        out[2] = is;
        out[3] = -is;
      },
      readouts(x, out, ac) {
        const re = (i: number) => (ac ? ac.re(i) : 0);
        const im = (i: number) => (ac ? ac.im(i) : 0);
        const across = (a: number, b: number) =>
          signed(x.v(a) - x.v(b), re(a) - re(b), im(a) - im(b));
        out('vPrimary', across(p1, p2));
        out('vSecondary', across(s1, s2));
        out('iPrimary', signed(ip, re(bp), im(bp)));
        out('iSecondary', -signed(is, re(bs), im(bs)));
        out('losses', heat.burned ? 0 : copperLosses(ac));
        out('temperature', heat.temperature);
        out('burned', heat.burned);
      },
      reset() {
        heat.reset();
        ip0 = is0 = ep0 = es0 = ip = is = 0;
      },
    };
  },
});
