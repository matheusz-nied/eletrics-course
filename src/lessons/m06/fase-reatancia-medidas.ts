/**
 * Test helper for the circuits of lessons 6.3 and 6.4: runs a circuit until
 * it settles and measures each probe the way the lesson reads it. The RMS is
 * AC coupled over the last 100 ms, like the simulation's multimeter in V~ and
 * A~; the phase is that of the component at the source frequency, relative to
 * the probe `ref` (positive = leading).
 */
import type { CircuitDoc, ParamValue } from '../../engine/contract';
import { Simulator } from '../../engine/analysis/simulator';

export interface AcReading {
  rms: number;
  /** Degrees relative to the reference probe, in (−180°, 180°]. */
  phase: number;
}

export function measureAc(
  doc: CircuitDoc,
  probes: string[],
  {
    settings = {},
    frequency = 60,
    ref = 'VE',
    settle = 0.5,
    window = 0.1,
  }: {
    settings?: Record<string, ParamValue>;
    frequency?: number;
    ref?: string;
    settle?: number;
    window?: number;
  } = {},
): Record<string, AcReading> {
  const sim = new Simulator(doc);
  for (const [key, value] of Object.entries(settings)) {
    const dot = key.indexOf('.');
    sim.setParam(key.slice(0, dot), key.slice(dot + 1), value);
  }
  sim.refresh();
  while (sim.t < settle) sim.step();
  const keys = [...new Set([ref, ...probes])];
  const t: number[] = [];
  const samples: Record<string, number[]> = Object.fromEntries(keys.map((k) => [k, []]));
  const end = sim.t + window;
  while (sim.t < end) {
    sim.step();
    t.push(sim.t);
    const r = sim.frame({ samples: false }).readouts;
    for (const k of keys) samples[k]!.push(Number(r[k]));
  }
  const omega = 2 * Math.PI * frequency;
  const angle = (values: number[]) => {
    let re = 0;
    let im = 0;
    values.forEach((v, i) => {
      re += v * Math.cos(omega * t[i]!);
      im -= v * Math.sin(omega * t[i]!);
    });
    return Math.atan2(im, re);
  };
  const refAngle = angle(samples[ref]!);
  const out: Record<string, AcReading> = {};
  for (const k of keys) {
    const values = samples[k]!;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const rms = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    let phase = ((angle(values) - refAngle) * 180) / Math.PI;
    while (phase <= -180) phase += 360;
    while (phase > 180) phase -= 360;
    out[k] = { rms, phase };
  }
  return out;
}
