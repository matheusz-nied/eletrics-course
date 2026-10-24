/**
 * The live state diagram of lesson 12.2 runs the gate central of module 16
 * (CentralController: the real firmware m16/central-generica against the
 * gate model) and adds the transition log on top of it. One object for the
 * React side: subscribe/getSnapshot, plus what the student can do.
 */
import {
  CentralController,
  type CentralOptions,
  type CentralSnapshot,
} from '../m16/ui/central-controller';
import { Rastreador, type Registro } from './maquina-estados';

/** "Portão normal", or the manual release open: the motor turns, the gate stays. */
export type Cenario = 'normal' | 'destravado';

/** Auto-close pause of the lesson (s): short, so the student sees it happen. */
export const PAUSA_AULA = 10;
/** Trimpot position for that pause (the PAUSA range is 0 to 120 s). */
export const PAUSA_TRIMPOT = PAUSA_AULA / 120;

export interface MaquinaSnapshot {
  central: CentralSnapshot;
  /** Newest first, at most `MAX_REGISTROS`. */
  registros: readonly Registro[];
  cenario: Cenario;
  /** The push button is held (a press lasts `TOQUE` of simulated time). */
  botoeira: boolean;
  /** A remote frame reached the receiver in the last `TOQUE`. */
  controle: boolean;
}

/** How long a press of the push button lasts, and how long the remote indicator stays on (s). */
export const TOQUE = 0.3;

export const MAX_REGISTROS = 6;

export interface MaquinaOptions {
  /** Simulated seconds per real second. */
  speed?: number;
  cenario?: Cenario;
}

export class MaquinaController {
  private ctl!: CentralController;
  private unsubscribe: () => void = () => {};
  private readonly rastreador = new Rastreador();
  private registros: Registro[] = [];
  private snap!: MaquinaSnapshot;
  private listeners = new Set<() => void>();
  private visible = false;
  private speed: number;
  private cenario: Cenario;
  private botoeiraAte: number | null = null;
  private controleAte = -1;

  constructor(opts: MaquinaOptions = {}) {
    this.speed = opts.speed ?? 2;
    this.cenario = opts.cenario ?? 'normal';
    this.build();
  }

  private build(): void {
    this.unsubscribe();
    this.ctl?.dispose();
    const options: CentralOptions = {
      settings: { pausa: PAUSA_TRIMPOT },
      speed: this.speed,
      faults: this.cenario === 'destravado' ? { desbloqueado: true } : {},
    };
    this.ctl = new CentralController(options);
    this.rastreador.reset();
    this.registros = [];
    this.botoeiraAte = null;
    this.controleAte = -1;
    this.unsubscribe = this.ctl.subscribe(() => this.update());
    this.update();
    if (this.visible) this.ctl.setVisible(true);
  }

  private update(): void {
    const central = this.ctl.getSnapshot();
    if (this.botoeiraAte !== null && central.t >= this.botoeiraAte) {
      this.botoeiraAte = null;
      // Publishes again, and that update builds the snapshot.
      this.ctl.hold('botoeira', false);
      return;
    }
    const novos = this.rastreador.observar(central);
    if (novos.length) {
      this.registros = [...novos.reverse(), ...this.registros].slice(0, MAX_REGISTROS);
    }
    this.snap = {
      central,
      registros: this.registros,
      cenario: this.cenario,
      botoeira: this.botoeiraAte !== null,
      controle: central.t < this.controleAte,
    };
    for (const fn of this.listeners) fn();
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): MaquinaSnapshot => this.snap;

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.ctl.setVisible(visible);
  }

  dispose(): void {
    this.visible = false;
    this.ctl.setVisible(false);
  }

  /** Steps the simulation by `seconds` of simulated time (tests). */
  advance(seconds: number): void {
    this.ctl.advance(seconds);
  }

  /** A press of the learned remote. */
  remote(): void {
    this.controleAte = this.ctl.getSnapshot().t + TOQUE;
    this.ctl.remote();
  }

  /** A short press of the push button, released after `TOQUE` of simulated time. */
  pressBotoeira(): void {
    this.botoeiraAte = this.ctl.getSnapshot().t + TOQUE;
    this.ctl.hold('botoeira', true);
  }

  setBeam(blocked: boolean): void {
    this.ctl.setBeam(blocked);
  }

  setObstacle(present: boolean): void {
    this.ctl.setObstacle(present);
  }

  setAutoClose(on: boolean): void {
    this.ctl.setSetting('j2', on);
  }

  setPlaying(playing: boolean): void {
    this.ctl.setPlaying(playing);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.ctl.setSpeed(speed);
  }

  reset(): void {
    this.build();
  }

  setCenario(cenario: Cenario): void {
    this.cenario = cenario;
    this.build();
  }
}
