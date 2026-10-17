/**
 * Bode plot of an AC sweep: gain in dB (solid) and phase in degrees (dashed)
 * against frequency on a log axis, with the −3 dB point marked.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type uPlot from 'uplot';
import type { SimFrame } from '../../engine/contract';
import { SERIES_COLORS } from '../colors';
import { formatNumber, formatSI } from '../format';
import { probeMeta } from '../readouts';
import { useSim, useSimState } from '../ui/context';
import { axisValues, useUPlot, type ChartColors } from './chart';

const HEIGHT = 260;

export interface BodeCurve {
  freq: number[];
  db: number[];
  phase: number[];
}

/** Gain (dB) and phase (°) of a probe along the sweep frames. */
export function bodeCurve(frames: SimFrame[], probe: string): BodeCurve {
  const freq: number[] = [];
  const db: number[] = [];
  const phase: number[] = [];
  for (const f of frames) {
    const mag = f.readouts[probe];
    const ph = f.readouts[`${probe}.phase`];
    freq.push(f.t);
    db.push(typeof mag === 'number' && mag > 0 ? 20 * Math.log10(mag) : Number.NaN);
    phase.push(typeof ph === 'number' ? ph : Number.NaN);
  }
  return { freq, db, phase };
}

/**
 * Frequency where the gain first falls 3 dB below its value at the start of
 * the sweep (low-pass) or rises to 3 dB below its final value (high-pass).
 */
export function cutoff(c: BodeCurve): number | null {
  const pts = c.db.map((d, i) => [c.freq[i]!, d] as const).filter(([, d]) => Number.isFinite(d));
  if (pts.length < 3) return null;
  const first = pts[0]![1];
  const last = pts[pts.length - 1]![1];
  const falling = first > last;
  const target = (falling ? first : last) - 3;
  for (let i = 1; i < pts.length; i++) {
    const [f0, d0] = pts[i - 1]!;
    const [f1, d1] = pts[i]!;
    const crosses = falling ? d0 >= target && d1 < target : d0 < target && d1 >= target;
    if (!crosses) continue;
    const k = (target - d0) / (d1 - d0);
    return 10 ** (Math.log10(f0) + k * (Math.log10(f1) - Math.log10(f0)));
  }
  return null;
}

export function Bode({ probes: ids }: { probes: string[] }) {
  const sim = useSim();
  const sweep = useSimState((s) => s.sweep);
  const probes = useMemo(
    () => (sim.doc.probes ?? []).filter((p) => p.kind === 'voltage' && ids.includes(p.id)),
    [sim, ids],
  );
  const curves = useMemo(
    () => (sweep ? probes.map((p) => bodeCurve(sweep, p.id)) : []),
    [sweep, probes],
  );
  const fc = curves[0] ? cutoff(curves[0]) : null;
  const fcRef = useRef<number | null>(null);

  const build = useCallback(
    (colors: ChartColors): Omit<uPlot.Options, 'width' | 'height'> => ({
      scales: {
        x: { time: false, distr: 3 },
        db: { auto: true },
        deg: { auto: false, range: [-180, 180] },
      },
      axes: [
        {
          stroke: colors.text,
          grid: { stroke: colors.grid, width: 1 },
          ticks: { stroke: colors.grid, width: 1 },
          values: axisValues('Hz', 2),
        },
        {
          scale: 'db',
          stroke: colors.text,
          grid: { stroke: colors.grid, width: 1 },
          ticks: { stroke: colors.grid, width: 1 },
          values: (_u: uPlot, splits: number[]) => splits.map((v) => `${formatNumber(v, 1)} dB`),
          size: 64,
        },
        {
          scale: 'deg',
          side: 1,
          stroke: colors.text,
          grid: { show: false },
          ticks: { stroke: colors.grid, width: 1 },
          splits: () => [-180, -135, -90, -45, 0, 45, 90, 135, 180],
          values: axisValues('°', 3),
          size: 52,
        },
      ],
      series: [
        {
          label: 'Frequência',
          value: (_u: uPlot, v: number) => (v == null ? '—' : formatSI(v, 'Hz')),
        },
        ...probes.flatMap((p, i) => {
          const color = SERIES_COLORS[i % SERIES_COLORS.length];
          const label = probeMeta(p).label;
          return [
            {
              label: `Ganho: ${label}`,
              scale: 'db',
              stroke: color,
              width: 2,
              points: { show: false },
              value: (_u: uPlot, v: number) => (v == null ? '—' : `${formatNumber(v, 1)} dB`),
            },
            {
              label: `Fase: ${label}`,
              scale: 'deg',
              stroke: color,
              width: 1.5,
              dash: [6, 4],
              points: { show: false },
              value: (_u: uPlot, v: number) => (v == null ? '—' : formatSI(v, '°')),
            },
          ];
        }),
      ],
      legend: { live: true },
      hooks: {
        draw: [
          (u: uPlot) => {
            const f = fcRef.current;
            if (f === null) return;
            const x = u.valToPos(f, 'x', true);
            const { top, height } = u.bbox;
            const ctx = u.ctx;
            ctx.save();
            ctx.strokeStyle = colors.text;
            ctx.setLineDash([3, 3]);
            ctx.lineWidth = devicePixelRatio || 1;
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, top + height);
            ctx.stroke();
            ctx.restore();
          },
        ],
      },
    }),
    [probes],
  );

  const { container, plot, ready } = useUPlot(build, HEIGHT);

  useEffect(() => {
    fcRef.current = fc;
    const u = plot.current;
    if (!u || curves.length === 0) return;
    const freq = curves[0]!.freq;
    u.setData([freq, ...curves.flatMap((c) => [c.db, c.phase])] as uPlot.AlignedData);
  }, [plot, ready, curves, fc]);

  if (probes.length === 0) {
    return (
      <p className="sim-empty">
        Marque um medidor de tensão no circuito para ver o gráfico de Bode.
      </p>
    );
  }

  return (
    <figure className="sim-chart-box">
      <div className="sim-chart-box__bar">
        <figcaption className="sim-chart-box__title">Resposta em frequência (Bode)</figcaption>
        {fc !== null && (
          <p className="sim-chart-box__note num">
            Frequência de corte (−3 dB): {formatSI(fc, 'Hz')}
          </p>
        )}
      </div>
      <div className="sim-chart" ref={container} aria-hidden="true" />
      <p className="sim-sr">
        {curves[0] && Number.isFinite(curves[0].db[0])
          ? `Ganho de ${formatNumber(curves[0].db[0]!, 1)} dB em ${formatSI(curves[0].freq[0]!, 'Hz')} e de ${formatNumber(curves[0].db.at(-1)!, 1)} dB em ${formatSI(curves[0].freq.at(-1)!, 'Hz')}.`
          : 'Calculando a resposta em frequência.'}
        {fc !== null && ` Frequência de corte: ${formatSI(fc, 'Hz')}.`}
      </p>
    </figure>
  );
}
