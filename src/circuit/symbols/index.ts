/**
 * Symbol registry. Each file in this folder registers one device type; add a
 * symbol by creating a file (files starting with "_" are helpers).
 */
import type { SymbolDef } from './_kit';
import { unknownSymbol } from './_unknown';

const modules = import.meta.glob<{ default: SymbolDef }>(['./*.tsx', '!./_*.tsx'], {
  eager: true,
});

const BY_TYPE = new Map<string, SymbolDef>();
for (const [path, mod] of Object.entries(modules)) {
  const def = mod.default;
  const file = path.replace(/^\.\//, '').replace(/\.tsx$/, '');
  if (def.type !== file) {
    throw new Error(
      `O símbolo em ${path} declara o tipo "${def.type}"; o arquivo deve se chamar ${def.type}.tsx`,
    );
  }
  BY_TYPE.set(def.type, def);
}

export function getSymbol(type: string): SymbolDef {
  return BY_TYPE.get(type) ?? unknownSymbol(type);
}

export function hasSymbol(type: string): boolean {
  return BY_TYPE.has(type);
}

export function listSymbols(): SymbolDef[] {
  return [...BY_TYPE.values()].sort((a, b) => a.type.localeCompare(b.type));
}

export type { SymbolCtx, SymbolDef } from './_kit';
