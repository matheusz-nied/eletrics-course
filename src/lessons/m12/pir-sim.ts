/**
 * The PIR tab of the sensor lab in real time: a person in front of the
 * sensor, the HC-SR501 timer of sensores.ts and the last 20 s of the OUT
 * pin. A requestAnimationFrame loop while the tab is on screen, and an
 * immutable snapshot for React.
 */
import { PIR, PIR_INICIAL, pirDetecta, pirPasso, type PirEstado, type PirModo } from './sensores';

/** Step of the timer and of the plot (s). */
export const PIR_DT = 0.05;
/** Seconds of history in the plot. */
export const PIR_JANELA = 20;
const AMOSTRAS = Math.round(PIR_JANELA / PIR_DT);

export interface PirSnapshot {
  t: number;
  /** Person position across the scene, 0 to 1. */
  x: number;
  andando: boolean;
  estado: PirEstado;
  tempo: number;
  modo: PirModo;
  /** OUT level, one per step, oldest first (length `PIR_JANELA / PIR_DT`). */
  amostras: readonly boolean[];
  /** Times of the changes the sensor saw (s). */
  deteccoes: readonly number[];
}

export class PirSim {
  private t = 0;
  private x = 0.04;
  private destino: number | null = null;
  private pendente = false;
  private estado: PirEstado = PIR_INICIAL;
  private amostras: boolean[] = Array.from({ length: AMOSTRAS }, () => false);
  private deteccoes: number[] = [];
  private acc = 0;
  private snap!: PirSnapshot;
  private listeners = new Set<() => void>();
  private raf = 0;
  private last = 0;

  constructor(
    private tempo = 5,
    private modo: PirModo = 'H',
  ) {
    this.publish();
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): PirSnapshot => this.snap;

  private publish(): void {
    this.snap = {
      t: this.t,
      x: this.x,
      andando: this.destino !== null,
      estado: this.estado,
      tempo: this.tempo,
      modo: this.modo,
      amostras: this.amostras.slice(),
      deteccoes: this.deteccoes.slice(),
    };
    for (const fn of this.listeners) fn();
  }

  /** The student drags the person. */
  setX(x: number): void {
    this.destino = null;
    this.moveTo(x);
    this.publish();
  }

  /** The person walks across the scene, to the far side. */
  passar(): void {
    this.destino = this.x < 0.5 ? 0.96 : 0.04;
    this.publish();
  }

  setTempo(tempo: number): void {
    this.tempo = tempo;
    this.publish();
  }

  setModo(modo: PirModo): void {
    this.modo = modo;
    this.publish();
  }

  private moveTo(x: number): void {
    if (pirDetecta(this.x, x)) this.pendente = true;
    this.x = x;
  }

  /** Advances `seconds` of time (also used by the tests). */
  advance(seconds: number): void {
    this.acc += seconds;
    let steps = 0;
    while (this.acc >= PIR_DT - 1e-9 && steps < 400) {
      this.acc -= PIR_DT;
      steps++;
      if (this.destino !== null) {
        const d = this.destino - this.x;
        const step = Math.sign(d) * Math.min(Math.abs(d), PIR.passo * PIR_DT);
        this.moveTo(this.x + step);
        if (Math.abs(this.destino - this.x) < 1e-9) this.destino = null;
      }
      this.t += PIR_DT;
      const detectou = this.pendente;
      this.pendente = false;
      if (detectou) {
        this.deteccoes.push(this.t);
        this.deteccoes = this.deteccoes.filter((d) => d > this.t - PIR_JANELA);
      }
      this.estado = pirPasso(this.estado, PIR_DT, detectou, this.tempo, this.modo);
      this.amostras.push(this.estado.saida);
      this.amostras.shift();
    }
    if (steps > 0) this.publish();
  }

  setVisible(visible: boolean): void {
    if (!visible) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    if (this.raf) return;
    this.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - this.last) / 1000, 0.1);
      this.last = now;
      this.advance(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
}
