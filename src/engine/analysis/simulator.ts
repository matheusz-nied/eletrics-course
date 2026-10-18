import type {
  CircuitDoc,
  DeviceInfo,
  ParamValue,
  ProbeDoc,
  SimEvent,
  SimFrame,
  Vec2,
} from '../contract';
import {
  infoFor,
  type AcContext,
  type DeviceDefinition,
  type DeviceModel,
  type Method,
  type NewtonState,
  type NodeSignal,
  type PhasorView,
  type StepInfo,
  type SolutionView,
  type UpdateContext,
} from '../device';
import { findDevice } from '../devices';
import { pinPoints } from '../format/geometry';
import { buildNetlist, GROUND } from '../format/netlist';
import { checkParam, CircuitError, validateCircuit } from '../format/validate';
import { AMBIENT_C, GMIN } from '../models/constants';
import { ComplexMna, StampLog } from '../solver/complex';
import { MnaSystem } from '../solver/mna';
import { SingularMatrixError } from '../solver/lu';
import { buildWireGraph, wireCurrents, type WireGraph } from './wires';

/** Time step of the DC analysis, which still advances time for thermal models (s). */
export const DC_STEP = 1e-3;
/** Step used to show a paused transient after a change, without advancing time (s). */
const REFRESH_STEP = 1e-9;
/** Newton iterations for DC solves, and for a transient step before it is split. */
const MAX_NEWTON_DC = 100;
const MAX_NEWTON_TRAN = 30;
/** A step that does not converge is split down to this many pieces. */
const MAX_PIECES = 1024;
/**
 * From this many pieces on, a piece that still fails gets gmin stepping: a
 * circuit with positive feedback (a multivibrator, a Schmitt trigger) reaches
 * points where its solution jumps, and no step is short enough for Newton
 * alone to follow the jump.
 */
const HOMOTOPY_PIECES = 8;
const RELTOL = 1e-6;
const VNTOL = 1e-6;
const ABSTOL = 1e-12;
/**
 * Residual, relative to the size of a row's terms, below which a guess
 * satisfies its equations: a few orders above rounding, far below RELTOL
 * (a looser value lets companion-model errors pile up step after step).
 */
const RESIDUAL_RELTOL = 1e-10;

const NO_CONVERGENCE = 'A simulação parou: o circuito não convergiu neste instante.';
const SINGULAR =
  'A simulação parou: o circuito não tem solução. Há um laço só de fontes de tensão ou uma fonte de corrente sem caminho de volta?';
const DIVERGED = 'A simulação parou: os valores divergiram (resultado infinito).';

function newtonState(): NewtonState {
  return { iteration: 0, limited: false, gmin: 0, sourceScale: 1, initJunctions: false };
}

export class SimulationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimulationError';
  }
}

interface Element {
  id: string;
  index: number;
  def: DeviceDefinition;
  info: DeviceInfo;
  model: DeviceModel;
  params: Record<string, ParamValue>;
  pins: number[];
  currents: Float64Array;
  twoTerminal: boolean;
  /** It emitted a 'damaged' event since the last reset (readout `X.damaged`). */
  damaged: boolean;
  /** Quasi-static: its stamps in the phasor solve, and the phasor current into each pin. */
  log?: StampLog;
  acRe?: Float64Array;
  acIm?: Float64Array;
}

/** UpdateContext with the fields the simulator rewrites for each device. */
interface MutableUpdateContext extends UpdateContext {
  commit: boolean;
  t: number;
  element: string;
}

type ResolvedProbe =
  | { id: string; kind: 'voltage'; plus: number; minus: number }
  | { id: string; kind: 'current' | 'power'; element: Element }
  /** Current in a wire (its first segment), from the wire currents. */
  | { id: string; kind: 'wire'; key: string };

/**
 * One circuit, ready to step: compiled devices, the MNA system and the
 * integration state. Pure computation (no timers, no DOM): the runtime drives
 * it in real time and runUntil/tests drive it directly.
 */
export class Simulator {
  readonly doc: CircuitDoc;
  /** Mode of the (real) solve: the quasi-static analysis solves DC, then phasors. */
  readonly mode: 'dc' | 'tran';
  /** Quasi-static analysis: each step solves DC and the AC steady state at one frequency. */
  readonly quasiStatic: boolean;
  /** Fixed step of this circuit (s). */
  readonly dt: number;
  /** Simulated time (s). */
  t = 0;
  /** Accepted steps since the last reset. */
  steps = 0;

