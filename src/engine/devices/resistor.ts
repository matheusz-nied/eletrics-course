import { defineDevice, num, TWO_PINS } from '../device';
import { formatSI } from '../messages';
import { R_OPEN } from '../models/constants';
import { ResistiveHeating } from '../models/heating';

/**
 * Resistor with a body temperature model. Above its power rating it heats past
 * the safe limit (warning); sustained at about five times the rating it chars
 * and opens (damaged), as real film resistors do.
 */
export default defineDevice({
  info: {
    type: 'resistor',
    label: 'Resistor',
    terminals: 'two',
    pins: TWO_PINS,
    params: {
      resistance: { default: 1000, label: 'Resistência', unit: 'Ω', min: 1e-6 },
      watts: { default: 0.25, label: 'Potência nominal', unit: 'W', min: 0.01 },
      tolerance: { default: 5, label: 'Tolerância', unit: '%', min: 0, max: 20 },
    },
    readouts: ['current', 'voltage', 'power', 'temperature', 'burned'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão', unit: 'V' },
      power: { label: 'Potência dissipada', unit: 'W' },
      temperature: { label: 'Temperatura do corpo', unit: '°C' },
      burned: { label: 'Queimado' },
    },
  },
  create({ id, params, pins: [a, b] }) {
    const heat = new ResistiveHeating(() => num(params, 'watts'));
    let current = 0;
    const resistance = () => (heat.burned ? R_OPEN : num(params, 'resistance'));
    return {
      stamp(m) {
        m.conductance(a, b, 1 / resistance());
      },
      stampAc(m) {
        m.admittance(a, b, 1 / resistance());
      },
      update(step, x, ctx) {
        const v = x.v(a) - x.v(b);
        current = v / resistance();
        if (!ctx.commit) return;
        const result = heat.step(v * current, step.dt);
        if (result === 'ok') return;
        const watts = formatSI(num(params, 'watts'), 'W');
        if (result === 'hot') {
          ctx.emit(
            'warning',
            `O resistor ${id} está esquentando demais: dissipa ${formatSI(heat.power, 'W')}, máximo ${watts}.`,
          );
        } else if (result === 'burned') {
          ctx.emit(
            'damaged',
            `O resistor ${id} queimou: dissipava ${formatSI(heat.power, 'W')}, máximo ${watts}.`,
          );
          ctx.discontinuity();
        }
      },
      pinCurrents(_x, out) {
        out[0] = current;
        out[1] = -current;
      },
      readouts(_x, out) {
        out('temperature', heat.temperature);
        out('burned', heat.burned);
      },
      reset() {
        heat.reset();
        current = 0;
      },
    };
  },
});
