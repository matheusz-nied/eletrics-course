/**
 * A behavioural model of a sliding gate with its motor, limit switches and
 * photocell, simple enough to run in a lesson widget and in the firmware
 * tests without the circuit simulator. The engine (S3) has the physical
 * model; this one only needs the right shape: the gate moves at about
 * 10 m/min, the current rises when the motor is loaded or stalls, the reed
 * closes near its magnet, and the faults of docs/plano/05-portao.md
 * (section 7) behave like the real ones. Values are typical, not a
 * manufacturer's.
 */

export interface GateParams {
  /** Travel from closed (0) to open (m). */
  curso: number;
  /** Gate speed at full voltage and light load (m/s). */
  velocidade: number;
  /** Push at the rack with full voltage just before stalling (N). */
  forcaMaxima: number;
  /** Rolling friction of the gate (N). */
  atrito: number;
  /** Where each magnet meets the reed (m from closed). */
  imaFca: number;
  imaFcf: number;
  /** The reed is closed within this distance of its magnet (m). */
  zonaReed: number;
  /** Motor current at full voltage, light load and locked rotor (A, RMS). */
  correnteVazio: number;
  correnteBloqueado: number;
  /** Speed time constant while driven and when coasting (s). */
  tau: number;
  tauParada: number;
}

export const GATE_PARAMS: GateParams = {
  curso: 4,
  velocidade: 0.17,
  forcaMaxima: 600,
  atrito: 90,
  imaFca: 3.98,
  imaFcf: 0.02,
  zonaReed: 0.03,
  correnteVazio: 1.8,
  correnteBloqueado: 7,
  tau: 0.15,
  tauParada: 0.05,
};

export interface GateFaults {
  /** Motor capacitor open or missing: no starting torque, the motor hums. */
  capacitorAberto?: boolean;
  /** ABRE and FECHA wires swapped at the central. */
  fiosInvertidos?: boolean;
  /** The reed never closes. */
  reedDefeituoso?: boolean;
  /** FCA and FCF swapped at the connector. */
  conectorFcInvertido?: boolean;
  /** Photocell misaligned: the receiver never sees the beam. */
  fotocelulaDesalinhada?: boolean;
  /** No photocell wired to FOTO. */
  semFotocelula?: boolean;
  /** Manual release open: the motor turns, the gate does not follow. */
  desbloqueado?: boolean;
  /** Extra friction on part of the track (m, m, N). */
  atritoExtra?: { de: number; ate: number; forca: number };
}

export interface GateEnvironment {
  /** Something (a car, a person) in the photocell beam. */
  feixeInterrompido: boolean;
  /**
   * An obstacle in the opening, at this distance from the closing post (m):
   * the closing gate hits it when its edge gets there.
   */
  obstaculo: number | null;
  /** Something stops the gate from opening past this position (m), like a hand holding it. */
  obstaculoAbertura?: number | null;
}

export interface MotorDrive {
  /** Relay contacts at the central: phase to ABRE (K1) and to FECHA (K2). */
  abre: boolean;
  fecha: boolean;
  /** TRIAC conduction, 0 to 1. */
  triac: number;
}

export interface GateReadings {
  /** Opening limit switch closed, as seen at the central's connector. */
  fca: boolean;
  fcf: boolean;
  /** Photocell NC contact closed (beam seen). False also with no photocell. */
  feixeLivre: boolean;
  /** Motor current (A, RMS). */
  corrente: number;
  /** The motor is powered but not turning. */
  zumbindo: boolean;
}

export class GatePlant {
  /** Gate position (m, 0 = closed). */
  position: number;
  /** Gate speed (m/s, positive opening). */
  speed = 0;
  /** Motor speed expressed at the rack (m/s); differs from the gate when released. */
  motorSpeed = 0;
  current = 0;
  humming = false;
  /** The gate pushes against something it cannot move. */
  blocked = false;

