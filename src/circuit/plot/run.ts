/**
 * Runs a circuit at build time for <Plot>: transient or DC up to `until`,
 * or the whole AC sweep (gain in dB against frequency).
 */
import type { CircuitDoc, SimFrame } from '../../engine/contract';
import { engineFor } from '../engine';
import { probeMeta, seriesMeta } from '../readouts';
import type { PlotSeriesInput } from './layout';

export interface PlotData {
  series: PlotSeriesInput[];
  xUnit: string;
  log: boolean;
  xMin?: number;
  xMax?: number;
}

const asNumber = (v: SimFrame['readouts'][string] | undefined) =>
  typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : Number.NaN;

export async function simulateForPlot(
  doc: CircuitDoc,
  until: number,
  keys: string[],
): Promise<PlotData> {
  const handle = engineFor(doc).createSimulation({ worker: false });
  try {
    await handle.load(doc);
    const sweep = doc.analysis.kind === 'ac-sweep';
    const frames = await handle.runUntil(sweep ? Number.POSITIVE_INFINITY : until, {
      maxFrames: 1200,
    });
    if (sweep) {
      const probes = (doc.probes ?? []).filter((p) => keys.includes(p.id));
      return {
        xUnit: 'Hz',
        log: true,
        series: probes.map((p) => ({
          label: `Ganho: ${probeMeta(p).label}`,
          unit: 'dB',
          points: frames.map((f): [number, number] => {
            const m = asNumber(f.readouts[p.id]);
            return [f.t, m > 0 ? 20 * Math.log10(m) : Number.NaN];
          }),
        })),
      };
    }
    // DC has a single operating point: draw it as a level over the whole range.
    const points =
      frames.length === 1
        ? [
            { ...frames[0]!, t: 0 },
            { ...frames[0]!, t: until },
          ]
        : frames;
    return {
      xUnit: 's',
      log: false,
      xMin: 0,
      xMax: until,
      series: keys.map((key) => {
        const meta = seriesMeta(key, doc);
        return {
          label: meta.label,
          unit: meta.unit,
          points: points.map((f): [number, number] => [
            f.t,
            asNumber(f.readouts[key]) * meta.scale,
          ]),
        };
      }),
    };
  } finally {
    handle.dispose();
  }
}
