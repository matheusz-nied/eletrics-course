/**
 * Public entry of the simulation engine (docs/plano/02-arquitetura.md, section 5;
 * conventions in src/engine/README.md).
 */
import type { ElementDoc, Vec2 } from './contract';
import { infoFor } from './device';
import { findDevice } from './devices';
import { pinPoints } from './format/geometry';

export type * from './contract';
export { createSimulation } from './runtime/create';
export { buildNetlist } from './format/netlist';
export { getDeviceInfo, listDevices } from './devices';
export { defineCircuit } from './define';
export { validateCircuit, CircuitError, type ValidationResult } from './format/validate';
export { checkGoal } from './analysis/goals';
export {
  defineFirmware,
  findFirmware,
  listFirmware,
  type FirmwareDoc,
  type FirmwarePin,
  type FirmwareInput,
  type FirmwareOutput,
  type FirmwareEvent,
  type RfFrame,
} from './firmware';

/** Grid position of every pin of an element: `{ a: [2, 4], b: [8, 4] }` or `{ com: …, nc: …, no: … }`. */
export function getPinPositions(el: ElementDoc): Record<string, Vec2> {
  const def = findDevice(el.type);
  if (!def) throw new Error(`Tipo de dispositivo desconhecido: "${el.type}".`);
  const info = infoFor(def, el.params);
  const points = pinPoints(el, info);
  return Object.fromEntries(info.pins.map((pin, i) => [pin.name, points[i]]));
}
