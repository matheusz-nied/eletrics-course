import { defineDevice, num } from '../device';
import { DiodeCore } from '../models/diode';

/** Fraction of the rated current at which the internal oscillator starts. */
const START = 0.3;

/**
 * Active buzzer (with its own oscillator): polarized, draws about its rated
 * current at its rated voltage and sounds above roughly a third of it.
 * Electrically a diode in series with a resistance.
 */
export default defineDevice({
  info: {
    type: 'buzzer',
    label: 'Buzzer ativo',
    terminals: 'two',
    pins: [
      { name: 'a', offset: [0, 0], label: 'positivo (+, perna longa)' },
      { name: 'b', offset: [0, 0], label: 'negativo (−)' },
    ],
    params: {
      voltage: { default: 5, label: 'Tensão nominal', unit: 'V', min: 1 },
      current: { default: 0.025, label: 'Corrente nominal', unit: 'A', min: 1e-4 },
      frequency: { default: 2700, label: 'Frequência do som', unit: 'Hz', min: 20, max: 20000 },
    },
    readouts: ['current', 'voltage', 'power', 'sounding', 'loudness', 'frequency'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão', unit: 'V' },
      power: { label: 'Potência', unit: 'W' },
      sounding: { label: 'Apitando' },
      loudness: { label: 'Volume (1 = nominal)' },
      frequency: { label: 'Frequência do som', unit: 'Hz' },
    },
  },
  create({ params, pins: [a, b], node }) {
    const core = new DiodeCore(a, b, node);
    const configure = () =>
      core.configure({
        is: 1e-14,
        n: 1,
        rs: Math.max(1, (num(params, 'voltage') - 0.65) / num(params, 'current')),
      });
    configure();
    const loudness = () => Math.max(0, core.current) / num(params, 'current');
    return {
      nonlinear: true,
      beginSolve: () => core.begin(),
      stamp: (m, step, x) => core.stamp(m, step.nl, x),
      stampAc: (m, _ctx, op) => core.stampAc(m, op),
      update: (_step, x, ctx) => core.update(x, ctx.commit),
      pinCurrents(_x, out) {
        out[0] = core.current;
        out[1] = -core.current;
      },
      readouts(_x, out) {
        out('sounding', loudness() >= START);
        out('loudness', loudness() >= START ? Math.min(loudness(), 1.5) : 0);
        out('frequency', num(params, 'frequency'));
      },
      paramChanged: configure,
      reset: () => core.reset(),
    };
  },
});
