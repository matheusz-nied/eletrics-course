import type { CircuitDoc, ParamValue, SimFrame } from '../contract';

/** Messages between WorkerSimulation (page) and SimHost (worker). One worker serves every simulation on the page. */
export type ToWorker =
  | { type: 'load'; sim: number; req: number; doc: CircuitDoc }
  | { type: 'setParam'; sim: number; element: string; param: string; value: ParamValue }
  | { type: 'play' | 'pause' | 'reset' | 'dispose'; sim: number }
  | { type: 'setSpeed'; sim: number; factor: number }
  | { type: 'runUntil'; sim: number; req: number; t: number; maxFrames?: number };

export type FromWorker =
  | { type: 'frame'; sim: number; frame: SimFrame }
  | { type: 'result'; sim: number; req: number; ok: true; frames?: SimFrame[] }
  | { type: 'result'; sim: number; req: number; ok: false; error: string };

/** The part of Worker / MessagePort / worker scope the protocol uses. */
export interface Port<In, Out> {
  postMessage(message: Out): void;
  addEventListener(type: 'message', listener: (event: { data: In }) => void): void;
}
