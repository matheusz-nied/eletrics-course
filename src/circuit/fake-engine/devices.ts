/**
 * Behaviour of each device in the stand-in engine. Simplified but physically
 * sensible models, enough to drive the schematic and the instruments until the
 * real engine (src/engine) replaces this folder.
 */
import type { ParamValue, SimEvent } from '../../engine/contract';
import { formatSI } from '../format';
import type { Stamper } from './linear';

export type Mode = 'dc' | 'tran' | 'ac';

export interface DevCtx {
  mode: Mode;
  dt: number;
  t: number;
  /** Angular frequency for 'ac'. */
  omega: number;
  /** Name of the swept source for 'ac'. */
  acSource?: string;
  /** Unknown vector of the current iteration. */
  x: Float64Array;
  /** Set by devices that limited a junction voltage (iteration not converged yet). */
  limited: boolean;
  events: SimEvent[];
}

export interface Device {
  id: string;
  type: string;
  label: string;
  /** Matrix index of each pin (-1 = reference). */
  pins: Record<string, number>;
  params: Record<string, ParamValue>;
  /** Number of extra unknowns (branch currents). */
  branches: number;
  branch: number;
  nonlinear: boolean;
  stamp(st: Stamper, c: DevCtx): void;
  /** Updates internal state after a converged time step. */
  accept?(c: DevCtx): void;
  /** Device-specific readouts ("brightness", "blown"…). */
  readouts?(out: Record<string, number | boolean | string>, c: DevCtx): void;
  reset(): void;
}

const VT = 0.025852;
const G_ON = 1e3; // 1 mΩ
const G_OFF = 1e-12;

const v = (c: DevCtx, i: number) => (i < 0 ? 0 : c.x[i]!);
const num = (p: ParamValue | undefined, d: number) => (typeof p === 'number' ? p : d);
const bool = (p: ParamValue | undefined) => p === true || p === 'true' || p === 1;

/** Junction voltage limiting (SPICE pnjlim). */
function pnjlim(vnew: number, vold: number, vt: number, vcrit: number, c: DevCtx): number {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    c.limited = true;
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      return arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    }
    return vt * Math.log(vnew / vt);
  }
  return vnew;
}

function emit(c: DevCtx, element: string, kind: SimEvent['kind'], message: string) {
  c.events.push({ t: c.t, element, kind, message });
}

const A = (x: number) => formatSI(Math.abs(x), 'A');
const W = (x: number) => formatSI(Math.abs(x), 'W');

interface Base {
  id: string;
  type: string;
  label: string;
  pins: Record<string, number>;
  params: Record<string, ParamValue>;
}

type Factory = (b: Base) => Device;

function dev(b: Base, d: Partial<Device> & Pick<Device, 'stamp'> & ThisType<Device>): Device {
  return { branches: 0, branch: -1, nonlinear: false, reset() {}, ...b, ...d } as Device;
}

/** Two-terminal conductance whose value comes from a function. */
function conductance(get: (b: Base) => number): Factory {
  return (b) =>
    dev(b, {
      stamp(st) {
        st.g(b.pins.a!, b.pins.b!, get(b));
      },
    });
}

const switchLike = (closed: (p: Record<string, ParamValue>) => boolean): Factory =>
  conductance((b) => (closed(b.params) ? G_ON : G_OFF));

/** Two-terminal device that burns when the power stays above a limit. */
function resistorFactory(b: Base): Device {
  let hot = 0;
  let damaged = false;
  return dev(b, {
    stamp(st) {
      const r = Math.max(num(b.params.resistance, 1000), 1e-6);
      st.g(b.pins.a!, b.pins.b!, damaged ? G_OFF : 1 / r);
    },
    accept(c) {
      if (damaged) return;
      const r = Math.max(num(b.params.resistance, 1000), 1e-6);
      const vab = v(c, b.pins.a!) - v(c, b.pins.b!);
      const p = (vab * vab) / r;
      const rated = num(b.params.watts, 0.25);
      hot = p > 2 * rated ? hot + (c.dt || 0.016) : Math.max(0, hot - (c.dt || 0.016));
      if (hot > 0.5) {
        damaged = true;
        emit(
          c,
          b.id,
          'damaged',
          `O resistor ${b.label} queimou: potência de ${W(p)}, nominal ${W(rated)}.`,
        );
      }
    },
    readouts(out) {
      out.burned = damaged;
    },
    reset() {
      hot = 0;
      damaged = false;
    },
  });
}

