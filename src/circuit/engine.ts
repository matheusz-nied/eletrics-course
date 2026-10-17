/**
 * The engine used by the schematic and the instruments.
 *
 * The real engine (src/engine) runs every circuit it supports. Until the
 * Simulação front delivers levels 2 and 3 (diodes, relays, motors, AC sweep,
 * quasi-static), circuits that need them run on the stand-in in ./fake-engine,
 * which follows the same contract and the same pins, parameters and readouts.
 * When the real engine covers everything, this file drops the fallback.
 */
import * as real from '../engine';
import type {
  CircuitDoc,
  DeviceInfo,
  Netlist,
  ParamValue,
  SimFrame,
  SimHandle,
} from '../engine/contract';
import * as fake from './fake-engine';

export interface EngineApi {
  createSimulation(opts?: { worker?: boolean }): SimHandle;
  buildNetlist(doc: CircuitDoc): Netlist;
  getDeviceInfo(type: string, params?: Record<string, ParamValue>): DeviceInfo;
}

/** Analyses the real engine runs today (S2 adds ac-sweep, S3 quasi-static). */
const REAL_ANALYSES = new Set<CircuitDoc['analysis']['kind']>(['dc', 'transient']);

const realTypes = new Set(real.listDevices().map((d) => d.type));

/** True when the real engine knows every element and the analysis of the circuit. */
export function runsOnRealEngine(doc: CircuitDoc): boolean {
  return REAL_ANALYSES.has(doc.analysis.kind) && doc.elements.every((el) => realTypes.has(el.type));
}

/** The engine that runs this circuit. */
export function engineFor(doc: CircuitDoc): EngineApi {
  return runsOnRealEngine(doc) ? real : fake;
}

/**
 * Typed identity for circuit files. Circuits the real engine runs are
 * validated by it (in development); the others wait for levels 2 and 3.
 */
export function defineCircuit<const T extends CircuitDoc>(doc: T): T {
  return runsOnRealEngine(doc) ? real.defineCircuit(doc) : doc;
}

/** Device info (the real engine's when it knows the type), or undefined for an unknown type. */
export function deviceInfo(
  type: string,
  params?: Record<string, ParamValue>,
): DeviceInfo | undefined {
  if (realTypes.has(type)) return real.getDeviceInfo(type);
  try {
    return fake.getDeviceInfo(type, params);
  } catch {
    return undefined;
  }
}

/** Every device type the schematic can show, real engine first. */
export function listDeviceTypes(): string[] {
  const types = new Set(realTypes);
  for (const d of fake.listDevices()) types.add(d.type);
  return [...types].sort();
}

/** Per-step probe samples since the previous frame (`SimFrame.samples`). */
export type FrameSamples = NonNullable<SimFrame['samples']>;

export function frameSamples(frame: SimFrame): FrameSamples | undefined {
  const s = frame.samples;
  return s && Array.isArray(s.t) && s.t.length > 0 ? s : undefined;
}
