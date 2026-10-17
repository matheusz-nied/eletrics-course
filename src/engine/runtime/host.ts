import type { SimFrame } from '../contract';
import { LocalSimulation, systemClock, type Clock } from './local';
import type { FromWorker, ToWorker } from './protocol';

/** Worker side: one LocalSimulation per id, frames posted back to the page. */
export class SimHost {
  private readonly sims = new Map<number, { sim: LocalSimulation; unsubscribe: () => void }>();

  constructor(
    private readonly post: (message: FromWorker) => void,
    private readonly clock: Clock = systemClock,
  ) {}

  handle(msg: ToWorker): void {
    const entry =
      this.sims.get(msg.sim) ?? (msg.type === 'dispose' ? undefined : this.create(msg.sim));
    if (!entry) return;
    const { sim } = entry;
    switch (msg.type) {
      case 'load':
        sim.load(msg.doc).then(
          () => this.post({ type: 'result', sim: msg.sim, req: msg.req, ok: true }),
          (error: unknown) =>
            this.post({
              type: 'result',
              sim: msg.sim,
              req: msg.req,
              ok: false,
              error: describe(error),
            }),
        );
        break;
      case 'setParam':
        sim.setParam(msg.element, msg.param, msg.value);
        break;
      case 'play':
        sim.play();
        break;
      case 'pause':
        sim.pause();
        break;
      case 'reset':
        sim.reset();
        break;
      case 'setSpeed':
        sim.setSpeed(msg.factor);
        break;
      case 'runUntil':
        sim.runUntil(msg.t, { maxFrames: msg.maxFrames }).then(
          (frames) => this.post({ type: 'result', sim: msg.sim, req: msg.req, ok: true, frames }),
          (error: unknown) =>
            this.post({
              type: 'result',
              sim: msg.sim,
              req: msg.req,
              ok: false,
              error: describe(error),
            }),
        );
        break;
      case 'dispose':
        entry.unsubscribe();
        sim.dispose();
        this.sims.delete(msg.sim);
        break;
    }
  }

  private create(id: number) {
    const sim = new LocalSimulation(this.clock);
    const unsubscribe = sim.subscribe((frame: SimFrame) =>
      this.post({ type: 'frame', sim: id, frame }),
    );
    const entry = { sim, unsubscribe };
    this.sims.set(id, entry);
    return entry;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