function sourceFactory(value: (b: Base, c: DevCtx) => number): Factory {
  return (b) =>
    dev(b, {
      branches: 1,
      stamp(st, c) {
        if (c.mode === 'ac') {
          st.v(b.pins.a!, b.pins.b!, this.branch, c.acSource === b.id ? 1 : 0);
          return;
        }
        st.v(b.pins.a!, b.pins.b!, this.branch, value(b, c));
      },
    });
}

function batteryFactory(b: Base): Device {
  const r = num(b.params.resistance, 0.1);
  if (r <= 0) return sourceFactory((bb) => num(bb.params.voltage, 9))(b);
  return dev(b, {
    stamp(st, c) {
      const g = 1 / Math.max(num(b.params.resistance, 0.1), 1e-6);
      st.g(b.pins.a!, b.pins.b!, g);
      if (c.mode !== 'ac') st.i(b.pins.a!, b.pins.b!, -g * num(b.params.voltage, 9));
    },
  });
}

function capacitorFactory(b: Base): Device {
  let vPrev = 0;
  let damaged = false;
  return dev(b, {
    stamp(st, c) {
      const C = num(b.params.capacitance, 1e-6);
      const [a, bb] = [b.pins.a!, b.pins.b!];
      if (damaged) {
        st.g(a, bb, 1); // shorted, as a swollen electrolytic
        return;
      }
      if (c.mode === 'dc') st.g(a, bb, G_OFF);
      else if (c.mode === 'ac') st.g(a, bb, 0, c.omega * C);
      else {
        const g = C / c.dt;
        st.g(a, bb, g);
        st.i(a, bb, -g * vPrev);
      }
    },
    accept(c) {
      const vab = v(c, b.pins.a!) - v(c, b.pins.b!);
      vPrev = vab;
      if (damaged) return;
      const rated = num(b.params.voltage, 50);
      if (bool(b.params.polarized) && vab < -1) {
        damaged = true;
        emit(
          c,
          b.id,
          'damaged',
          `O capacitor ${b.label} estufou: ligado com a polaridade invertida.`,
        );
      } else if (Math.abs(vab) > rated * 1.2) {
        damaged = true;
        emit(
          c,
          b.id,
          'damaged',
          `O capacitor ${b.label} estufou: tensão de ${formatSI(Math.abs(vab), 'V')}, máximo ${formatSI(rated, 'V')}.`,
        );
      }
    },
    readouts(out) {
      out.damaged = damaged;
    },
    reset() {
      vPrev = 0;
      damaged = false;
    },
  });
}

function inductorFactory(b: Base): Device {
  let iPrev = 0;
  return dev(b, {
    stamp(st, c) {
      const L = Math.max(num(b.params.inductance, 0.01), 1e-12);
      const R = Math.max(num(b.params.resistance, 0), 0);
      const [a, bb] = [b.pins.a!, b.pins.b!];
      if (c.mode === 'dc') st.g(a, bb, 1 / Math.max(R, 1e-6));
      else if (c.mode === 'ac') {
        // Y = 1 / (R + jωL)
        const x = c.omega * L;
        const den = R * R + x * x || 1e-30;
        st.g(a, bb, R / den, -x / den);
      } else {
        const k = L / c.dt;
        const g = 1 / (R + k);
        st.g(a, bb, g);
        st.i(a, bb, g * k * iPrev);
      }
    },
    accept(c) {
      const L = Math.max(num(b.params.inductance, 0.01), 1e-12);
      const R = Math.max(num(b.params.resistance, 0), 0);
      const vab = v(c, b.pins.a!) - v(c, b.pins.b!);
      if (c.mode === 'dc') iPrev = vab / Math.max(R, 1e-6);
      else {
        const k = L / c.dt;
        iPrev = (vab + k * iPrev) / (R + k);
      }
    },
    reset() {
      iPrev = 0;
    },
  });
}

