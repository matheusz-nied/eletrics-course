import { defineDevice, num } from '../device';
import { reportHeating } from '../messages';
import { R_OPEN } from '../models/constants';
import { ResistiveHeating } from '../models/heating';

/** Speed below which the load torque fades to zero, so it never drives the motor (rad/s). */
const LOAD_SMOOTHING = 0.05;
/** Thermal time constant of a small motor's winding (s). */
const THERMAL_TAU = 60;

/**
 * Permanent-magnet DC motor. Electrical side: V = R·i + L·di/dt + Ke·ω.
 * Mechanical side: J·dω/dt = Kt·i − b·ω − load, with the load torque always
 * opposing the rotation. The speed is an unknown of the circuit, so the
 * electrical and mechanical sides are solved together (stable at any step).
 * A stalled motor takes R-limited current and its winding heats: past the
 * rated current for long it warns, and much past it the winding burns open.
 */
export default defineDevice({
  info: {
    type: 'dc-motor',
    label: 'Motor CC',
    terminals: 'two',
    pins: [
      { name: 'a', offset: [0, 0], label: 'terminal + (gira no sentido positivo)' },
      { name: 'b', offset: [0, 0], label: 'terminal −' },
    ],
    params: {
      resistance: { default: 2, label: 'Resistência do enrolamento', unit: 'Ω', min: 1e-3 },
      inductance: { default: 0.002, label: 'Indutância do enrolamento', unit: 'H', min: 1e-7 },
      ke: {
        default: 0.02,
        label: 'Constante de força contraeletromotriz Ke',
        unit: 'V·s/rad',
        min: 1e-5,
      },
      kt: { default: 0.02, label: 'Constante de torque Kt', unit: 'N·m/A', min: 1e-5 },
      inertia: { default: 1e-5, label: 'Inércia do rotor e da carga', unit: 'kg·m²', min: 1e-9 },
      friction: { default: 1e-5, label: 'Atrito viscoso', unit: 'N·m·s/rad', min: 0 },
      load: { default: 0, label: 'Torque da carga', unit: 'N·m', min: 0 },
      ratedCurrent: { default: 1, label: 'Corrente nominal', unit: 'A', min: 1e-3 },
    },
    readouts: ['current', 'voltage', 'power', 'rpm', 'speed', 'torque', 'temperature', 'burned'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão', unit: 'V' },
      power: { label: 'Potência elétrica', unit: 'W' },
      rpm: { label: 'Rotação', unit: 'rpm' },
      speed: { label: 'Velocidade angular', unit: 'rad/s' },
      torque: { label: 'Torque do motor', unit: 'N·m' },
      temperature: { label: 'Temperatura do enrolamento', unit: '°C' },
      burned: { label: 'Queimado (enrolamento aberto)' },
    },
  },
  create({ id, params, pins: [a, b], branch }) {
    const br = branch(); // winding current a → b
    const w = branch(); // angular speed (rad/s)
    const heat = new ResistiveHeating(
      () => num(params, 'resistance') * num(params, 'ratedCurrent') ** 2,
      THERMAL_TAU,
    );
    const r = () => (heat.burned ? R_OPEN : num(params, 'resistance'));
    // Load torque, opposing the rotation, smoothed through zero speed.
    const load = (omega: number) => {
      const t = Math.tanh(omega / LOAD_SMOOTHING);
      const l = num(params, 'load');
      return { torque: l * t, slope: (l * (1 - t * t)) / LOAD_SMOOTHING };
    };
    let i0 = 0;
    let w0 = 0;
    let eL0 = 0; // L·di/dt at the last step
    let tq0 = 0; // J·dω/dt at the last step
    let i = 0;
    let omega = 0;
    return {
      nonlinear: true,
      stamp(m, step, x) {
        const ke = num(params, 'ke');
        const kt = num(params, 'kt');
        const l = num(params, 'inductance');
        const j = num(params, 'inertia');
        const fr = num(params, 'friction');
        const dc = step.mode === 'dc';
        const dt = step.dt > 0 ? step.dt : 1e-9;
        const k = dc ? 0 : step.method === 'be' ? 1 / dt : 2 / dt;
        const trap = !dc && step.method === 'trap';
        // Electrical: V(a) − V(b) − (R + k·L)·i − Ke·ω = −k·L·i0 − eL0.
        m.branch(br, a, b, -k * l * i0 - (trap ? eL0 : 0), r() + k * l);
        m.add(br, w, -ke);
        // Mechanical: (k·J + b)·ω + load(ω) − Kt·i = k·J·ω0 + T0.
        const ld = load(x.x[w]);
        m.add(w, w, k * j + fr + ld.slope);
        m.add(w, br, -kt);
        m.addRhs(w, k * j * w0 + (trap ? tq0 : 0) - (ld.torque - ld.slope * x.x[w]));
      },
      stampAc(m, { omega: wAc }, op) {
        m.branch(br, a, b, 0, 0, r(), wAc * num(params, 'inductance'));
        m.add(br, w, -num(params, 'ke'));
        m.add(w, w, num(params, 'friction') + load(op.x[w]).slope, wAc * num(params, 'inertia'));
        m.add(w, br, -num(params, 'kt'));
      },
      update(step, x, ctx) {
        i = x.x[br];
        omega = x.x[w];
        if (!ctx.commit) return;
        if (step.mode === 'dc') {
          eL0 = tq0 = 0;
        } else {
          eL0 = x.v(a) - x.v(b) - r() * i - num(params, 'ke') * omega;
          tq0 = num(params, 'kt') * i - num(params, 'friction') * omega - load(omega).torque;
        }
        i0 = i;
        w0 = omega;
        reportHeating(
          ctx,
          heat.step(r() * i * i, step.dt),
          `O motor ${id}`,
          heat.power,
          num(params, 'resistance') * num(params, 'ratedCurrent') ** 2,
          'e o enrolamento abriu',
        );
      },
      pinCurrents(_x, out) {
        out[0] = i;
        out[1] = -i;
      },
      readouts(_x, out) {
        out('rpm', (omega * 60) / (2 * Math.PI));
        out('speed', omega);
        out('torque', num(params, 'kt') * i);
        out('temperature', heat.temperature);
        out('burned', heat.burned);
      },
      reset() {
        heat.reset();
        i0 = w0 = eL0 = tq0 = i = omega = 0;
      },
    };
  },
});
