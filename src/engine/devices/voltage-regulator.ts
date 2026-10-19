import { defineDevice, bool, num } from '../device';
import { formatSI } from '../messages';
import { AMBIENT_C } from '../models/constants';
import { relax } from '../models/filters';

/** Transconductance of the error amplifier and pass transistor together (S). */
const GM = 50;
/** Softness of the current clamp at 0 and at the current limit (A). */
const I_SOFT = 1e-3;
/** Width of the transition into dropout (V). */
const V_SOFT = 0.1;
/** Width of the quiescent current turn-on as the input rises (V). */
const V_Q = 0.5;
/** Thermal shutdown: the output turns off at T_OFF and back on below T_ON (°C). */
const T_OFF = 160;
const T_ON = 140;

/** ln(1 + eˣ) without overflow, and its derivative. */
function softplus(x: number): { value: number; slope: number } {
  if (x > 30) return { value: x, slope: 1 };
  if (x < -30) return { value: 0, slope: 0 };
  const e = Math.exp(x);
  return { value: Math.log1p(e), slope: e / (1 + e) };
}

/** Logistic function and its derivative. */
function logistic(x: number): { value: number; slope: number } {
  if (x > 40) return { value: 1, slope: 0 };
  if (x < -40) return { value: 0, slope: 0 };
  const s = 1 / (1 + Math.exp(-x));
  return { value: s, slope: s * (1 - s) };
}

type State = 'regulando' | 'sem folga' | 'limitando a corrente' | 'proteção térmica' | 'desligado';

/**
 * Three-terminal linear regulator, behavioural (7805, 7812, LM317 style).
 * The pass transistor is a current source from `in` to `out` driven by an
 * error amplifier that holds V(out) − V(com) at `vref`: it only sources
 * current, between zero and `ilimit` (short-circuit protection), and only
 * while the input stays `dropout` volts above the output; below that the
 * output follows the input minus about `dropout`. A quiescent current `iq`
 * flows from `in` out of `com` (about 5 mA to ground in a 78xx, 50 µA out of
 * the ADJ pin of an LM317). The die heats with the dissipated power through
 * `rth` (junction to ambient, with or without a heatsink) with time constant
 * `tau`; at about 160 °C the thermal protection turns the output off, and it
 * comes back below 140 °C. Typical values for teaching, not a datasheet.
 */
const info = {
  type: 'voltage-regulator',
  label: 'Regulador de tensão linear (78xx, LM317)',
  terminals: 'fixed' as const,
  pins: [
    { name: 'in', offset: [-4, 0] as [number, number], label: 'entrada (IN)' },
    { name: 'out', offset: [4, 0] as [number, number], label: 'saída (OUT)' },
    { name: 'com', offset: [0, 3] as [number, number], label: 'comum (GND)' },
  ],
  params: {
    vref: {
      default: 12,
      label: 'Tensão regulada (entre OUT e GND, ou OUT e ADJ)',
      unit: 'V',
      min: 0.5,
      max: 40,
    },
    adjustable: { default: false, label: 'Ajustável (tipo LM317): o comum é o pino ADJ' },
    dropout: {
      default: 2,
      label: 'Folga mínima entre entrada e saída (dropout)',
      unit: 'V',
      min: 0.1,
      max: 5,
    },
    ilimit: { default: 1.5, label: 'Limite de corrente', unit: 'A', min: 0.01, max: 10 },
    iq: {
      default: 5e-3,
      label: 'Corrente quiescente (sai pelo comum)',
      unit: 'A',
      min: 0,
      max: 0.05,
    },
    rth: {
      default: 50,
      label: 'Resistência térmica junção-ambiente (com o dissipador)',
      unit: '°C/W',
      min: 0.5,
      max: 200,
    },
    tau: { default: 30, label: 'Constante de tempo térmica', unit: 's', min: 0.1, max: 1000 },
  },
  readouts: ['vout', 'iout', 'iin', 'power', 'temperature', 'state', 'shutdown'],
  readoutInfo: {
    vout: { label: 'Tensão de saída (OUT − comum)', unit: 'V' },
    iout: { label: 'Corrente de saída', unit: 'A' },
    iin: { label: 'Corrente de entrada', unit: 'A' },
    power: { label: 'Potência dissipada', unit: 'W' },
    temperature: { label: 'Temperatura da junção', unit: '°C' },
    state: { label: 'Situação' },
    shutdown: { label: 'Proteção térmica atuando' },
  },
};

