import type { DeviceInfo, ParamValue, SimEvent } from './contract';
import type { ComplexMna } from './solver/complex';
import type { MnaSystem } from './solver/mna';

/**
 * Internal device API. Each file in `devices/` default-exports one
 * `DeviceDefinition` built with `defineDevice`; the registry picks it up by
 * `import.meta.glob`, so adding a device is adding a file.
 */

export type AnalysisMode = 'dc' | 'tran';
export type Method = 'be' | 'trap';

export interface StepInfo {
  /** 'dc': capacitors open, inductors shorted; time still advances for thermal models. */
  mode: AnalysisMode;
  /** Time at the end of the step being solved (s). */
  t: number;
  /** Step length (s). 0 for a refresh, which shows the circuit without advancing time. */
  dt: number;
  /** Integration rule for reactive elements (backward Euler after discontinuities). */
  method: Method;
  /** Newton-Raphson state of the solve in progress. */
  nl: NewtonState;
}

export interface NewtonState {
  /** Iteration number within this solve (0 = first). */
  iteration: number;
  /** Set by a device that limited its junction voltage this iteration: not converged yet. */
  limited: boolean;
  /** Extra conductance across junctions while gmin stepping (S); 0 normally. */
  gmin: number;
  /** Scale of independent sources while source stepping (0…1); 1 normally. */
  sourceScale: number;
  /**
   * First iteration from a circuit at rest: junctions start at their critical
   * voltage instead of the (all-zero) guess, as SPICE does.
   */
  initJunctions: boolean;
}

/** Small-signal (Bode) or phasor (quasi-static) stamping at one angular frequency. */
export interface AcContext {
  /** Angular frequency ω = 2πf (rad/s). */
  omega: number;
  /** Id of the source that carries the 1 V (or 1 A) test signal in a sweep. */
  source: string;
  /** Id of the element being stamped. */
  id: string;
}

/** Read access to a solution (the current Newton iterate, or the accepted one). */
export interface SolutionView {
  readonly x: Float64Array;
  /** Voltage of an unknown index; 0 for ground (-1). */
  v(node: number): number;
}

export interface UpdateContext {
  /** True when the step is accepted and states may advance; false for a refresh. */
  readonly commit: boolean;
  /** Ambient temperature (°C). */
  readonly ambient: number;
  /** Reports an event (damage, trip, warning) with a pt-BR message. */
  emit(kind: SimEvent['kind'], message: string): void;
  /** The device changed behaviour abruptly (blew, burned, switched): restart integration. */
  discontinuity(): void;
}

export type ReadoutSink = (name: string, value: number | boolean | string) => void;

export interface DeviceModel {
  /** True when stamp() depends on the solution (Newton iterations needed). */
  readonly nonlinear?: boolean;
  /** Adds the device to the MNA system. Must not change the device state. */
  stamp(m: MnaSystem, step: StepInfo, x: SolutionView): void;
  /**
   * Before each solve attempt: reset per-iteration memory (the last limited
   * junction voltage) to the accepted state, so a retried step starts clean.
   */
  beginSolve?(): void;
  /**
   * Small-signal stamp for the AC sweep, linearized at the operating point
   * `op`. Devices without it cannot take part in a sweep.
   */
  stampAc?(m: ComplexMna, ctx: AcContext, op: SolutionView): void;
  /** After every solve: derive currents; when committing, advance states and check limits. */
  update?(step: StepInfo, x: SolutionView, ctx: UpdateContext): void;
  /** Currents entering the device through each pin, in `info.pins` order (A). */
  pinCurrents(x: SolutionView, out: Float64Array): void;
  /**
   * Device readouts (without the "id." prefix). Two-terminal devices get
   * `current` (a→b), `voltage` (Va−Vb) and `power` (absorbed) automatically;
   * writing the same name here overrides them.
   */
  readouts?(x: SolutionView, out: ReadoutSink): void;
  /** A parameter changed at run time (already validated and stored in `params`). */
  paramChanged?(name: string): void;
  /** Back to the initial state: undamaged, discharged, cold. Parameters are kept. */
  reset?(): void;
}

export interface SetupContext {
  /** Element id ("R1"), used in messages. */
  readonly id: string;
  /** Live parameter values, defaults filled in. Updated in place by setParam. */
  readonly params: Record<string, ParamValue>;
  /** Unknown index of each pin's node, in `info.pins` order (-1 = ground). */
  readonly pins: readonly number[];
  /** Allocates a branch-current unknown. */
  branch(): number;
  /** Allocates an internal node (gets gmin to ground like the circuit nodes). */
  node(): number;
}

export interface DeviceDefinition {
  readonly info: DeviceInfo;
  /**
   * Pin that becomes the reference node when a circuit has no ground symbol
   * (the negative terminal of a source).
   */
  readonly referencePin?: string;
  /** Sources report delivered current and power instead of absorbed. */
  readonly source?: boolean;
  create(setup: SetupContext): DeviceModel;
}

export function defineDevice(def: DeviceDefinition): DeviceDefinition {
  return def;
}

/** Pins of two-terminal devices. */
export const TWO_PINS = [
  { name: 'a', offset: [0, 0] as [number, number] },
  { name: 'b', offset: [0, 0] as [number, number] },
];

/** Reads typed values from the live params object. */
export function num(params: Record<string, ParamValue>, name: string): number {
  return params[name] as number;
}
export function bool(params: Record<string, ParamValue>, name: string): boolean {
  return params[name] as boolean;
}
export function str(params: Record<string, ParamValue>, name: string): string {
  return params[name] as string;
}
