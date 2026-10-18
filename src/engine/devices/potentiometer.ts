import { defineDevice, num, str } from '../device';
import { formatSI } from '../messages';
import { R_OPEN } from '../models/constants';
import { ResistiveHeating } from '../models/heating';

/** Smallest track resistance at the end stops (Ω): the wiper never reaches zero. */
const R_END = 0.01;

/**
 * Potentiometer: a resistive track between a and b with the wiper w at
 * `position` (0 = at a, 1 = at b). Each part of the track heats with the
 * share of the rating its length allows, so a wiper near the end that carries
 * too much current burns the track, as on real pots.
 */
export default defineDevice({
  info: {
    type: 'potentiometer',
    label: 'Potenciômetro',
    terminals: 'fixed',
    pins: [
      { name: 'a', offset: [-4, 0], label: 'extremo A' },
      { name: 'w', offset: [0, -3], label: 'cursor' },
      { name: 'b', offset: [4, 0], label: 'extremo B' },
    ],
    params: {
      resistance: { default: 10000, label: 'Resistência total', unit: 'Ω', min: 1 },
      position: { default: 0.5, label: 'Posição do cursor', min: 0, max: 1 },
      taper: {
        default: 'linear',
        label: 'Curva',
        options: [
          { value: 'linear', label: 'Linear (B)' },
          { value: 'log', label: 'Logarítmica (A)' },
        ],
      },
      watts: { default: 0.5, label: 'Potência nominal', unit: 'W', min: 0.01 },
    },
    readouts: ['position', 'resistanceAw', 'resistanceWb', 'power', 'burned'],
    readoutInfo: {
      position: { label: 'Posição do cursor' },
      resistanceAw: { label: 'Resistência A–cursor', unit: 'Ω' },
      resistanceWb: { label: 'Resistência cursor–B', unit: 'Ω' },
      power: { label: 'Potência dissipada', unit: 'W' },
      burned: { label: 'Queimado' },
    },
  },
  create({ id, params, pins: [a, w, b] }) {
    const fraction = () => {
      const p = Math.min(1, Math.max(0, num(params, 'position')));
      return str(params, 'taper') === 'log' ? (Math.pow(10, 2 * p) - 1) / 99 : p;
    };
    const share = (f: number) => num(params, 'watts') * Math.max(f, 0.02);
    const heatAw = new ResistiveHeating(() => share(fraction()));
    const heatWb = new ResistiveHeating(() => share(1 - fraction()));
    const burned = () => heatAw.burned || heatWb.burned;
    const rAw = () => (burned() ? R_OPEN : Math.max(num(params, 'resistance') * fraction(), R_END));
    const rWb = () =>
      burned() ? R_OPEN : Math.max(num(params, 'resistance') * (1 - fraction()), R_END);
    let iAw = 0;
    let iWb = 0;
    return {
      stamp(m) {
        m.conductance(a, w, 1 / rAw());
        m.conductance(w, b, 1 / rWb());
      },
      stampAc(m) {
        m.admittance(a, w, 1 / rAw());
        m.admittance(w, b, 1 / rWb());
      },
      update(step, x, ctx) {
        iAw = (x.v(a) - x.v(w)) / rAw();
        iWb = (x.v(w) - x.v(b)) / rWb();
        if (!ctx.commit) return;
        const pAw = iAw * iAw * rAw();
        const pWb = iWb * iWb * rWb();
        const rAwResult = heatAw.step(pAw, step.dt);
        const rWbResult = heatWb.step(pWb, step.dt);
        if (rAwResult === 'ok' && rWbResult === 'ok') return;
        const power = formatSI(heatAw.power + heatWb.power, 'W');
        if (rAwResult === 'burned' || rWbResult === 'burned') {
          ctx.emit(
            'damaged',
            `O potenciômetro ${id} queimou: a pista dissipava ${power} num trecho curto. Use um resistor em série com o cursor.`,
          );
          ctx.discontinuity();
        } else if (rAwResult === 'hot' || rWbResult === 'hot') {
          ctx.emit('warning', `O potenciômetro ${id} está esquentando demais (${power}).`);
        }
      },
      pinCurrents(_x, out) {
        out[0] = iAw;
        out[1] = iWb - iAw;
        out[2] = -iWb;
      },
      readouts(_x, out) {
        out('position', num(params, 'position'));
        out('resistanceAw', num(params, 'resistance') * fraction());
        out('resistanceWb', num(params, 'resistance') * (1 - fraction()));
        out('power', iAw * iAw * rAw() + iWb * iWb * rWb());
        out('burned', burned());
      },
      reset() {
        heatAw.reset();
        heatWb.reset();
        iAw = iWb = 0;
      },
    };
  },
});
