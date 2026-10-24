/**
 * Host of the microcontroller widget: compiles ("upload"), runs the machine
 * in real time × speed on requestAnimationFrame, and publishes immutable
 * snapshots for React (useSyncExternalStore). The loop runs only while the
 * widget is on screen, the tab is visible and a program is running.
 *
 * Per frame, the machine may run for about FRAME_BUDGET_MS of real time, in
 * chunks of CHUNK_OPS operations. If that is not enough to keep up (a heavy
 * program at 10×), the virtual clock simply falls behind: the simulation
 * goes slower than real time, it never piles up work or freezes the tab.
 */
import { Board, type BoardInputs, type BoardView } from './board';
import { compile, type CompiledProgram } from './checker';
import type { Diagnostic } from './diagnostico';
import { Machine } from './interpreter';

export type Estado = 'vazia' | 'rodando' | 'parada' | 'erro';

export interface Aviso {
  key: string;
  linha: number;
  texto: string;
}

export interface MideSnapshot {
  estado: Estado;
  /** Virtual time since the board started (ms). */
  tempo: number;
  view: BoardView;
  inputs: BoardInputs;
  serial: string;
  /** The compile error of the last upload, or the run-time error. */
  erro: (Diagnostic & { tipo: 'compilacao' | 'execucao' }) | null;
  /** Compile warnings of the program on the board, then run-time warnings. */
  avisos: Aviso[];
  /** The virtual clock is behind real time × speed. */
  lento: boolean;
  /** The program has not called delay() for a while: loop() runs flat out. */
  semDelay: boolean;
  /** loop() calls per virtual second, measured over the last half second. */
  loopsPorSegundo: number;
  velocidade: number;
  /** Source of the program on the board, or null. */
  enviado: string | null;
  /** Counts uploads, to reset UI state that depends on them. */
  envios: number;
}

/** Real time the machine may use per animation frame (ms). */
export const FRAME_BUDGET_MS = 7;
export const CHUNK_OPS = 20_000;
const MAX_AVISOS = 8;

export class MicroController {
  private readonly board: Board;
  private machine: Machine | null = null;
  private program: CompiledProgram | null = null;
  private source: string | null = null;
  private estado: Estado = 'vazia';
  private erro: MideSnapshot['erro'] = null;
  private compileAvisos: Aviso[] = [];
  private runAvisos = new Map<string, Aviso>();
  private simTime = 0;
  private speed = 1;
  private visible = false;
  private raf = 0;
  private last = 0;
  private behind = 0;
  private rateStart = 0;
  private rateLoops = 0;
  private rate = 0;
  private envios = 0;
  private serialVersion = -1;
  private serialText = '';
  private snap: MideSnapshot;
  private readonly listeners = new Set<() => void>();

  constructor() {
    this.board = new Board({ warn: this.onWarn });
    this.snap = this.build();
  }

