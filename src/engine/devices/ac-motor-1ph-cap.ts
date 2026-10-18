import { defineDevice, num, type PhasorView } from '../device';
import { formatNumber } from '../messages';
import { AMBIENT_C, R_OPEN } from '../models/constants';
import {
  twoPhase,
  twoPhaseCurrents,
  twoPhaseTorque,
  type Complex,
  type EquivalentCircuit,
} from '../models/induction';
import { implicitStep, type Shaft } from '../models/mechanics';

/**
 * Equivalent circuit of the reference motor, per winding at 60 Hz: 1/3 CV
 * (250 W), 127 V, as used in sliding gate operators. It gives about 1,3 A
 * running light, 5,5 A locked, a breakdown torque of 1,8 N·m and a starting
 * torque of 0,6 N·m with a 25 µF capacitor. Other ratings scale the
 * impedances with V²/P (a 220 V motor takes a third of the capacitance).
 */
const REF = { voltage: 127, power: 250, r1: 7, x1: 7, xm: 90, r2: 9, x2: 7 };
const REF_OMEGA = 2 * Math.PI * 60;
/** Protector inside the winding: opens hot, closes again once cooled (°C). */
const PROTECTOR_OPEN = 135;
const PROTECTOR_CLOSE = 85;
/** Closed protector, between the star point of the windings and the common lead (S). */
const G_PROTECTOR = 1e3;
/** Below this rotor speed (fraction of synchronous) an energized motor is humming. */
const HUM_SPEED = 0.05;
/** A winding with less than this fraction of the rated voltage is not energized. */
const ENERGIZED = 0.25;

/**
 * Single-phase induction motor with a permanent capacitor, as in gate
 * operators: two equal windings (w1–common and w2–common) at 90° in the
 * stator, the capacitor between w1 and w2 in the circuit. The winding that
 * gets the phase directly leads the field: phase on w1 turns it forward
 * (+), phase on w2 backward. Two-phase machine by the double revolving field
 * theory, in the quasi-static analysis (phasors at the mains frequency, the
 * rotor speed integrated over each mechanical step).
 *
 * What it reproduces: without the capacitor (or with both windings on the
 * phase) there is no rotating field at standstill and the motor hums at
 * locked-rotor current, but runs if pushed; a weak capacitor gives a weak
 * start; locked, the current is about four times the running current; the
 * thermal protector opens the common lead when the winding passes 135 °C and
 * closes again at 85 °C. In DC (an ohmmeter) each winding is its resistance.
 */
