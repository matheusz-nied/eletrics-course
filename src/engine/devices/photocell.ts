import { bool, defineDevice } from '../device';
import { R_OPEN } from '../models/constants';

/** Supply range of the pair (V): below the minimum the receiver does not work. */
const V_MIN = 9;
/** Current the transmitter and receiver draw together at 12 V (A). */
const I_SUPPLY = 0.04;
/** Closed relay contact (Ω). */
const R_CONTACT = 0.05;

/**
 * Safety photocell for gates: an infrared transmitter and a receiver with a
 * relay contact, powered from 12 V (vp, gnd). While the receiver sees the
 * beam, the relay is energized and closes nc–com (the "NF" contact the
 * central reads: beam clear = closed); an obstacle in the beam, a misaligned
 * pair or no supply opens it and closes no–com instead, so a cut wire also
 * reads as an obstacle.
 */
export default defineDevice({
  info: {
    type: 'photocell',
    label: 'Fotocélula',
    terminals: 'fixed',
    pins: [
      { name: 'vp', offset: [-3, -1], label: 'alimentação + (12 V)' },
      { name: 'gnd', offset: [-3, 1], label: 'alimentação − (GND)' },
      { name: 'nc', offset: [3, -2], label: 'contato NF (fechado com o feixe livre)' },
      { name: 'com', offset: [3, 0], label: 'comum do contato' },
      { name: 'no', offset: [3, 2], label: 'contato NA (fechado com o feixe interrompido)' },
    ],
    params: {
      blocked: { default: false, label: 'Obstáculo no feixe' },
      misaligned: { default: false, label: 'Desalinhada (o receptor não vê o transmissor)' },
    },
    readouts: ['beam', 'blocked', 'powered'],
    readoutInfo: {
      beam: { label: 'Receptor vendo o feixe (contato NF fechado)' },
      blocked: { label: 'Feixe interrompido' },
      powered: { label: 'Alimentada' },
    },
  },
  create({ params, pins: [vp, gnd, nc, com, no] }) {
    const gSupply = I_SUPPLY / 12;
    let powered = false;
    let beam = false;
    const sense = () => powered && !bool(params, 'blocked') && !bool(params, 'misaligned');
    const gNc = () => 1 / (beam ? R_CONTACT : R_OPEN);
    const gNo = () => 1 / (beam ? R_OPEN : R_CONTACT);
    let iNc = 0;
    let iNo = 0;
    return {
      stamp(m) {
        m.conductance(vp, gnd, gSupply);
        m.conductance(com, nc, gNc());
        m.conductance(com, no, gNo());
      },
      stampAc(m) {
        m.admittance(vp, gnd, gSupply);
        m.admittance(com, nc, gNc());
        m.admittance(com, no, gNo());
      },
      update(_step, x, ctx) {
        iNc = gNc() * (x.v(com) - x.v(nc));
        iNo = gNo() * (x.v(com) - x.v(no));
        if (!ctx.commit) return;
        powered = x.v(vp) - x.v(gnd) >= V_MIN;
        const now = sense();
        if (now !== beam) {
          beam = now;
          ctx.discontinuity();
        }
      },
      paramChanged() {
        beam = sense();
      },
      pinCurrents(x, out) {
        const supply = gSupply * (x.v(vp) - x.v(gnd));
        out[0] = supply;
        out[1] = -supply;
        out[2] = -iNc;
        out[3] = iNc + iNo;
        out[4] = -iNo;
      },
      readouts(_x, out) {
        out('beam', beam);
        out('blocked', powered && !beam);
        out('powered', powered);
      },
      reset() {
        powered = beam = false;
        iNc = iNo = 0;
      },
    };
  },
});