  private readonly elements: Element[] = [];
  private readonly byId = new Map<string, Element>();
  private readonly nodeIds: string[] = [];
  private readonly isNode: boolean[] = [];
  private readonly system: MnaSystem;
  private readonly accepted: Float64Array;
  private readonly guess: Float64Array;
  private readonly nonlinear: boolean;
  private readonly wires: WireGraph;
  private readonly wireScratch: Float64Array;
  private readonly probes: ResolvedProbe[];
  private readonly initialParams = new Map<string, Record<string, ParamValue>>();
  private restart = true;
  /** False until the first solution after load or reset (junctions start at Vcrit). */
  private solved = false;
  private complex?: ComplexMna;
  private lastSweep?: NonNullable<SimFrame['sweep']>;
  private pendingEvents: SimEvent[] = [];
  private sampleT: number[] = [];
  private sampleValues: Record<string, number[]> = {};
  /** Elements in update order: coupled devices after the ones they follow. */
  private readonly order: Element[] = [];
  private readonly signals = new Map<number, NodeSignal>();
  // Quasi-static: angular frequency, phasor solution (and the first pass's), element being read.
  private readonly omega: number = 0;
  private readonly acRe: Float64Array;
  private readonly acIm: Float64Array;
  private readonly firstRe: Float64Array;
  private readonly firstIm: Float64Array;
  private acElement?: Element;
  private readonly phasorView: PhasorView;
  private readonly firstView: PhasorView;

  constructor(doc: CircuitDoc) {
    const { errors } = validateCircuit(doc);
    if (errors.length) throw new CircuitError(doc?.id ?? '?', errors);
    this.doc = doc;
    const analysis = doc.analysis;
    this.mode = analysis.kind === 'transient' ? 'tran' : 'dc';
    this.quasiStatic = analysis.kind === 'quasi-static';
    this.dt =
      analysis.kind === 'transient'
        ? analysis.dt
        : analysis.kind === 'quasi-static'
          ? analysis.dtMech
          : DC_STEP;
    if (analysis.kind === 'quasi-static') this.omega = 2 * Math.PI * analysis.frequency;

    const netlist = buildNetlist(doc);
    const nodeIndex = new Map<string, number>();
    for (const node of netlist.nodes) {
      if (node.id === GROUND) continue;
      nodeIndex.set(node.id, this.nodeIds.length);
      this.nodeIds.push(node.id);
      this.isNode.push(true);
    }
    const pinPositions: { element: number; pin: number; point: Vec2; ground: boolean }[] = [];
    for (const el of doc.elements) {
      if (el.type === 'wire') continue;
      const def = findDevice(el.type)!;
      const info = infoFor(def, el.params);
      const params: Record<string, ParamValue> = {};
      for (const [name, p] of Object.entries(info.params)) params[name] = p.default;
      Object.assign(params, el.params);
      this.initialParams.set(el.id, { ...params });
      const pins = info.pins.map((pin) => {
        const node = netlist.pins[`${el.id}.${pin.name}`];
        return node === GROUND ? -1 : nodeIndex.get(node)!;
      });
      const index = this.elements.length;
      pinPoints(el, info).forEach((point, pin) =>
        pinPositions.push({ element: index, pin, point, ground: el.type === 'ground' }),
      );
      const model = def.create({
        id: el.id,
        params,
        pins,
        branch: () => {
          this.isNode.push(false);
          return this.isNode.length - 1;
        },
        node: () => {
          this.isNode.push(true);
          return this.isNode.length - 1;
        },
        analysis: analysis.kind,
        signal: (node) => this.signal(node),
      });
      const element: Element = {
        id: el.id,
        index,
        def,
        info,
        model,
        params,
        pins,
        currents: new Float64Array(info.pins.length),
        twoTerminal: info.terminals === 'two',
        damaged: false,
      };
      this.elements.push(element);
      this.byId.set(el.id, element);
    }
    this.nonlinear = this.elements.some((e) => e.model.nonlinear);
    if (analysis.kind === 'ac-sweep' || this.quasiStatic) {
      const missing = this.elements.filter((e) => !e.model.stampAc).map((e) => e.id);
      if (missing.length)
        throw new CircuitError(doc.id, [
          `estes componentes não entram na ${this.quasiStatic ? 'análise quase-estática' : 'varredura CA'}: ${missing.join(', ')}`,
        ]);
    }
    this.order = this.couple();
    const size = this.isNode.length;
    this.system = new MnaSystem(size);
    this.accepted = new Float64Array(size);
    this.guess = new Float64Array(size);
    const phasorSize = this.quasiStatic ? size : 0;
    this.acRe = new Float64Array(phasorSize);
    this.acIm = new Float64Array(phasorSize);
    this.firstRe = new Float64Array(phasorSize);
    this.firstIm = new Float64Array(phasorSize);
    this.phasorView = this.phasors(this.acRe, this.acIm, true);
    this.firstView = this.phasors(this.firstRe, this.firstIm, false);
    if (this.quasiStatic) {
      for (const el of this.elements) {
        el.log = new StampLog();
        el.acRe = new Float64Array(el.pins.length);
        el.acIm = new Float64Array(el.pins.length);
      }
    }

    this.wires = buildWireGraph(doc, pinPositions);
    this.wireScratch = new Float64Array(this.wires.vertexCount);

    const pinNode = (ref: string) => {
      if (ref === GROUND) return -1;
      const node = netlist.pins[ref];
      return node === GROUND ? -1 : nodeIndex.get(node)!;
    };
    this.probes = (doc.probes ?? []).map((p: ProbeDoc): ResolvedProbe => {
      if (p.kind === 'voltage') {
        return { id: p.id, kind: 'voltage', plus: pinNode(p.plus), minus: pinNode(p.minus) };
      }
      const element = this.byId.get(p.element);
      if (!element) return { id: p.id, kind: 'wire', key: `${p.element}.current` };
      return { id: p.id, kind: p.kind, element };
    });
    for (const p of this.probes) this.sampleValues[p.id] = [];
  }

