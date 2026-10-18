import { defineDevice, num, str, TWO_PINS } from '../device';
import { formatSI } from '../messages';
import { R_OPEN } from '../models/constants';
import { relax } from '../models/filters';

/** The element never melts below this multiple of the rated current. */
const K_MIN_MELT = 1.6;
/** Typical melting I²t per ampere² of rating (s), when `i2t` is 0. */
const I2T_PER_A2 = { fast: 0.8, slow: 15 } as const;

/**
 * Fuse with a thermal model of the element: its "heat" follows i² with a time
 * constant set by the melting I²t, and it blows when the heat reaches
 * (1,6·In)². That gives the real behaviour: never at 1,5× the rating, after
 * seconds at 2×, in milliseconds at 10×, with fast (F) and time-lag (T) types.
 */
export default defineDevice({
  info: {
    type: 'fuse',
    label: 'Fusível',
    terminals: 'two',
    pins: TWO_PINS,
    params: {
      rating: { default: 1, label: 'Corrente nominal', unit: 'A', min: 1e-3 },
      kind: {
        default: 'fast',
        label: 'Tipo',
        options: [
          { value: 'fast', label: 'Rápido (F)' },
          { value: 'slow', label: 'Retardado (T)' },
        ],
      },
      i2t: { default: 0, label: 'I²t de fusão (0 = típico do tipo)', unit: 'A²s', min: 0 },
      resistance: { default: 0, label: 'Resistência (0 = típica)', unit: 'Ω', min: 0 },
    },
    readouts: ['current', 'voltage', 'power', 'blown', 'heat'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão', unit: 'V' },
      power: { label: 'Potência', unit: 'W' },
      blown: { label: 'Rompido' },
      heat: { label: 'Aquecimento do elo (1 = rompe)' },
    },
  },
  create({ id, params, pins: [a, b] }) {
    let heat = 0;
    let blown = false;
    let current = 0;
    const rating = () => num(params, 'rating');
    const melt = () => (K_MIN_MELT * rating()) ** 2;
    const i2t = () => {
      const kind = str(params, 'kind') === 'slow' ? 'slow' : 'fast';
      return num(params, 'i2t') || I2T_PER_A2[kind] * rating() ** 2;
    };
    const resistance = () => {
      if (blown) return R_OPEN;
      return num(params, 'resistance') || 0.1 / rating();
    };
    return {
      stamp(m) {
        m.conductance(a, b, 1 / resistance());
      },
      stampAc(m) {
        m.admittance(a, b, 1 / resistance());
      },
      update(step, x, ctx) {
        current = (x.v(a) - x.v(b)) / resistance();
        if (!ctx.commit || blown) return;
        heat = relax(heat, current * current, step.dt, i2t() / melt());
        if (heat >= melt()) {
          blown = true;
          ctx.emit(
            'damaged',
            `O fusível ${id} rompeu: corrente de ${formatSI(Math.abs(current), 'A')}, nominal ${formatSI(rating(), 'A')}.`,
          );
          ctx.discontinuity();
        }
      },
      pinCurrents(_x, out) {
        out[0] = current;
        out[1] = -current;
      },
      readouts(_x, out) {
        out('blown', blown);
        out('heat', blown ? 1 : heat / melt());
      },
      reset() {
        heat = 0;
        blown = false;
        current = 0;
      },
    };
  },
});
