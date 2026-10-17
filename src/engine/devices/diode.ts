import { defineDevice, num, str } from '../device';
import { reportHeating } from '../messages';
import { DiodeCore } from '../models/diode';
import { JunctionHeating } from '../models/heating';

interface DiodeModel {
  label: string;
  is: number;
  n: number;
  rs: number;
  bv: number;
  ibv: number;
  power: number;
}

/** Typical SPICE parameters of common diodes (no junction capacitance). */
const MODELS: Record<string, DiodeModel> = {
  signal: {
    label: 'Sinal (tipo 1N4148)',
    is: 2.52e-9,
    n: 1.752,
    rs: 0.568,
    bv: 100,
    ibv: 1e-7,
    power: 0.5,
  },
  rectifier: {
    label: 'Retificador (tipo 1N4007)',
    is: 7.03e-9,
    n: 1.808,
    rs: 0.0342,
    bv: 1000,
    ibv: 5e-6,
    power: 1.5,
  },
  schottky: {
    label: 'Schottky (tipo 1N5819)',
    is: 3.17e-5,
    n: 1.373,
    rs: 0.051,
    bv: 40,
    ibv: 1e-3,
    power: 1.25,
  },
};

/**
 * Diode (Shockley equation with series resistance and reverse breakdown).
 * Too much power heats the junction past 150 °C (warning); at about twice
 * the rating, sustained, it fails short, as real silicon diodes do.
 */
export default defineDevice({
  info: {
    type: 'diode',
    label: 'Diodo',
    terminals: 'two',
    pins: [
      { name: 'a', offset: [0, 0], label: 'ânodo' },
      { name: 'b', offset: [0, 0], label: 'cátodo (faixa)' },
    ],
    params: {
      model: {
        default: 'rectifier',
        label: 'Modelo',
        options: Object.entries(MODELS).map(([value, m]) => ({ value, label: m.label })),
      },
      is: { default: 0, label: 'Corrente de saturação Is (0 = do modelo)', unit: 'A', min: 0 },
      n: { default: 0, label: 'Coeficiente de emissão n (0 = do modelo)', min: 0, max: 4 },
      rs: { default: 0, label: 'Resistência série (0 = do modelo)', unit: 'Ω', min: 0 },
      bv: { default: 0, label: 'Tensão de ruptura reversa (0 = do modelo)', unit: 'V', min: 0 },
      power: { default: 0, label: 'Potência máxima (0 = do modelo)', unit: 'W', min: 0 },
    },
    readouts: ['current', 'voltage', 'power', 'temperature', 'burned'],
    readoutInfo: {
      current: { label: 'Corrente (ânodo → cátodo)', unit: 'A' },
      voltage: { label: 'Tensão direta', unit: 'V' },
      power: { label: 'Potência dissipada', unit: 'W' },
      temperature: { label: 'Temperatura da junção', unit: '°C' },
      burned: { label: 'Queimado (em curto)' },
    },
  },
  create({ id, params, pins: [a, k], node }) {
    const model = () => MODELS[str(params, 'model')] ?? MODELS.rectifier;
    const pick = (name: 'is' | 'n' | 'rs' | 'bv' | 'power') => num(params, name) || model()[name];
    const diode = new DiodeCore(a, k, node);
    const configure = () =>
      diode.configure({
        is: pick('is'),
        n: pick('n'),
        rs: pick('rs'),
        bv: pick('bv'),
        ibv: model().ibv,
      });
    configure();
    const heat = new JunctionHeating(() => pick('power'));
    return {
      nonlinear: true,
      beginSolve: () => diode.begin(),
      stamp: (m, step, x) => diode.stamp(m, step.nl, x),
      stampAc: (m, _ctx, op) => diode.stampAc(m, op),
      update(step, x, ctx) {
        diode.update(x, ctx.commit);
        if (!ctx.commit) return;
        const result = heat.step(diode.current * diode.voltage, step.dt);
        if (result === 'burned') diode.failure = 'short';
        reportHeating(ctx, result, `O diodo ${id}`, heat.power, pick('power'), 'e entrou em curto');
      },
      pinCurrents(_x, out) {
        out[0] = diode.current;
        out[1] = -diode.current;
      },
      readouts(_x, out) {
        out('temperature', heat.temperature);
        out('burned', diode.failure === 'short');
      },
      paramChanged: configure,
      reset() {
        diode.reset();
        heat.reset();
      },
    };
  },
});
