/**
 * 02.9: load power and efficiency of a source with internal resistance, as
 * fixed points for <Plot data={…}> (same source as m02/maxima-potencia).
 */

export interface CurveSeries {
  label: string;
  unit: string;
  points: [number, number][];
}

/** Power in the load (W) and efficiency (%) for loads from 0 to `maxLoad` ohms. */
export function loadPowerCurve(
  voltage: number,
  internal: number,
  maxLoad: number,
  step: number,
): CurveSeries[] {
  const power: [number, number][] = [];
  const efficiency: [number, number][] = [];
  for (let k = 0; k * step <= maxLoad + 1e-9; k++) {
    const load = k * step;
    const current = voltage / (internal + load);
    power.push([load, current * current * load]);
    efficiency.push([load, (100 * load) / (internal + load)]);
  }
  return [
    { label: 'Potência na carga', unit: 'W', points: power },
    { label: 'Eficiência', unit: '%', points: efficiency },
  ];
}

/** The curve of the lesson: 12 V with 4 Ω, loads from 0 to 40 Ω. */
export const LESSON_CURVE = loadPowerCurve(12, 4, 40, 0.5);
