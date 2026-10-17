import type { SimHandle } from '../contract';
import { WorkerSimulation } from './client';
import { LocalSimulation } from './local';

/**
 * A simulation in the page's shared Web Worker when the browser has one
 * (default), or on the calling thread (`{ worker: false }`, Node and tests).
 */
export function createSimulation(opts: { worker?: boolean } = {}): SimHandle {
  const wantWorker = opts.worker ?? typeof Worker !== 'undefined';
  if (wantWorker && typeof Worker !== 'undefined') {
    try {
      return new WorkerSimulation();
    } catch (error) {
      console.warn('Simulação sem worker:', error);
    }
  }
  return new LocalSimulation();
}
