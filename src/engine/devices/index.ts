import type { DeviceInfo } from '../contract';
import type { DeviceDefinition } from '../device';

/**
 * Device registry. Every other `.ts` file in this folder default-exports a
 * DeviceDefinition; adding a device is adding a file (docs/plano/02-arquitetura.md, section 3).
 */
const modules = import.meta.glob<{ default: DeviceDefinition }>(
  ['./*.ts', '!./index.ts', '!./*.test.ts'],
  { eager: true },
);

const registry = new Map<string, DeviceDefinition>();
for (const [path, mod] of Object.entries(modules)) {
  const def = mod.default;
  if (!def?.info?.type) throw new Error(`${path} does not default-export a device definition`);
  if (registry.has(def.info.type)) throw new Error(`device type "${def.info.type}" defined twice`);
  registry.set(def.info.type, def);
}

export function findDevice(type: string): DeviceDefinition | undefined {
  return registry.get(type);
}

export function getDeviceInfo(type: string): DeviceInfo {
  const def = registry.get(type);
  if (!def) throw new Error(`Tipo de dispositivo desconhecido: "${type}".`);
  return def.info;
}

export function listDevices(): DeviceInfo[] {
  return [...registry.values()].map((def) => def.info).sort((x, y) => x.type.localeCompare(y.type));
}
