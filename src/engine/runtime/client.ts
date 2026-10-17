import type { CircuitDoc, ParamValue, SimFrame, SimHandle } from '../contract';
import type { FromWorker, Port, ToWorker } from './protocol';

type WorkerPort = Port<FromWorker, ToWorker>;

interface Shared {
  port: WorkerPort;
  handlers: Map<number, (msg: FromWorker) => void>;
  terminate?: () => void;
}

let shared: Shared | undefined;
let nextSim = 1;

/** The page's simulation worker, created on first use and closed when the last simulation goes. */
function sharedWorker(): Shared {
  if (shared) return shared;
  const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
    name: 'simulacao',
  });
  shared = connect(worker, () => worker.terminate());
  worker.addEventListener('error', (event) => {
    console.error('Falha no worker da simulação:', event.message);
  });
  return shared;
}

function connect(port: WorkerPort, terminate?: () => void): Shared {
  const handlers = new Map<number, (msg: FromWorker) => void>();
  port.addEventListener('message', ({ data }) => handlers.get(data.sim)?.(data));
  return { port, handlers, terminate };
}

/**
 * SimHandle that forwards to the simulation worker. Commands keep their order
 * (postMessage is FIFO); frames arrive as the worker produces them.
 */
export class WorkerSimulation implements SimHandle {
  private readonly id = nextSim++;
  private readonly shared: Shared;
  private readonly listeners = new Set<(frame: SimFrame) => void>();
  private readonly pending = new Map<
    number,
    { resolve: (frames: SimFrame[]) => void; reject: (error: Error) => void }
  >();
  private nextReq = 1;
  private lastFrame?: SimFrame;
  private disposed = false;

  /** `port` is for tests; the page uses the shared worker. */
  constructor(port?: WorkerPort) {
    this.shared = port ? connect(port) : sharedWorker();
    this.shared.handlers.set(this.id, (msg) => this.receive(msg));
  }

  load(doc: CircuitDoc): Promise<void> {
    return this.request({ type: 'load', sim: this.id, req: 0, doc }).then(() => undefined);
  }

  setParam(element: string, param: string, value: ParamValue): void {
    this.send({ type: 'setParam', sim: this.id, element, param, value });
  }

  play(): void {
    this.send({ type: 'play', sim: this.id });
  }

  pause(): void {
    this.send({ type: 'pause', sim: this.id });
  }

  reset(): void {
    this.send({ type: 'reset', sim: this.id });
  }

  setSpeed(factor: number): void {
    this.send({ type: 'setSpeed', sim: this.id, factor });
  }

  subscribe(listener: (frame: SimFrame) => void): () => void {
    this.listeners.add(listener);
    const last = this.lastFrame;
    if (last)
      queueMicrotask(() => this.listeners.has(listener) && listener({ ...last, events: [] }));
    return () => this.listeners.delete(listener);
  }

  runUntil(t: number, opts: { maxFrames?: number } = {}): Promise<SimFrame[]> {
    return this.request({ type: 'runUntil', sim: this.id, req: 0, t, maxFrames: opts.maxFrames });
  }

  dispose(): void {
    if (this.disposed) return;
    this.send({ type: 'dispose', sim: this.id });
    this.disposed = true;
    this.listeners.clear();
    for (const { reject } of this.pending.values()) reject(new Error('Simulação encerrada.'));
    this.pending.clear();
    this.shared.handlers.delete(this.id);
    if (this.shared === shared && shared.handlers.size === 0) {
      shared.terminate?.();
      shared = undefined;
    }
  }

  private send(msg: ToWorker): void {
    if (!this.disposed) this.shared.port.postMessage(msg);
  }

  private request(msg: Extract<ToWorker, { req: number }>): Promise<SimFrame[]> {
    if (this.disposed) return Promise.reject(new Error('Simulação encerrada.'));
    const req = this.nextReq++;
    return new Promise((resolve, reject) => {
      this.pending.set(req, { resolve, reject });
      this.send({ ...msg, req });
    });
  }

  private receive(msg: FromWorker): void {
    if (msg.type === 'frame') {
      this.lastFrame = msg.frame;
      for (const listener of this.listeners) {
        try {
          listener(msg.frame);
        } catch (error) {
          console.error(error);
        }
      }
      return;
    }
    const pending = this.pending.get(msg.req);
    if (!pending) return;
    this.pending.delete(msg.req);
    if (msg.ok) pending.resolve(msg.frames ?? []);
    else pending.reject(new Error(msg.error));
  }
}