  /** AC sweep: one solution per frequency instead of a run in time (play does nothing). */
  get isSweep(): boolean {
    return this.doc.analysis.kind === 'ac-sweep';
  }

  /** Whether the analysis has a stop time and reached it. */
  get finished(): boolean {
    return this.doc.analysis.kind === 'transient' && this.doc.analysis.tStop !== undefined
      ? this.t >= this.doc.analysis.tStop - this.dt * 1e-6
      : false;
  }

  /**
   * Advances one fixed step. When Newton-Raphson does not converge, the step
   * is done in smaller pieces (down to 1/1024), with gmin stepping for the
   * pieces that still fail. Throws SimulationError when the circuit has no
   * solution.
   */
  step(): void {
    if (this.quasiStatic) {
      this.solveQuasiStatic(this.dt, true);
      this.steps++;
      this.recordSamples();
      return;
    }
    const end = this.t + this.dt;
    if (!this.tryAdvance(this.dt, this.restart ? 'be' : 'trap')) {
      let pieces = 2;
      while (this.t < end - this.dt * 1e-9) {
        const h = Math.min(this.dt / pieces, end - this.t);
        if (this.tryAdvance(h, 'be')) continue;
        if (pieces >= HOMOTOPY_PIECES && this.tryAdvance(h, 'be', true)) continue;
        if (pieces >= MAX_PIECES) throw new SimulationError(NO_CONVERGENCE);
        pieces *= 2;
      }
    }
    this.t = end;
    this.steps++;
    this.recordSamples();
  }

  /**
   * Solves the circuit at the current time without advancing it, so a change
   * made while paused (a switch, a slider) shows right away.
   */
  refresh(): void {
    if (this.quasiStatic) {
      this.solveQuasiStatic(0, false);
      return;
    }
    const step: StepInfo =
      this.mode === 'dc'
        ? { mode: 'dc', t: this.t, dt: 0, method: 'be', nl: newtonState() }
        : { mode: 'tran', t: this.t, dt: REFRESH_STEP, method: 'be', nl: newtonState() };
    const x = this.solveRobust(step);
    this.update(step, x, false);
    this.accepted.set(x);
    this.solved = true;
    if (this.isSweep) this.lastSweep = this.sweep();
  }

