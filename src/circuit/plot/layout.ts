/**
 * Layout of the static chart drawn by <Plot> at build time: nice ticks with
 * pt-BR labels, one vertical axis per unit (up to two) and SVG paths in a
 * 1000 × 1000 box that the page stretches to any width.
 */
import { formatSI } from '../format';

export interface PlotSeriesInput {
  label: string;
  unit: string;
  points: [number, number][];
}

export interface Tick {
  value: number;
  label: string;
  /** Position 0…1000 along the axis (x from the left, y from the top). */
  pos: number;
}

export interface PlotAxis {
  unit: string;
  side: 'left' | 'right';
  min: number;
  max: number;
  ticks: Tick[];
}

export interface PlotLayout {
  x: { min: number; max: number; log: boolean; unit: string; ticks: Tick[] };
  axes: PlotAxis[];
  series: { label: string; unit: string; axis: number; path: string; color: number }[];
}

export const BOX = 1000;

function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  const m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return m * p;
}

/** Round limits and the ticks between them (about `count` intervals). */
export function niceScale(
  min: number,
  max: number,
  count = 5,
): { min: number; max: number; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, ticks: [0, 0.5, 1] };
  if (max - min < Math.max(Math.abs(min), Math.abs(max)) * 1e-6 + 1e-15) {
    const pad = Math.abs(max) > 1e-12 ? Math.abs(max) * 0.5 : 1;
    min -= pad;
    max += pad;
  }
  const step = niceStep((max - min) / count);
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step * 1e-6; v += step)
    ticks.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  return { min: lo, max: hi, ticks };
}

/** Ticks inside a fixed range (the time axis keeps exactly 0…until). */
function rangeTicks(min: number, max: number, count = 5): number[] {
  const step = niceStep((max - min) / count);
  const out: number[] = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-6; v += step) {
    out.push(Number(v.toPrecision(12)));
  }
  return out;
}

function logTicks(min: number, max: number): number[] {
  const out: number[] = [];
  for (let e = Math.ceil(Math.log10(min) - 1e-9); e <= Math.floor(Math.log10(max) + 1e-9); e++)
    out.push(10 ** e);
  return out;
}

/** Below this a reading is solver residue (pA, nV…), drawn as zero. */
const NOISE = 1e-9;
export const clean = (v: number) => (Math.abs(v) < NOISE ? 0 : v);

export function layoutPlot(
  input: PlotSeriesInput[],
  opts: { xUnit: string; log?: boolean; xMin?: number; xMax?: number },
): PlotLayout {
  const log = opts.log ?? false;
  const xs = input
    .flatMap((s) => s.points.map((p) => p[0]))
    .filter((x) => Number.isFinite(x) && (!log || x > 0));
  const xMin = opts.xMin ?? (xs.length ? Math.min(...xs) : 0);
  const xMax0 = opts.xMax ?? (xs.length ? Math.max(...xs) : 1);
  const xMax = xMax0 > xMin ? xMax0 : xMin + 1;
  const tx = log
    ? (x: number) =>
        ((Math.log10(x) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin))) * BOX
    : (x: number) => ((x - xMin) / (xMax - xMin)) * BOX;
  const xTicks = (log ? logTicks(xMin, xMax) : rangeTicks(xMin, xMax)).map((v) => ({
    value: v,
    label: formatSI(v, opts.xUnit, { digits: 3 }),
    pos: tx(v),
  }));

  const units = [...new Set(input.map((s) => s.unit))].slice(0, 2);
  const axes: PlotAxis[] = units.map((unit, i) => {
    const ys = input
      .filter((s) => s.unit === unit)
      .flatMap((s) => s.points.map((p) => clean(p[1])))
      .filter(Number.isFinite);
    const lo = ys.length ? Math.min(...ys) : 0;
    const hi = ys.length ? Math.max(...ys) : 1;
    // Include zero when the data sits close to it, so curves are not exaggerated.
    const withZero =
      lo > 0 && lo < (hi - lo) * 0.6 ? 0 : hi < 0 && -hi < (hi - lo) * 0.6 ? 0 : undefined;
    const scale = niceScale(
      withZero === undefined ? lo : Math.min(lo, 0),
      withZero === undefined ? hi : Math.max(hi, 0),
    );
    const ty = (v: number) => BOX - ((v - scale.min) / (scale.max - scale.min)) * BOX;
    return {
      unit,
      side: i === 0 ? 'left' : 'right',
      min: scale.min,
      max: scale.max,
      ticks: scale.ticks.map((v) => ({
        value: v,
        label: formatSI(v, unit, { digits: 3 }),
        pos: ty(v),
      })),
    };
  });

  const series = input.map((s, i) => {
    const axis = Math.max(0, units.indexOf(s.unit));
    const a = axes[axis]!;
    const ty = (v: number) => BOX - ((v - a.min) / (a.max - a.min)) * BOX;
    let path = '';
    let pen = false;
    for (const [x, y] of s.points) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || (log && x <= 0)) {
        pen = false;
        continue;
      }
      path += `${pen ? 'L' : 'M'}${tx(x).toFixed(1)} ${ty(clean(y)).toFixed(1)}`;
      pen = true;
    }
    return { label: s.label, unit: s.unit, axis, path, color: i };
  });

  return { x: { min: xMin, max: xMax, log, unit: opts.xUnit, ticks: xTicks }, axes, series };
}
