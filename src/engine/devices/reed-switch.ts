import { bool, defineDevice, num, str, TWO_PINS } from '../device';
import { R_OPEN } from '../models/constants';
import type { Track } from '../models/mechanics';

/** Resistance of the closed reed contact (Ω). */
const R_REED = 0.1;

/**
 * Reed switch: a contact sealed in glass that closes near a magnet. Alone it
 * follows `closed` ("ímã perto", a control). Coupled to a gate (`gate` =
 * "G1"), it closes while the gate is within `zone` of `magnet`, the position
 * of the magnet on the rack: a limit switch. `defective` keeps it open.
 */
export default defineDevice({
  info: {
    type: 'reed-switch',
    label: 'Reed switch',
    terminals: 'two',
    pins: TWO_PINS,
    params: {
      closed: { default: false, label: 'Ímã perto (sem portão acoplado)' },
      gate: { default: '', label: 'Portão que leva o ímã (id)' },
      magnet: { default: 0, label: 'Posição do ímã no portão', unit: 'm', min: 0 },
      zone: { default: 0.03, label: 'Distância de acionamento', unit: 'm', min: 0.001, max: 0.5 },
      defective: { default: false, label: 'Com defeito (não fecha)' },
    },
    readouts: ['current', 'voltage', 'power', 'closed'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão', unit: 'V' },
      power: { label: 'Potência', unit: 'W' },
      closed: { label: 'Contato fechado' },
    },
  },
  links: { gate: ['gate-mechanics'] },
  create({ params, pins: [a, b] }) {
    let track: Track | undefined;
    const sense = () => {
      if (bool(params, 'defective')) return false;
      if (!track) return bool(params, 'closed');
      return Math.abs(track.position - num(params, 'magnet')) <= num(params, 'zone');
    };
    let closed = sense();
    const g = () => 1 / (closed ? R_REED : R_OPEN);
    let current = 0;
    return {
      couple(find) {
        const name = str(params, 'gate');
        if (!name) return undefined;
        track = find(name)?.exposes?.track;
        closed = sense();
        return track ? undefined : `"gate" = "${name}" não é um portão`;
      },
      stamp(m) {
        m.conductance(a, b, g());
      },
      stampAc(m) {
        m.admittance(a, b, g());
      },
      update(_step, x, ctx) {
        current = g() * (x.v(a) - x.v(b));
        if (!ctx.commit) return;
        const now = sense();
        if (now !== closed) {
          closed = now;
          ctx.discontinuity();
        }
      },
      paramChanged() {
        closed = sense();
      },
      pinCurrents(_x, out) {
        out[0] = current;
        out[1] = -current;
      },
      readouts(_x, out) {
        out('closed', closed);
      },
      reset() {
        closed = sense();
        current = 0;
      },
    };
  },
});