  setParam(element: string, param: string, value: ParamValue): void {
    const el = this.byId.get(element);
    if (!el) throw new SimulationError(`Elemento desconhecido: "${element}".`);
    const problem = checkParam(el.info, param, value);
    if (problem) throw new SimulationError(`${element}: ${problem}.`);
    if (el.params[param] === value) return;
    el.params[param] = value;
    el.model.paramChanged?.(param);
    this.restart = true;
  }

  getParam(element: string, param: string): ParamValue | undefined {
    return this.byId.get(element)?.params[param];
  }

  /** Time back to zero; damaged parts restored, capacitors discharged. Parameters are kept. */
  reset(): void {
    this.t = 0;
    this.steps = 0;
    this.restart = true;
    this.solved = false;
    this.accepted.fill(0);
    this.acRe.fill(0);
    this.acIm.fill(0);
    for (const signal of this.signals.values()) {
      signal.phase = undefined;
      signal.frames.length = 0;
    }
    this.pendingEvents = [];
    this.clearSamples();
    for (const el of this.elements) {
      el.damaged = false;
      el.model.reset?.();
    }
  }

  /** Parameters as the document defines them (for "restore defaults"). */
  restoreParams(): void {
    for (const el of this.elements) {
      Object.assign(el.params, this.initialParams.get(el.id));
    }
    this.restart = true;
  }

  /** Snapshot of the circuit now, with the events and samples since the last frame. */
  frame(opts: { samples?: boolean; maxSamples?: number } = {}): SimFrame {
    const x = this.view(this.accepted);
    const nodeVoltages: Record<string, number> = { [GROUND]: 0 };
    this.nodeIds.forEach((id, i) => (nodeVoltages[id] = this.combined(this.accepted[i], i, -1)));
    const readouts: SimFrame['readouts'] = {};
    for (const el of this.elements) this.collect(el, x, readouts);
    this.wireCurrents(readouts);
    for (const p of this.probes) readouts[p.id] = this.probeValue(p, x, readouts);
    const frame: SimFrame = { t: this.t, nodeVoltages, readouts, events: this.pendingEvents };
    this.pendingEvents = [];
    if (this.lastSweep) frame.sweep = this.lastSweep;
    if (opts.samples !== false && this.probes.length) {
      frame.samples = this.takeSamples(opts.maxSamples ?? 2000);
    }
    return frame;
  }

  /** Drops samples collected since the last frame (runUntil keeps its own). */
  clearSamples(): void {
    this.sampleT = [];
    for (const p of this.probes) this.sampleValues[p.id] = [];
  }

  // ---------------------------------------------------------------------------

  private view(x: Float64Array): SolutionView {
    return { x, v: (i: number) => (i < 0 ? 0 : x[i]) };
  }

  /** Shared signals of a node (phase control, data frames). */
  private signal(node: number): NodeSignal {
    let s = this.signals.get(node);
    if (!s) {
      s = { frames: [] };
      this.signals.set(node, s);
    }
    return s;
  }

  /**
   * Resolves couplings between devices (`params.motor = "M1"`) and returns
   * the update order: each coupled device after the one it follows.
   */
  private couple(): Element[] {
    const problems: string[] = [];
    const targets = new Map<Element, Element>();
    for (const el of this.elements) {
      if (!el.model.couple) continue;
      let target: Element | undefined;
      const problem = el.model.couple((id) => {
        target = this.byId.get(id);
        return target?.model;
      });
      if (problem) problems.push(`elemento ${el.id}: ${problem}`);
      if (target && target !== el) targets.set(el, target);
    }
    if (problems.length) throw new CircuitError(this.doc.id, problems);
    const depth = (el: Element, seen = new Set<Element>()): number => {
      const target = targets.get(el);
      if (!target || seen.has(el)) return 0;
      seen.add(el);
      return 1 + depth(target, seen);
    };
    const depths = new Map(this.elements.map((el) => [el, depth(el)]));
    return [...this.elements].sort((a, b) => depths.get(a)! - depths.get(b)! || a.index - b.index);
  }