/** Incandescent lamp: the filament resistance rises with temperature (about 12× from cold). */
function lampFactory(b: Base): Device {
  let theta = 0; // relative filament heating: 1 at rated power
  let hot = 0;
  let damaged = false;
  const rHot = () => {
    const vr = num(b.params.voltage, 12);
    const pr = num(b.params.power, 5);
    return (vr * vr) / Math.max(pr, 1e-9);
  };
  const res = () => {
    const rh = rHot();
    return rh / 12 + (rh - rh / 12) * Math.min(theta, 2) ** 0.85;
  };
  return dev(b, {
    nonlinear: true,
    stamp(st) {
      st.g(b.pins.a!, b.pins.b!, damaged ? G_OFF : 1 / res());
    },
    accept(c) {
      if (damaged) return;
      const vab = v(c, b.pins.a!) - v(c, b.pins.b!);
      const p = (vab * vab) / res();
      const pr = num(b.params.power, 5);
      const target = p / pr;
      if (c.mode === 'dc') theta += (target - theta) * 0.5;
      else theta += (target - theta) * Math.min(1, c.dt / 0.08);
      hot = target > 1.8 ? hot + (c.dt || 0.016) : 0;
      if (hot > 0.05) {
        damaged = true;
        theta = 0;
        emit(
          c,
          b.id,
          'damaged',
          `A lâmpada ${b.label} queimou: potência de ${W(p)}, nominal ${W(pr)}.`,
        );
      }
    },
    readouts(out) {
      out.brightness = damaged ? 0 : Math.min(1, Math.max(0, (theta - 0.12) / 0.88)) ** 1.6;
      out.temperature = 25 + theta * 2500;
      out.burned = damaged;
    },
    reset() {
      theta = 0;
      hot = 0;
      damaged = false;
    },
  });
}

function fuseFactory(b: Base): Device {
  let heat = 0;
  let blown = false;
  return dev(b, {
    stamp(st) {
      st.g(b.pins.a!, b.pins.b!, blown ? G_OFF : 1 / 0.02);
    },
    accept(c) {
      if (blown) return;
      const rating = num(b.params.rating, 1);
      const i = (v(c, b.pins.a!) - v(c, b.pins.b!)) / 0.02;
      const dt = c.dt || 0.016;
      heat =
        Math.abs(i) > rating
          ? heat + (i * i - rating * rating) * dt
          : Math.max(0, heat - rating * rating * dt);
      if (heat > 0.5 * rating * rating) {
        blown = true;
        emit(
          c,
          b.id,
          'damaged',
          `O fusível ${b.label} rompeu: corrente de ${A(i)}, nominal ${A(rating)}.`,
        );
      }
    },
    readouts(out) {
      out.blown = blown;
    },
    reset() {
      heat = 0;
      blown = false;
    },
  });
}

function breakerFactory(b: Base): Device {
  let heat = 0;
  let tripped = false;
  return dev(b, {
    stamp(st) {
      const on = b.params.closed !== false && !tripped;
      st.g(b.pins.a!, b.pins.b!, on ? G_ON : G_OFF);
    },
    accept(c) {
      if (tripped || b.params.closed === false) return;
      const rating = num(b.params.rating, 16);
      const i = (v(c, b.pins.a!) - v(c, b.pins.b!)) * G_ON;
      const dt = c.dt || 0.016;
      const magnetic = (b.params.curve === 'B' ? 4 : 7) * rating;
      heat =
        Math.abs(i) > 1.13 * rating
          ? heat + (i * i - rating * rating) * dt
          : Math.max(0, heat - rating * rating * dt);
      if (Math.abs(i) > magnetic || heat > 20 * rating * rating) {
        tripped = true;
        emit(
          c,
          b.id,
          'tripped',
          `O disjuntor ${b.label} desarmou: corrente de ${A(i)}, nominal ${A(rating)}.`,
        );
      }
    },
    readouts(out) {
      out.tripped = tripped;
    },
    reset() {
      heat = 0;
      tripped = false;
    },
  });
}

