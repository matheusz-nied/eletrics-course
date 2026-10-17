import { bool, defineDevice, num } from '../device';
import { formatSI } from '../messages';
import { R_FAILED_SHORT } from '../models/diode';
import { relax } from '../models/filters';

/** Reverse voltage an electrolytic takes without harm (V). */
const REVERSE_OK = 1.5;
/** Voltage above the rating that starts to stress the dielectric (fraction of the rating). */
const OVERVOLTAGE = 1.2;
/** Accumulated stress (severity² · s) at which the part fails. */
const STRESS_FAIL = 5;
/** Recovery of the stress once the voltage is back to normal (s). */
const STRESS_RECOVERY = 30;

/**
 * Capacitor. Transient: companion model of the trapezoidal rule (backward
 * Euler after discontinuities); DC: open circuit. Starts at `ic` volts.
 * Pin a is + when `polarized`.
 *
 * Damage: an electrolytic (`polarized`) with more than 1,5 V reversed, or any
 * capacitor above 1,2× its rated voltage, accumulates stress with the square
 * of the excess; it fails short (an electrolytic bulges) after seconds at a
 * small excess and within a fraction of a second at a large one.
 */
export default defineDevice({
  info: {
    type: 'capacitor',
    label: 'Capacitor',
    terminals: 'two',
    pins: [
      { name: 'a', offset: [0, 0], label: 'terminal a (+ se polarizado)' },
      { name: 'b', offset: [0, 0], label: 'terminal b (− se polarizado, faixa)' },
    ],
    params: {
      capacitance: { default: 1e-6, label: 'Capacitância', unit: 'F', min: 1e-15 },
      voltage: { default: 50, label: 'Tensão nominal', unit: 'V', min: 0.1 },
      polarized: { default: false, label: 'Polarizado (eletrolítico)' },
      ic: { default: 0, label: 'Tensão inicial', unit: 'V' },
    },
    readouts: ['current', 'voltage', 'power', 'charge', 'energy', 'bulged'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão', unit: 'V' },
      power: { label: 'Potência', unit: 'W' },
      charge: { label: 'Carga', unit: 'C' },
      energy: { label: 'Energia armazenada', unit: 'J' },
      bulged: { label: 'Danificado (eletrolítico estufado)' },
    },
  },
  create({ id, params, pins: [a, b] }) {
    let vPrev = num(params, 'ic');
    let iPrev = 0;
    let v = vPrev;
    let i = 0;
    let stress = 0;
    let warned = false;
    let failed = false;
    // Companion model i = g·v − h for the step being solved.
    const companion = (step: { mode: string; dt: number; method: string }) => {
      if (failed) return { g: 1 / R_FAILED_SHORT, h: 0 };
      if (step.mode === 'dc' || step.dt <= 0) return { g: 0, h: 0 };
      const c = num(params, 'capacitance');
      if (step.method === 'be') {
        const g = c / step.dt;
        return { g, h: g * vPrev };
      }
      const g = (2 * c) / step.dt;
      return { g, h: g * vPrev + iPrev };
    };
    /** How far past its limits the capacitor is (0 = safe), and why. */
    const severity = (v: number): { s: number; reverse: boolean } => {
      const rated = num(params, 'voltage');
      const over = Math.max(0, (Math.abs(v) - OVERVOLTAGE * rated) / (0.1 * rated));
      const reverse = bool(params, 'polarized') ? Math.max(0, (-v - REVERSE_OK) / REVERSE_OK) : 0;
      return reverse > over ? { s: reverse, reverse: true } : { s: over, reverse: false };
    };
    return {
      stamp(m, step) {
        const { g, h } = companion(step);
        if (g === 0) return;
        m.conductance(a, b, g);
        m.current(b, a, h);
      },
      stampAc(m, { omega }) {
        if (failed) m.admittance(a, b, 1 / R_FAILED_SHORT);
        else m.admittance(a, b, 0, omega * num(params, 'capacitance'));
      },
      update(step, x, ctx) {
        v = x.v(a) - x.v(b);
        const { g, h } = companion(step);
        i = g * v - h;
        if (!ctx.commit) return;
        vPrev = v;
        iPrev = i;
        if (failed || step.dt <= 0) return;
        const { s, reverse } = severity(v);
        const rated = formatSI(num(params, 'voltage'), 'V');
        if (s > 0) {
          stress += s * s * step.dt;
          if (!warned) {
            warned = true;
            ctx.emit(
              'warning',
              reverse
                ? `O capacitor ${id} está com a polaridade invertida (${formatSI(v, 'V')}): um eletrolítico ao contrário esquenta e estufa.`
                : `O capacitor ${id} está acima da tensão nominal: ${formatSI(Math.abs(v), 'V')}, nominal ${rated}.`,
            );
          }
        } else {
          stress = relax(stress, 0, step.dt, STRESS_RECOVERY);
          if (stress < 0.1) warned = false;
        }
        if (stress >= STRESS_FAIL) {
          failed = true;
          const what = bool(params, 'polarized')
            ? 'estufou e entrou em curto'
            : 'teve o dielétrico perfurado e entrou em curto';
          ctx.emit(
            'damaged',
            `O capacitor ${id} ${what}: tensão de ${formatSI(v, 'V')}, nominal ${rated}${reverse ? ' (polaridade invertida)' : ''}.`,
          );
          ctx.discontinuity();
        }
      },
      pinCurrents(_x, out) {
        out[0] = i;
        out[1] = -i;
      },
      readouts(_x, out) {
        const c = num(params, 'capacitance');
        out('charge', failed ? 0 : c * v);
        out('energy', failed ? 0 : 0.5 * c * v * v);
        out('bulged', failed);
      },
      reset() {
        vPrev = v = num(params, 'ic');
        iPrev = i = 0;
        stress = 0;
        warned = failed = false;
      },
    };
  },
});