  /**
   * One quasi-static step of length dt (0 = refresh, nothing advances): the
   * DC solution (logic, sensors, relay coils), then the AC steady state at
   * the analysis frequency (mains, motors, TRIACs), then device updates with
   * both, where motors and mechanics integrate over dt.
   */
  private solveQuasiStatic(dt: number, commit: boolean): void {
    const step: StepInfo = {
      mode: 'dc',
      t: this.t + dt,
      dt,
      method: 'be',
      nl: newtonState(),
      quasiStatic: true,
    };
    const x = this.solveRobust(step);
    this.solvePhasors(x);
    step.ac = this.phasorView;
    this.solved = true;
    this.update(step, x, commit);
    this.accepted.set(x);
    this.t = step.t;
  }

  /**
   * Phasor solve at the analysis frequency around the DC solution `op`, in
   * two passes when a device asks for the first one's solution. Records each
   * device's stamps to get its pin currents.
   */
  private solvePhasors(op: Float64Array): void {
    const n = this.isNode.length;
    const cm = (this.complex ??= new ComplexMna(n));
    const opView = this.view(op);
    let again = false;
    const ctx: AcContext = {
      omega: this.omega,
      source: '',
      id: '',
      phasor: true,
      again: () => (again = true),
    };
    for (let pass = 0; pass < 2; pass++) {
      cm.clear();
      for (let i = 0; i < n; i++) if (this.isNode[i]) cm.add(i, i, GMIN);
      for (const el of this.elements) {
        ctx.id = el.id;
        el.log!.clear();
        cm.log = el.log;
        el.model.stampAc!(cm, ctx, opView);
      }
      cm.log = undefined;
      try {
        cm.solve();
      } catch (error) {
        if (error instanceof SingularMatrixError) throw new SimulationError(SINGULAR);
        throw error;
      }
      for (let i = 0; i < n; i++) {
        if (!Number.isFinite(cm.xRe[i]) || !Number.isFinite(cm.xIm[i]))
          throw new SimulationError(DIVERGED);
      }
      if (!again || pass === 1) break;
      this.firstRe.set(cm.xRe);
      this.firstIm.set(cm.xIm);
      ctx.first = this.firstView;
      again = false;
    }
    this.acRe.set(cm.xRe);
    this.acIm.set(cm.xIm);
    for (const el of this.elements) el.log!.pinCurrents(el.pins, cm.xRe, cm.xIm, el.acRe!, el.acIm!);
  }

  /** A phasor solution; `pins` reads the pin currents of the element in `acElement`. */
  private phasors(re: Float64Array, im: Float64Array, pins: boolean): PhasorView {
    const omega = this.omega;
    return {
      omega,
      re: (i) => (i < 0 ? 0 : re[i]),
      im: (i) => (i < 0 ? 0 : im[i]),
      pinRe: (k) => (pins ? (this.acElement?.acRe?.[k] ?? 0) : 0),
      pinIm: (k) => (pins ? (this.acElement?.acIm?.[k] ?? 0) : 0),
    };
  }

  /**
   * A DC value and the phasor at `plus` − `minus` combined as a true-RMS
   * reading, signed like the DC part (what nodes, probes and two-terminal
   * readouts report in the quasi-static analysis). Outside it, the DC value.
   */
  private combined(dc: number, plus: number, minus: number): number {
    if (!this.quasiStatic) return dc;
    const at = (arr: Float64Array, i: number) => (i < 0 ? 0 : arr[i]);
    const re = at(this.acRe, plus) - at(this.acRe, minus);
    const im = at(this.acIm, plus) - at(this.acIm, minus);
    const value = Math.sqrt(dc * dc + re * re + im * im);
    return dc < 0 ? -value : value;
  }

  /**
   * One step of length h; false when it did not converge (nothing committed).
   * `homotopy` solves it by gmin stepping instead of plain Newton-Raphson.
   */
  private tryAdvance(h: number, method: Method, homotopy = false): boolean {
    const step: StepInfo = { mode: this.mode, t: this.t + h, dt: h, method, nl: newtonState() };
    for (const el of this.elements) el.model.beginSolve?.();
    // DC steps and the first step from rest get the full set of fallbacks.
    const x =
      this.mode === 'dc' || this.steps === 0
        ? this.solveRobust(step)
        : homotopy
          ? this.gminStepping(step, this.accepted, false)
          : this.newton(step, MAX_NEWTON_TRAN);
    if (!x) return false;
    // After a jump the trapezoidal rule would ring: the next step restarts with backward Euler.
    this.restart = homotopy;
    this.solved = true;
    this.update(step, x, true);
    this.accepted.set(x);
    this.t = step.t;
    return true;
  }

