/**
 * Stand-in engine with the public API of src/engine (docs/plano/02-arquitetura.md,
 * section 5.2), used by the schematic until the Simulação front's engine is on
 * main. It runs on the main thread and adds `samples` to each frame (every
 * sampled step since the previous frame), which the oscilloscope uses.
 */
import type {
  CircuitDoc,
  DeviceInfo,
  ParamValue,
  SimEvent,
  SimFrame,
  SimHandle,
} from '../../engine/contract';
import { getDeviceInfo, listDevices } from './catalog';
import { buildNetlist } from './netlist';
import { Simulator, type Samples } from './simulator';

export { buildNetlist, getDeviceInfo, listDevices };

export function defineCircuit(doc: CircuitDoc): CircuitDoc {
  return doc;
}

/** Main-thread time budget per animation frame. */
const BUDGET_MS = 7;
const MAX_SAMPLES_PER_FRAME = 400;

class FakeHandle implements SimHandle {
  private sim: Simulator | null = null;
  private listeners = new Set<(frame: SimFrame) => void>();
  private playing = false;
  private speed = 1;
  private timer: ReturnType<typeof setTimeout> | number | null = null;
  private lastWall = 0;
  private pendingTime = 0;
  private lastFrame: SimFrame | null = null;

  async load(doc: CircuitDoc): Promise<void> {
    this.pause();
    this.sim = new Simulator(doc);
    const a = doc.analysis;
    this.speed = 'speed' in a && a.speed ? a.speed : 1;
    this.emit(this.initialFrame());
  }

  private initialFrame(): SimFrame {
    const sim = this.sim!;
    if (sim.doc.analysis.kind === 'ac-sweep')
      return { t: 0, nodeVoltages: {}, readouts: {}, events: [] };
    const frame = sim.solveNow();
    return { ...frame, events: sim.drainEvents() };
  }

  setParam(element: string, param: string, value: ParamValue): void {
    if (!this.sim) return;
    this.sim.setParam(element, param, value);
    // Paused: recompute at once, like the real engine (capacitors keep their charge).
    if (!this.playing && this.sim.doc.analysis.kind !== 'ac-sweep') this.emit(this.initialFrame());
  }

  play(): void {
    if (!this.sim || this.playing || this.sim.doc.analysis.kind === 'ac-sweep') return;
    const a = this.sim.doc.analysis;
    // After tStop, play starts over (as in the real engine).
    if (
      a.kind === 'transient' &&
      a.tStop !== undefined &&
      this.sim.t >= a.tStop - this.sim.dt / 2
    ) {
      this.reset();
    }
    this.playing = true;
    this.lastWall = now();
    this.schedule();
  }

  pause(): void {
    this.playing = false;
    if (this.timer !== null) {
      if (typeof cancelAnimationFrame === 'function' && typeof this.timer === 'number') {
        cancelAnimationFrame(this.timer);
      } else clearTimeout(this.timer as ReturnType<typeof setTimeout>);
      this.timer = null;
    }
  }

  reset(): void {
    if (!this.sim) return;
    this.sim.reset();
    this.pendingTime = 0;
    this.emit(this.initialFrame());
  }

  setSpeed(factor: number): void {
    this.speed = Math.max(1e-6, factor);
  }

  subscribe(listener: (frame: SimFrame) => void): () => void {
    this.listeners.add(listener);
    if (this.lastFrame) listener(this.lastFrame);
    return () => this.listeners.delete(listener);
  }

  async runUntil(t: number, opts: { maxFrames?: number } = {}): Promise<SimFrame[]> {
    const sim = this.sim;
    if (!sim) return [];
    if (sim.doc.analysis.kind === 'ac-sweep') return sim.acSweep();
    if (sim.mode === 'dc') return [{ ...sim.solveNow(), events: sim.drainEvents() }];
    const steps = Math.ceil((t - sim.t) / sim.dt - 1e-9);
    const every = Math.max(1, Math.floor(steps / (opts.maxFrames ?? 2000)));
    const frames: SimFrame[] = [];
    for (let i = 0; i < steps; i++) {
      const want = i % every === 0 || i === steps - 1;
      const frame = sim.step(0, want);
      if (frame) frames.push({ ...frame, events: sim.drainEvents() });
    }
    return frames;
  }

  dispose(): void {
    this.pause();
    this.listeners.clear();
    this.sim = null;
  }

  private schedule() {
    if (!this.playing) return;
    if (typeof requestAnimationFrame === 'function') {
      this.timer = requestAnimationFrame(() => this.tick());
    } else {
      this.timer = setTimeout(() => this.tick(), 16);
    }
  }

  private tick() {
    const sim = this.sim;
    if (!sim || !this.playing) return;
    const wall = now();
    const wallDt = Math.min(0.1, (wall - this.lastWall) / 1000);
    this.lastWall = wall;

    if (sim.mode === 'dc') {
      const frame = sim.step(wallDt * this.speed)!;
      this.emit({ ...frame, events: sim.drainEvents() });
      this.schedule();
      return;
    }

    const dt = sim.dt;
    const tStop = sim.doc.analysis.kind === 'transient' ? sim.doc.analysis.tStop : undefined;
    this.pendingTime += wallDt * this.speed;
    const wanted = Math.floor(this.pendingTime / dt);
    const every = Math.max(1, Math.ceil(wanted / MAX_SAMPLES_PER_FRAME));
    const probes = sim.doc.probes ?? [];
    const samples: Samples = { t: [], values: {} };
    const start = now();
    let last: SimFrame | null = null;
    let done = 0;
    while (this.pendingTime >= dt) {
      if (tStop !== undefined && sim.t >= tStop) {
        this.pendingTime = 0;
        this.playing = false;
        break;
      }
      const want = done % every === 0 || this.pendingTime - dt < dt;
      const frame = sim.step(0, want);
      this.pendingTime -= dt;
      done++;
      if (frame) {
        last = frame;
        if (probes.length) pushSample(samples, frame, probes);
      }
      if (now() - start > BUDGET_MS) {
        // Slower than real time: drop the backlog instead of spiralling.
        this.pendingTime = 0;
        break;
      }
    }
    if (last) {
      this.emit({ ...last, events: sim.drainEvents(), ...(probes.length ? { samples } : {}) });
    } else {
      const events = sim.drainEvents();
      if (events.length) this.emit({ ...sim.frame(), events });
    }
    this.schedule();
  }

  private emit(frame: SimFrame) {
    this.lastFrame = frame;
    for (const l of this.listeners) l(frame);
  }
}

function pushSample(s: Samples, frame: SimFrame, probes: { id: string }[]) {
  s.t.push(frame.t);
  for (const p of probes) {
    const v = frame.readouts[p.id];
    (s.values[p.id] ??= []).push(typeof v === 'number' ? v : Number.NaN);
  }
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function createSimulation(_opts?: { worker?: boolean }): SimHandle {
  return new FakeHandle();
}

export type { DeviceInfo, SimEvent };
