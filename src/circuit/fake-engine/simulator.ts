/**
 * Circuit solver of the stand-in engine: Modified Nodal Analysis with
 * Newton-Raphson, operating point, backward-Euler transient and small-signal
 * AC sweep.
 */
import type { CircuitDoc, Netlist, ProbeDoc, SimEvent, SimFrame } from '../../engine/contract';
import { elementParams } from '../geometry';
import { getDeviceInfo, hasDevice } from './catalog';
import { FACTORIES, type DevCtx, type Device, type Mode } from './devices';
import { unwrapDegrees, type Sweep, type SweepFrame } from '../runtime/sweep';
import { Recorder, System, systemStamper } from './linear';
import { buildNetlist } from './netlist';

/** Per-step probe samples, as in `SimFrame.samples`. */
export interface Samples {
  t: number[];
  values: Record<string, number[]>;
}

const SOURCES = new Set(['battery', 'dc-voltage', 'ac-voltage', 'dc-current']);

const MAX_ITER = 150;

export class Simulator {
  readonly netlist: Netlist;
  private devices: Device[] = [];
  private nodeIndex = new Map<string, number>();
  private nodeIds: string[] = [];
  private size = 0;
  private sys!: System;
  private x!: Float64Array;
  private pendingEvents: SimEvent[] = [];
  private warnedUnsupported = false;
  private converged = true;
  /** Elements that reported a 'damaged' event since the last reset. */
  private damaged = new Set<string>();
  t = 0;

  constructor(readonly doc: CircuitDoc) {
    this.netlist = buildNetlist(doc);
    this.compile();
  }

  private compile() {
    const ref = this.netlist.nodes.find((n) => n.id === 'GND')?.id ?? this.netlist.nodes[0]?.id;
    let k = 0;
    for (const node of this.netlist.nodes) {
      if (node.id === ref) {
        this.nodeIndex.set(node.id, -1);
        continue;
      }
      this.nodeIndex.set(node.id, k++);
      this.nodeIds.push(node.id);
    }
    const unsupported: string[] = [];
    for (const el of this.doc.elements) {
      if (el.type === 'wire' || el.type === 'ground') continue;
      const factory = FACTORIES[el.type];
      if (!factory || !hasDevice(el.type)) {
        unsupported.push(el.id);
        continue;
      }
      const info = getDeviceInfo(el.type, el.params);
      const pins: Record<string, number> = {};
      for (const p of info.pins) {
        const node = this.netlist.pins[`${el.id}.${p.name}`];
        pins[p.name] = node === undefined ? -1 : (this.nodeIndex.get(node) ?? -1);
      }
      if (el.a && el.b) {
        pins.a = this.nodeIndex.get(this.netlist.pins[`${el.id}.a`]!) ?? -1;
        pins.b = this.nodeIndex.get(this.netlist.pins[`${el.id}.b`]!) ?? -1;
      }
      const device = factory({
        id: el.id,
        type: el.type,
        label: el.label ?? el.id,
        pins,
        params: elementParams(el, info),
      });
      this.devices.push(device);
    }
    for (const d of this.devices) {
      if (d.branches > 0) {
        d.branch = k;
        k += d.branches;
      }
    }
    this.size = k;
    this.sys = new System(Math.max(k, 1));
    this.x = new Float64Array(Math.max(k, 1));
    if (unsupported.length > 0 && !this.warnedUnsupported) {
      this.warnedUnsupported = true;
      this.pendingEvents.push({
        t: 0,
        element: unsupported[0]!,
        kind: 'info',
        message: `Simulação simplificada: ${unsupported.join(', ')} ainda não ${unsupported.length > 1 ? 'são simulados' : 'é simulado'}.`,
      });
    }
  }

  get mode(): Mode {
    return this.doc.analysis.kind === 'dc' ? 'dc' : 'tran';
  }

  get dt(): number {
    const a = this.doc.analysis;
    if (a.kind === 'transient') return a.dt;
    if (a.kind === 'quasi-static') return 1 / (a.frequency * 40);
    return 0;
  }

  setParam(element: string, param: string, value: number | boolean | string) {
    const d = this.devices.find((dev) => dev.id === element);
    if (!d) return;
    d.params[param] = value;
    d.onParam?.(param, value);
  }

  getParam(element: string, param: string) {
    return this.devices.find((dev) => dev.id === element)?.params[param];
  }

  reset() {
    this.t = 0;
    this.x.fill(0);
    for (const d of this.devices) d.reset();
    this.damaged.clear();
    this.converged = true;
  }

  private ctx(mode: Mode, dt: number, events: SimEvent[]): DevCtx {
    return { mode, dt, t: this.t, omega: 0, x: this.x, limited: false, events };
  }

