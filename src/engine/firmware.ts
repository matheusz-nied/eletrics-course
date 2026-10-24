/**
 * Firmware of the `mcu` device: a pure function of (state, inputs, time) →
 * (state, outputs), stepped every `period`. Each file
 * `src/lessons/<module>/firmware/<name>.ts` default-exports one, with
 * `id = "<module>/<name>"`, and a circuit picks it with
 * `params.firmware = "<module>/<name>"` (docs/plano/05-portao.md, section 5).
 *
 * Same shape as src/lessons/m16/central/firmware-api.ts, which the gate
 * module wrote first; firmware files may import the types from either.
 */

import type { ReadoutInfo } from './contract';

/** Digital level (true = high) or analog value (V), see `FirmwarePin.kind`. */
export type PinValue = boolean | number;

export interface FirmwarePin {
  /** Silkscreen name, also the pin name in the circuit and the key in `pins`: "FCA", "K1". */
  name: string;
  /**
   * - `digital-in`: high above half the supply (with `pullUp`, an open contact reads high).
   * - `analog-in`: voltage read by the ADC, 0 to `vcc` (V).
   * - `digital-out`: drives the supply (true) or ground (false) through about 50 Ω.
   * - `phase-out`: TRIAC phase control, the fraction of each half-cycle the TRIAC
   *   conducts (0 to 1); wired straight to a TRIAC gate.
   */
  kind: 'digital-in' | 'analog-in' | 'digital-out' | 'phase-out';
  pullUp?: boolean;
  /** pt-BR: "Fim de curso de abertura". */
  label: string;
}

/** A frame decoded by a radio receiver: one press of a remote button. */
export interface RfFrame {
  serial: string;
  button: number;
  /** Rolling code counter; absent for fixed code. */
  counter?: number;
}

export interface FirmwareInput {
  /** Time since power-up (s). */
  t: number;
  /** Time since the previous step (s). */
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
  /** Readouts of the element ("U1.estado"). */
  readouts: Record<string, number | boolean | string>;
  events: FirmwareEvent[];
}

export interface FirmwareDoc<S> {
  id: string;
  title: string;
  description: string;
  /** Step period (s). */
  period: number;
  /** Rated supply and ADC reference (V). */
  vcc: number;
  pins: FirmwarePin[];
  /** State at power-up; `memory` is what `persist` returned before the power went off. */
  init(memory?: unknown): S;
  step(state: S, input: FirmwareInput): FirmwareOutput<S>;
  /** Part of the state kept without power (EEPROM). */
  persist?(state: S): unknown;
  /** Label and unit of the step's own readouts (`ciclo`, `estado`…), shown in the inspector. */
  readouts?: Record<string, ReadoutInfo>;
}

/** Typed identity for firmware files. */
export function defineFirmware<S>(doc: FirmwareDoc<S>): FirmwareDoc<S> {
  return doc;
}

const modules = import.meta.glob<{ default: FirmwareDoc<unknown> }>(
  ['../lessons/**/firmware/*.ts', '!../lessons/**/firmware/*.test.ts'],
  { eager: true },
);

const registry = new Map<string, FirmwareDoc<unknown>>();
for (const [path, mod] of Object.entries(modules)) {
  const doc = mod.default;
  if (!doc?.id || typeof doc.step !== 'function') continue;
  if (registry.has(doc.id)) throw new Error(`firmware "${doc.id}" defined twice (${path})`);
  registry.set(doc.id, doc);
}

export function findFirmware(id: string): FirmwareDoc<unknown> | undefined {
  return registry.get(id);
}

export function listFirmware(): FirmwareDoc<unknown>[] {
  return [...registry.values()];
}
