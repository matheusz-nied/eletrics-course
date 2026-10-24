import type { CircuitDoc, ParamValue } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';

/**
 * What the multimeter of a lesson 6.7 simulation shows in V~ and A~: the
 * true RMS of the last 100 ms of each probe (AC coupled, like the
 * simulation's multimeter), after the circuit settles, plus the final
 * readouts. For tests only.
 */
export function measureRms(
  doc: CircuitDoc,
  settings: Record<string, ParamValue> = {},
  settle = 1,
): { rms: Record<string, number>; readouts: Record<string, number | boolean | string> } {
  const sim = new Simulator(doc);
  for (const [key, value] of Object.entries(settings)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  while (sim.t < settle) sim.step();
  const ids = (doc.probes ?? []).map((p) => p.id);
  const samples: Record<string, number[]> = Object.fromEntries(ids.map((id) => [id, []]));
  const end = sim.t + 0.1;
  while (sim.t < end) {
    sim.step();
    const r = sim.frame({ samples: false }).readouts;
    for (const id of ids) samples[id]!.push(Number(r[id]));
  }
  const rms = Object.fromEntries(
    ids.map((id) => {
      const a = samples[id]!;
      const mean = a.reduce((s, v) => s + v, 0) / a.length;
      return [id, Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / a.length)];
    }),
  );
  return { rms, readouts: sim.frame({ samples: false }).readouts };
}
