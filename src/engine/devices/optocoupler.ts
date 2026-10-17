import { defineDevice, num } from '../device';
import { formatSI } from '../messages';
import { DiodeCore } from '../models/diode';
import { relax } from '../models/filters';
import { VT } from '../models/junction';

/** Collector-emitter voltage below which the phototransistor saturates (V). */
const V_SAT = 0.1;
/** Infrared LED: forward voltage at 20 mA, ideality and series resistance. */
const LED_VF = 1.2;
const LED_N = 2;
const LED_RS = 3;
/** The LED burns when its filtered current reaches this multiple of the maximum. */
const K_BURN = 2.5;

/**
 * Optocoupler (LED and phototransistor in one package, electrically
 * isolated): the collector current is the LED current times the current
 * transfer ratio (CTR), limited when the transistor saturates. The LED
 * burns like any LED when driven without a resistor.
 */
export default defineDevice({
  info: {
    type: 'optocoupler',
    label: 'Optoacoplador',
    terminals: 'fixed',
    pins: [
      { name: 'a', offset: [-4, -2], label: 'ânodo do LED' },
      { name: 'k', offset: [-4, 2], label: 'cátodo do LED' },
      { name: 'c', offset: [4, -2], label: 'coletor' },
      { name: 'e', offset: [4, 2], label: 'emissor' },
    ],
    params: {
      ctr: { default: 1, label: 'Razão de transferência de corrente (CTR, 1 = 100 %)', min: 0.01 },
      imax: { default: 0.05, label: 'Corrente máxima do LED', unit: 'A', min: 1e-3 },
    },
    readouts: ['ledCurrent', 'ic', 'vce', 'burned'],
    readoutInfo: {
      ledCurrent: { label: 'Corrente no LED', unit: 'A' },
      ic: { label: 'Corrente de coletor', unit: 'A' },
      vce: { label: 'Tensão coletor-emissor', unit: 'V' },
      burned: { label: 'LED queimado' },
    },
  },
  create({ id, params, pins: [a, k, c, e], node }) {
    const led = new DiodeCore(a, k, node);
    led.configure({
      is: 0.02 / Math.expm1((LED_VF - 0.02 * LED_RS) / (LED_N * VT)),
      n: LED_N,
      rs: LED_RS,
      bv: 5,
      ibv: 1e-5,
    });
    let heat = 0;
    let ic = 0;
    /** Saturation of the output (0…1) and its slope, for vce ≥ 0; tiny reverse leakage. */
    const saturation = (vce: number) => {
      if (vce <= 0) return { f: (vce / V_SAT) * 1e-3, df: 1e-3 / V_SAT };
      const t = Math.tanh(vce / V_SAT);
      return { f: t, df: (1 - t * t) / V_SAT };
    };
    return {
      nonlinear: true,
      beginSolve: () => led.begin(),
      stamp(m, step, x) {
        const lin = led.stamp(m, step.nl, x);
        const ctr = num(params, 'ctr');
        const iLed = lin ? Math.max(0, lin.i) : 0;
        const gLed = lin && lin.i > 0 ? lin.g : 0;
        const vce = x.v(c) - x.v(e);
        const s = saturation(vce);
        // Ic = CTR·I_LED(v_led)·f(vce), linearized in v_led (at the junction) and vce.
        const dLed = ctr * gLed * s.f;
        const dVce = ctr * iLed * s.df;
        m.transconductance(c, e, led.mid, k, dLed);
        m.transconductance(c, e, c, e, dVce);
        m.current(c, e, ctr * iLed * s.f - dLed * (lin?.v ?? 0) - dVce * vce);
        // Keeps the output defined when the LED is off.
        m.conductance(c, e, 1e-9);
      },
      stampAc(m, _ctx, op) {
        led.stampAc(m, op);
        const vj = op.v(led.mid) - op.v(k);
        const j = led.junction.at(vj);
        const s = saturation(op.v(c) - op.v(e));
        const ctr = num(params, 'ctr');
        m.transconductance(c, e, led.mid, k, j.i > 0 ? ctr * j.g * s.f : 0);
        m.admittance(c, e, ctr * Math.max(0, j.i) * s.df + 1e-9);
      },
      update(step, x, ctx) {
        led.update(x, ctx.commit);
        const vce = x.v(c) - x.v(e);
        ic = num(params, 'ctr') * Math.max(0, led.current) * saturation(vce).f + 1e-9 * vce;
        if (!ctx.commit || led.failure) return;
        heat = relax(heat, led.current ** 2, step.dt, 0.1);
        const imax = num(params, 'imax');
        if (heat >= (K_BURN * imax) ** 2) {
          led.failure = 'open';
          ctx.emit(
            'damaged',
            `O LED do optoacoplador ${id} queimou: corrente de ${formatSI(Math.abs(led.current), 'A')}, máximo ${formatSI(imax, 'A')}.`,
          );
          ctx.discontinuity();
        }
      },
      pinCurrents(_x, out) {
        out[0] = led.current;
        out[1] = -led.current;
        out[2] = ic;
        out[3] = -ic;
      },
      readouts(x, out) {
        out('ledCurrent', led.current);
        out('ic', ic);
        out('vce', x.v(c) - x.v(e));
        out('burned', led.failure === 'open');
      },
      reset() {
        led.reset();
        heat = ic = 0;
      },
    };
  },
});
