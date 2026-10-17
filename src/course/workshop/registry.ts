/**
 * Every workshop of the course, found by file name:
 * `src/lessons/**\/oficinas/<id>.ts` (default export from defineWorkshop).
 */
import { normalizeWorkshop, type Workshop, type WorkshopDoc } from './format';

const files = import.meta.glob<{ default: WorkshopDoc }>('/src/lessons/**/oficinas/*.ts', {
  eager: true,
});

let cache: Map<string, Workshop> | undefined;

export function workshops(): Map<string, Workshop> {
  if (cache) return cache;
  const map = new Map<string, Workshop>();
  for (const [path, mod] of Object.entries(files)) {
    if (path.endsWith('.test.ts')) continue;
    const id = path.split('/').pop()!.replace(/\.ts$/, '');
    if (map.has(id)) {
      throw new Error(`Duas oficinas com o id "${id}". O nome do arquivo precisa ser único.`);
    }
    map.set(id, normalizeWorkshop(mod.default, id));
  }
  cache = map;
  return map;
}

export function getWorkshop(id: string): Workshop {
  const workshop = workshops().get(id);
  if (!workshop) {
    const known = [...workshops().keys()].join(', ') || 'nenhuma';
    throw new Error(
      `<Workshop id="${id}">: oficina não encontrada. Crie src/lessons/mNN/oficinas/${id}.ts ` +
        `com defineWorkshop(). Oficinas existentes: ${known}.`,
    );
  }
  return workshop;
}
