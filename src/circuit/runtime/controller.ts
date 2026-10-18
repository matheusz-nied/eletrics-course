/**
 * One live simulation on the page: owns the engine handle, the UI state
 * (zustand store), the sample history used by the instruments and the
 * schematic model. React components and the animation loop read from here.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
  CircuitDoc,
  GoalDoc,
  Netlist,
  ParamValue,
  ProbeDoc,
  SimEvent,
  SimFrame,
  SimHandle,
} from '../../engine/contract';
import { deviceInfo, engineFor, frameSamples, type EngineApi, type FrameSamples } from '../engine';
import { elementParams } from '../geometry';
import { buildSchematicModel, type SchematicModel } from '../schematic/model';
import { History } from './history';
import { sweepOf, type Sweep } from './sweep';

export interface ViewOptions {
  /** Moving dots along the wires. */
  current: boolean;
  /** Wire colours by voltage. */
  voltage: boolean;
  /** Dots follow the electrons instead of the conventional current. */
  electrons: boolean;
  /** Voltage label on each node. */
  nodeLabels: boolean;
}

export interface SimState {
  ready: boolean;
  playing: boolean;
  speed: number;
  /** Simulated time (updated a few times per second). */
  t: number;
  /** Current parameters of every element. */
  params: Record<string, Record<string, ParamValue>>;
  /** Latest frame (every animation frame). */
  frame: SimFrame | null;
  /** Latest frame, a few times per second: for numbers people read. */
  slow: SimFrame | null;
  events: (SimEvent & { key: number })[];
  /** Result of an AC sweep. */
  sweep: Sweep | null;
  error: string | null;
  view: ViewOptions;
  sound: boolean;
  /** Element shown in the inspector. */
  focus: string | null;
}

const SLOW_MS = 140;
const MAX_EVENTS = 12;

export const probeChannel = (id: string) => `probe:${id}`;

export class SimController {
  readonly store: StoreApi<SimState>;
  readonly engine: EngineApi;
  readonly netlist: Netlist;
  readonly model: SchematicModel;
  /** Every solver step of the probes (oscilloscope, multimeter): the last moments. */
  readonly history = new History();
  /** One point per frame: long time charts. */
  readonly trend = new History();
  readonly initialParams: Record<string, Record<string, ParamValue>>;
  private handle: SimHandle | null = null;
  private unsubscribe: (() => void) | null = null;
  private listeners = new Set<(frame: SimFrame) => void>();
  private lastSlow = 0;
  private visible = true;
  private visibilityListeners = new Set<() => void>();
  private eventKey = 0;
  private sweepTimer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;

  constructor(
    readonly doc: CircuitDoc,
    options: { reducedMotion?: boolean } = {},
  ) {
    this.engine = engineFor(doc);
    this.netlist = this.engine.buildNetlist(doc);
    this.model = buildSchematicModel(doc.elements, this.netlist, doc.view);
    const params: SimState['params'] = {};
    for (const el of doc.elements) {
      if (el.type === 'wire') continue;
      params[el.id] = elementParams(el, deviceInfo(el.type, el.params));
    }
    this.initialParams = params;
    const a = doc.analysis;
    this.store = createStore<SimState>(() => ({
      ready: false,
      playing: false,
      speed: 'speed' in a && a.speed ? a.speed : 1,
      t: 0,
      params,
      frame: null,
      slow: null,
      events: [],
      sweep: null,
      error: null,
      view: {
        current: (doc.view?.showCurrent ?? true) && !options.reducedMotion,
        voltage: doc.view?.showVoltage ?? true,
        electrons: false,
        nodeLabels: false,
      },
      sound: false,
      focus: null,
    }));
    for (const p of doc.probes ?? []) this.track(probeChannel(p.id));
  }

  get isSweep() {
    return this.doc.analysis.kind === 'ac-sweep';
  }

  get isDc() {
    return this.doc.analysis.kind === 'dc';
  }

