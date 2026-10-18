import { defineDevice, num } from '../device';
import { formatSI, reportHeating } from '../messages';
import { R_OPEN } from '../models/constants';
import { relax } from '../models/filters';
import { ResistiveHeating } from '../models/heating';
import { Winding } from '../models/winding';

/** Resistance of a closed relay contact (Ω). */
const R_CONTACT = 0.02;
/** The armature pulls in at 75 % of the rated coil voltage and drops out below 10 %. */
const PULL_IN = 0.75;
const DROP_OUT = 0.1;
/** Eddy currents and core losses, as a resistance across the coil (multiple of its resistance). */
const R_LOSS_FACTOR = 50;
/** Thermal time of the contacts: how fast an overcurrent welds them (s). */
const CONTACT_TAU = 0.5;
/** The contacts weld when their filtered current reaches this multiple of the rating. */
const K_WELD = 3;

/**
 * Relay with one changeover contact. The coil is its resistance and
 * inductance (so it takes a few milliseconds to build up current, and
 * produces a voltage spike when switched off without a diode); the armature
 * pulls in above 75 % of the rated coil current and drops out below 10 %,
 * then travels for `travelTime` with both contacts open (break before make).
 * Too much contact current welds the contact closed; too much coil voltage
 * burns the coil.
 */
export default defineDevice({
  info: {
    type: 'relay-spdt',
    label: 'Relé (1 contato reversível)',
    terminals: 'fixed',
    pins: [
      { name: 'coil1', offset: [-2, -2], label: 'bobina' },
      { name: 'coil2', offset: [-2, 2], label: 'bobina' },
      { name: 'com', offset: [2, 2], label: 'comum (C)' },
      { name: 'nc', offset: [1, -2], label: 'normalmente fechado (NF)' },
      { name: 'no', offset: [3, -2], label: 'normalmente aberto (NA)' },
    ],
    params: {
      coilVoltage: { default: 12, label: 'Tensão nominal da bobina', unit: 'V', min: 1 },
      coilResistance: { default: 400, label: 'Resistência da bobina', unit: 'Ω', min: 1 },
      coilInductance: { default: 0.15, label: 'Indutância da bobina', unit: 'H', min: 1e-6 },
      travelTime: { default: 0.004, label: 'Tempo de curso da armadura', unit: 's', min: 1e-4 },
      contactRating: { default: 10, label: 'Corrente máxima dos contatos', unit: 'A', min: 0.01 },
    },
    readouts: ['closed', 'energized', 'position', 'coilCurrent', 'coilVoltage', 'welded', 'burned'],
    readoutInfo: {
      closed: { label: 'Contato NA fechado' },
      energized: { label: 'Bobina atraindo a armadura' },
      position: { label: 'Posição da armadura (0 = repouso, 1 = atracada)' },
      coilCurrent: { label: 'Corrente na bobina', unit: 'A' },
      coilVoltage: { label: 'Tensão na bobina', unit: 'V' },
      welded: { label: 'Contato colado (soldado)' },
      burned: { label: 'Bobina queimada' },
    },
  },
  create({ id, params, pins: [c1, c2, com, nc, no], branch }) {
    const coil = new Winding(branch(), c1, c2);
    const coilHeat = new ResistiveHeating(
      () => num(params, 'coilVoltage') ** 2 / num(params, 'coilResistance'),
    );
    let position = 0;
    let energized = false;
    let welded = false;
    let contactHeat = 0;
    let iNc = 0;
    let iNo = 0;
    const rCoil = () => (coilHeat.burned ? R_OPEN : num(params, 'coilResistance'));
    const gLoss = () => 1 / (R_LOSS_FACTOR * num(params, 'coilResistance'));
    const ratedCurrent = () => num(params, 'coilVoltage') / num(params, 'coilResistance');
    const noClosed = () => welded || position >= 1;
    const ncClosed = () => !welded && position <= 0;
    const gNo = () => 1 / (noClosed() ? R_CONTACT : R_OPEN);
    const gNc = () => 1 / (ncClosed() ? R_CONTACT : R_OPEN);
    return {
      stamp(m, step) {
        coil.stamp(m, step, num(params, 'coilInductance'), rCoil());
        m.conductance(c1, c2, gLoss());
        m.conductance(com, nc, gNc());
        m.conductance(com, no, gNo());
      },
      stampAc(m, { omega }) {
        coil.stampAc(m, omega, num(params, 'coilInductance'), rCoil());
        m.admittance(c1, c2, gLoss());
        m.admittance(com, nc, gNc());
        m.admittance(com, no, gNo());
      },
      update(step, x, ctx) {
        coil.update(x, ctx.commit);
        iNc = gNc() * (x.v(com) - x.v(nc));
        iNo = gNo() * (x.v(com) - x.v(no));
        if (!ctx.commit || step.dt <= 0) return;
        const vCoil = x.v(c1) - x.v(c2);
        reportHeating(
          ctx,
          coilHeat.step(vCoil * coil.current, step.dt),
          `A bobina do relé ${id}`,
          coilHeat.power,
          num(params, 'coilVoltage') ** 2 / num(params, 'coilResistance'),
          'e abriu',
        );
        const i = Math.abs(coil.current);
        if (!energized && i >= PULL_IN * ratedCurrent()) energized = true;
        else if (energized && i <= DROP_OUT * ratedCurrent()) energized = false;
        const before = [noClosed(), ncClosed()];
        const travel = step.dt / num(params, 'travelTime');
        position = energized ? Math.min(1, position + travel) : Math.max(0, position - travel);
        // Contacts: heating with the square of the current; too much welds them shut.
        const ic = Math.max(Math.abs(iNc), Math.abs(iNo));
        contactHeat = relax(contactHeat, ic * ic, step.dt, CONTACT_TAU);
        const rating = num(params, 'contactRating');
        if (!welded && noClosed() && contactHeat >= (K_WELD * rating) ** 2) {
          welded = true;
          ctx.emit(
            'damaged',
            `O contato do relé ${id} colou (soldou): corrente de ${formatSI(ic, 'A')}, máximo ${formatSI(rating, 'A')}.`,
          );
        }
        if (before[0] !== noClosed() || before[1] !== ncClosed()) ctx.discontinuity();
      },
      pinCurrents(x, out) {
        const iLoss = gLoss() * (x.v(c1) - x.v(c2));
        out[0] = coil.current + iLoss;
        out[1] = -out[0];
        out[2] = iNc + iNo;
        out[3] = -iNc;
        out[4] = -iNo;
      },
      readouts(x, out) {
        out('closed', noClosed());
        out('energized', energized);
        out('position', position);
        out('coilCurrent', coil.current);
        out('coilVoltage', x.v(c1) - x.v(c2));
        out('welded', welded);
        out('burned', coilHeat.burned);
      },
      reset() {
        coil.reset();
        coilHeat.reset();
        position = contactHeat = iNc = iNo = 0;
        energized = welded = false;
      },
    };
  },
});
