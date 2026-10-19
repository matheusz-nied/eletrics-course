import { defineDevice, num, str, type PhasorView } from '../device';
import { formatNumber } from '../messages';
import { AMBIENT_C, R_OPEN } from '../models/constants';
import { gapImpedance, type Complex, type EquivalentCircuit } from '../models/induction';
import { implicitStep, type Shaft } from '../models/mechanics';

/**
 * Equivalent circuit of the reference motor, per winding at 60 Hz: 1 CV
 * (750 W), 4 poles, windings of 220 V (the 220/380 V nameplate, delta on a
 * 220 V network). Teaching model tuned to typical catalogue figures of such a
 * motor: about 1.720 rpm and 2,8 A per line at full load, 6 to 7 times that
 * locked, a starting torque near 2,8 times the rated torque and a breakdown
 * torque near 3,6 times. Other ratings scale the impedances with V²/P.
 */
export const REF = { voltage: 220, power: 750, r1: 7.5, x1: 7, xm: 230, r2: 6.5, x2: 7.5 };
const REF_OMEGA = 2 * Math.PI * 60;
/** Insulation class F: past this the winding is overheating (°C). */
const HOT = 155;
/** The insulation gives way and the windings open (°C). */
const BURN = 200;
/** Below this rotor speed (fraction of synchronous) an energized motor is humming. */
const HUM_SPEED = 0.05;
/** A winding with less than this fraction of its rated voltage is not energized. */
const ENERGIZED = 0.25;

const zero = (): Complex => ({ re: 0, im: 0 });
const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const mul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
const scale = (a: Complex, k: number): Complex => ({ re: a.re * k, im: a.im * k });
const abs2 = (a: Complex) => a.re * a.re + a.im * a.im;
/** a = 1∠120°, the operator of the symmetrical components. */
const A1: Complex = { re: -0.5, im: Math.sqrt(3) / 2 };
const A2: Complex = { re: -0.5, im: -Math.sqrt(3) / 2 };

/** Positive and negative sequence components of three phasors (u, v, w). */
function sequences(x: readonly Complex[]): { pos: Complex; neg: Complex } {
  const [u, v, w] = x as [Complex, Complex, Complex];
  return {
    pos: scale(add(u, add(mul(A1, v), mul(A2, w))), 1 / 3),
    neg: scale(add(u, add(mul(A2, v), mul(A1, w))), 1 / 3),
  };
}

/**
 * Three-phase squirrel-cage induction motor with three equal windings at
 * 120° in the stator, connected inside the terminal box in delta (each
 * winding across two lines, u–v, v–w, w–u) or star (each from its line to a
 * common point that goes nowhere). Supply in the order u, v, w (v lagging u
 * by 120°) turns it forward (+); swapping any two lines reverses it.
 * Quasi-static analysis by symmetrical components: the positive sequence
 * sees the rotor at slip s, the negative at 2 − s, and the zero sequence (a
 * current circulating in the delta) only the stator leakage. The rotor speed
 * is integrated over each mechanical step.
 *
 * What it reproduces: on the right connection it starts at 6 to 7 times the
 * full-load current and settles a few percent below the synchronous speed;
 * in star on a network made for delta each winding gets 1/√3 of the voltage
 * and the motor has a third of the current and of the torque (the star-delta
 * start); with one line open there is no rotating field at standstill, so it
 * hums at locked current, but keeps running if already turning, hotter. The
 * windings heat with the losses; past 155 °C it warns and past 200 °C they
 * burn open. In DC (an ohmmeter) each winding is its resistance.
 */