export default defineDevice({
  info: {
    type: 'ac-motor-1ph-cap',
    label: 'Motor monofásico com capacitor',
    terminals: 'fixed',
    pins: [
      { name: 'w1', offset: [-2, -3], label: 'enrolamento 1 (ABRE)' },
      { name: 'w2', offset: [2, -3], label: 'enrolamento 2 (FECHA)' },
      { name: 'common', offset: [0, 3], label: 'comum (COM)' },
    ],
    params: {
      power: { default: 250, label: 'Potência nominal', unit: 'W', min: 10, max: 5000 },
      voltage: { default: 127, label: 'Tensão nominal', unit: 'V', min: 1, max: 500 },
      poles: {
        default: 4,
        label: 'Número de polos',
        options: [
          { value: 2, label: '2 polos (3.600 rpm)' },
          { value: 4, label: '4 polos (1.800 rpm)' },
          { value: 6, label: '6 polos (1.200 rpm)' },
          { value: 8, label: '8 polos (900 rpm)' },
        ],
      },
      inertia: { default: 5e-4, label: 'Inércia do rotor', unit: 'kg·m²', min: 1e-6 },
      load: { default: 0, label: 'Carga no eixo (sem portão acoplado)', unit: 'N·m', min: 0 },
    },
    readouts: [
      'rpm',
      'direction',
      'torque',
      'current',
      'power',
      'temperature',
      'humming',
      'protector',
    ],
    readoutInfo: {
      rpm: { label: 'Rotação (+ sentido do enrolamento 1)', unit: 'rpm' },
      direction: { label: 'Sentido de giro (1, 0 ou −1)' },
      torque: { label: 'Torque do motor', unit: 'N·m' },
      current: { label: 'Corrente no comum', unit: 'A' },
      power: { label: 'Potência consumida', unit: 'W' },
      temperature: { label: 'Temperatura do enrolamento', unit: '°C' },
      humming: { label: 'Zumbindo (energizado e parado)' },
      protector: { label: 'Protetor térmico aberto' },
    },
  },
  analyses: ['dc', 'quasi-static'],
  create({ id, params, pins: [w1, w2, common], branch, node }) {
    const star = node();
    const ba = branch();
    const bb = branch();
    const zero = (): Complex => ({ re: 0, im: 0 });
    let speed = 0;
    let omega = REF_OMEGA;
    let va = zero();
    let vb = zero();
    let ia = zero();
    let ib = zero();
    let iaDc = 0;
    let ibDc = 0;
    let torque = 0;
    let power = 0;
    let tWinding = AMBIENT_C;
    let tFrame = AMBIENT_C;
    let protector = false;
    let humming = false;

    const scale = () => (num(params, 'voltage') / REF.voltage) ** 2 * (REF.power / num(params, 'power'));
    const circuit = (w: number): EquivalentCircuit => {
      const k = scale();
      const x = (k * w) / REF_OMEGA;
      return { r1: REF.r1 * k, x1: REF.x1 * x, xm: REF.xm * x, r2: REF.r2 * k, x2: REF.x2 * x };
    };
    const pairs = () => num(params, 'poles') / 2;
    const syncSpeed = () => omega / pairs();
    const slip = (w: number) => 1 - w / syncSpeed();
    const gProtector = () => (protector ? 1 / R_OPEN : G_PROTECTOR);
    // Bearings and fan, scaled with the rating (N·m).
    const coulomb = () => 0.004 * (num(params, 'power') / REF.power);
    const viscous = () => 1e-5 * (num(params, 'power') / REF.power);

    /** Torque at speed w with the winding voltages of the last solve held. */
    const torqueAt = (w: number) => {
      if (protector) return 0;
      const m = twoPhase(circuit(omega), slip(w));
      const [a, b] = twoPhaseCurrents(m, va, vb);
      return twoPhaseTorque(m, a, b, syncSpeed());
    };
    const shaft: Shaft = {
      speed: 0,
      get inertia() {
        return num(params, 'inertia');
      },
      torqueAt,
      get coulomb() {
        return coulomb();
      },
      get viscous() {
        return viscous();
      },
      driven: false,
    };
    const phasor = (ac: PhasorView, i: number, j = -1): Complex => ({
      re: ac.re(i) - ac.re(j),
      im: ac.im(i) - ac.im(j),
    });

    return {
      exposes: { shaft },
      stamp(m) {
        const r1 = circuit(REF_OMEGA).r1;
        m.branch(ba, w1, star, 0, r1);
        m.branch(bb, w2, star, 0, r1);
        m.conductance(star, common, gProtector());
      },
      stampAc(m, ctx) {
        omega = ctx.omega;
        const t = twoPhase(circuit(ctx.omega), slip(speed));
        m.branch(ba, w1, star, 0, 0, t.zs.re, t.zs.im);
        m.branch(bb, w2, star, 0, 0, t.zs.re, t.zs.im);
        // Coupling through the rotor: +j·zd·Ib in row a, −j·zd·Ia in row b.
        m.add(ba, bb, -t.zd.im, t.zd.re);
        m.add(bb, ba, t.zd.im, -t.zd.re);
        m.admittance(star, common, gProtector());
      },
      update(step, x, ctx) {
        iaDc = x.x[ba];
        ibDc = x.x[bb];
        const ac = step.ac;
        if (ac) {
          omega = ac.omega;
          va = phasor(ac, w1, star);
          vb = phasor(ac, w2, star);
          ia = phasor(ac, ba);
          ib = phasor(ac, bb);
        } else {
          va = zero();
          vb = zero();
          ia = zero();
          ib = zero();
        }
        speed = shaft.speed;
        const m = twoPhase(circuit(omega), slip(speed));
        torque = protector ? 0 : twoPhaseTorque(m, ia, ib, syncSpeed());
        power =
          va.re * ia.re + va.im * ia.im + vb.re * ib.re + vb.im * ib.im +
          (x.v(w1) - x.v(star)) * iaDc + (x.v(w2) - x.v(star)) * ibDc;
        if (!ctx.commit || step.dt <= 0) return;
        const dt = step.dt;

        if (!shaft.driven) {
          const load = num(params, 'load');
          speed = implicitStep(
            speed,
            shaft.inertia,
            dt,
            (w) => torqueAt(w) - viscous() * w,
            () => coulomb() + load,
            1.2 * syncSpeed(),
          );
          shaft.speed = speed;
        }

        // Heat: everything taken from the supply that is not mechanical work.
        const heat = Math.max(0, power - torque * speed);
        const cw = 0.6 * num(params, 'power');
        const cf = 6 * num(params, 'power');
        const rwf = 75 / num(params, 'power');
        const rfa = 250 / num(params, 'power');
        // Backward Euler on the winding and frame temperatures.
        const a11 = cw / dt + 1 / rwf;
        const a12 = -1 / rwf;
        const a22 = cf / dt + 1 / rwf + 1 / rfa;
        const b1 = (cw / dt) * tWinding + heat;
        const b2 = (cf / dt) * tFrame + AMBIENT_C / rfa;
        const det = a11 * a22 - a12 * a12;
        tWinding = (b1 * a22 - a12 * b2) / det;
        tFrame = (a11 * b2 - a12 * b1) / det;
        if (!protector && tWinding >= PROTECTOR_OPEN) {
          protector = true;
          ctx.emit(
            'warning',
            `O protetor térmico do motor ${id} abriu: o enrolamento chegou a ${formatNumber(tWinding, 3)} °C. Ele volta a fechar sozinho quando esfriar (${PROTECTOR_CLOSE} °C).`,
          );
        } else if (protector && tWinding <= PROTECTOR_CLOSE) {
          protector = false;
          ctx.emit('info', `O protetor térmico do motor ${id} fechou de novo: o enrolamento esfriou.`);
        }
        const rated = num(params, 'voltage');
        const energized =
          !protector && Math.max(Math.hypot(va.re, va.im), Math.hypot(vb.re, vb.im)) > ENERGIZED * rated;
        humming = energized && Math.abs(speed) < HUM_SPEED * syncSpeed();
      },
      pinCurrents(_x, out) {
        out[0] = iaDc;
        out[1] = ibDc;
        out[2] = -iaDc - ibDc;
      },
      readouts(_x, out, ac) {
        const rpm = (speed * 30) / Math.PI;
        out('rpm', rpm);
        out('direction', Math.abs(rpm) < 1 ? 0 : Math.sign(rpm));
        out('torque', torque);
        const dc = iaDc + ibDc;
        const re = ac ? ia.re + ib.re : 0;
        const im = ac ? ia.im + ib.im : 0;
        out('current', Math.sqrt(dc * dc + re * re + im * im));
        out('power', power);
        out('temperature', tWinding);
        out('humming', humming);
        out('protector', protector);
      },
      reset() {
        speed = shaft.speed = 0;
        va = zero();
        vb = zero();
        ia = zero();
        ib = zero();
        iaDc = ibDc = torque = power = 0;
        tWinding = tFrame = AMBIENT_C;
        protector = humming = false;
      },
    };
  },
});
