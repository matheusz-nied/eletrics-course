/** Data of the internal gallery /dev/circuitos/ (not linked from the course). */
import type { CircuitDoc } from '../../engine/contract';
import { runsOnRealEngine } from '../engine';
import { listCircuitIds, loadCircuit } from '../registry';

export const ANALYSIS_LABELS: Record<CircuitDoc['analysis']['kind'], string> = {
  dc: 'Corrente contínua (ponto de operação)',
  transient: 'Transiente (no tempo)',
  'ac-sweep': 'Varredura de frequência (Bode)',
  'quasi-static': 'Quase-estático (60 Hz + mecânica)',
};

export interface GalleryEntry {
  id: string;
  doc: CircuitDoc;
  lesson: boolean;
  realEngine: boolean;
  parts: number;
}

export async function galleryEntries(): Promise<GalleryEntry[]> {
  return Promise.all(
    listCircuitIds().map(async (id) => {
      const doc = await loadCircuit(id);
      return {
        id,
        doc,
        lesson: !id.startsWith('demo/'),
        realEngine: runsOnRealEngine(doc),
        parts: doc.elements.filter((e) => e.type !== 'wire' && e.type !== 'ground').length,
      };
    }),
  );
}

/** How long the static chart of a circuit runs. */
export function plotUntil(doc: CircuitDoc): number | null {
  const a = doc.analysis;
  if (a.kind === 'transient') return a.tStop ?? a.dt * 2000;
  if (a.kind === 'ac-sweep') return 0;
  return null;
}