export default defineDevice({
  info: {
    type: 'ac-motor-3ph',
    label: 'Motor trifásico',
    terminals: 'fixed',
    pins: [
      { name: 'u', offset: [-2, -3], label: 'terminal U (fase L1)' },
      { name: 'v', offset: [0, -3], label: 'terminal V (fase L2)' },
      { name: 'w', offset: [2, -3], label: 'terminal W (fase L3)' },
    ],
    params: {
      power: { default: 750, label: 'Potência nominal', unit: 'W', min: 50, max: 50000 },
      voltage: {
        default: 220,
        label: 'Tensão de cada enrolamento (a menor da placa)',
        unit: 'V',
        min: 1,
        max: 1000,
      },
      connection: {
        default: 'triangulo',
        label: 'Ligação dos enrolamentos',
        options: [
          { value: 'triangulo', label: 'Triângulo (Δ)' },
          { value: 'estrela', label: 'Estrela (Y)' },
        ],
      },
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
      inertia: { default: 3e-3, label: 'Inércia do rotor e da carga', unit: 'kg·m²', min: 1e-6 },
      load: { default: 0, label: 'Torque da carga no eixo', unit: 'N·m', min: 0 },
    },
    readouts: [
      'rpm',
      'direction',
      'slip',
      'torque',
      'current',
      'windingVoltage',
      'windingCurrent',
      'power',
      'temperature',
      'humming',
      'burned',
    ],
    readoutInfo: {
      rpm: { label: 'Rotação (+ na sequência U, V, W)', unit: 'rpm' },
      direction: { label: 'Sentido de giro (1, 0 ou −1)' },
      slip: { label: 'Escorregamento (fração da velocidade síncrona)' },
      torque: { label: 'Torque do motor', unit: 'N·m' },
      current: { label: 'Corrente de linha (a maior das três)', unit: 'A' },
      windingVoltage: { label: 'Tensão no enrolamento U', unit: 'V' },
      windingCurrent: { label: 'Corrente no enrolamento U', unit: 'A' },
      power: { label: 'Potência consumida', unit: 'W' },
      temperature: { label: 'Temperatura do enrolamento', unit: '°C' },
      humming: { label: 'Zumbindo (energizado e parado)' },
      burned: { label: 'Queimado (enrolamentos abertos)' },
    },
  },
  analyses: ['dc', 'quasi-static'],
  create({ id, params, pins, branch, node }) {
    const [u, v, w] = pins as [number, number, number];
    const star = node();
    const br = [branch(), branch(), branch()] as const;
    let speed = 0;
    let omega = REF_OMEGA;
    let vw: Complex[] = [zero(), zero(), zero()];
    let iw: Complex[] = [zero(), zero(), zero()];
    const iDc = [0, 0, 0];
    let lineRms = [0, 0, 0];
    let torque = 0;
    let power = 0;
    let tWinding = AMBIENT_C;
    let tFrame = AMBIENT_C;
    let hot = false;
    let burned = false;
    let humming = false;

    const k = () => (num(params, 'voltage') / REF.voltage) ** 2 * (REF.power / num(params, 'power'));
    const circuit = (wAc: number): EquivalentCircuit => {
      const kk = k();
      const x = (kk * wAc) / REF_OMEGA;
      return { r1: REF.r1 * kk, x1: REF.x1 * x, xm: REF.xm * x, r2: REF.r2 * kk, x2: REF.x2 * x };
    };
    const delta = () => str(params, 'connection') !== 'estrela';
    /** Winding k runs from terminal `ends[k][0]` to `ends[k][1]`. */
    const ends = (): [number, number][] =>
      delta()
        ? [
            [u, v],
            [v, w],
            [w, u],
          ]
        : [
            [u, star],
            [v, star],
            [w, star],
          ];
    const pairs = () => num(params, 'poles') / 2;
    const syncSpeed = () => omega / pairs();
    const slip = (s: number) => 1 - s / syncSpeed();
    // Bearings and fan, scaled with the rating (N·m).
    const coulomb = () => 0.06 * (num(params, 'power') / REF.power);
    const viscous = () => 3e-4 * (num(params, 'power') / REF.power);

    /** Sequence impedances (positive, negative, zero) and air-gap resistances at speed s. */
    const machine = (s: number) => {
      const eq = circuit(omega);
      const f = gapImpedance(eq, slip(s));
      const b = gapImpedance(eq, 2 - slip(s));
      const leak: Complex = { re: eq.r1, im: eq.x1 };
      return { z1: add(leak, f), z2: add(leak, b), z0: leak, gf: f.re, gb: b.re };
    };
    const seqTorque = (i1: Complex, i2: Complex, gf: number, gb: number) =>
      (3 / syncSpeed()) * (abs2(i1) * gf - abs2(i2) * gb);

    /** Torque at speed s with the winding voltages of the last solve held. */
    const torqueAt = (s: number) => {
      if (burned) return 0;
      const m = machine(s);
      const { pos, neg } = sequences(vw);
      const d1 = abs2(m.z1);
      const d2 = abs2(m.z2);
      return (3 / syncSpeed()) * ((abs2(pos) / d1) * m.gf - (abs2(neg) / d2) * m.gb);
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
        const r = burned ? R_OPEN : circuit(REF_OMEGA).r1;
        ends().forEach(([p, n], j) => m.branch(br[j], p, n, 0, r));
      },
      stampAc(m, ctx) {
        omega = ctx.omega;
        const e = ends();
        if (burned) {
          e.forEach(([p, n], j) => m.branch(br[j], p, n, 0, 0, R_OPEN, 0));
          return;
        }
        // Circulant impedance matrix: Z[j][l] = c[(l − j) mod 3], with
        // c0 = (Z0 + Z1 + Z2)/3, c1 = (Z0 + a·Z1 + a²·Z2)/3, c2 = (Z0 + a²·Z1 + a·Z2)/3.
        const { z0, z1, z2 } = machine(speed);
        const c = [
          scale(add(z0, add(z1, z2)), 1 / 3),
          scale(add(z0, add(mul(A1, z1), mul(A2, z2))), 1 / 3),
          scale(add(z0, add(mul(A2, z1), mul(A1, z2))), 1 / 3),
        ] as [Complex, Complex, Complex];
        e.forEach(([p, n], j) => {
          m.branch(br[j], p, n, 0, 0, c[0].re, c[0].im);
          for (let l = 0; l < 3; l++) {
            if (l === j) continue;
            const z = c[(l - j + 3) % 3]!;
            m.add(br[j], br[l], -z.re, -z.im);
          }
        });
      },
      update(step, x, ctx) {
        const e = ends();
        for (let j = 0; j < 3; j++) iDc[j] = x.x[br[j]]!;
        const ac = step.ac;
        if (ac) {
          omega = ac.omega;
          vw = e.map(([p, n]) => phasor(ac, p, n));
          iw = br.map((b) => phasor(ac, b));
        } else {
          vw = [zero(), zero(), zero()];
          iw = [zero(), zero(), zero()];
        }
        // Line currents: what enters each terminal.
        const line = delta()
          ? [0, 1, 2].map((j) => add(iw[j]!, scale(iw[(j + 2) % 3]!, -1)))
          : iw;
        const lineDc = delta() ? [0, 1, 2].map((j) => iDc[j]! - iDc[(j + 2) % 3]!) : [...iDc];
        lineRms = line.map((l, j) => Math.sqrt(lineDc[j]! ** 2 + abs2(l)));

        speed = shaft.speed;
        const m = machine(speed);
        const { pos, neg } = sequences(iw);
        torque = burned ? 0 : seqTorque(pos, neg, m.gf, m.gb);
        power = 0;
        for (let j = 0; j < 3; j++) {
          const [p, n] = e[j]!;
          power += vw[j]!.re * iw[j]!.re + vw[j]!.im * iw[j]!.im + (x.v(p) - x.v(n)) * iDc[j]!;
        }
        if (!ctx.commit || step.dt <= 0) return;
        const dt = step.dt;

        if (!shaft.driven) {
          const load = num(params, 'load');
          speed = implicitStep(
            speed,
            shaft.inertia,
            dt,
            (s) => torqueAt(s) - viscous() * s,
            () => coulomb() + load,
            1.2 * syncSpeed(),
          );
          shaft.speed = speed;
        }

        // Heat: everything taken from the supply that is not mechanical work.
        const heat = Math.max(0, power - torque * speed);
        const p = num(params, 'power');
        const cw = 0.6 * p;
        const cf = 6 * p;
        const rwf = 75 / p;
        const rfa = 250 / p;
        // Backward Euler on the winding and frame temperatures.
        const a11 = cw / dt + 1 / rwf;
        const a12 = -1 / rwf;
        const a22 = cf / dt + 1 / rwf + 1 / rfa;
        const b1 = (cw / dt) * tWinding + heat;
        const b2 = (cf / dt) * tFrame + AMBIENT_C / rfa;
        const det = a11 * a22 - a12 * a12;
        tWinding = (b1 * a22 - a12 * b2) / det;
        tFrame = (a11 * b2 - a12 * b1) / det;
        if (!burned && tWinding >= BURN) {
          burned = true;
          ctx.emit(
            'damaged',
            `O motor ${id} queimou: o enrolamento passou de ${BURN} °C, a isolação do fio se desfez e os enrolamentos abriram.`,
          );
          ctx.discontinuity();
        } else if (!hot && tWinding >= HOT) {
          hot = true;
          ctx.emit(
            'warning',
            `O motor ${id} está superaquecendo: o enrolamento chegou a ${formatNumber(tWinding, 3)} °C, acima do que a isolação aguenta (${HOT} °C). Desligue antes que ele queime.`,
          );
        } else if (hot && tWinding < HOT - 20) {
          hot = false;
        }
        const rated = num(params, 'voltage');
        const energized =
          !burned && Math.max(...vw.map((z) => Math.sqrt(abs2(z)))) > ENERGIZED * rated;
        humming = energized && Math.abs(speed) < HUM_SPEED * syncSpeed();
      },
      pinCurrents(_x, out) {
        if (delta()) {
          out[0] = iDc[0]! - iDc[2]!;
          out[1] = iDc[1]! - iDc[0]!;
          out[2] = iDc[2]! - iDc[1]!;
        } else {
          out[0] = iDc[0]!;
          out[1] = iDc[1]!;
          out[2] = iDc[2]!;
        }
      },
      readouts(_x, out) {
        const rpm = (speed * 30) / Math.PI;
        out('rpm', rpm);
        out('direction', Math.abs(rpm) < 1 ? 0 : Math.sign(rpm));
        out('slip', slip(Math.abs(speed)));
        out('torque', torque);
        out('current', Math.max(...lineRms));
        out('windingVoltage', Math.sqrt(abs2(vw[0]!)));
        out('windingCurrent', Math.sqrt(iDc[0]! ** 2 + abs2(iw[0]!)));
        out('power', power);
        out('temperature', tWinding);
        out('humming', humming);
        out('burned', burned);
      },
      reset() {
        speed = shaft.speed = 0;
        vw = [zero(), zero(), zero()];
        iw = [zero(), zero(), zero()];
        iDc.fill(0);
        lineRms = [0, 0, 0];
        torque = power = 0;
        tWinding = tFrame = AMBIENT_C;
        hot = burned = humming = false;
      },
    };
  },
});