  /** Newton-Raphson on the real system. Returns true when converged. */
  private newton(c: DevCtx): boolean {
    const st = systemStamper(this.sys);
    const next = new Float64Array(this.x.length);
    const nonlinear = this.devices.some((d) => d.nonlinear);
    for (let iter = 0; iter < MAX_ITER; iter++) {
      this.sys.clear();
      c.limited = false;
      c.x = this.x;
      for (const d of this.devices) d.stamp(st, c);
      for (let i = 0; i < this.nodeIds.length; i++) this.sys.add(i, i, 1e-12);
      if (!this.sys.solve(next)) return false;
      let delta = 0;
      for (let i = 0; i < next.length; i++) {
        delta = Math.max(delta, Math.abs(next[i]! - this.x[i]!) / (1 + Math.abs(next[i]!)));
      }
      this.x.set(next);
      if (!nonlinear) return true;
      if (delta < 1e-7 && !c.limited) return true;
    }
    return false;
  }

  /**
   * One analysis step: operating point (dc) or one time step (tran). Returns the
   * frame of the new solution; device states advance after it is read, so
   * currents through capacitors and inductors are those of this step.
   */
  step(wallDt = 0.016, wantFrame = true): SimFrame | null {
    const events = this.pendingEvents;
    const mode = this.mode;
    const dt = mode === 'dc' ? wallDt : this.dt;
    this.t += dt;
    const c = this.ctx(mode, mode === 'dc' ? 0 : dt, events);
    // dc: iterate devices with internal state (lamp filament, motor) towards steady state
    const rounds = mode === 'dc' ? 4 : 1;
    let frame: SimFrame | null = null;
    for (let r = 0; r < rounds; r++) {
      const ok = this.newton(c);
      if (!ok && this.converged) {
        events.push({
          t: this.t,
          element: '',
          kind: 'warning',
          message: 'A simulação não convergiu neste instante; os valores podem estar imprecisos.',
        });
      }
      this.converged = ok;
      if (r === rounds - 1 && wantFrame) frame = this.frame();
      c.dt = mode === 'dc' ? wallDt / rounds : dt;
      for (const d of this.devices) d.accept?.(c);
    }
    this.noteDamage(events);
    return frame;
  }

  /** Remembers the elements damaged by these events (`X.damaged` readout). */
  private noteDamage(events: SimEvent[]) {
    for (const e of events) if (e.kind === 'damaged' && e.element) this.damaged.add(e.element);
  }

  /** Events produced since the last call. */
  drainEvents(): SimEvent[] {
    return this.pendingEvents.splice(0);
  }

  /** Solves the current state without advancing time (paused dc circuits). */
  solveNow(): SimFrame {
    const events = this.pendingEvents;
    const c = this.ctx(this.mode, this.mode === 'dc' ? 0 : this.dt, events);
    if (this.mode === 'dc') {
      for (let r = 0; r < 4; r++) {
        this.newton(c);
        c.dt = 0;
        for (const d of this.devices) if (d.type === 'lamp' || d.type === 'dc-motor') d.accept?.(c);
      }
    } else {
      // the instant after the current state (capacitor charges, coil currents),
      // so a paused circuit shows its voltages instead of all zeros
      this.newton(c);
    }
    this.noteDamage(events);
    return this.frame();
  }

  /** Current entering each pin of each device, computed from its own stamp. */
  private pinCurrents(c: DevCtx): Map<Device, Record<string, number>> {
    const out = new Map<Device, Record<string, number>>();
    for (const d of this.devices) {
      // Pins on the reference node get spare indices past the unknowns (read
      // as 0 V) so the current of each one is recorded, even when a device has
      // two pins on ground (a relay's coil and contact).
      const original = { ...d.pins };
      let spare = this.x.length;
      for (const [pin, idx] of Object.entries(d.pins)) if (idx < 0) d.pins[pin] = spare++;
      const rec = new Recorder();
      try {
        d.stamp(rec, { ...c, limited: false });
      } finally {
        Object.assign(d.pins, original);
      }
      const currents: Record<string, number> = {};
      let k = this.x.length;
      for (const [pin, idx] of Object.entries(original)) {
        currents[pin] = rec.currentFrom(idx < 0 ? k++ : idx, this.x);
      }
      out.set(d, currents);
    }
    return out;
  }

  voltage(node: string): number {
    const idx = this.nodeIndex.get(node);
    return idx === undefined || idx < 0 ? 0 : this.x[idx]!;
  }

  private probeValue(p: ProbeDoc, readouts: Record<string, number | boolean | string>): number {
    if (p.kind === 'voltage') {
      return this.refVoltage(p.plus) - this.refVoltage(p.minus);
    }
    const value = readouts[`${p.element}.${p.kind}`];
    return typeof value === 'number' ? value : Number.NaN;
  }

