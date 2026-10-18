import type { AnalysisDoc, DeviceInfo, ParamValue, SimEvent } from './contract';
import type { Exposed } from './models/mechanics';
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
  /**
   * Quasi-static analysis: this is the DC part of a mechanical step (mode
   * 'dc'); the AC part is solved after it, and `ac` carries it to update().
   */
  quasiStatic?: boolean;
  /** Quasi-static analysis, in update() only: the phasor solution of this step. */
  ac?: PhasorView;
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
  /**
   * Quasi-static analysis: sources stamp their own RMS phasor (those at
   * another frequency stamp zero) and power devices their large-signal model.
   */
  phasor?: boolean;
  /**
   * Quasi-static analysis, second pass: the solution of the first one. A
   * device that needs it (a TRIAC in phase control needs its open-circuit
   * voltage) calls `again()` during the first pass.
   */
  first?: PhasorView;
  again?(): void;
}

/**
 * Phasor solution of a quasi-static step at `omega`: RMS phasors of node
 * voltages and branch currents, and of the currents entering the device being
 * updated through each of its pins.
 */
export interface PhasorView {
  readonly omega: number;
  re(index: number): number;
  im(index: number): number;
  pinRe(pin: number): number;
  pinIm(pin: number): number;
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
   * writing the same name here overrides them. `ac` is the phasor solution in
   * the quasi-static analysis.
   */
  readouts?(x: SolutionView, out: ReadoutSink, ac?: PhasorView): void;
  /** A parameter changed at run time (already validated and stored in `params`). */
  paramChanged?(name: string): void;
  /** Back to the initial state: undamaged, discharged, cold. Parameters are kept. */
  reset?(): void;
  /** Mechanical parts other devices couple to (a motor shaft, a gate's position). */
  readonly exposes?: Exposed;
  /**
   * Called once after every device exists, for devices coupled to another by
   * a parameter (`params.motor = "M1"`): `find` gives the other device's
   * model. Returns a pt-BR problem when the link does not work. Coupled
   * devices update after the ones they couple to.
   */
  couple?(find: (id: string) => DeviceModel | undefined): string | undefined;
}

/**
 * State shared by everything connected to one node, for signals that are not
 * a voltage: the phase-control fraction from a microcontroller to a TRIAC
 * gate, the frames from a radio receiver to a microcontroller.
 */
export interface NodeSignal {
  /** TRIAC conduction fraction driven onto this node (0…1), when a `phase-out` pin drives it. */
  phase?: number;
  /** Data frames sent on this node since the reader last took them. */
  frames: unknown[];
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
  /** Analysis the circuit runs. */
  readonly analysis: AnalysisDoc['kind'];
  /** Signals shared on a node (-1 = ground, which carries none worth reading). */
  signal(node: number): NodeSignal;
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
  /** Analyses the device runs in (default: all). */
  readonly analyses?: readonly AnalysisDoc['kind'][];
  /**
   * Parameters that name another element (`motor: "M1"`), with the device
   * types they accept. Empty means not coupled.
   */
  readonly links?: Readonly<Record<string, readonly string[]>>;
  /** Pins (and readouts) that depend on parameters: a microcontroller's firmware, a DIP switch's size. */
  instance?(params: Record<string, ParamValue>): DeviceInfo;
  /** Problems with parameter values beyond their range (an unknown firmware id), in pt-BR. */
  checkParams?(params: Record<string, ParamValue>): string[];
  create(setup: SetupContext): DeviceModel;
}

/** Parameters with defaults filled in. */
export function withDefaults(
  info: DeviceInfo,
  params: Record<string, ParamValue> = {},
): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const [name, p] of Object.entries(info.params)) out[name] = p.default;
  return Object.assign(out, params);
}

/** Device info of one element: its pins may depend on its parameters. */
export function infoFor(def: DeviceDefinition, params?: Record<string, ParamValue>): DeviceInfo {
  return def.instance ? def.instance(withDefaults(def.info, params)) : def.info;
}

/** RMS of a DC value plus a phasor (RMS) at one frequency. */
export function rms(dc: number, re = 0, im = 0): number {
  return Math.sqrt(dc * dc + re * re + im * im);
}

/** Square of the RMS current entering pin `k` through the AC part (0 outside the quasi-static analysis). */
export function acSquared(step: StepInfo, k: number): number {
  const ac = step.ac;
  if (!ac) return 0;
  const re = ac.pinRe(k);
  const im = ac.pinIm(k);
  return re * re + im * im;
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
