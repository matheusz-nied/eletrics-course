import type { CircuitDoc, ParamValue, SimEvent, SimFrame, SimHandle } from '../contract';
import { Simulator, SimulationError } from '../analysis/simulator';

/** Wall clock and timer, injectable for tests. */
export interface Clock {
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

export const systemClock: Clock = {
  now: () => performance.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Target interval between frames (ms): 60 frames per second. */
const FRAME_MS = 1000 / 60;
/** Computing time a tick may use before it gives up catching up (ms). */
const TICK_BUDGET_MS = 10;
const DEFAULT_MAX_FRAMES = 2000;

/**
 * Real-time loop around a Simulator, on whatever thread it runs: steps as many
 * fixed steps as the wall clock (times the speed factor) asks for, up to a
 * time budget per tick, and emits one SimFrame per tick. When the circuit is
 * too heavy for real time it slows down instead of piling up work.
 */
export class LocalSimulation implements SimHandle {
  private sim?: Simulator;
  private readonly listeners = new Set<(frame: SimFrame) => void>();
  private playing = false;
  private speed = 1;
  private anchorWall = 0;
  private anchorSim = 0;
  private timer: unknown;
  private lastFrame?: SimFrame;
  private disposed = false;

  constructor(private readonly clock: Clock = systemClock) {}

  async load(doc: CircuitDoc): Promise<void> {
    this.pause();
    this.sim = undefined;
    this.lastFrame = undefined;
    const sim = new Simulator(doc);
    this.sim = sim;
    this.speed = 'speed' in doc.analysis && doc.analysis.speed ? doc.analysis.speed : 1;
    this.refreshAndEmit();
  }

  setParam(element: string, param: string, value: ParamValue): void {
    const sim = this.sim;
    if (!sim) return;
    try {
      sim.setParam(element, param, value);
    } catch (error) {
      console.warn(error instanceof Error ? error.message : error);
      return;
    }
    if (!this.playing) this.refreshAndEmit();
  }

  play(): void {
    if (!this.sim || this.playing || this.disposed || this.sim.isSweep) return;
    if (this.sim.finished) this.reset();
    this.playing = true;
    this.anchor();
    this.schedule(0);
  }

  pause(): void {
    this.playing = false;
    if (this.timer !== undefined) this.clock.clearTimer(this.timer);
    this.timer = undefined;
  }

  reset(): void {
    if (!this.sim) return;
    this.sim.reset();
    this.anchor();
    this.refreshAndEmit();
  }

  setSpeed(factor: number): void {
    if (!(factor > 0) || !Number.isFinite(factor)) return;
    this.speed = factor;
    this.anchor();
  }

  subscribe(listener: (frame: SimFrame) => void): () => void {
    this.listeners.add(listener);
    const last = this.lastFrame;
    if (last)
      queueMicrotask(() => this.listeners.has(listener) && listener({ ...last, events: [] }));
    return () => this.listeners.delete(listener);
  }

  async runUntil(t: number, opts: { maxFrames?: number } = {}): Promise<SimFrame[]> {
    const sim = this.sim;
    if (!sim) return [];
    if (sim.isSweep) return this.lastFrame ? [this.lastFrame] : [];
    const maxFrames = Math.max(1, Math.floor(opts.maxFrames ?? DEFAULT_MAX_FRAMES));
    const total = Math.max(0, Math.ceil((t - sim.t) / sim.dt - 1e-9));
    const stride = Math.max(1, Math.ceil(total / maxFrames));
    const frames: SimFrame[] = [];
    try {
      for (let n = 1; n <= total; n++) {
        sim.step();
        if (n % stride === 0 || n === total) frames.push(sim.frame({ samples: false }));
      }
    } catch (error) {
      frames.push(this.failure(error));
    }
    sim.clearSamples();
    this.anchor();
    const last = frames.at(-1) ?? sim.frame({ samples: false });
    this.lastFrame = last;
    this.emit({ ...last, events: [] });
    return frames;
  }

  dispose(): void {
    this.pause();
    this.disposed = true;
    this.listeners.clear();
    this.sim = undefined;
  }

  // ---------------------------------------------------------------------------

  private anchor(): void {
    this.anchorWall = this.clock.now();
    this.anchorSim = this.sim?.t ?? 0;
  }

  private schedule(ms: number): void {
    this.timer = this.clock.setTimer(() => this.tick(), ms);
  }

  private tick(): void {
    this.timer = undefined;
    const sim = this.sim;
    if (!this.playing || !sim) return;
    const start = this.clock.now();
    const target = this.anchorSim + ((start - this.anchorWall) / 1000) * this.speed;
    let failed: SimFrame | undefined;
    try {
      let n = 0;
      while (sim.t + sim.dt * 0.5 <= target && !sim.finished) {
        sim.step();
        if (++n % 16 === 0 && this.clock.now() - start > TICK_BUDGET_MS) {
          // Too slow for this speed: drop the backlog and go on from here.
          this.anchorSim = sim.t;
          this.anchorWall = this.clock.now();
          break;
        }
      }
    } catch (error) {
      failed = this.failure(error);
    }
    const frame = failed ?? sim.frame();
    this.lastFrame = frame;
    if (failed || sim.finished) this.pause();
    this.emit(frame);
    if (this.playing) this.schedule(Math.max(0, FRAME_MS - (this.clock.now() - start)));
  }

  private refreshAndEmit(): void {
    const sim = this.sim;
    if (!sim) return;
    let frame: SimFrame;
    try {
      sim.refresh();
      frame = sim.frame();
    } catch (error) {
      frame = this.failure(error);
    }
    this.lastFrame = frame;
    this.emit(frame);
  }

  /** Frame for a simulation that cannot go on: the last state plus a warning event. */
  private failure(error: unknown): SimFrame {
    if (!(error instanceof SimulationError)) throw error;
    const sim = this.sim!;
    const event: SimEvent = { t: sim.t, element: '', kind: 'warning', message: error.message };
    const frame = sim.frame({ samples: false });
    frame.events = [...frame.events, event];
    this.pause();
    return frame;
  }

  private emit(frame: SimFrame): void {
    for (const listener of this.listeners) {
      try {
        listener(frame);
      } catch (error) {
        console.error(error);
      }
    }
  }
}