interface DiodeModel {
  is: number;
  n: number;
  /** Reverse breakdown (zener), positive volts. */
  vz?: number;
}

const LED_VF: Record<string, number> = {
  red: 1.9,
  vermelho: 1.9,
  yellow: 2.0,
  amarelo: 2.0,
  green: 2.1,
  verde: 2.1,
  blue: 3.0,
  azul: 3.0,
  white: 3.0,
  branco: 3.0,
};

function diodeFactory(model: (b: Base) => DiodeModel, kind: 'diode' | 'led' | 'zener'): Factory {
  return (b) => {
    let vLast = 0;
    let vzLast = 0;
    let over = 0;
    let damaged = false;
    let iLast = 0;
    let gdOp = G_OFF;
    const current = (vd: number, m: DiodeModel) => {
      const nvt = m.n * VT;
      const e = Math.exp(Math.min(vd / nvt, 80));
      let id = m.is * (e - 1);
      let gd = (m.is / nvt) * e;
      if (m.vz !== undefined) {
        const ez = Math.exp(Math.min((-vd - m.vz) / nvt, 80));
        id -= m.is * ez;
        gd += (m.is / nvt) * ez;
      }
      return { id, gd: gd + 1e-12 };
    };
    return dev(b, {
      nonlinear: true,
      stamp(st, c) {
        const [a, k] = [b.pins.a!, b.pins.b!];
        if (damaged) {
          st.g(a, k, G_OFF);
          return;
        }
        if (c.mode === 'ac') {
          st.g(a, k, gdOp);
          return;
        }
        const m = model(b);
        const nvt = m.n * VT;
        const vcrit = nvt * Math.log(nvt / (Math.SQRT2 * m.is));
        let vd = v(c, a) - v(c, k);
        if (m.vz !== undefined && vd < 0) {
          // limit the reverse (zener) junction the same way
          const vr = pnjlim(-vd - m.vz, vzLast, nvt, vcrit, c);
          vzLast = vr;
          vd = -(vr + m.vz);
        } else {
          vd = pnjlim(vd, vLast, nvt, vcrit, c);
        }
        vLast = vd;
        const { id, gd } = current(vd, m);
        st.g(a, k, gd);
        st.i(a, k, id - gd * vd);
      },
      accept(c) {
        const m = model(b);
        const vd = v(c, b.pins.a!) - v(c, b.pins.b!);
        const { id, gd } = current(vd, m);
        iLast = id;
        gdOp = gd;
        if (damaged || kind !== 'led') return;
        const max = num(b.params.maxCurrent, 0.03);
        over = id > 1.5 * max ? over + (c.dt || 0.016) : 0;
        if (over > 0.03) {
          damaged = true;
          emit(
            c,
            b.id,
            'damaged',
            `O LED ${b.label} queimou: corrente de ${A(id)}, máximo ${A(max)}.`,
          );
        } else if (vd < -5.5) {
          damaged = true;
          emit(
            c,
            b.id,
            'damaged',
            `O LED ${b.label} queimou: tensão reversa de ${formatSI(-vd, 'V')}, máximo 5 V.`,
          );
        }
      },
      readouts(out) {
        out.burned = damaged;
        if (kind === 'led') out.brightness = damaged ? 0 : Math.min(1, Math.max(0, iLast / 0.02));
      },
      reset() {
        vLast = 0;
        vzLast = 0;
        over = 0;
        damaged = false;
        iLast = 0;
      },
    });
  };
}