  /** Creates the engine and loads the circuit with the current parameters. */
  async start(autoplay: boolean): Promise<void> {
    const generation = ++this.generation;
    this.stopHandle();
    try {
      const handle = this.engine.createSimulation({ worker: true });
      this.handle = handle;
      this.unsubscribe = handle.subscribe(this.onEngineFrame);
      const params = this.store.getState().params;
      await handle.load({
        ...this.doc,
        elements: this.doc.elements.map((el) =>
          el.type === 'wire' ? el : { ...el, params: { ...el.params, ...params[el.id] } },
        ),
      });
      if (generation !== this.generation) return;
      handle.setSpeed(this.store.getState().speed);
      this.store.setState({ ready: true, error: null });
      if (this.isSweep) await this.runSweep();
      else if (autoplay) this.play();
    } catch (err) {
      if (generation !== this.generation) return;
      console.error(err);
      this.store.setState({
        error: 'Não foi possível iniciar a simulação deste circuito.',
        ready: false,
      });
    }
  }

  private stopHandle() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.handle?.dispose();
    this.handle = null;
  }

  dispose() {
    this.generation++;
    if (this.sweepTimer) clearTimeout(this.sweepTimer);
    this.stopHandle();
    this.store.setState({ ready: false, playing: false });
  }

  /** Called on every engine frame (also by the animation loop's consumers). */
  onFrame(listener: (frame: SimFrame) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private onEngineFrame = (frame: SimFrame) => {
    const samples = frameSamples(frame);
    if (samples) {
      for (let i = 0; i < samples.t.length; i++) {
        this.history.push(samples.t[i]!, (key) => this.sampleValue(key, samples, i, frame));
      }
    } else {
      this.history.push(frame.t, (key) => this.channelValue(key, frame));
    }
    this.trend.push(frame.t, (key) => this.channelValue(key, frame));

    const state = this.store.getState();
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const patch: Partial<SimState> = { frame };
    // The engine pauses by itself at tStop.
    const a = this.doc.analysis;
    if (
      a.kind === 'transient' &&
      a.tStop !== undefined &&
      state.playing &&
      frame.t >= a.tStop - a.dt / 2
    ) {
      patch.playing = false;
    }
    if (frame.events.length) {
      const added = frame.events.map((e) => ({ ...e, key: ++this.eventKey }));
      patch.events = [...state.events, ...added].slice(-MAX_EVENTS);
    }
    if (now - this.lastSlow > SLOW_MS || frame.events.length || !state.playing) {
      this.lastSlow = now;
      patch.slow = frame;
      patch.t = frame.t;
    }
    this.store.setState(patch);
    for (const l of this.listeners) l(frame);
  };

  // ── values ────────────────────────────────────────────────────────────

  /** Node id of a reference: "R1.a", "GND" or a node id. */
  nodeOf(ref: string): string | undefined {
    if (ref === 'GND' || ref === '0') return 'GND';
    return (
      this.netlist.pins[ref] ?? (this.netlist.nodes.some((n) => n.id === ref) ? ref : undefined)
    );
  }

  probeValue(probe: ProbeDoc, frame: SimFrame): number {
    const direct = frame.readouts[probe.id];
    if (typeof direct === 'number') return direct;
    if (probe.kind === 'voltage') {
      const v = (ref: string) => {
        const node = this.nodeOf(ref);
        return node === undefined ? Number.NaN : (frame.nodeVoltages[node] ?? 0);
      };
      return v(probe.plus) - v(probe.minus);
    }
    const r = frame.readouts[`${probe.element}.${probe.kind}`];
    return typeof r === 'number' ? r : Number.NaN;
  }

  /** Value of a chart/goal key (probe id or readout key) in a frame. */
  value(key: string, frame: SimFrame | null): number | boolean | string | undefined {
    if (!frame) return undefined;
    const probe = this.doc.probes?.find((p) => p.id === key);
    if (probe) return this.probeValue(probe, frame);
    return frame.readouts[key];
  }

  private channelValue(key: string, frame: SimFrame): number {
    if (key.startsWith('probe:')) {
      const probe = this.doc.probes?.find((p) => probeChannel(p.id) === key);
      return probe ? this.probeValue(probe, frame) : Number.NaN;
    }
    const v = frame.readouts[key];
    return typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : Number.NaN;
  }

  /** Probe channels come from the per-step samples; other readouts hold the frame value. */
  private sampleValue(key: string, s: FrameSamples, i: number, frame: SimFrame): number {
    if (key.startsWith('probe:')) {
      const v = s.values[key.slice(6)]?.[i];
      if (typeof v === 'number') return v;
    }
    return this.channelValue(key, frame);
  }

  /** Starts recording a history channel ("probe:V1" or a readout key). */
  track(channel: string) {
    this.history.track(channel);
    this.trend.track(channel);
  }

  /** History channel of a chart key (probe id or readout key), recorded from now on. */
  channelOf(key: string): string {
    const channel = this.doc.probes?.some((p) => p.id === key) ? probeChannel(key) : key;
    this.track(channel);
    return channel;
  }

  goalMet(goal: GoalDoc, frame: SimFrame | null): boolean | undefined {
    const v = this.value(goal.check.readout, frame);
    if (v === undefined) return undefined;
    const { op, value } = goal.check;
    if (op === 'between') {
      if (!Array.isArray(value) || typeof v !== 'number') return false;
      return v >= value[0] && v <= value[1];
    }
    if (op === '==')
      return typeof v === 'number' && typeof value === 'number'
        ? Math.abs(v - value) <= Math.abs(value) * 1e-3 + 1e-12
        : v === value;
    if (typeof v !== 'number' || typeof value !== 'number') return false;
    if (op === '<') return v < value;
    if (op === '<=') return v <= value;
    if (op === '>') return v > value;
    return v >= value;
  }

  // ── commands ──────────────────────────────────────────────────────────

  play() {
    if (!this.handle || this.isSweep) return;
    if (this.visible) this.handle.play();
    this.store.setState({ playing: true });
  }

  pause() {
    this.handle?.pause();
    this.store.setState({ playing: false });
  }

  togglePlay() {
    if (this.store.getState().playing) this.pause();
    else this.play();
  }

  reset() {
    this.handle?.reset();
    this.history.clear();
    this.trend.clear();
    this.store.setState({ events: [], t: 0 });
    if (this.isSweep) void this.runSweep();
  }

  setSpeed(factor: number) {
    this.handle?.setSpeed(factor);
    this.store.setState({ speed: factor });
  }

  setParam(element: string, param: string, value: ParamValue) {
    const params = this.store.getState().params;
    this.store.setState({
      params: { ...params, [element]: { ...params[element], [param]: value } },
    });
    this.handle?.setParam(element, param, value);
    if (this.isSweep) this.scheduleSweep();
  }

  /** Puts an element's parameters back to the values of the circuit file. */
  restoreParams(element: string) {
    const original = this.initialParams[element] ?? {};
    const current = this.store.getState().params[element] ?? {};
    for (const [k, v] of Object.entries(original))
      if (current[k] !== v) this.setParam(element, k, v);
  }

  setView(patch: Partial<ViewOptions>) {
    this.store.setState({ view: { ...this.store.getState().view, ...patch } });
  }

  setFocus(id: string | null) {
    if (this.store.getState().focus !== id) this.store.setState({ focus: id });
  }

  get isVisible() {
    return this.visible;
  }

  onVisibility(listener: () => void): () => void {
    this.visibilityListeners.add(listener);
    return () => this.visibilityListeners.delete(listener);
  }

  /** Pauses the engine while the simulation is off screen. */
  setVisible(visible: boolean) {
    if (visible === this.visible) return;
    this.visible = visible;
    for (const l of this.visibilityListeners) l();
    if (!this.handle || !this.store.getState().playing) return;
    if (visible) this.handle.play();
    else this.handle.pause();
  }

  private scheduleSweep() {
    if (this.sweepTimer) clearTimeout(this.sweepTimer);
    this.sweepTimer = setTimeout(() => void this.runSweep(), 60);
  }

  private async runSweep() {
    if (!this.handle) return;
    const generation = this.generation;
    const frames = await this.handle.runUntil(Number.POSITIVE_INFINITY);
    if (generation === this.generation) this.store.setState({ sweep: sweepOf(frames) });
  }
}
