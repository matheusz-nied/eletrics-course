/**
 * The whole gate without the circuit simulator: the plant (gate, motor,
 * sensors), the CD-1 board (pull-ups, jumpers, DIP, trimpots, current
 * sensor, receiver) and its firmware, stepped together every firmware
 * period. Used by the "central virtual" lesson widget and by the tests.
 */
import firmware, { SENSOR_CORRENTE_V_POR_A, VCC } from '../firmware/central-generica';
import type { CentralState } from './controller';
import type { FirmwareEvent, PinValue, RfFrame } from './firmware-api';
import {
  GATE_PARAMS,
  GatePlant,
  type GateEnvironment,
  type GateFaults,
  type GateParams,
} from './plant';

export interface BoardSettings {
  /** Jumpers fitted. */
  j1: boolean;
  j2: boolean;
  /** DIP switches on. */
  inv: boolean;
  luz: boolean;
  /** Trimpot positions, 0 to 1. */
  pausa: number;
  forca: number;
}

export const DEFAULT_SETTINGS: BoardSettings = {
  j1: false,
  j2: true,
  inv: false,
  luz: false,
  pausa: 0.25,
  forca: 0.5,
};

export interface SystemOptions {
  settings?: Partial<BoardSettings>;
  faults?: GateFaults;
  params?: Partial<GateParams>;
  /** Initial gate position (m from closed). */
  position?: number;
  /** EEPROM contents at power-up (learned remotes), as `firmware.persist` returns. */
  memory?: unknown;
}

export interface LoggedEvent extends FirmwareEvent {
  t: number;
}

export class GateSystem {
  readonly period = firmware.period;
  readonly plant: GatePlant;
  settings: BoardSettings;
  env: GateEnvironment = { feixeInterrompido: false, obstaculo: null };
  /** Buttons held by the user. */
  held = { botoeira: false, prog: false };
  /** Mains on (circuit breaker and fuse). */
  powered = true;
  t = 0;
  state: CentralState;
  pins: Record<string, PinValue> = {};
  readouts: Record<string, number | boolean | string> = {};
  log: LoggedEvent[] = [];
  private rf: RfFrame[] = [];
  private release: { botoeira: number; prog: number } = { botoeira: -1, prog: -1 };
  private memory: unknown;

  constructor(opts: SystemOptions = {}) {
    this.settings = { ...DEFAULT_SETTINGS, ...opts.settings };
    this.plant = new GatePlant(
      { ...GATE_PARAMS, ...opts.params },
      opts.faults ?? {},
      opts.position,
    );
    this.memory = opts.memory;
    this.state = firmware.init(opts.memory);
  }

  get faults(): GateFaults {
    return this.plant.faults;
  }

  /** Pin levels the board presents to the microcontroller. */
  inputPins(): Record<string, PinValue> {
    const r = this.plant.read(this.env);
    const s = this.settings;
    // Each contact closes to GND; the pin has a pull-up, so closed reads low.
    return {
      FCA: !r.fca,
      FCF: !r.fcf,
      BOT: !this.held.botoeira,
      FOTO: !r.feixeLivre,
      PROG: !this.held.prog,
      J1: !s.j1,
      J2: !s.j2,
      INV: !s.inv,
      LUZ: !s.luz,
      PAUSA: s.pausa * VCC,
      FORCA: s.forca * VCC,
      CORRENTE: r.corrente * SENSOR_CORRENTE_V_POR_A,
    };
  }

  /** Presses a button for `seconds` (a short touch by default). */
  press(button: 'botoeira' | 'prog', seconds = 0.2): void {
    this.held[button] = true;
    this.release[button] = this.t + seconds;
  }

  /** A remote button press reaching the receiver. */
  sendRf(frame: RfFrame): void {
    this.rf.push(frame);
  }

  setPower(on: boolean): void {
    if (on === this.powered) return;
    this.powered = on;
    if (on) this.state = firmware.init(this.memory);
    else {
      this.memory = firmware.persist?.(this.state);
      this.pins = {};
      this.readouts = {};
    }
  }

  /** One firmware period. */
  step(): void {
    const dt = this.period;
    const drive = this.powered
      ? {
          abre: this.pins.K1 === true,
          fecha: this.pins.K2 === true,
          triac: Number(this.pins.TRIAC ?? 0),
        }
      : { abre: false, fecha: false, triac: 0 };
    // The board's relays: K1 puts the phase on ABRE, K2 on FECHA.
    this.plant.update(dt, drive, this.env);
    this.t += dt;
    for (const b of ['botoeira', 'prog'] as const) {
      if (this.held[b] && this.release[b] >= 0 && this.t >= this.release[b]) {
        this.held[b] = false;
        this.release[b] = -1;
      }
    }
    if (!this.powered) {
      this.rf = [];
      return;
    }
    const out = firmware.step(this.state, {
      t: this.t,
      dt,
      pins: this.inputPins(),
      rf: this.rf,
    });
    this.rf = [];
    this.state = out.state;
    this.pins = out.pins;
    this.readouts = out.readouts;
    for (const e of out.events) this.log.push({ ...e, t: this.t });
  }

  /** Runs for `seconds`; `each` sees every step. */
  run(seconds: number, each?: (sys: this) => void): void {
    const steps = Math.round(seconds / this.period);
    for (let i = 0; i < steps; i++) {
      this.step();
      each?.(this);
    }
  }

  /** Runs until `done` is true or `limit` seconds pass; returns the time it took. */
  runUntil(done: (sys: this) => boolean, limit = 120, each?: (sys: this) => void): number {
    const start = this.t;
    while (this.t - start < limit) {
      this.step();
      each?.(this);
      if (done(this)) break;
    }
    return this.t - start;
  }

  get estado(): string {
    return String(this.readouts.estado ?? '');
  }
}
