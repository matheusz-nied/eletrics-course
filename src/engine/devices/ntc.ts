import { defineDevice, num, TWO_PINS } from '../device';
import { KELVIN } from '../models/constants';
import { relax } from '../models/filters';

/**
 * NTC thermistor, Beta model: R = R25·e^(B·(1/T − 1/298,15 K)). Its body is
 * at the surrounding temperature (a parameter, usually a slider) plus its own
 * heating: the dissipated power over the dissipation constant, with a
 * thermal time constant.
 */
export default defineDevice({
  info: {
    type: 'ntc',
    label: 'Termistor NTC',
    terminals: 'two',
    pins: TWO_PINS,
    params: {
      temperature: {
        default: 25,
        label: 'Temperatura do ambiente',
        unit: '°C',
        min: -55,
        max: 300,
      },
      r25: { default: 10000, label: 'Resistência a 25 °C', unit: 'Ω', min: 1 },
      beta: { default: 3950, label: 'Constante B', unit: 'K', min: 100 },
      dissipation: { default: 0.002, label: 'Constante de dissipação', unit: 'W/K', min: 1e-5 },
      thermalTime: { default: 10, label: 'Constante de tempo térmica', unit: 's', min: 0.01 },
    },
    readouts: ['current', 'voltage', 'power', 'resistance', 'temperature'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão', unit: 'V' },
      power: { label: 'Potência', unit: 'W' },
      resistance: { label: 'Resistência', unit: 'Ω' },
      temperature: { label: 'Temperatura do termistor', unit: '°C' },
    },
  },
  create({ params, pins: [a, b] }) {
    let rise = 0;
    let current = 0;
    const temperature = () => num(params, 'temperature') + rise;
    const resistance = () =>
      num(params, 'r25') *
      Math.exp(num(params, 'beta') * (1 / (temperature() + KELVIN) - 1 / (25 + KELVIN)));
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
        const target = (v * current) / num(params, 'dissipation');
        rise = relax(rise, target, step.dt, num(params, 'thermalTime'));
      },
      pinCurrents(_x, out) {
        out[0] = current;
        out[1] = -current;
      },
      readouts(_x, out) {
        out('resistance', resistance());
        out('temperature', temperature());
      },
      reset() {
        rise = current = 0;
      },
    };
  },
});