  private onWarn = (key: string, linha: number, texto: string) => {
    if (this.runAvisos.has(key) || this.runAvisos.size >= MAX_AVISOS) return;
    this.runAvisos.set(key, { key, linha, texto });
  };

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): MideSnapshot => this.snap;

  private build(): MideSnapshot {
    const m = this.monitorText();
    const machine = this.machine;
    return {
      estado: this.estado,
      tempo: this.simTime / 1000,
      view: this.board.view(this.simTime),
      inputs: { ...this.board.inputs },
      serial: m,
      erro: this.erro,
      avisos: [...this.compileAvisos, ...this.runAvisos.values()],
      lento: this.behind > 30,
      semDelay:
        this.estado === 'rodando' &&
        !!machine &&
        machine.time > 1.5e6 &&
        machine.time - machine.lastDelayAt > 1.5e6,
      loopsPorSegundo: this.rate,
      velocidade: this.speed,
      enviado: this.source,
      envios: this.envios,
    };
  }

  private monitorText(): string {
    const mon = this.board.monitor;
    if (mon.version !== this.serialVersion) {
      this.serialVersion = mon.version;
      this.serialText = mon.text();
    }
    return this.serialText;
  }

  private publish(): void {
    this.snap = this.build();
    for (const fn of this.listeners) fn();
  }

  // What the student does

  /** Compiles and, if it works, starts the program. Returns the compile result. */
  enviar(source: string): boolean {
    const r = compile(source);
    if (!r.ok) {
      this.erro = { ...r.error, tipo: 'compilacao' };
      this.publish();
      return false;
    }
    this.program = r.program;
    this.source = source;
    this.compileAvisos = r.warnings.map((w, i) => ({
      key: `compilacao:${i}`,
      linha: w.line,
      texto: w.message,
    }));
    this.envios++;
    this.board.monitor.clear();
    this.boot();
    return true;
  }

  private boot(): void {
    if (!this.program) return;
    this.board.reset(0);
    this.runAvisos.clear();
    this.machine = new Machine(this.program, this.board, { warn: this.onWarn });
    this.simTime = 0;
    this.behind = 0;
    this.rateStart = 0;
    this.rateLoops = 0;
    this.rate = 0;
    this.estado = 'rodando';
    this.erro = null;
    // Run the first 100 µs now, so what setup() does shows at once.
    this.machine.run(100, CHUNK_OPS);
    this.loop();
    this.publish();
  }

  /** Holds the board in reset: the program stops and every pin goes back to input. */
  parar(): void {
    if (!this.program) return;
    this.machine = null;
    this.board.reset(this.simTime);
    this.estado = 'parada';
    if (this.erro?.tipo === 'execucao') this.erro = null;
    this.loop();
    this.publish();
  }

  /** The reset button: the same program starts again from setup(). */
  reiniciar(): void {
    if (!this.program) return;
    this.boot();
  }

  setVelocidade(v: number): void {
    this.speed = v;
    this.publish();
  }

  setBotao(down: boolean): void {
    if (this.board.inputs.botao === down) return;
    this.board.inputs = { ...this.board.inputs, botao: down };
    this.publish();
  }

  setPot(x: number): void {
    this.board.inputs = { ...this.board.inputs, pot: x };
    this.publish();
  }

  setLuz(x: number): void {
    this.board.inputs = { ...this.board.inputs, luz: x };
    this.publish();
  }

  limparSerial(): void {
    this.board.monitor.clear();
    this.publish();
  }

  /** Forgets the compile error shown (the student is editing again). */
  limparErro(): void {
    if (this.erro?.tipo !== 'compilacao') return;
    this.erro = null;
    this.publish();
  }

  // Real-time loop

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.loop();
  }

  dispose(): void {
    this.visible = false;
    this.loop();
    this.listeners.clear();
  }

  private loop(): void {
    const active = this.visible && this.estado === 'rodando' && !!this.machine;
    if (!active) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    if (this.raf) return;
    this.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - this.last, 100);
      this.last = now;
      this.raf = 0;
      this.advance(dt);
      if (this.raf === 0) this.loop();
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Advances `realMs` of real time (× speed), within the frame budget. */
  advance(realMs: number, budgetMs = FRAME_BUDGET_MS): void {
    const m = this.machine;
    if (!m || this.estado !== 'rodando') return;
    const target = this.simTime + realMs * 1000 * this.speed;
    const deadline = performance.now() + budgetMs;
    let stop = m.run(target, CHUNK_OPS);
    while (stop === 'limite' && performance.now() < deadline) stop = m.run(target, CHUNK_OPS);
    if (stop === 'erro') {
      this.estado = 'erro';
      this.erro = { ...m.error!.toDiagnostic(), tipo: 'execucao' };
      this.simTime = Math.min(m.time, target);
      this.publish();
      return;
    }
    if (stop === 'limite') {
      this.simTime = m.time;
      this.behind++;
    } else {
      this.simTime = target;
      this.behind = 0;
    }
    if (this.simTime - this.rateStart >= 500_000) {
      this.rate = ((m.loops - this.rateLoops) * 1e6) / (this.simTime - this.rateStart);
      this.rateStart = this.simTime;
      this.rateLoops = m.loops;
    }
    this.publish();
  }
}
