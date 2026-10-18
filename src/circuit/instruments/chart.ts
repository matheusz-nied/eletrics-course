/**
 * uPlot, loaded on demand (only when an instrument with a chart is opened),
 * and a hook that keeps one chart sized to its container.
 */
import { useEffect, useRef, useState } from 'react';
import type uPlot from 'uplot';
// The stylesheet is small and static: Astro drops CSS imported from a lazy chunk of an island.
import 'uplot/dist/uPlot.min.css';
import { formatSI } from '../format';

type UPlotCtor = typeof uPlot;

let loading: Promise<UPlotCtor> | null = null;

/**
 * uPlot creates `Intl.NumberFormat(navigator.language)` when its module loads,
 * and Intl throws on tags such as "en-US@posix" (Chromium started without a
 * locale). Such a browser reads pt-BR while the module loads.
 */
async function importUPlot(): Promise<UPlotCtor> {
  let restore: (() => void) | null = null;
  try {
    new Intl.NumberFormat(navigator.language);
  } catch {
    const own = Object.getOwnPropertyDescriptor(navigator, 'language');
    Object.defineProperty(navigator, 'language', { value: 'pt-BR', configurable: true });
    restore = () =>
      own
        ? Object.defineProperty(navigator, 'language', own)
        : Reflect.deleteProperty(navigator, 'language');
  }
  try {
    return (await import('uplot')).default;
  } finally {
    restore?.();
  }
}

export function loadUPlot(): Promise<UPlotCtor> {
  loading ??= importUPlot();
  return loading;
}

/** Colours the canvas needs, read from the container's CSS (theme aware). */
export interface ChartColors {
  text: string;
  grid: string;
}

function readColors(el: HTMLElement): ChartColors {
  const cs = getComputedStyle(el);
  return { text: cs.color, grid: cs.borderTopColor };
}

export type ChartOptions = Omit<uPlot.Options, 'width' | 'height'>;

/**
 * Creates a uPlot chart in the returned container once uPlot is loaded, and
 * recreates it when `build` changes (memoize it). `plot.current` is the chart;
 * `ready` changes each time a new chart exists, so data effects can re-run.
 */
export function useUPlot(build: (colors: ChartColors) => ChartOptions, height: number) {
  const container = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const [ready, setReady] = useState(0);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let disposed = false;
    let chart: uPlot | null = null;
    let observer: ResizeObserver | null = null;
    void loadUPlot().then((UPlot) => {
      if (disposed) return;
      const opts = build(readColors(el));
      const empty = opts.series.map(() => [] as number[]) as uPlot.AlignedData;
      chart = new UPlot({ ...opts, width: Math.max(el.clientWidth, 120), height }, empty, el);
      plot.current = chart;
      observer = new ResizeObserver(() => {
        if (chart && el.clientWidth > 0) chart.setSize({ width: el.clientWidth, height });
      });
      observer.observe(el);
      setReady((n) => n + 1);
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      chart?.destroy();
      if (plot.current === chart) plot.current = null;
    };
  }, [build, height]);

  return { container, plot, ready };
}

/** Axis tick labels in pt-BR with SI prefixes: "2,5 ms", "−10 V". */
export function axisValues(unit: string, digits = 3) {
  return (_u: uPlot, splits: number[]) =>
    splits.map((v) => (v == null ? '' : formatSI(Math.abs(v) < 1e-15 ? 0 : v, unit, { digits })));
}

/** 1-2-5 sequence between two powers of ten: 1e-6, 2e-6, 5e-6, 1e-5… */
export function sequence125(from: number, to: number): number[] {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(from)); e <= Math.ceil(Math.log10(to)); e++) {
    for (const m of [1, 2, 5]) {
      const v = Number((m * 10 ** e).toPrecision(3));
      if (v >= from * 0.999 && v <= to * 1.001) out.push(v);
    }
  }
  return out;
}

/** Index of the smallest step ≥ value (the last one if none). */
export function stepAtLeast(steps: number[], value: number): number {
  const i = steps.findIndex((s) => s >= value * 0.999);
  return i < 0 ? steps.length - 1 : i;
}
