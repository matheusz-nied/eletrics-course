/**
 * Quantities against simulated time: one line per series, one vertical axis
 * per unit (up to two), the whole run or a rolling window.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type uPlot from 'uplot';
import { SERIES_COLORS } from '../colors';
import { formatSI, formatTime } from '../format';
import { seriesMeta } from '../readouts';
import { useSim } from '../ui/context';
import { axisValues, useUPlot, type ChartColors } from './chart';

const HEIGHT = 220;
const WINDOWS = [1e-3, 1e-2, 0.1, 1, 10, 60];

interface Series {
  key: string;
  channel: string;
  label: string;
  unit: string;
  scale: number;
}

export function TimeChart({ series: keys }: { series: string[] }) {
  const sim = useSim();
  const series: Series[] = useMemo(
    () =>
      keys.map((key) => {
        const meta = seriesMeta(key, sim.doc);
        return { key, channel: sim.channelOf(key), ...meta };
      }),
    [keys, sim],
  );
  const units = useMemo(() => [...new Set(series.map((s) => s.unit))].slice(0, 2), [series]);
  const a = sim.doc.analysis;
  const tStop = a.kind === 'transient' ? a.tStop : undefined;
  const minWindow =
    a.kind === 'transient' ? a.dt * 20 : a.kind === 'quasi-static' ? a.dtMech * 20 : 0.01;
  const windows = WINDOWS.filter((w) => w >= minWindow && (tStop === undefined || w < tStop));
  // 0 = the whole run
  const [span, setSpan] = useState(0);
  // Time axis limits, set before each redraw (the axis can extend past the data).
  const xRange = useRef<[number, number]>([0, 1]);

  const build = useCallback(
    (colors: ChartColors): Omit<uPlot.Options, 'width' | 'height'> => {
      const axis = (unit: string, side: 1 | 3) => ({
        scale: unit,
        side,
        stroke: colors.text,
        grid: { stroke: colors.grid, width: 1, show: side === 3 },
        ticks: { stroke: colors.grid, width: 1 },
        values: axisValues(unit, 2),
        size: 64,
      });
      return {
        scales: {
          x: { time: false, range: () => xRange.current },
          ...Object.fromEntries(units.map((u) => [u, { auto: true }])),
        },
        axes: [
          {
            stroke: colors.text,
            grid: { stroke: colors.grid, width: 1 },
            ticks: { stroke: colors.grid, width: 1 },
            values: axisValues('s', 2),
          },
          ...units.map((u, i) => axis(u, i === 0 ? 3 : 1)),
        ],
        series: [
          { label: 'Tempo', value: (_u: uPlot, v: number) => (v == null ? '—' : formatTime(v)) },
          ...series.map((s, i) => ({
            label: s.unit ? `${s.label}` : s.label,
            scale: units.includes(s.unit) ? s.unit : units[0],
            stroke: SERIES_COLORS[i % SERIES_COLORS.length],
            width: 2,
            points: { show: false },
            value: (_u: uPlot, v: number) => (v == null ? '—' : formatSI(v, s.unit)),
          })),
        ],
        legend: { live: true },
        cursor: { drag: { x: false, y: false } },
      };
    },
    [series, units],
  );

  const { container, plot, ready } = useUPlot(build, HEIGHT);

  useEffect(() => {
    const u = plot.current;
    if (!u) return;
    let raf = 0;
    let last = 0;
    const draw = () => {
      raf = 0;
      const now = performance.now();
      // A chart people read: 30 updates per second are plenty.
      if (now - last < 33) {
        raf = requestAnimationFrame(draw);
        return;
      }
      last = now;
      const fine = sim.history;
      const end = Math.max(fine.lastT(), sim.trend.lastT());
      if (!Number.isFinite(end)) return;
      const t0 = span > 0 ? end - span : tStop !== undefined ? 0 : Number.NEGATIVE_INFINITY;
      // Fine history while it covers the window, otherwise one point per frame.
      const oldest = Math.max(t0, sim.trend.length > 0 ? sim.trend.firstT() : 0);
      const source = fine.length > 0 && fine.firstT() <= oldest ? fine : sim.trend;
      const from = Number.isFinite(t0) ? t0 : source.firstT();
      const { t, values } = source.window(
        from,
        end,
        series.map((s) => s.channel),
        1500,
      );
      const xMax = tStop !== undefined && span === 0 ? Math.max(tStop, end) : end;
      const xMin = span > 0 ? end - span : tStop !== undefined ? 0 : (t[0] ?? 0);
      xRange.current = [xMin, xMax > xMin ? xMax : xMin + 1e-6];
      u.setData([
        t,
        ...values.map((v, i) => v.map((x) => x * series[i]!.scale)),
      ] as uPlot.AlignedData);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    schedule();
    const off = sim.onFrame(schedule);
    return () => {
      off();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [plot, ready, sim, series, span, tStop]);

  if (series.length === 0) {
    return <p className="sim-empty">Este circuito não tem grandezas marcadas para o gráfico.</p>;
  }

  return (
    <figure className="sim-chart-box">
      <div className="sim-chart-box__bar">
        <figcaption className="sim-chart-box__title">Gráfico no tempo</figcaption>
        {windows.length > 0 && (
          <label className="sim-inline">
            <span>Janela</span>
            <select
              className="sim-select"
              value={span}
              onChange={(e) => setSpan(Number(e.target.value))}
            >
              <option value={0}>
                {tStop !== undefined ? 'Toda a simulação' : 'Desde o início'}
              </option>
              {windows.map((w) => (
                <option key={w} value={w}>
                  Últimos {formatTime(w)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="sim-chart" ref={container} aria-hidden="true" />
      <p className="sim-sr">
        Gráfico de {series.map((s) => s.label).join(', ')} em função do tempo. Os valores atuais
        estão na tabela de valores e nos medidores.
      </p>
    </figure>
  );
}
