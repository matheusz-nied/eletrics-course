import type {
  CircuitDoc,
  DeviceInfo,
  ParamValue,
  ProbeDoc,
  SimEvent,
  SimFrame,
  Vec2,
} from '../contract';
import type {
  DeviceDefinition,
  DeviceModel,
  StepInfo,
  SolutionView,
  UpdateContext,
} from '../device';
import { findDevice } from '../devices';
import { pinPoints } from '../format/geometry';
import { buildNetlist, GROUND } from '../format/netlist';
import { checkParam, CircuitError, validateCircuit } from '../format/validate';
import { AMBIENT_C, GMIN } from '../models/constants';
import { MnaSystem } from '../solver/mna';
import { SingularMatrixError } from '../solver/lu';
import { buildWireGraph, wireCurrents, type WireGraph } from './wires';

/** Time step of the DC analysis, which still advances time for thermal models (s). */
export const DC_STEP = 1e-3;
/** Step used to show a paused transient after a change, without advancing time (s). */
const REFRESH_STEP = 1e-9;
const MAX_NEWTON = 100;
const RELTOL = 1e-6;
const VNTOL = 1e-6;
const ABSTOL = 1e-12;

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
}

/** UpdateContext with the fields the simulator rewrites for each device. */
interface MutableUpdateContext extends UpdateContext {
  commit: boolean;
  t: number;
  element: string;
}

type ResolvedProbe =
  | { id: string; kind: 'voltage'; plus: number; minus: number }
  | { id: string; kind: 'current' | 'power'; element: Element };

/**
 * One circuit, ready to step: compiled devices, the MNA system and the
 * integration state. Pure computation (no timers, no DOM): the runtime drives
 * it in real time and runUntil/tests drive it directly.
 */
export class Simulator {
  readonly doc: CircuitDoc;
  readonly mode: 'dc' | 'tran';
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
  private pendingEvents: SimEvent[] = [];
  private sampleT: number[] = [];
  private sampleValues: Record<string, number[]> = {};