  constructor(
    readonly params: GateParams = GATE_PARAMS,
    readonly faults: GateFaults = {},
    position = 0,
  ) {
    this.position = position;
  }

  /** Advances `dt` seconds with the motor driven as given. */
  update(dt: number, drive: MotorDrive, env: GateEnvironment): void {
    const p = this.params;
    const level = Math.min(1, Math.max(0, drive.triac));
    const both = drive.abre && drive.fecha;
    const powered = level > 0 && (drive.abre || drive.fecha);
    // Phase on ABRE turns the motor the opening way, unless the wires are swapped.
    let dir = 0;
    if (powered && !both) dir = drive.abre ? 1 : -1;
    if (this.faults.fiosInvertidos) dir = -dir;

    // Torque goes with the square of the voltage. Without the capacitor (or
    // with both windings on the phase) there is no rotating field to start.
    let force = p.forcaMaxima * level * level;
    const noField = this.faults.capacitorAberto || both;
    if (noField) force = Math.abs(this.motorSpeed) > 0.3 * p.velocidade ? force * 0.5 : 0;

    const released = !!this.faults.desbloqueado;
    let load = released ? 0 : p.atrito;
    const extra = this.faults.atritoExtra;
    if (extra && !released && this.position >= extra.de && this.position <= extra.ate) {
      load += extra.forca;
    }
    const obstacle = env.obstaculo;
    const atClosedEnd = this.position <= 0 && dir < 0;
    const atOpenEnd = this.position >= p.curso && dir > 0;
    const held = env.obstaculoAbertura ?? null;
    const atObstacle =
      (obstacle !== null && dir < 0 && this.position <= obstacle) ||
      (held !== null && dir > 0 && this.position >= held);
    this.blocked = !released && powered && (atClosedEnd || atOpenEnd || atObstacle);

    let target = 0;
    if (powered && dir !== 0 && !this.blocked && force > 0) {
      const r = load / force;
      const v =
        r <= 0.8 ? 1 - 0.15 * r : r < 1 ? (0.88 * (1 - r)) / 0.2 : 0; /* fraction of rated speed */
      target = dir * v * p.velocidade;
    }
    const tau = powered ? p.tau : p.tauParada;
    this.motorSpeed += ((target - this.motorSpeed) * Math.min(dt, tau)) / tau;
    if (this.blocked || (!powered && Math.abs(this.motorSpeed) < 1e-4)) this.motorSpeed = 0;

    this.speed = released ? 0 : this.motorSpeed;
    let next = this.position + this.speed * dt;
    if (obstacle !== null && this.position > obstacle && next < obstacle) next = obstacle;
    if (held !== null && this.position < held && next > held) next = held;
    this.position = Math.min(p.curso, Math.max(0, next));

    // Current: no-load value when spinning freely, rising to locked-rotor as it slows.
    if (powered) {
      const slip = 1 - Math.min(1, Math.abs(this.motorSpeed) / p.velocidade);
      const full = noField
        ? p.correnteBloqueado * 0.85
        : p.correnteVazio + (p.correnteBloqueado - p.correnteVazio) * slip;
      this.current = level * (noField && Math.abs(this.motorSpeed) > 0 ? full * 0.8 : full);
      this.humming = Math.abs(this.motorSpeed) < 0.05 * p.velocidade;
    } else {
      this.current = 0;
      this.humming = false;
    }
  }

  read(env: GateEnvironment): GateReadings {
    const p = this.params;
    const f = this.faults;
    let fca = !f.reedDefeituoso && Math.abs(this.position - p.imaFca) <= p.zonaReed;
    let fcf = !f.reedDefeituoso && Math.abs(this.position - p.imaFcf) <= p.zonaReed;
    if (f.conectorFcInvertido) [fca, fcf] = [fcf, fca];
    return {
      fca,
      fcf,
      feixeLivre: !f.semFotocelula && !f.fotocelulaDesalinhada && !env.feixeInterrompido,
      corrente: this.current,
      zumbindo: this.humming,
    };
  }
}
