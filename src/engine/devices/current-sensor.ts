import { acSquared, defineDevice, num } from '../device';
import { relax } from '../models/filters';

/** Shunt in the measured path (Ω). */
const R_SHUNT = 0.002;
/** Output resistance of the amplifier (Ω). */
const R_OUT = 100;

/**
 * Current sensor with an RMS converter, like the one on a gate central's
 * motor common: the current through a–b (a shunt) becomes a DC voltage
 * between out and gnd of `gain` volts per ampere RMS, smoothed over `tau`
 * and limited to the full scale. Works with DC, with AC in a transient run
 * (true RMS of the samples) and with phasors in the quasi-static analysis.
 */
export default defineDevice({
  info: {
    type: 'current-sensor',
    label: 'Sensor de corrente',
    terminals: 'fixed',
    pins: [
      { name: 'a', offset: [-3, -1], label: 'entrada da corrente medida' },
      { name: 'b', offset: [3, -1], label: 'saída da corrente medida' },
      { name: 'out', offset: [-1, 2], label: 'saída de tensão' },
      { name: 'gnd', offset: [1, 2], label: 'referência da saída (GND)' },
    ],
    params: {
      gain: { default: 0.5, label: 'Sensibilidade', unit: 'V/A', min: 1e-4 },
      range: { default: 10, label: 'Fundo de escala', unit: 'A', min: 0.01 },
      tau: { default: 0.05, label: 'Tempo de resposta', unit: 's', min: 1e-4 },
    },
    readouts: ['measured', 'output'],
    readoutInfo: {
      measured: { label: 'Corrente medida (eficaz)', unit: 'A' },
      output: { label: 'Tensão de saída', unit: 'V' },
    },
  },
  create({ params, pins: [a, b, out, gnd] }) {
    let i = 0;
    let squared = 0;
    const output = () => num(params, 'gain') * Math.min(Math.sqrt(squared), num(params, 'range'));
    return {
      stamp(m) {
        m.conductance(a, b, 1 / R_SHUNT);
        m.conductance(out, gnd, 1 / R_OUT);
        m.current(gnd, out, output() / R_OUT);
      },
      stampAc(m) {
        m.admittance(a, b, 1 / R_SHUNT);
        m.admittance(out, gnd, 1 / R_OUT);
      },
      update(step, x, ctx) {
        i = (x.v(a) - x.v(b)) / R_SHUNT;
        if (!ctx.commit || step.dt <= 0) return;
        squared = relax(squared, i * i + acSquared(step, 0), step.dt, num(params, 'tau'));
      },
      pinCurrents(x, o) {
        const io = (x.v(out) - x.v(gnd)) / R_OUT - output() / R_OUT;
        o[0] = i;
        o[1] = -i;
        o[2] = io;
        o[3] = -io;
      },
      readouts(_x, o) {
        o('measured', Math.sqrt(squared));
        o('output', output());
      },
      reset() {
        i = squared = 0;
      },
    };
  },
});