  /** Newton-Raphson, then gmin stepping, then source stepping (as SPICE does for DC). */
  private solveRobust(step: StepInfo): Float64Array {
    for (const el of this.elements) el.model.beginSolve?.();
    const start = new Float64Array(this.accepted);
    const x = this.newton(step, MAX_NEWTON_DC, start, !this.solved);
    if (x || !this.nonlinear) return x ?? this.fail();
    return this.gminStepping(step, start, !this.solved) ?? this.sourceStepping(step);
  }

  /**
   * gmin stepping: a large conductance from every node to ground (and across
   * every junction), reduced decade by decade, each solution starting the next.
   */
  private gminStepping(
    step: StepInfo,
    start: Float64Array,
    init: boolean,
  ): Float64Array | undefined {
    let from = new Float64Array(start);
    for (let gmin = 1e-2; gmin >= 1e-12; gmin /= 10) {
      step.nl.gmin = gmin;
      const xi = this.newton(step, MAX_NEWTON_DC, from, init && gmin === 1e-2);
      if (!xi) {
        step.nl.gmin = 0;
        return undefined;
      }
      from = new Float64Array(xi);
    }
    step.nl.gmin = 0;
    return this.newton(step, MAX_NEWTON_DC, from);
  }

  /** Source stepping: sources ramp from zero to their value. */
  private sourceStepping(step: StepInfo): Float64Array {
    for (const el of this.elements) el.model.beginSolve?.();
    let from = new Float64Array(this.accepted.length);
    let scale = 0;
    let delta = 0.1;
    while (scale < 1) {
      const next = Math.min(1, scale + delta);
      step.nl.sourceScale = next;
      const xi = this.newton(step, MAX_NEWTON_DC, from, scale === 0);
      if (xi) {
        from = new Float64Array(xi);
        scale = next;
        delta = Math.min(delta * 2, 0.25);
      } else {
        delta /= 4;
        if (delta < 1e-4) return this.fail();
      }
    }
    step.nl.sourceScale = 1;
    return from;
  }

  /**
   * AC sweep at the operating point in `accepted`: the sweep source carries
   * 1 V (or 1 A) at phase 0, other sources are zeroed, and each voltage probe
   * gets its gain (V/V) and unwrapped phase (degrees) at log-spaced frequencies.
   */
  private sweep(): NonNullable<SimFrame['sweep']> {
    const analysis = this.doc.analysis as Extract<CircuitDoc['analysis'], { kind: 'ac-sweep' }>;
    const { fStart, fStop, points, source } = analysis;
    const n = this.isNode.length;
    const cm = (this.complex ??= new ComplexMna(n));
    const op = this.view(this.accepted);
    const probes = this.probes.filter((p) => p.kind === 'voltage');
    const result: NonNullable<SimFrame['sweep']> = { f: [], magnitude: {}, phase: {} };
    for (const p of probes) {
      result.magnitude[p.id] = [];
      result.phase[p.id] = [];
    }
    const ctx = { omega: 0, source, id: '' };
    for (let k = 0; k < points; k++) {
      const f = fStart * Math.pow(fStop / fStart, k / (points - 1));
      ctx.omega = 2 * Math.PI * f;
      cm.clear();
      for (let i = 0; i < n; i++) if (this.isNode[i]) cm.add(i, i, GMIN);
      for (const el of this.elements) {
        ctx.id = el.id;
        el.model.stampAc!(cm, ctx, op);
      }
      try {
        cm.solve();
      } catch (error) {
        if (error instanceof SingularMatrixError) throw new SimulationError(SINGULAR);
        throw error;
      }
      result.f.push(f);
      const at = (arr: Float64Array, i: number) => (i < 0 ? 0 : arr[i]);
      for (const p of probes) {
        if (p.kind !== 'voltage') continue;
        const re = at(cm.xRe, p.plus) - at(cm.xRe, p.minus);
        const im = at(cm.xIm, p.plus) - at(cm.xIm, p.minus);
        const phases = result.phase[p.id];
        let ph = (Math.atan2(im, re) * 180) / Math.PI;
        const prev = phases.at(-1);
        if (prev !== undefined) ph -= 360 * Math.round((ph - prev) / 360);
        result.magnitude[p.id].push(Math.hypot(re, im));
        phases.push(ph);
      }
    }
    return result;
  }

