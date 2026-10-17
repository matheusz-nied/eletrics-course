import { defineDevice, num } from '../device';
import { reportHeating } from '../messages';
import { DiodeCore } from '../models/diode';
import { JunctionHeating } from '../models/heating';

/** Test current at which the zener voltage is specified (A). */
const I_TEST = 5e-3;

/**
 * Zener diode: a silicon diode that conducts in reverse at its zener voltage
 * (specified at 5 mA). Above its power rating the junction overheats; at
 * about twice the rating it fails short.
 */
export default defineDevice({
  info: {
    type: 'zener',
    label: 'Diodo zener',
    terminals: 'two',
    pins: [
      { name: 'a', offset: [0, 0], label: 'ânodo' },
      { name: 'b', offset: [0, 0], label: 'cátodo (faixa)' },
    ],
    params: {
      voltage: { default: 5.1, label: 'Tensão zener (a 5 mA)', unit: 'V', min: 1, max: 200 },
      power: { default: 0.5, label: 'Potência máxima', unit: 'W', min: 0.01 },
    },
    readouts: ['current', 'voltage', 'power', 'temperature', 'burned'],
    readoutInfo: {
      current: { label: 'Corrente (ânodo → cátodo; negativa na ruptura)', unit: 'A' },
      voltage: { label: 'Tensão ânodo − cátodo', unit: 'V' },
      power: { label: 'Potência dissipada', unit: 'W' },
      temperature: { label: 'Temperatura da junção', unit: '°C' },
      burned: { label: 'Queimado (em curto)' },
    },
  },
  create({ id, params, pins: [a, k], node }) {
    const zener = new DiodeCore(a, k, node);
    const configure = () =>
      zener.configure({ is: 1e-14, n: 1, rs: 2, bv: num(params, 'voltage'), ibv: I_TEST });
    configure();
    const heat = new JunctionHeating(() => num(params, 'power'));
    return {
      nonlinear: true,
      beginSolve: () => zener.begin(),
      stamp: (m, step, x) => zener.stamp(m, step.nl, x),
      stampAc: (m, _ctx, op) => zener.stampAc(m, op),
      update(step, x, ctx) {
        zener.update(x, ctx.commit);
        if (!ctx.commit) return;
        const result = heat.step(zener.current * zener.voltage, step.dt);
        if (result === 'burned') zener.failure = 'short';
        const rating = num(params, 'power');
        reportHeating(ctx, result, `O zener ${id}`, heat.power, rating, 'e entrou em curto');
      },
      pinCurrents(_x, out) {
        out[0] = zener.current;
        out[1] = -zener.current;
      },
      readouts(_x, out) {
        out('temperature', heat.temperature);
        out('burned', zener.failure === 'short');
      },
      paramChanged: configure,
      reset() {
        zener.reset();
        heat.reset();
      },
    };
  },
});
