import { bool, defineDevice, num } from '../device';
import { R_OPEN } from '../models/constants';

/**
 * Mains supply at the panel: phase (l), neutral (n) and protective earth
 * (pe). An ideal sine of `voltage` (RMS) behind the installation's loop
 * impedance, with earth bonded to neutral at the service entrance (TN-C-S,
 * the usual Brazilian arrangement) through `earth`.
 *
 * Transient: v(t) = √2·V·sin(2π·f·t). Quasi-static: the phasor V∠0 at the
 * analysis frequency. DC: zero. `on` = false is the main breaker open.
 */
export default defineDevice({
  info: {
    type: 'mains',
    label: 'Rede elétrica',
    terminals: 'fixed',
    pins: [
      { name: 'l', offset: [2, -2], label: 'fase (F)' },
      { name: 'n', offset: [2, 0], label: 'neutro (N)' },
      { name: 'pe', offset: [2, 2], label: 'terra (PE, ⏚)' },
    ],
    params: {
      voltage: { default: 127, label: 'Tensão (eficaz)', unit: 'V', min: 0, max: 1000 },
      frequency: { default: 60, label: 'Frequência', unit: 'Hz', min: 1, max: 1000 },
      impedance: {
        default: 0.3,
        label: 'Impedância da instalação (fase + neutro)',
        unit: 'Ω',
        min: 0.001,
      },
      earth: { default: 1, label: 'Resistência entre terra e neutro', unit: 'Ω', min: 0.001 },
      on: { default: true, label: 'Energizada (disjuntor geral ligado)' },
    },
    readouts: ['voltage', 'current', 'power', 'powerFactor'],
    readoutInfo: {
      voltage: { label: 'Tensão entre fase e neutro', unit: 'V' },
      current: { label: 'Corrente fornecida (fase)', unit: 'A' },
      power: { label: 'Potência fornecida (ativa)', unit: 'W' },
      powerFactor: { label: 'Fator de potência da carga' },
    },
  },
  referencePin: 'n',
  source: true,
  create({ params, pins: [l, n, pe], branch }) {
    const br = branch();
    const gEarth = () => 1 / num(params, 'earth');
    const r = () => (bool(params, 'on') ? num(params, 'impedance') : R_OPEN);
    return {
      stamp(m, step) {
        const v =
          step.mode === 'dc'
            ? 0
            : Math.SQRT2 *
              num(params, 'voltage') *
              Math.sin(2 * Math.PI * num(params, 'frequency') * step.t);
        m.branch(br, l, n, v * step.nl.sourceScale, r());
        m.conductance(pe, n, gEarth());
      },
      stampAc(m, ctx) {
        const omega = 2 * Math.PI * num(params, 'frequency');
        const v =
          ctx.phasor && Math.abs(omega - ctx.omega) <= 1e-6 * ctx.omega
            ? num(params, 'voltage')
            : ctx.source === ctx.id
              ? 1
              : 0;
        m.branch(br, l, n, v, 0, r());
        m.admittance(pe, n, gEarth());
      },
      pinCurrents(x, out) {
        const iEarth = gEarth() * (x.v(n) - x.v(pe));
        out[0] = x.x[br];
        out[1] = -x.x[br] + iEarth;
        out[2] = -iEarth;
      },
      readouts(x, out, ac) {
        const v = x.v(l) - x.v(n);
        const i = -x.x[br];
        if (!ac) {
          out('voltage', v);
          out('current', i);
          out('power', v * i);
          out('powerFactor', 1);
          return;
        }
        const vr = ac.re(l) - ac.re(n);
        const vi = ac.im(l) - ac.im(n);
        const ir = -ac.re(br);
        const ii = -ac.im(br);
        const p = vr * ir + vi * ii;
        const s = Math.hypot(vr, vi) * Math.hypot(ir, ii);
        out('voltage', Math.hypot(vr, vi));
        out('current', Math.hypot(ir, ii));
        out('power', p);
        out('powerFactor', s > 1e-9 ? p / s : 1);
      },
    };
  },
});
