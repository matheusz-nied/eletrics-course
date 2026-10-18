/**
 * Runs the gate system (src/lessons/m16/central/system.ts) in real time for
 * the "central virtual" widget: a requestAnimationFrame loop that steps the
 * firmware every 10 ms of simulated time, and an immutable snapshot for
 * React after each frame. No DOM besides the animation frame.
 */
import { NOME_ESTADO, type Estado } from '../central/controller';
import type { RfFrame } from '../central/firmware-api';
import type { GateEnvironment, GateFaults } from '../central/plant';
import { GateSystem, type BoardSettings, type LoggedEvent } from '../central/system';

/** Faults outside the gate itself, handled by the widget. */
export interface WidgetFaults extends GateFaults {
  /** The board fuse is open: nothing works, the REDE LED is off. */
  fusivelQueimado?: boolean;
  /** The remote's battery is weak: it only works close to the central. */
  bateriaFraca?: boolean;
}

export interface CentralOptions {
  settings?: Partial<BoardSettings>;
  faults?: WidgetFaults;
  /** Initial gate position, 0 (closed) to 1 (open). */
  abertura?: number;
  /** The remote is already learned. */
  controleCadastrado?: boolean;
  /** Simulated seconds per real second. */
  speed?: number;
}

export interface CentralSnapshot {
  t: number;
  estado: Estado | '';
  nomeEstado: string;
  /** 0 (closed) to 1 (open). */
  abertura: number;
  /** Gate speed (m/s, positive opening). */
  velocidade: number;
  corrente: number;
  zumbindo: boolean;
  leds: { rede: boolean; fca: boolean; fcf: boolean; foto: boolean; prog: boolean };
  k1: boolean;
  k2: boolean;
  triac: number;
  trava: boolean;
  aux: boolean;
  buzzer: boolean;
  pausaRestante: number;
  tempoPercurso: number;
  fechamentoAutomatico: boolean;
  controles: number;
  cadastro: boolean;
  fotocelula: string;
  limiteCorrente: number;
  settings: BoardSettings;
  env: GateEnvironment;
  /** Circuit breaker on. */
  disjuntor: boolean;
  energizada: boolean;
  controlePerto: boolean;
  playing: boolean;
  speed: number;
  /** Newest first. */
  eventos: LoggedEvent[];
}

const REMOTE = 'CTRL-0001';
const OTHER_REMOTE = 'CTRL-0002';
/** Where the closing gate meets the obstacle, from the closing post (m). */
export const OBSTACLE_AT = 1.5;

export class CentralController {
  private sys!: GateSystem;
  private listeners = new Set<() => void>();
  private snap!: CentralSnapshot;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private visible = false;
  private playing = true;
  private speed: number;
  private disjuntor = true;
  private perto = false;
  private counter = 100;
  private otherCounter = 0;
  private lastFrame: RfFrame | null = null;

  constructor(private readonly opts: CentralOptions = {}) {
    this.speed = opts.speed ?? 2;
    this.build();
  }

  private build(): void {
    const o = this.opts;
    const learned = o.controleCadastrado ?? true;
    this.sys = new GateSystem({
      settings: o.settings,
      faults: { ...o.faults },
      position: (o.abertura ?? 0) * 3.98,
      memory: learned ? { controles: [{ serial: REMOTE, botao: 1, contador: 99 }] } : undefined,
    });
    this.disjuntor = true;
    this.perto = false;
    this.counter = 100;
    this.otherCounter = 0;
    this.lastFrame = null;
    this.acc = 0;
    this.applyPower();
    this.sys.step();
    this.publish();
  }

  get faults(): WidgetFaults {
    return this.opts.faults ?? {};
  }

  private applyPower(): void {
    this.sys.setPower(this.disjuntor && !this.faults.fusivelQueimado);
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): CentralSnapshot => this.snap;

