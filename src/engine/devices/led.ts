import { defineDevice, num, str } from '../device';
import { formatSI } from '../messages';
import { DiodeCore } from '../models/diode';
import { relax } from '../models/filters';
import { VT } from '../models/junction';

/** Current at which `brightness` is 1 and the forward voltage of each color is given (A). */
const I_NOMINAL = 0.02;
const N = 2;
/** Forward voltage at 20 mA and series resistance of each color (typical 5 mm LEDs). */
const COLORS: Record<string, { label: string; vf: number; rs: number }> = {
  red: { label: 'Vermelho', vf: 2.0, rs: 10 },
  yellow: { label: 'Amarelo', vf: 2.1, rs: 10 },
  green: { label: 'Verde', vf: 2.2, rs: 10 },
  blue: { label: 'Azul', vf: 3.1, rs: 12 },
  white: { label: 'Branco', vf: 3.1, rs: 12 },
  infrared: { label: 'Infravermelho', vf: 1.2, rs: 3 },
};
/** Thermal time of the die: how fast an overcurrent burns it (s). */
const TAU = 0.1;
/** The die fails when the filtered current reaches this multiple of the maximum. */
const K_BURN = 2.5;

/**
 * LED: a diode whose forward voltage depends on the color, with 5 V reverse
 * breakdown. The die heats with the square of the current: above the maximum
 * it warns, and at 2,5× the maximum it burns open within a fraction of a
 * second, so an LED without a resistor on 5 V or more burns at once.
 */
export default defineDevice({
  info: {
    type: 'led',
    label: 'LED',
    terminals: 'two',
    pins: [
      { name: 'a', offset: [0, 0], label: 'ânodo (perna longa)' },
      { name: 'b', offset: [0, 0], label: 'cátodo (perna curta, lado chanfrado)' },
    ],
    params: {
      color: {
        default: 'red',
        label: 'Cor',
        options: Object.entries(COLORS).map(([value, c]) => ({ value, label: c.label })),
      },
      imax: { default: 0.03, label: 'Corrente máxima', unit: 'A', min: 1e-3 },
    },
    readouts: ['current', 'voltage', 'power', 'brightness', 'burned'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão direta', unit: 'V' },
      power: { label: 'Potência', unit: 'W' },
      brightness: { label: 'Brilho (1 = 20 mA)' },
      burned: { label: 'Queimado' },
    },
  },
  create({ id, params, pins: [a, k], node }) {
    const led = new DiodeCore(a, k, node);
    const configure = () => {
      const c = COLORS[str(params, 'color')] ?? COLORS.red;
      const is = I_NOMINAL / Math.expm1((c.vf - I_NOMINAL * c.rs) / (N * VT));
      led.configure({ is, n: N, rs: c.rs, bv: 5, ibv: 1e-5 });
    };
    configure();
    let heat = 0;
    let warned = false;
    const imax = () => num(params, 'imax');
    return {
      nonlinear: true,
      beginSolve: () => led.begin(),
      stamp: (m, step, x) => led.stamp(m, step.nl, x),
      stampAc: (m, _ctx, op) => led.stampAc(m, op),
      update(step, x, ctx) {
        led.update(x, ctx.commit);
        if (!ctx.commit || led.failure) return;
        const i = led.current;
        heat = relax(heat, i * i, step.dt, TAU);
        const max = formatSI(imax(), 'A');
        if (heat >= (K_BURN * imax()) ** 2) {
          led.failure = 'open';
          ctx.emit(
            'damaged',
            `O LED ${id} queimou: corrente de ${formatSI(Math.abs(i), 'A')}, máximo ${max}.`,
          );
          ctx.discontinuity();
        } else if (!warned && heat > imax() ** 2) {
          warned = true;
          ctx.emit(
            'warning',
            `O LED ${id} está com corrente acima do máximo: ${formatSI(Math.sqrt(heat), 'A')}, máximo ${max}.`,
          );
        } else if (warned && heat < (0.8 * imax()) ** 2) {
          warned = false;
        }
      },
      pinCurrents(_x, out) {
        out[0] = led.current;
        out[1] = -led.current;
      },
      readouts(_x, out) {
        out('brightness', led.failure ? 0 : Math.max(0, led.current) / I_NOMINAL);
        out('burned', led.failure === 'open');
      },
      paramChanged: configure,
      reset() {
        led.reset();
        heat = 0;
        warned = false;
      },
    };
  },
});
