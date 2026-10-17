import { defineDevice, num, TWO_PINS } from '../device';

/**
 * Light-dependent resistor (LDR): R = R10·(lux/10)^(−γ), limited by the dark
 * resistance. The light level is a parameter, usually a slider.
 */
export default defineDevice({
  info: {
    type: 'ldr',
    label: 'LDR (resistor dependente de luz)',
    terminals: 'two',
    pins: TWO_PINS,
    params: {
      lux: { default: 100, label: 'Luz sobre o LDR', unit: 'lx', min: 0, max: 100000 },
      r10: { default: 20000, label: 'Resistência a 10 lx', unit: 'Ω', min: 1 },
      gamma: { default: 0.7, label: 'Expoente γ', min: 0.1, max: 2 },
      rDark: { default: 1e6, label: 'Resistência no escuro', unit: 'Ω', min: 1 },
    },
    readouts: ['current', 'voltage', 'power', 'resistance', 'lux'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão', unit: 'V' },
      power: { label: 'Potência', unit: 'W' },
      resistance: { label: 'Resistência', unit: 'Ω' },
      lux: { label: 'Luz', unit: 'lx' },
    },
  },
  create({ params, pins: [a, b] }) {
    const resistance = () => {
      const lux = num(params, 'lux');
      const dark = num(params, 'rDark');
      if (lux <= 0) return dark;
      return Math.min(dark, num(params, 'r10') * Math.pow(lux / 10, -num(params, 'gamma')));
    };
    return {
      stamp(m) {
        m.conductance(a, b, 1 / resistance());
      },
      stampAc(m) {
        m.admittance(a, b, 1 / resistance());
      },
      pinCurrents(x, out) {
        out[0] = (x.v(a) - x.v(b)) / resistance();
        out[1] = -out[0];
      },
      readouts(_x, out) {
        out('resistance', resistance());
        out('lux', num(params, 'lux'));
      },
    };
  },
});
