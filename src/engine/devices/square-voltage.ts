import { defineDevice, num } from '../device';
import { R_SERIES_MIN } from '../models/constants';

/** Level of the wave at time t: high during the first `duty` of each period. */
function highAt(t: number, frequency: number, duty: number): boolean {
  if (duty <= 0) return false;
  if (duty >= 1 || frequency <= 0) return true;
  const phase = t * frequency - Math.floor(t * frequency + 1e-9);
  return phase < duty - 1e-9;
}

/**
 * Square wave voltage source, like a function generator or a clock: `high`
 * during the first `duty` of each period and `low` for the rest. The level
 * switches after the step in which the edge falls (the same one-step delay as
 * a microcontroller output), and each edge restarts the integration, so the
 * edges stay sharp. In a sweep and in the quasi-static analysis it is a short.
 * Pin a is the + terminal.
 */
export default defineDevice({
  info: {
    type: 'square-voltage',
    label: 'Gerador de onda quadrada',
    terminals: 'two',
    pins: [
      { name: 'a', offset: [0, 0], label: 'saída (+)' },
      { name: 'b', offset: [0, 0], label: 'referência (−)' },
    ],
    params: {
      high: { default: 5, label: 'Nível alto', unit: 'V' },
      low: { default: 0, label: 'Nível baixo', unit: 'V' },
      frequency: { default: 1, label: 'Frequência', unit: 'Hz', min: 0 },
      duty: { default: 0.5, label: 'Ciclo de trabalho (fração do período em nível alto)', min: 0, max: 1 },
    },
    readouts: ['current', 'voltage', 'power', 'high'],
    readoutInfo: {
      current: { label: 'Corrente fornecida', unit: 'A' },
      voltage: { label: 'Tensão', unit: 'V' },
      power: { label: 'Potência fornecida', unit: 'W' },
      high: { label: 'Saída em nível alto' },
    },
  },
  referencePin: 'b',
  source: true,
  create({ params, pins: [a, b], branch }) {
    const br = branch();
    const levelAt = (t: number) => highAt(t, num(params, 'frequency'), num(params, 'duty'));
    let high = levelAt(0);
    const value = () => num(params, high ? 'high' : 'low');
    return {
      stamp(m, step) {
        m.branch(br, a, b, value() * step.nl.sourceScale, R_SERIES_MIN);
      },
      stampAc(m, ctx) {
        m.branch(br, a, b, ctx.source === ctx.id ? 1 : 0, 0, R_SERIES_MIN);
      },
      update(step, _x, ctx) {
        if (!ctx.commit) return;
        const next = levelAt(step.t);
        if (next !== high) {
          high = next;
          ctx.discontinuity();
        }
      },
      pinCurrents(x, out) {
        out[0] = x.x[br];
        out[1] = -x.x[br];
      },
      readouts(_x, out) {
        out('high', high);
      },
      paramChanged() {
        // A new duty cycle of 0 or 1 (a constant level) shows at once, even paused.
        const d = num(params, 'duty');
        if (d <= 0) high = false;
        else if (d >= 1) high = true;
      },
      reset() {
        high = levelAt(0);
      },
    };
  },
});
