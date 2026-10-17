import type { CircuitDoc } from './contract';
import { CircuitError, validateCircuit } from './format/validate';

/**
 * Typed identity for circuit files (`src/lessons/mNN/<slug>.circuit.ts`).
 * In development and tests it validates the document and throws a pt-BR
 * list of problems; warnings (a pin that touches nothing) go to the console.
 * In production it does nothing: the engine validates again when it loads.
 */
export function defineCircuit<const T extends CircuitDoc>(doc: T): T {
  if (import.meta.env.DEV) {
    const { errors, warnings } = validateCircuit(doc);
    if (errors.length) throw new CircuitError(doc.id, errors);
    for (const w of warnings) console.warn(`Circuito "${doc.id}": ${w}`);
  }
  return doc;
}