const diode = diodeFactory(() => ({ is: 1e-14, n: 1 }), 'diode');
const zener = diodeFactory(
  (b) => ({ is: 1e-14, n: 1, vz: num(b.params.breakdownVoltage, 5.1) }),
  'zener',
);
const led = diodeFactory((b) => {
  const vf = LED_VF[String(b.params.color ?? 'red')] ?? 2;
  const n = 2;
  return { is: 0.02 / Math.exp(vf / (n * VT)), n };
}, 'led');

function potFactory(b: Base): Device {
  const parts = () => {
    const r = Math.max(num(b.params.resistance, 10000), 1e-3);
    const pos = Math.min(1, Math.max(0, num(b.params.position, 0.5)));
    return [Math.max(pos * r, 1e-3), Math.max((1 - pos) * r, 1e-3)] as const;
  };
  return dev(b, {
    stamp(st) {
      const [raw, rwb] = parts();
      st.g(b.pins.a!, b.pins.w!, 1 / raw);
      st.g(b.pins.w!, b.pins.b!, 1 / rwb);
    },
  });
}

function spdtFactory(b: Base): Device {
  return dev(b, {
    stamp(st) {
      const no = bool(b.params.actuated);
      st.g(b.pins.com!, b.pins.nc!, no ? G_OFF : G_ON);
      st.g(b.pins.com!, b.pins.no!, no ? G_ON : G_OFF);
    },
  });
}

function relayFactory(b: Base): Device {
  let closed = false;
  let timer = 0;
  return dev(b, {
    stamp(st) {
      const rc = Math.max(num(b.params.coilResistance, 400), 1e-3);
      st.g(b.pins.coil1!, b.pins.coil2!, 1 / rc);
      st.g(b.pins.com!, b.pins.nc!, closed ? G_OFF : G_ON);
      st.g(b.pins.com!, b.pins.no!, closed ? G_ON : G_OFF);
    },
    accept(c) {
      const rc = Math.max(num(b.params.coilResistance, 400), 1e-3);
      const i = Math.abs(v(c, b.pins.coil1!) - v(c, b.pins.coil2!)) / rc;
      const nominal = num(b.params.coilVoltage, 12) / rc;
      const want = closed ? i > 0.3 * nominal : i > 0.7 * nominal;
      if (want !== closed) {
        timer += c.dt || 0.016;
        if (timer >= (closed ? 0.005 : 0.008)) {
          closed = want;
          timer = 0;
        }
      } else timer = 0;
    },
    readouts(out) {
      out.closed = closed;
    },
    reset() {
      closed = false;
      timer = 0;
    },
  });
}

function dcMotorFactory(b: Base): Device {
  let omega = 0;
  let torque = 0;
  const J = 2e-5;
  const friction = 2e-6;
  return dev(b, {
    stamp(st, c) {
      const R = Math.max(num(b.params.resistance, 2), 1e-3);
      const ke = num(b.params.ke, 0.01);
      st.g(b.pins.a!, b.pins.b!, 1 / R);
      if (c.mode !== 'ac') st.i(b.pins.a!, b.pins.b!, (-ke * omega) / R);
    },
    accept(c) {
      const R = Math.max(num(b.params.resistance, 2), 1e-3);
      const ke = num(b.params.ke, 0.01);
      const i = (v(c, b.pins.a!) - v(c, b.pins.b!) - ke * omega) / R;
      torque = ke * i;
      const load = num(b.params.load, 0) * Math.sign(omega || torque);
      if (c.mode === 'dc') {
        // steady state: ke·(V − ke·ω)/R = friction·ω
        const vab = v(c, b.pins.a!) - v(c, b.pins.b!);
        const target = (ke * vab) / R / (friction + (ke * ke) / R);
        omega += (target - omega) * 0.5;
      } else omega += ((torque - friction * omega - load) / J) * c.dt;
    },
    readouts(out) {
      out.rpm = (omega * 60) / (2 * Math.PI);
      out.torque = torque;
      out.burned = false;
    },
    reset() {
      omega = 0;
      torque = 0;
    },
  });
}

