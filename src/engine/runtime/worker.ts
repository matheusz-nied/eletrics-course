import { SimHost } from './host';
import type { FromWorker, Port, ToWorker } from './protocol';

// Entry point of the simulation Web Worker shared by every simulation on the page.
const scope = self as unknown as Port<ToWorker, FromWorker>;
const host = new SimHost((message) => scope.postMessage(message));
scope.addEventListener('message', (event) => host.handle(event.data));
