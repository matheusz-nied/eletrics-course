/**
 * Two-channel oscilloscope: dark screen with 10 × 8 divisions, time base,
 * volts per division, position, edge trigger (source, slope, level, auto or
 * normal), run/stop, automatic setup and the usual measurements.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type uPlot from 'uplot';
import { formatSI } from '../format';
import { seriesMeta } from '../readouts';
import { useSim, useSimState } from '../ui/context';
import { useUPlot, type ChartColors } from './chart';
import {
  AMPLITUDE_DIVS,
  H_DIVS,
  TIME_DIVS,
  V_DIVS,
  autoTime,
  autoVertical,
  defaultTimeDiv,
  findTrigger,
  measure,
  sourceFrequency,
  type ChannelSetup,
  type Measurement,
  type Slope,
} from './scope';

const TRACE = ['#f5c518', '#36c5e8'];
const HEIGHT = 240;

interface Channel {
  key: string;
  history: string;
  label: string;
  unit: string;
}

type TriggerState = 'triggered' | 'auto' | 'waiting' | 'stopped';

const STATE_TEXT: Record<TriggerState, string> = {
  triggered: 'Disparado',
  auto: 'Automático',
  waiting: 'Esperando disparo',
  stopped: 'Parado',
};

function Stepper({
  label,
  value,
  onDown,
  onUp,
  downLabel,
  upLabel,
}: {
  label: string;
  value: string;
  onDown: () => void;
  onUp: () => void;
  downLabel: string;
  upLabel: string;
}) {
  return (
    <div className="scope-step" role="group" aria-label={label}>
      <span className="scope-step__label">{label}</span>
      <button
        type="button"
        className="sim-btn sim-btn--small"
        onClick={onDown}
        aria-label={downLabel}
      >
        −
      </button>
      <output className="scope-step__value num">{value}</output>
      <button type="button" className="sim-btn sim-btn--small" onClick={onUp} aria-label={upLabel}>
        +
      </button>
    </div>
  );
}

export function Oscilloscope({ channels: keys }: { channels: string[] }) {
  const sim = useSim();
  const playing = useSimState((s) => s.playing);
  const channels: Channel[] = useMemo(
    () =>
      keys.slice(0, 2).map((key) => {
        const meta = seriesMeta(key, sim.doc);
        return { key, history: sim.channelOf(key), label: meta.label, unit: meta.unit };
      }),
    [keys, sim],
  );

  const [time, setTime] = useState(() => defaultTimeDiv(sim.doc));
  const [setup, setSetup] = useState<ChannelSetup[]>(() =>
    channels.map(() => ({ div: AMPLITUDE_DIVS.indexOf(1), offset: 0 })),
  );
  const [enabled, setEnabled] = useState<boolean[]>(() => channels.map(() => true));
  const [source, setSource] = useState(0);
  const [slope, setSlope] = useState<Slope>('rise');
  const [level, setLevel] = useState(0);
  const [normal, setNormal] = useState(false);
  const [running, setRunning] = useState(true);
  const [state, setState] = useState<TriggerState>('auto');
  const [measures, setMeasures] = useState<(Measurement | null)[]>(() => channels.map(() => null));
  const [autoDone, setAutoDone] = useState(false);

  const tdiv = TIME_DIVS[time]!;
  const width = tdiv * H_DIVS;

  const autoset = useCallback(() => {
    const h = sim.history;
    const end = h.lastT();
    if (!Number.isFinite(end)) return;
    const span = Math.min(end - h.firstT(), 1);
    const { t, values } = h.window(
      end - span,
      end,
      channels.map((c) => c.history),
      20000,
    );
    const ms = values.map((v) => measure(t, v));
    const src = ms[0] ?? null;
    // Too few cycles to measure: the source's own frequency is a good guess.
    const freq = src && Number.isFinite(src.freq) ? src.freq : sourceFrequency(sim.doc);
    setSetup(ms.map((m) => autoVertical(m)));
    setTime(autoTime(freq, span));
    setSource(0);
    setSlope('rise');
    setLevel(src && Number.isFinite(src.mean) ? src.mean : 0);
    setAutoDone(true);
  }, [sim, channels]);

  const build = useCallback(
    (_colors: ChartColors): Omit<uPlot.Options, 'width' | 'height'> => ({
      scales: {
        x: { time: false, range: [-H_DIVS / 2, H_DIVS / 2] },
        y: { range: [-V_DIVS / 2, V_DIVS / 2] },
      },
      legend: { show: false },
      cursor: { show: false },
      axes: [
        {
          show: true,
          size: 0,
          gap: 0,
          ticks: { show: false },
          grid: { stroke: 'rgba(255,255,255,0.13)', width: 1 },
          splits: () => [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5],
          values: () => [],
        },
        {
          show: true,
          size: 0,
          gap: 0,
          ticks: { show: false },
          grid: { stroke: 'rgba(255,255,255,0.13)', width: 1 },
          splits: () => [-4, -3, -2, -1, 0, 1, 2, 3, 4],
          values: () => [],
        },
      ],
      series: [
        {},
        ...channels.map((_c, i) => ({ stroke: TRACE[i], width: 2, points: { show: false } })),
      ],
      hooks: {
        draw: [
          (u: uPlot) => {
            // Minor ticks on the centre lines, like a real graticule.
            const ctx = u.ctx;
            const x0 = u.valToPos(0, 'x', true);
            const y0 = u.valToPos(0, 'y', true);
            const px = devicePixelRatio || 1;
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.32)';
            ctx.lineWidth = px;
            ctx.beginPath();
            for (let d = -H_DIVS / 2; d <= H_DIVS / 2; d += 0.2) {
              const x = u.valToPos(d, 'x', true);
              ctx.moveTo(x, y0 - 3 * px);
              ctx.lineTo(x, y0 + 3 * px);
            }
            for (let d = -V_DIVS / 2; d <= V_DIVS / 2; d += 0.2) {
              const y = u.valToPos(d, 'y', true);
              ctx.moveTo(x0 - 3 * px, y);
              ctx.lineTo(x0 + 3 * px, y);
            }
            ctx.stroke();
            ctx.restore();
          },
        ],
      },
    }),
    [channels],
  );

  const { container, plot, ready } = useUPlot(build, HEIGHT);

  // Autoajuste once, when there is something to look at.
  useEffect(() => {
    if (autoDone) return;
    const known = sourceFrequency(sim.doc);
    const check = () => {
      const h = sim.history;
      // With an AC source, wait for two of its cycles so the amplitudes are right.
      const enough = Number.isFinite(known) ? h.lastT() - h.firstT() >= 2 / known : true;
      if ((h.length >= 200 && enough) || (!sim.store.getState().playing && h.length > 2)) autoset();
    };
    check();
    return sim.onFrame(check);
  }, [autoDone, autoset, sim]);

  useEffect(() => {
    const u = plot.current;
    if (!u || !running) return;
    let raf = 0;
    let lastMeasure = 0;
    const draw = () => {
      raf = 0;
      const h = sim.history;
      const end = h.lastT();
      if (!Number.isFinite(end)) return;
      const src = channels[source];
      let t0: number;
      let origin: number;
      let next: TriggerState = 'auto';
      const tc = src
        ? findTrigger(h, src.history, level, slope, end - 3 * width, end - width / 2)
        : null;
      if (tc !== null) {
        t0 = tc - width / 2;
        origin = tc;
        next = 'triggered';
      } else if (!normal) {
        t0 = end - width;
        origin = end - width / 2;
      } else {
        setState('waiting');
        return;
      }
      const t1 = t0 + width;
      const { t, values } = h.window(
        t0,
        t1,
        channels.map((c) => c.history),
        1600,
      );
      const xs = t.map((x) => (x - origin) / tdiv);
      const ys = values.map((col, i) => {
        const s = setup[i]!;
        const size = AMPLITUDE_DIVS[s.div]!;
        return enabled[i] ? col.map((v) => v / size + s.offset) : col.map(() => Number.NaN);
      });
      u.setData([xs, ...ys] as uPlot.AlignedData);
      setState(next);
      const now = performance.now();
      if (now - lastMeasure > 300) {
        lastMeasure = now;
        const exact = h.window(
          t0,
          t1,
          channels.map((c) => c.history),
          20000,
        );
        setMeasures(exact.values.map((v, i) => (enabled[i] ? measure(exact.t, v) : null)));
      }
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
  }, [
    plot,
    ready,
    running,
    sim,
    channels,
    source,
    level,
    slope,
    normal,
    width,
    tdiv,
    setup,
    enabled,
  ]);

  const srcSetup = setup[source];
  const srcUnit = channels[source]?.unit ?? 'V';
  const levelStep = srcSetup ? AMPLITUDE_DIVS[srcSetup.div]! * 0.2 : 0.1;
  const levelY = srcSetup ? level / AMPLITUDE_DIVS[srcSetup.div]! + srcSetup.offset : 0;
  const shownState: TriggerState = running ? state : 'stopped';

  const summary = channels
    .map((c, i) => {
      const m = measures[i];
      if (!enabled[i] || !m || !Number.isFinite(m.pp))
        return `Canal ${i + 1} (${c.label}): sem sinal`;
      const f = Number.isFinite(m.freq) ? `, ${formatSI(m.freq, 'Hz')}` : '';
      return `Canal ${i + 1} (${c.label}): ${formatSI(m.pp, c.unit)} de pico a pico, ${formatSI(m.rms, c.unit)} eficaz, média ${formatSI(m.mean, c.unit)}${f}`;
    })
    .join('. ');

  if (channels.length === 0) {
    return (
      <p className="sim-empty">Este circuito não tem pontos de medição para o osciloscópio.</p>
    );
  }

  return (
    <figure className="scope" aria-label="Osciloscópio">
      <div className="scope__screen">
        <div className="scope__status" aria-hidden="true">
          {channels.map((c, i) => (
            <span key={c.key} className="scope__badge" style={{ color: TRACE[i] }}>
              CH{i + 1} {formatSI(AMPLITUDE_DIVS[setup[i]!.div]!, c.unit, { digits: 2 })}/div
            </span>
          ))}
          <span className="scope__badge">{formatSI(tdiv, 's', { digits: 2 })}/div</span>
          <span className={`scope__badge scope__badge--state is-${shownState}`}>
            {STATE_TEXT[shownState]}
          </span>
        </div>
        <div className="scope__plot" ref={container} aria-hidden="true">
          {channels.map((c, i) =>
            enabled[i] ? (
              <span
                key={c.key}
                className="scope__marker"
                style={{ color: TRACE[i], top: `${(0.5 - setup[i]!.offset / V_DIVS) * 100}%` }}
              >
                {i + 1}
              </span>
            ) : null,
          )}
          <span
            className="scope__trigger"
            style={{
              color: TRACE[source],
              top: `${Math.min(100, Math.max(0, (0.5 - levelY / V_DIVS) * 100))}%`,
            }}
          >
            T
          </span>
        </div>
      </div>
      <figcaption className="scope__legend">
        {channels.map((c, i) => {
          const m = measures[i];
          return (
            <p key={c.key} className="scope__measure">
              <span className="scope__chip" style={{ background: TRACE[i] }} aria-hidden="true" />
              <span className="scope__name">
                CH{i + 1}: {c.label}
              </span>
              {m && Number.isFinite(m.pp) && (
                <span className="num scope__values">
                  pico a pico {formatSI(m.pp, c.unit)} · eficaz {formatSI(m.rms, c.unit)} · média{' '}
                  {formatSI(m.mean, c.unit)}
                  {Number.isFinite(m.freq) && <> · {formatSI(m.freq, 'Hz')}</>}
                </span>
              )}
            </p>
          );
        })}
      </figcaption>
      <p className="sim-sr" aria-live="off">
        {summary}
      </p>
      <div className="scope__controls">
        <div className="scope__group">
          <button
            type="button"
            className="sim-btn"
            onClick={() => setRunning((r) => !r)}
            aria-pressed={!running}
          >
            {running ? 'Parar tela' : 'Continuar'}
          </button>
          <button
            type="button"
            className="sim-btn"
            onClick={autoset}
            disabled={!playing && sim.history.length < 2}
          >
            Autoajuste
          </button>
        </div>
        <Stepper
          label="Tempo por divisão"
          value={`${formatSI(tdiv, 's', { digits: 2 })}/div`}
          onDown={() => setTime((i) => Math.max(0, i - 1))}
          onUp={() => setTime((i) => Math.min(TIME_DIVS.length - 1, i + 1))}
          downLabel="Diminuir o tempo por divisão"
          upLabel="Aumentar o tempo por divisão"
        />
        {channels.map((c, i) => (
          <div
            key={c.key}
            className="scope__group scope__channel"
            style={{ ['--trace' as string]: TRACE[i] }}
          >
            <label className="sim-check">
              <input
                type="checkbox"
                checked={enabled[i]}
                onChange={(e) =>
                  setEnabled((en) => en.map((v, j) => (j === i ? e.target.checked : v)))
                }
              />
              <span>CH{i + 1}</span>
            </label>
            <Stepper
              label={`Escala do canal ${i + 1}`}
              value={`${formatSI(AMPLITUDE_DIVS[setup[i]!.div]!, c.unit, { digits: 2 })}/div`}
              onDown={() =>
                setSetup((s) =>
                  s.map((x, j) => (j === i ? { ...x, div: Math.max(0, x.div - 1) } : x)),
                )
              }
              onUp={() =>
                setSetup((s) =>
                  s.map((x, j) =>
                    j === i ? { ...x, div: Math.min(AMPLITUDE_DIVS.length - 1, x.div + 1) } : x,
                  ),
                )
              }
              downLabel={`Ampliar o canal ${i + 1} (menos por divisão)`}
              upLabel={`Reduzir o canal ${i + 1} (mais por divisão)`}
            />
            <Stepper
              label={`Posição do canal ${i + 1}`}
              value={`${setup[i]!.offset.toLocaleString('pt-BR')} div`}
              onDown={() =>
                setSetup((s) =>
                  s.map((x, j) => (j === i ? { ...x, offset: Math.max(-4, x.offset - 0.5) } : x)),
                )
              }
              onUp={() =>
                setSetup((s) =>
                  s.map((x, j) => (j === i ? { ...x, offset: Math.min(4, x.offset + 0.5) } : x)),
                )
              }
              downLabel={`Descer o canal ${i + 1}`}
              upLabel={`Subir o canal ${i + 1}`}
            />
          </div>
        ))}
        <div className="scope__group" role="group" aria-label="Disparo (trigger)">
          <span className="scope-step__label">Disparo</span>
          {channels.length > 1 && (
            <select
              className="sim-select"
              value={source}
              onChange={(e) => setSource(Number(e.target.value))}
              aria-label="Canal que dispara"
            >
              {channels.map((c, i) => (
                <option key={c.key} value={i}>
                  CH{i + 1}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="sim-btn sim-btn--small"
            onClick={() => setSlope((s) => (s === 'rise' ? 'fall' : 'rise'))}
            aria-label={
              slope === 'rise'
                ? 'Borda de subida (trocar para descida)'
                : 'Borda de descida (trocar para subida)'
            }
          >
            {slope === 'rise' ? '↑ subida' : '↓ descida'}
          </button>
          <Stepper
            label="Nível"
            value={formatSI(level, srcUnit, { digits: 3 })}
            onDown={() => setLevel((l) => l - levelStep)}
            onUp={() => setLevel((l) => l + levelStep)}
            downLabel="Baixar o nível de disparo"
            upLabel="Subir o nível de disparo"
          />
          <label className="sim-check">
            <input type="checkbox" checked={normal} onChange={(e) => setNormal(e.target.checked)} />
            <span>Só com disparo (normal)</span>
          </label>
        </div>
      </div>
    </figure>
  );
}