  private fail(): never {
    throw new SimulationError(NO_CONVERGENCE);
  }

  /**
   * Newton-Raphson from `start` (default: the accepted solution). Returns the
   * converged solution (a view of an internal buffer) or undefined.
   */
  private newton(
    step: StepInfo,
    maxIter: number,
    start = this.accepted,
    init = false,
  ): Float64Array | undefined {
    const sys = this.system;
    const guess = this.guess;
    guess.set(start);
    const view = this.view(guess);
    const gmin = GMIN + step.nl.gmin;
    for (let iter = 0; iter < maxIter; iter++) {
      step.nl.iteration = iter;
      step.nl.limited = false;
      step.nl.initJunctions = init && iter === 0;
      sys.clear();
      for (let i = 0; i < this.isNode.length; i++) if (this.isNode[i]) sys.add(i, i, gmin);
      for (const el of this.elements) el.model.stamp(sys, step, view);
      // A slow convergence may only be rounding noise in a badly conditioned
      // unknown (a floating winding, a node held only by reverse-biased
      // junctions): when the guess already satisfies every equation, this
      // solve only polishes it and ends the iteration.
      const settled = iter >= 2 && !step.nl.limited && this.satisfies(guess);
      let x: Float64Array;
      try {
        x = sys.solve();
      } catch (error) {
        if (!(error instanceof SingularMatrixError)) throw error;
        if (this.nonlinear) return undefined;
        throw new SimulationError(SINGULAR);
      }
      for (let i = 0; i < x.length; i++) {
        if (!Number.isFinite(x[i])) {
          if (this.nonlinear) return undefined;
          throw new SimulationError(DIVERGED);
        }
      }
      if (!this.nonlinear) return x;
      let converged = !step.nl.limited;
      for (let i = 0; converged && !settled && i < x.length; i++) {
        const tol =
          RELTOL * Math.max(Math.abs(x[i]), Math.abs(guess[i])) + (this.isNode[i] ? VNTOL : ABSTOL);
        if (Math.abs(x[i] - guess[i]) > tol) converged = false;
      }
      guess.set(x);
      if (converged && iter > 0) return guess;
    }
    return undefined;
  }

  /**
   * Whether `x` satisfies the system just stamped at it: every row's residual
   * within RESIDUAL_RELTOL of the size of its terms (or an absolute floor).
   */
  private satisfies(x: Float64Array): boolean {
    const { a, b, size: n } = this.system;
    for (let i = 0; i < n; i++) {
      let residual = -b[i];
      let scale = Math.abs(b[i]);
      for (let j = 0, k = i * n; j < n; j++, k++) {
        if (a[k] === 0) continue;
        const term = a[k] * x[j];
        residual += term;
        scale += Math.abs(term);
      }
      const floor = this.isNode[i] ? ABSTOL : VNTOL;
      if (Math.abs(residual) > RESIDUAL_RELTOL * scale + floor) return false;
    }
    return true;
  }

  private update(step: StepInfo, x: Float64Array, commit: boolean): void {
    const view = this.view(x);
    const ctx = this.updateContext;
    ctx.commit = commit;
    ctx.t = step.t;
    for (const el of this.order) {
      ctx.element = el.id;
      this.acElement = el;
      el.model.update?.(step, view, ctx);
      el.model.pinCurrents(view, el.currents);
    }
    this.acElement = undefined;
  }

  /** One context reused for every device update (no allocation per step). */
  private readonly updateContext: MutableUpdateContext = {
    commit: false,
    ambient: AMBIENT_C,
    t: 0,
    element: '',
    emit: (kind: SimEvent['kind'], message: string) => {
      const ctx = this.updateContext;
      this.pendingEvents.push({ t: ctx.t, element: ctx.element, kind, message });
      if (kind === 'damaged') this.byId.get(ctx.element)!.damaged = true;
    },
    discontinuity: () => {
      this.restart = true;
    },
  };

