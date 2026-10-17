import { defineDevice, num } from '../device';

/** Conductance of the internal gain node (S); the other internal values follow from it. */
const G1 = 1e-6;
/** Output clamp near the rails: conductance (S) and softness (V). */
const G_CLAMP = 1;
const V_SOFT = 0.01;

/** ln(1 + eˣ) without overflow, and its derivative. */
function softplus(x: number): { value: number; slope: number } {
  if (x > 30) return { value: x, slope: 1 };
  const e = Math.exp(x);
  return { value: Math.log1p(e), slope: e / (1 + e) };
}

/**
 * Operational amplifier, behavioural: an input stage with limited current
 * (which sets the slew rate) drives an internal node with the open-loop gain
 * and one pole (from the gain-bandwidth product); the output follows that
 * node through its output resistance and saturates 1,5 V (`headroom`) inside
 * the supply rails, which are parameters (no supply pins). An input offset
 * voltage adds to the differential input.
 */
export default defineDevice({
  info: {
    type: 'opamp',
    label: 'Amplificador operacional',
    terminals: 'fixed',
    pins: [
      { name: 'plus', offset: [-4, 2], label: 'entrada não inversora (+)' },
      { name: 'minus', offset: [-4, -2], label: 'entrada inversora (−)' },
      { name: 'out', offset: [4, 0], label: 'saída' },
    ],
    params: {
      gain: { default: 1e5, label: 'Ganho em malha aberta', min: 10 },
      gbw: { default: 1e6, label: 'Produto ganho-banda', unit: 'Hz', min: 1e3 },
      slewRate: { default: 5e5, label: 'Taxa de subida (slew rate)', unit: 'V/s', min: 1e3 },
      vcc: { default: 12, label: 'Alimentação positiva', unit: 'V' },
      vee: { default: -12, label: 'Alimentação negativa', unit: 'V' },
      headroom: { default: 1.5, label: 'Distância da saída até os trilhos', unit: 'V', min: 0 },
      rout: { default: 75, label: 'Resistência de saída', unit: 'Ω', min: 0.01 },
      // A real input stage is never balanced: this is also what starts an oscillator.
      offset: { default: 0.001, label: 'Tensão de offset na entrada', unit: 'V' },
    },
    readouts: ['vout', 'vd', 'iout', 'saturated'],
    readoutInfo: {
      vout: { label: 'Tensão de saída', unit: 'V' },
      vd: { label: 'Tensão diferencial (+ menos −)', unit: 'V' },
      iout: { label: 'Corrente de saída (fornecida)', unit: 'A' },
      saturated: { label: 'Saturado' },
    },
  },
  create({ params, pins: [plus, minus, output], node, branch }) {
    const n1 = node();
    const br = branch();
    const design = () => {
      const gm = num(params, 'gain') * G1;
      const c1 = gm / (2 * Math.PI * num(params, 'gbw'));
      const vcc = num(params, 'vcc');
      const vee = num(params, 'vee');
      return {
        gm,
        c1,
        imax: num(params, 'slewRate') * c1,
        mid: (vcc + vee) / 2,
        half: Math.max(0.1, (vcc - vee) / 2 - num(params, 'headroom')),
      };
    };
    /** Input stage current into the gain node, and its transconductance. */
    const input = (vd: number, d: ReturnType<typeof design>) => {
      const t = Math.tanh((d.gm * vd) / d.imax);
      return { i: d.imax * t, g: d.gm * (1 - t * t) };
    };
    /** Clamp current out of the gain node beyond the output swing, and its slope. */
    const clamp = (u: number, half: number) => {
      const hi = softplus((u - half) / V_SOFT);
      const lo = softplus((-u - half) / V_SOFT);
      return { i: G_CLAMP * V_SOFT * (hi.value - lo.value), g: G_CLAMP * (hi.slope + lo.slope) };
    };
    let v1Prev = 0;
    let iC1Prev = 0;
    let v1 = 0;
    let iout = 0;
    const capacitor = (step: { mode: string; dt: number; method: string }, c1: number) => {
      if (step.mode === 'dc' || step.dt <= 0) return { g: 0, h: 0 };
      const g = (step.method === 'be' ? 1 : 2) * (c1 / step.dt);
      return { g, h: g * v1Prev + (step.method === 'be' ? 0 : iC1Prev) };
    };
    return {
      nonlinear: true,
      stamp(m, step, x) {
        const d = design();
        const vd = x.v(plus) - x.v(minus);
        const inp = input(vd + num(params, 'offset'), d);
        m.transconductance(-1, n1, plus, minus, inp.g);
        m.current(-1, n1, inp.i - inp.g * vd);
        // Gain node: G1 to the middle of the rails, the pole capacitor, the clamp.
        m.conductance(n1, -1, G1);
        m.current(-1, n1, G1 * d.mid);
        const cap = capacitor(step, d.c1);
        if (cap.g) {
          m.conductance(n1, -1, cap.g);
          m.current(-1, n1, cap.h);
        }
        const u = x.v(n1) - d.mid;
        // Linearize the clamp at most 1 V past the swing, so one iterate cannot run away.
        const limit = d.half + 1;
        const ul = Math.max(-limit, Math.min(limit, u));
        if (ul !== u) step.nl.limited = true;
        const cl = clamp(ul, d.half);
        m.linearized(n1, -1, ul + d.mid, cl.i, cl.g);
        // Output: V(out) − V(n1) − rout·I = 0.
        m.branch(br, output, -1, 0, num(params, 'rout'));
        m.add(br, n1, -1);
      },
      stampAc(m, { omega }, op) {
        const d = design();
        const inp = input(op.v(plus) - op.v(minus) + num(params, 'offset'), d);
        m.transconductance(-1, n1, plus, minus, inp.g);
        const cl = clamp(op.v(n1) - d.mid, d.half);
        m.admittance(n1, -1, G1 + cl.g, omega * d.c1);
        m.branch(br, output, -1, 0, 0, num(params, 'rout'));
        m.add(br, n1, -1);
      },
      update(step, x, ctx) {
        v1 = x.v(n1);
        iout = -x.x[br];
        if (!ctx.commit) return;
        const cap = capacitor(step, design().c1);
        iC1Prev = cap.g * v1 - cap.h;
        v1Prev = v1;
      },
      pinCurrents(_x, out) {
        out[0] = 0;
        out[1] = 0;
        out[2] = -iout;
      },
      readouts(x, out) {
        const d = design();
        out('vout', x.v(output));
        out('vd', x.v(plus) - x.v(minus));
        out('iout', iout);
        out('saturated', Math.abs(v1 - d.mid) > 0.98 * d.half);
      },
      reset() {
        v1Prev = iC1Prev = v1 = iout = 0;
      },
    };
  },
});