function transformerFactory(b: Base): Device {
  return dev(b, {
    branches: 1,
    stamp(st) {
      const n = num(b.params.ratio, 10);
      const k = this.branch;
      const { p1, p2, s1, s2 } = b.pins as Record<string, number>;
      st.m(p1!, k, 1);
      st.m(p2!, k, -1);
      st.m(s1!, k, -n);
      st.m(s2!, k, n);
      st.m(k, p1!, 1);
      st.m(k, p2!, -1);
      st.m(k, s1!, -n);
      st.m(k, s2!, n);
      // magnetizing branch keeps the primary defined when the secondary is open
      st.g(p1!, p2!, 1e-6);
    },
  });
}

function gateFactory(fn: (a: boolean, b: boolean) => boolean, inputs: 1 | 2): Factory {
  return (b) => {
    let out = false;
    return dev(b, {
      nonlinear: true,
      stamp(st, c) {
        const vcc = num(b.params.vcc, 5);
        const ia = v(c, b.pins.a!) > vcc / 2;
        const ib = inputs === 2 ? v(c, b.pins.b!) > vcc / 2 : false;
        const next = fn(ia, ib);
        if (next !== out) c.limited = true;
        out = next;
        // output: Norton source with 50 Ω to the reference
        const g = 1 / 50;
        st.g(b.pins.y!, -1, g);
        if (c.mode !== 'ac') st.i(-1, b.pins.y!, g * (out ? vcc : 0));
      },
      readouts(o) {
        o.output = out;
      },
      reset() {
        out = false;
      },
    });
  };
}

function opampFactory(b: Base): Device {
  let region = 0; // -1 low rail, 0 linear, 1 high rail
  return dev(b, {
    branches: 1,
    nonlinear: true,
    stamp(st, c) {
      const vs = num(b.params.supply, 15);
      const gain = 1e5;
      const k = this.branch;
      const out = b.pins.out!;
      const vd = v(c, b.pins.inp!) - v(c, b.pins.inn!);
      const next = gain * vd > vs ? 1 : gain * vd < -vs ? -1 : 0;
      if (next !== region) c.limited = true;
      region = next;
      st.m(out, k, 1);
      st.m(k, out, 1);
      if (region === 0) {
        st.m(k, b.pins.inp!, -gain);
        st.m(k, b.pins.inn!, gain);
      } else st.rhs(k, c.mode === 'ac' ? 0 : region * vs);
    },
    reset() {
      region = 0;
    },
  });
}

function mainsFactory(b: Base): Device {
  return dev(b, {
    branches: 1,
    stamp(st, c) {
      const vrms = num(b.params.voltage, 127);
      const f = num(b.params.frequency, 60);
      const value = c.mode === 'tran' ? vrms * Math.SQRT2 * Math.sin(2 * Math.PI * f * c.t) : 0;
      st.v(
        b.pins.l!,
        b.pins.n!,
        this.branch,
        c.mode === 'ac' ? (c.acSource === b.id ? 1 : 0) : value,
      );
      st.g(b.pins.n!, b.pins.pe!, 10); // neutral and protective earth joined at the supply (TN)
    },
  });
}

function photocellFactory(b: Base): Device {
  return dev(b, {
    stamp(st) {
      const blocked = bool(b.params.blocked);
      st.g(b.pins.vp!, b.pins.gnd!, 1 / 400);
      st.g(b.pins.com!, b.pins.nc!, blocked ? G_OFF : G_ON);
      st.g(b.pins.com!, b.pins.no!, blocked ? G_ON : G_OFF);
    },
    readouts(out) {
      out.blocked = bool(b.params.blocked);
    },
  });
}

function dipFactory(b: Base): Device {
  return dev(b, {
    stamp(st) {
      for (const pin of Object.keys(b.pins)) {
        if (!pin.startsWith('a')) continue;
        const i = pin.slice(1);
        st.g(b.pins[pin]!, b.pins[`b${i}`]!, bool(b.params[`s${i}`]) ? G_ON : G_OFF);
      }
    },
  });
}