  refVoltage(ref: string): number {
    if (ref === 'GND' || ref === '0') return 0;
    const node = this.netlist.pins[ref] ?? ref;
    return this.voltage(node);
  }

  frame(): SimFrame {
    const nodeVoltages: Record<string, number> = {};
    for (const node of this.netlist.nodes) nodeVoltages[node.id] = this.voltage(node.id);
    const readouts: SimFrame['readouts'] = {};
    const c = this.ctx(this.mode, this.dt, []);
    const currents = this.pinCurrents(c);
    for (const d of this.devices) {
      const cur = currents.get(d)!;
      const twoTerminal = 'a' in d.pins && 'b' in d.pins && Object.keys(d.pins).length === 2;
      for (const [pin, value] of Object.entries(cur)) readouts[`${d.id}.pin.${pin}`] = value;
      if (twoTerminal) {
        // Same convention as the real engine: passives report a→b current and
        // absorbed power; sources report delivered current (out of a) and power.
        const vab = this.idxVoltage(d.pins.a!) - this.idxVoltage(d.pins.b!);
        const sign = SOURCES.has(d.type) ? -1 : 1;
        readouts[`${d.id}.current`] = sign * cur.a!;
        readouts[`${d.id}.voltage`] = vab;
        readouts[`${d.id}.power`] = sign * vab * cur.a!;
      }
      const extra: Record<string, number | boolean | string> = {};
      if (this.damaged.has(d.id)) extra.damaged = true;
      d.readouts?.(extra, c);
      for (const [k, value] of Object.entries(extra)) readouts[`${d.id}.${k}`] = value;
    }
    for (const p of this.doc.probes ?? []) readouts[p.id] = this.probeValue(p, readouts);
    return { t: this.t, nodeVoltages, readouts, events: [] };
  }

  private idxVoltage(idx: number) {
    return idx < 0 ? 0 : this.x[idx]!;
  }

  /**
   * Small-signal sweep. Like the real engine, one frame carries the whole
   * sweep: gain (V/V) and unwrapped phase (°) of each voltage probe.
   */
  acSweep(): SweepFrame[] {
    const a = this.doc.analysis;
    if (a.kind !== 'ac-sweep') return [];
    // operating point first (linearizes diodes and friends)
    const events: SimEvent[] = [];
    const dcCtx = this.ctx('dc', 0, events);
    this.newton(dcCtx);
    for (const d of this.devices) d.accept?.(dcCtx);

    const n = this.size;
    const sys = new System(Math.max(n, 1));
    const st = systemStamper(sys);
    const xr = new Float64Array(Math.max(n, 1));
    const xi = new Float64Array(Math.max(n, 1));
    const probes = (this.doc.probes ?? []).filter((p) => p.kind === 'voltage');
    const sweep: Sweep = { f: [], magnitude: {}, phase: {} };
    for (const p of probes) {
      sweep.magnitude[p.id] = [];
      sweep.phase[p.id] = [];
    }
    const complexAt = (ref: string): [number, number] => {
      if (ref === 'GND' || ref === '0') return [0, 0];
      const idx = this.nodeIndex.get(this.netlist.pins[ref] ?? ref);
      return idx === undefined || idx < 0 ? [0, 0] : [xr[idx]!, xi[idx]!];
    };
    const points = Math.max(2, a.points);
    for (let i = 0; i < points; i++) {
      const f = a.fStart * (a.fStop / a.fStart) ** (i / (points - 1));
      sys.clear();
      const c: DevCtx = {
        mode: 'ac',
        dt: 0,
        t: f,
        omega: 2 * Math.PI * f,
        acSource: a.source,
        x: this.x,
        limited: false,
        events: [],
      };
      for (const d of this.devices) d.stamp(st, c);
      for (let j = 0; j < this.nodeIds.length; j++) sys.add(j, j, 1e-12);
      sys.solve(xr, xi);
      sweep.f.push(f);
      for (const p of probes) {
        if (p.kind !== 'voltage') continue;
        const [pr, pi] = complexAt(p.plus);
        const [mr, mi] = complexAt(p.minus);
        sweep.magnitude[p.id]!.push(Math.hypot(pr - mr, pi - mi));
        sweep.phase[p.id]!.push((Math.atan2(pi - mi, pr - mr) * 180) / Math.PI);
      }
    }
    for (const p of probes) sweep.phase[p.id] = unwrapDegrees(sweep.phase[p.id]!);
    return [{ t: 0, nodeVoltages: {}, readouts: {}, events: [], sweep }];
  }
}