export default defineDevice({
  info,
  instance: (params) =>
    bool(params, 'adjustable')
      ? {
          ...info,
          pins: info.pins.map((p) => (p.name === 'com' ? { ...p, label: 'ajuste (ADJ)' } : p)),
        }
      : info,
  create({ id, params, pins: [vin, vout, com] }) {
    /** Pass current (in → out) and its partial derivatives by V(in), V(out), V(com). */
    const pass = (vi: number, vo: number, vc: number, enabled: boolean) => {
      if (!enabled) return { i: 0, gi: 0, go: 0, gc: 0, clamp: 0, head: 0 };
      const ilimit = num(params, 'ilimit');
      const z = GM * (num(params, 'vref') - (vo - vc));
      const lo = softplus(z / I_SOFT);
      const hi = softplus((z - ilimit) / I_SOFT);
      const clamp = I_SOFT * (lo.value - hi.value);
      const dClamp = lo.slope - hi.slope; // d clamp / dz
      const head = logistic((vi - vo - num(params, 'dropout')) / V_SOFT);
      const dHead = head.slope / V_SOFT; // d head / d(vi − vo)
      return {
        i: clamp * head.value,
        gi: clamp * dHead,
        go: -GM * dClamp * head.value - clamp * dHead,
        gc: GM * dClamp * head.value,
        clamp,
        head: head.value,
      };
    };
    /** Quiescent current (in → com), rising smoothly from zero input, and its slope. */
    const quiescent = (u: number) => {
      if (u <= 0) return { i: 0, g: 0 };
      const e = Math.exp(-u / V_Q);
      return { i: num(params, 'iq') * (1 - e), g: (num(params, 'iq') * e) / V_Q };
    };

    let rise = 0; // junction temperature above ambient (K)
    let off = false; // thermal protection
    let warned = false;
    let iPass = 0;
    let iQ = 0;
    let clampNow = 0;
    let headNow = 1;

    const stampLinear = (
      m: {
        add(r: number, c: number, v: number): void;
        current(i: number, j: number, v: number): void;
      },
      v: { vi: number; vo: number; vc: number },
    ) => {
      const p = pass(v.vi, v.vo, v.vc, !off);
      // Pass current from in to out: rows in (+) and out (−).
      for (const [row, sign] of [
        [vin, 1],
        [vout, -1],
      ] as const) {
        m.add(row, vin, sign * p.gi);
        m.add(row, vout, sign * p.go);
        m.add(row, com, sign * p.gc);
      }
      m.current(vin, vout, p.i - p.gi * v.vi - p.go * v.vo - p.gc * v.vc);
      const q = quiescent(v.vi - v.vc);
      for (const [row, sign] of [
        [vin, 1],
        [com, -1],
      ] as const) {
        m.add(row, vin, sign * q.g);
        m.add(row, com, -sign * q.g);
      }
      m.current(vin, com, q.i - q.g * (v.vi - v.vc));
    };

    return {
      nonlinear: true,
      stamp(m, _step, x) {
        stampLinear(m, { vi: x.v(vin), vo: x.v(vout), vc: x.v(com) });
      },
      stampAc(m, _ctx, op) {
        const p = pass(op.v(vin), op.v(vout), op.v(com), !off);
        for (const [row, sign] of [
          [vin, 1],
          [vout, -1],
        ] as const) {
          m.add(row, vin, sign * p.gi);
          m.add(row, vout, sign * p.go);
          m.add(row, com, sign * p.gc);
        }
        const q = quiescent(op.v(vin) - op.v(com));
        m.transconductance(vin, com, vin, com, q.g);
      },
      update(step, x, ctx) {
        const vi = x.v(vin);
        const vo = x.v(vout);
        const vc = x.v(com);
        const p = pass(vi, vo, vc, !off);
        iPass = p.i;
        clampNow = p.clamp;
        headNow = p.head;
        iQ = quiescent(vi - vc).i;
        if (!ctx.commit || step.dt <= 0) return;
        const power = iPass * (vi - vo) + iQ * (vi - vc);
        rise = relax(rise, Math.max(0, power) * num(params, 'rth'), step.dt, num(params, 'tau'));
        const tj = AMBIENT_C + rise;
        if (!off && tj >= T_OFF) {
          off = true;
          ctx.discontinuity();
          if (!warned) {
            warned = true;
            ctx.emit(
              'warning',
              `O regulador ${id} esquentou até ${Math.round(tj)} °C e a proteção térmica desligou a saída: dissipava ${formatSI(power, 'W')}.`,
            );
          }
        } else if (off && tj <= T_ON) {
          off = false;
          ctx.discontinuity();
        }
      },
      pinCurrents(_x, out) {
        out[0] = iPass + iQ;
        out[1] = -iPass;
        out[2] = -iQ;
      },
      readouts(x, out) {
        const vi = x.v(vin);
        const vo = x.v(vout);
        const vc = x.v(com);
        out('vout', vo - vc);
        out('iout', iPass);
        out('iin', iPass + iQ);
        out('power', iPass * (vi - vo) + iQ * (vi - vc));
        out('temperature', AMBIENT_C + rise);
        out('shutdown', off);
        let state: State = 'regulando';
        if (off) state = 'proteção térmica';
        else if (vi - vc < 0.5) state = 'desligado';
        else if (headNow < 0.98) state = 'sem folga';
        else if (clampNow > 0.95 * num(params, 'ilimit')) state = 'limitando a corrente';
        out('state', state);
      },
      paramChanged() {
        warned = false;
      },
      reset() {
        rise = 0;
        off = false;
        warned = false;
        iPass = iQ = clampNow = 0;
        headNow = 1;
      },
    };
  },
});