function humanFactory(b: Base): Device {
  let warned = false;
  let iLast = 0;
  return dev(b, {
    stamp(st) {
      st.g(b.pins.a!, b.pins.b!, 1 / Math.max(num(b.params.resistance, 1000), 1));
    },
    accept(c) {
      iLast = (v(c, b.pins.a!) - v(c, b.pins.b!)) / Math.max(num(b.params.resistance, 1000), 1);
      if (!warned && Math.abs(iLast) > 0.03) {
        warned = true;
        emit(c, b.id, 'warning', `Corrente de ${A(iLast)} pelo corpo: risco de morte.`);
      }
    },
    readouts(out) {
      out.danger = Math.abs(iLast) > 0.03;
    },
    reset() {
      warned = false;
      iLast = 0;
    },
  });
}

function buzzerFactory(b: Base): Device {
  let on = false;
  return dev(b, {
    stamp(st) {
      st.g(b.pins.a!, b.pins.b!, 1 / Math.max(num(b.params.resistance, 200), 1));
    },
    accept(c) {
      on =
        Math.abs(v(c, b.pins.a!) - v(c, b.pins.b!)) / Math.max(num(b.params.resistance, 200), 1) >
        0.005;
    },
    readouts(out) {
      out.sounding = on;
    },
    reset() {
      on = false;
    },
  });
}

export const FACTORIES: Record<string, Factory> = {
  resistor: resistorFactory,
  battery: batteryFactory,
  'dc-voltage': sourceFactory((b) => num(b.params.voltage, 5)),
  'ac-voltage': sourceFactory((b, c) => {
    const amp = num(b.params.amplitude, 10);
    const f = num(b.params.frequency, 60);
    const ph = (num(b.params.phase, 0) * Math.PI) / 180;
    return (
      num(b.params.offset, 0) +
      (c.mode === 'tran' ? amp * Math.sin(2 * Math.PI * f * c.t + ph) : amp * Math.sin(ph))
    );
  }),
  'dc-current': (b) =>
    dev(b, {
      stamp(st, c) {
        if (c.mode !== 'ac') st.i(b.pins.a!, b.pins.b!, num(b.params.current, 0.01));
      },
    }),
  switch: switchLike((p) => bool(p.closed)),
  'push-button': switchLike((p) => bool(p.pressed) !== bool(p.normallyClosed)),
  'reed-switch': switchLike((p) => bool(p.closed)),
  jumper: switchLike((p) => p.fitted !== false),
  'switch-spdt': spdtFactory,
  potentiometer: potFactory,
  trimpot: potFactory,
  capacitor: capacitorFactory,
  inductor: inductorFactory,
  lamp: lampFactory,
  fuse: fuseFactory,
  breaker: breakerFactory,
  diode,
  led,
  zener,
  'relay-spdt': relayFactory,
  'dc-motor': dcMotorFactory,
  transformer: transformerFactory,
  buzzer: buzzerFactory,
  ldr: conductance(
    (b) =>
      1 /
      Math.min(1e7, Math.max(100, 1e4 * (Math.max(num(b.params.lux, 100), 0.01) / 100) ** -0.7)),
  ),
  ntc: conductance((b) => {
    const t = num(b.params.temperature, 25) + 273.15;
    return 1 / (num(b.params.resistance, 10000) * Math.exp(3950 * (1 / t - 1 / 298.15)));
  }),
  'human-body': humanFactory,
  'electric-lock': conductance((b) => 1 / Math.max(num(b.params.resistance, 20), 0.1)),
  and: gateFactory((a, b) => a && b, 2),
  or: gateFactory((a, b) => a || b, 2),
  nand: gateFactory((a, b) => !(a && b), 2),
  nor: gateFactory((a, b) => !(a || b), 2),
  xor: gateFactory((a, b) => a !== b, 2),
  not: gateFactory((a) => !a, 1),
  opamp: opampFactory,
  mains: mainsFactory,
  photocell: photocellFactory,
  'dip-switch': dipFactory,
};
