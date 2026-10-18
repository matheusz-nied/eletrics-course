import { acSquared, defineDevice, num, TWO_PINS } from '../device';
import { formatSI } from '../messages';
import { KELVIN, R_OPEN } from '../models/constants';
import { RmsMeter } from '../models/filters';

/** Filament temperature at the rated voltage (K). Typical incandescent lamp. */
const T_RATED = 2700;
/** The filament breaks above this temperature: about 1,7× the rated voltage (K). */
const T_BURN = 3300;
/** Tungsten resistivity grows roughly with T^1,2. */
const R_EXPONENT = 1.2;
/** Light output grows roughly with T^8,8 (≈ V^3,4 for incandescent lamps). */
const LIGHT_EXPONENT = 8.8;

/**
 * Incandescent lamp. The filament resistance follows its temperature, which
 * comes from a power balance (electric power in, radiation out ∝ T⁴, thermal
 * mass): cold, the resistance is about 14 times lower, so the lamp takes a
 * current surge when switched on; above 1,7× the rated voltage it burns out.
 */
export default defineDevice({
  info: {
    type: 'lamp',
    label: 'Lâmpada incandescente',
    terminals: 'two',
    pins: TWO_PINS,
    params: {
      voltage: { default: 12, label: 'Tensão nominal', unit: 'V', min: 0.1 },
      power: { default: 5, label: 'Potência nominal', unit: 'W', min: 0.01 },
      thermalTime: {
        default: 0.08,
        label: 'Tempo de aquecimento do filamento',
        unit: 's',
        min: 1e-4,
      },
    },
    readouts: ['current', 'voltage', 'power', 'brightness', 'temperature', 'resistance', 'burned'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão', unit: 'V' },
      power: { label: 'Potência', unit: 'W' },
      brightness: { label: 'Brilho (1 = nominal)' },
      temperature: { label: 'Temperatura do filamento', unit: '°C' },
      resistance: { label: 'Resistência do filamento', unit: 'Ω' },
      burned: { label: 'Queimada' },
    },
  },
  create({ id, params, pins: [a, b] }) {
    const t0 = 25 + KELVIN;
    let temp = t0;
    let burned = false;
    let current = 0;
    const vRms = new RmsMeter();
    const hotResistance = () => num(params, 'voltage') ** 2 / num(params, 'power');
    const resistance = () =>
      burned ? R_OPEN : hotResistance() * Math.pow(temp / T_RATED, R_EXPONENT);
    return {
      stamp(m) {
        m.conductance(a, b, 1 / resistance());
      },
      // The filament's thermal mass holds its resistance over a signal cycle.
      stampAc(m) {
        m.admittance(a, b, 1 / resistance());
      },
      update(step, x, ctx) {
        const v = x.v(a) - x.v(b);
        current = v / resistance();
        if (!ctx.commit || step.dt <= 0) return;
        const ac = step.ac;
        vRms.update(ac ? Math.hypot(v, ac.re(a) - ac.re(b), ac.im(a) - ac.im(b)) : v, step.dt);
        if (burned) {
          temp = t0;
          return;
        }
        // Backward Euler on C·dT/dt = P − k·(T⁴ − T0⁴), solved by Newton.
        const k = num(params, 'power') / (T_RATED ** 4 - t0 ** 4);
        const heatCapacity = num(params, 'thermalTime') * 4 * k * T_RATED ** 3;
        const p = v * current + acSquared(step, 0) * resistance();
        const prev = temp;
        let t = prev;
        for (let n = 0; n < 8; n++) {
          const f = (heatCapacity * (t - prev)) / step.dt - p + k * (t ** 4 - t0 ** 4);
          const df = heatCapacity / step.dt + 4 * k * t ** 3;
          const next = Math.max(t0 * 0.5, t - f / df);
          if (Math.abs(next - t) < 1e-6) {
            t = next;
            break;
          }
          t = next;
        }
        temp = t;
        if (temp > T_BURN) {
          burned = true;
          ctx.emit(
            'damaged',
            `A lâmpada ${id} queimou: tensão de ${formatSI(vRms.value, 'V')}, nominal ${formatSI(num(params, 'voltage'), 'V')}.`,
          );
          ctx.discontinuity();
        }
      },
      pinCurrents(_x, out) {
        out[0] = current;
        out[1] = -current;
      },
      readouts(_x, out) {
        out('brightness', burned ? 0 : Math.min(Math.pow(temp / T_RATED, LIGHT_EXPONENT), 3));
        out('temperature', temp - KELVIN);
        out('resistance', burned ? Infinity : resistance());
        out('burned', burned);
      },
      reset() {
        temp = t0;
        burned = false;
        current = 0;
        vRms.reset();
      },
    };
  },
});
