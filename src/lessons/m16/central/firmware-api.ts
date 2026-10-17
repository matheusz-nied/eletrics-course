/**
 * Firmware of a simulated microcontroller: a pure function of
 * (state, inputs, time) → (state, outputs), as docs/plano/05-portao.md
 * (section 5.2) asks. The `mcu` device of the engine (S3) loads a firmware
 * by id, `params.firmware = "m16/central-generica"`, from
 * `src/lessons/**\/firmware/<name>.ts` (default export).
 *
 * This is the shape the gate central uses until the engine defines its own;
 * it is engine-agnostic so the lesson widgets and the tests can run the same
 * firmware without the simulator.
 */

/** Digital level (true = high, at `vcc`) or analog value, see `FirmwarePin.kind`. */
export type PinValue = boolean | number;

export interface FirmwarePin {
  /** Silkscreen name, also the key in `pins`: "FCA", "K1". */
  name: string;
  /**
   * - `digital-in`: logic level read by the pin (with `pullUp`, an open contact reads high).
   * - `analog-in`: voltage read by the ADC, 0 to `vcc` (V).
   * - `digital-out`: logic level driven by the pin (a transistor drives relays, buzzer, LEDs).
   * - `phase-out`: TRIAC firing by phase control. The value is the fraction of each
   *   half-cycle in which the TRIAC conducts, 0 (off) to 1 (full voltage).
   */
  kind: 'digital-in' | 'analog-in' | 'digital-out' | 'phase-out';
  pullUp?: boolean;
  /** pt-BR, for the interface: "Fim de curso de abertura". */
  label: string;
}

/** A frame decoded by the 433,92 MHz receiver: one press of a remote button. */
export interface RfFrame {
  /** Serial number of the remote, unique per remote. */
  serial: string;
  /** Button pressed on the remote, 1 to 4. */
  button: number;
  /** Rolling code: counter that grows at each press. Absent for fixed code ("code learning"). */
  counter?: number;
}

export interface FirmwareInput {
  /** Time since power-up (s). */
  t: number;
  /** Time since the previous step (s), normally `period`. */
  dt: number;
  /** Value of every input pin. */
  pins: Record<string, PinValue>;
  /** Frames received since the previous step. */
  rf?: readonly RfFrame[];
}

export interface FirmwareEvent {
  kind: 'info' | 'warning';
  /** pt-BR, ready to show. */
  message: string;
}

export interface FirmwareOutput<S> {
  state: S;
  /** Value of every output pin. */
  pins: Record<string, PinValue>;
  /** Values for the interface and lesson goals ("U1.estado" = "ABERTO"). */
  readouts: Record<string, number | boolean | string>;
  /** What happened in this step, in pt-BR. */
  events: FirmwareEvent[];
}

export interface FirmwareDoc<S> {
  /** "m16/central-generica", the path under src/lessons without `/firmware`. */
  id: string;
  /** pt-BR */
  title: string;
  description: string;
  /** Step period (s). */
  period: number;
  /** Supply and analog reference of the microcontroller (V). */
  vcc: number;
  pins: FirmwarePin[];
  /**
   * State at power-up. `memory` is what `persist` returned before the power
   * went off (the EEPROM), so learned remotes survive a power cut.
   */
  init(memory?: unknown): S;
  step(state: S, input: FirmwareInput): FirmwareOutput<S>;
  /** Part of the state kept without power (EEPROM). */
  persist?(state: S): unknown;
}

/** Typed identity for firmware files. */
export function defineFirmware<S>(doc: FirmwareDoc<S>): FirmwareDoc<S> {
  return doc;
}