  private collect(el: Element, x: SolutionView, out: SimFrame['readouts']): void {
    const prefix = `${el.id}.`;
    const qs = this.quasiStatic;
    el.info.pins.forEach((pin, k) => {
      const i = el.currents[k];
      out[`${prefix}pin.${pin.name}`] = qs ? this.combinedCurrent(i, el, k) : i;
    });
    if (el.twoTerminal) {
      const [a, b] = el.pins;
      const sign = el.def.source ? -1 : 1;
      const v = x.v(a) - x.v(b);
      const i = sign * el.currents[0];
      out[`${prefix}voltage`] = this.combined(v, a, b);
      out[`${prefix}current`] = qs ? sign * this.combinedCurrent(el.currents[0], el, 0) : i;
      let power = v * i;
      if (qs) {
        // Average power: DC part plus Re(V·I*) of the RMS phasors.
        const vr = this.phasorView.re(a) - this.phasorView.re(b);
        const vi = this.phasorView.im(a) - this.phasorView.im(b);
        power += sign * (vr * el.acRe![0] + vi * el.acIm![0]);
      }
      out[`${prefix}power`] = power;
    }
    this.acElement = el;
    el.model.readouts?.(
      x,
      (name, value) => (out[prefix + name] = value),
      qs ? this.phasorView : undefined,
    );
    this.acElement = undefined;
    if (el.damaged) out[`${prefix}damaged`] = true;
  }

  /** True-RMS current into pin k (DC plus phasor), signed like the DC part. */
  private combinedCurrent(dc: number, el: Element, k: number): number {
    const value = Math.sqrt(dc * dc + el.acRe![k] ** 2 + el.acIm![k] ** 2);
    return dc < 0 ? -value : value;
  }

  /** Current in every wire segment; true RMS (signed like the DC part) in the quasi-static analysis. */
  private wireCurrents(out: SimFrame['readouts']): void {
    const scratch = this.wireScratch;
    wireCurrents(this.wires, (e, pin) => this.elements[e].currents[pin], out, scratch);
    if (!this.quasiStatic) return;
    const re: SimFrame['readouts'] = {};
    const im: SimFrame['readouts'] = {};
    wireCurrents(this.wires, (e, pin) => this.elements[e].acRe![pin], re, scratch);
    wireCurrents(this.wires, (e, pin) => this.elements[e].acIm![pin], im, scratch);
    for (const key of Object.keys(re)) {
      const dc = out[key] as number;
      const value = Math.sqrt(dc * dc + (re[key] as number) ** 2 + (im[key] as number) ** 2);
      out[key] = dc < 0 ? -value : value;
    }
  }

  private probeValue(p: ResolvedProbe, x: SolutionView, readouts?: SimFrame['readouts']): number {
    if (p.kind === 'voltage') return this.combined(x.v(p.plus) - x.v(p.minus), p.plus, p.minus);
    if (p.kind === 'wire') {
      if (readouts) return (readouts[p.key] as number | undefined) ?? 0;
      const tmp: SimFrame['readouts'] = {};
      this.wireCurrents(tmp);
      return (tmp[p.key] as number | undefined) ?? 0;
    }
    const key = `${p.element.id}.${p.kind}`;
    if (readouts) return readouts[key] as number;
    const tmp: SimFrame['readouts'] = {};
    this.collect(p.element, x, tmp);
    return tmp[key] as number;
  }

  private recordSamples(): void {
    if (!this.probes.length) return;
    const x = this.view(this.accepted);
    this.sampleT.push(this.t);
    let wires: SimFrame['readouts'] | undefined;
    for (const p of this.probes) {
      if (p.kind === 'wire' && !wires) this.wireCurrents((wires = {}));
      this.sampleValues[p.id].push(this.probeValue(p, x, p.kind === 'wire' ? wires : undefined));
    }
  }

  private takeSamples(max: number): NonNullable<SimFrame['samples']> {
    const n = this.sampleT.length;
    const stride = Math.max(1, Math.ceil(n / max));
    const pick = <T>(arr: T[]) =>
      stride === 1 ? arr : arr.filter((_, i) => i % stride === 0 || i === n - 1);
    const samples = { t: pick(this.sampleT), values: {} as Record<string, number[]> };
    for (const p of this.probes) samples.values[p.id] = pick(this.sampleValues[p.id]);
    this.clearSamples();
    return samples;
  }
}