  constructor(doc: CircuitDoc) {
    const { errors } = validateCircuit(doc);
    if (errors.length) throw new CircuitError(doc?.id ?? '?', errors);
    if (doc.analysis.kind === 'ac-sweep' || doc.analysis.kind === 'quasi-static') {
      throw new CircuitError(doc.id, [
        `a análise "${doc.analysis.kind}" ainda não está disponível no motor`,
      ]);
    }
    this.doc = doc;
    this.mode = doc.analysis.kind === 'dc' ? 'dc' : 'tran';
    this.dt = doc.analysis.kind === 'transient' ? doc.analysis.dt : DC_STEP;

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
      const info = def.info;
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
      };
      this.elements.push(element);
      this.byId.set(el.id, element);
    }
    this.nonlinear = this.elements.some((e) => e.model.nonlinear);
    this.system = new MnaSystem(this.isNode.length);
    this.accepted = new Float64Array(this.isNode.length);
    this.guess = new Float64Array(this.isNode.length);

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
      return { id: p.id, kind: p.kind, element: this.byId.get(p.element)! };
    });
    for (const p of this.probes) this.sampleValues[p.id] = [];
  }

  /** Whether the analysis has a stop time and reached it. */
  get finished(): boolean {
    return this.doc.analysis.kind === 'transient' && this.doc.analysis.tStop !== undefined
      ? this.t >= this.doc.analysis.tStop - this.dt * 1e-6
      : false;
  }

  /** Advances one fixed step. Throws SimulationError when the circuit has no solution. */
  step(): void {
    const step: StepInfo = {
      mode: this.mode,
      t: this.t + this.dt,
      dt: this.dt,
      method: this.restart ? 'be' : 'trap',
    };
    const x = this.solve(step);
    this.restart = false;
    this.update(step, x, true);
    this.accepted.set(x);
    this.t = step.t;
    this.steps++;
    this.recordSamples();
  }

  /**
   * Solves the circuit at the current time without advancing it, so a change
   * made while paused (a switch, a slider) shows right away.
   */
  refresh(): void {
    const step: StepInfo =
      this.mode === 'dc'
        ? { mode: 'dc', t: this.t, dt: 0, method: 'be' }
        : { mode: 'tran', t: this.t, dt: REFRESH_STEP, method: 'be' };
    const x = this.solve(step);
    this.update(step, x, false);
    this.accepted.set(x);
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
    this.accepted.fill(0);
    this.pendingEvents = [];
    this.clearSamples();
    for (const el of this.elements) el.model.reset?.();
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
    this.nodeIds.forEach((id, i) => (nodeVoltages[id] = this.accepted[i]));
    const readouts: SimFrame['readouts'] = {};
    for (const el of this.elements) this.collect(el, x, readouts);
    wireCurrents(
      this.wires,
      (element, pin) => this.elements[element].currents[pin],
      readouts,
      this.wireScratch,
    );
    for (const p of this.probes) readouts[p.id] = this.probeValue(p, x, readouts);
    const frame: SimFrame = { t: this.t, nodeVoltages, readouts, events: this.pendingEvents };
    this.pendingEvents = [];
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

  private solve(step: StepInfo): Float64Array {
    const sys = this.system;
    const guess = this.guess;
    guess.set(this.accepted);
    const view = this.view(guess);
    for (let iter = 0; iter < MAX_NEWTON; iter++) {
      sys.clear();
      for (let i = 0; i < this.isNode.length; i++) if (this.isNode[i]) sys.add(i, i, GMIN);
      for (const el of this.elements) el.model.stamp(sys, step, view);
      let x: Float64Array;
      try {
        x = sys.solve();
      } catch (error) {
        if (error instanceof SingularMatrixError) throw new SimulationError(this.singularMessage());
        throw error;
      }
      for (let i = 0; i < x.length; i++) {
        if (!Number.isFinite(x[i])) {
          throw new SimulationError(
            'A simulação parou: os valores divergiram (resultado infinito).',
          );
        }
      }
      if (!this.nonlinear) return x;
      let converged = true;
      for (let i = 0; i < x.length; i++) {
        const tol =
          RELTOL * Math.max(Math.abs(x[i]), Math.abs(guess[i])) + (this.isNode[i] ? VNTOL : ABSTOL);
        if (Math.abs(x[i] - guess[i]) > tol) {
          converged = false;
          break;
        }
      }
      guess.set(x);
      if (converged && iter > 0) return guess;
    }
    throw new SimulationError('A simulação parou: o circuito não convergiu neste instante.');
  }

  private update(step: StepInfo, x: Float64Array, commit: boolean): void {
    const view = this.view(x);
    const ctx = this.updateContext;
    ctx.commit = commit;
    ctx.t = step.t;
    for (const el of this.elements) {
      ctx.element = el.id;
      el.model.update?.(step, view, ctx);
      el.model.pinCurrents(view, el.currents);
    }
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
    },
    discontinuity: () => {
      this.restart = true;
    },
  };

  private collect(el: Element, x: SolutionView, out: SimFrame['readouts']): void {
    const prefix = `${el.id}.`;
    el.info.pins.forEach((pin, i) => (out[`${prefix}pin.${pin.name}`] = el.currents[i]));
    if (el.twoTerminal) {
      const v = x.v(el.pins[0]) - x.v(el.pins[1]);
      const i = el.def.source ? -el.currents[0] : el.currents[0];
      out[`${prefix}voltage`] = v;
      out[`${prefix}current`] = i;
      out[`${prefix}power`] = v * i;
    }
    el.model.readouts?.(x, (name, value) => (out[prefix + name] = value));
  }

  private probeValue(p: ResolvedProbe, x: SolutionView, readouts?: SimFrame['readouts']): number {
    if (p.kind === 'voltage') return x.v(p.plus) - x.v(p.minus);
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
    for (const p of this.probes) this.sampleValues[p.id].push(this.probeValue(p, x));
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

  private singularMessage(): string {
    return 'A simulação parou: o circuito não tem solução. Há um laço só de fontes de tensão ou uma fonte de corrente sem caminho de volta?';
  }
}