  private publish(): void {
    const s = this.sys;
    const r = s.readouts;
    const reading = s.plant.read(s.env);
    const estado = (r.estado as Estado | undefined) ?? '';
    this.snap = {
      t: s.t,
      estado,
      nomeEstado: estado ? NOME_ESTADO[estado] : 'Desligada',
      abertura: s.plant.position / s.plant.params.imaFca,
      velocidade: s.plant.speed,
      corrente: s.plant.current,
      zumbindo: s.plant.humming,
      leds: {
        rede: s.powered,
        // These LEDs are in the input circuits: they show the contact itself.
        fca: s.powered && reading.fca,
        fcf: s.powered && reading.fcf,
        foto: s.powered && reading.feixeLivre,
        prog: s.powered && s.pins.LED_PROG === true,
      },
      k1: s.pins.K1 === true,
      k2: s.pins.K2 === true,
      triac: Number(s.pins.TRIAC ?? 0),
      trava: s.pins.TRAVA === true,
      aux: s.pins.AUX === true,
      buzzer: s.pins.BUZZER === true,
      pausaRestante: Number(r.pausaRestante ?? 0),
      tempoPercurso: Number(r.tempoPercurso ?? 0),
      fechamentoAutomatico: r.fechamentoAutomatico === true,
      controles: Number(r.controles ?? 0),
      cadastro: r.cadastro === true,
      fotocelula: String(r.fotocelula ?? ''),
      limiteCorrente: Number(r.limiteCorrente ?? 0),
      settings: { ...s.settings },
      env: { ...s.env },
      disjuntor: this.disjuntor,
      energizada: s.powered,
      controlePerto: this.perto,
      playing: this.playing,
      speed: this.speed,
      eventos: s.log.slice(-6).reverse(),
    };
    for (const fn of this.listeners) fn();
  }

  // Real-time loop

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.loop();
  }

  private loop(): void {
    const active = this.visible && this.playing;
    if (!active) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    if (this.raf) return;
    this.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - this.last) / 1000, 0.1);
      this.last = now;
      this.advance(dt * this.speed);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Steps the system by `seconds` of simulated time. */
  advance(seconds: number): void {
    this.acc += seconds;
    const period = this.sys.period;
    let steps = 0;
    while (this.acc >= period && steps < 2000) {
      this.sys.step();
      this.acc -= period;
      steps++;
    }
    if (steps > 0) this.publish();
  }

  dispose(): void {
    this.visible = false;
    this.loop();
    this.listeners.clear();
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
    this.loop();
    this.publish();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.publish();
  }

  reset(): void {
    this.build();
  }

  // What the student does

  hold(button: 'botoeira' | 'prog', down: boolean): void {
    this.sys.held[button] = down;
    this.publish();
  }

  /** A press of the learned remote's button (rolling code). */
  remote(): boolean {
    if (this.faults.bateriaFraca && !this.perto) return false;
    const frame = { serial: REMOTE, button: 1, counter: ++this.counter };
    this.lastFrame = frame;
    this.sys.sendRf(frame);
    return true;
  }

  /** A second remote, not learned at first (a neighbour's, or a new one). */
  otherRemote(): void {
    this.sys.sendRf({ serial: OTHER_REMOTE, button: 1, counter: ++this.otherCounter });
  }

  /** Plays back the last frame of the remote, as a code grabber would. */
  replay(): boolean {
    if (!this.lastFrame) return false;
    this.sys.sendRf({ ...this.lastFrame });
    return true;
  }

  setSetting<K extends keyof BoardSettings>(key: K, value: BoardSettings[K]): void {
    this.sys.settings = { ...this.sys.settings, [key]: value };
    this.publish();
  }

  setBeam(blocked: boolean): void {
    this.sys.env = { ...this.sys.env, feixeInterrompido: blocked };
    this.publish();
  }

  setObstacle(present: boolean): void {
    this.sys.env = { ...this.sys.env, obstaculo: present ? OBSTACLE_AT : null };
    this.publish();
  }

  setBreaker(on: boolean): void {
    this.disjuntor = on;
    this.applyPower();
    this.publish();
  }

  setRemoteClose(close: boolean): void {
    this.perto = close;
    this.publish();
  }
}
