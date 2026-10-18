/**
 * Circuit registry: every `src/lessons/**\/*.circuit.ts` is a circuit whose id is
 * its path without the extension ("m02/serie-lampadas"). Demos of the schematic
 * itself live in `src/circuit/demos/` with ids "demo/<name>".
 * Each file default-exports a CircuitDoc (`export default defineCircuit({...})`).
 */
import type { CircuitDoc } from '../engine/contract';

type Loader = () => Promise<{ default: CircuitDoc }>;

const lessonModules = import.meta.glob<{ default: CircuitDoc }>('/src/lessons/**/*.circuit.ts');
const demoModules = import.meta.glob<{ default: CircuitDoc }>('/src/circuit/demos/*.circuit.ts');

/** "/src/lessons/m02/serie-lampadas.circuit.ts" → "m02/serie-lampadas". */
export function circuitIdFromPath(path: string): string | undefined {
  const lesson = /^\/src\/lessons\/(.+)\.circuit\.ts$/.exec(path);
  if (lesson) return lesson[1];
  const demo = /^\/src\/circuit\/demos\/(.+)\.circuit\.ts$/.exec(path);
  if (demo) return `demo/${demo[1]}`;
  return undefined;
}

const LOADERS = new Map<string, { path: string; load: Loader }>();
for (const [path, load] of Object.entries({ ...lessonModules, ...demoModules })) {
  const id = circuitIdFromPath(path);
  if (id) LOADERS.set(id, { path, load });
}

export function listCircuitIds(): string[] {
  return [...LOADERS.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
}

export function hasCircuit(id: string): boolean {
  return LOADERS.has(id);
}

/** Loads a circuit by id. Throws when it does not exist or its id does not match the path. */
export async function loadCircuit(id: string): Promise<CircuitDoc> {
  const entry = LOADERS.get(id);
  if (!entry) {
    throw new Error(
      `Circuito "${id}" não encontrado. Crie src/lessons/${id}.circuit.ts (ou confira o id).`,
    );
  }
  const doc = (await entry.load()).default;
  if (doc.id !== id) {
    throw new Error(`O circuito em ${entry.path} declara id "${doc.id}"; deveria ser "${id}".`);
  }
  return doc;
}
