/*
 * Lesson 7.7 (lighting): a presence sensor (PIR) on the ceiling of a
 * hallway with a lamp. A person walks through, or comes in and stands
 * still; the TIME and LUX knobs and the light of the day decide what the
 * lamp does. The rules are in ./sensor-presenca.ts (unit-tested); this file
 * only runs the clock and draws.
 */
import { useEffect, useId, useState } from 'react';
import { formatNumber } from '../m00/formato';
import {
  AMBIENTS,
  isOn,
  LUX_LIMITS,
  OFF,
  onMotion,
  remaining,
  tick,
  TIMES,
  WALK_S,
  type Lamp,
  type MotionOutcome,
} from './sensor-presenca';
import '../m00/widget.css';
import './sensor-presenca.css';

/** Real milliseconds between clock ticks, and the longest simulated sub-step (s). */
const TICK_MS = 100;
const SUB_STEP = 0.1;
/** Timeline window (simulated s). */
const WINDOW = 120;
const SPEEDS = [1, 5, 20];

/* Scene (viewBox 0 0 360 176). */
const CEIL = 26;
const FLOOR = 158;
const SENSOR_X = 200;
const LAMP_X = 112;
const X_IN = 40;
const X_OUT = 336;
const X_STOP = SENSOR_X;

type Mode = 'fora' | 'andando' | 'parado';

interface Walk {
  from: number;
  to: number;
  start: number;
  duration: number;
  /** Mode when the walk ends. */
  then: 'fora' | 'parado';
}

interface State {
  t: number;
  mode: Mode;
  x: number;
  walk: Walk | null;
  lamp: Lamp;
  /** Last movement outcome, to explain what happened. */
  outcome: MotionOutcome | null;
  /** Light on intervals for the timeline (end null = still on). */
  segments: [number, number | null][];
  /** Moments with movement seen by the sensor (thinned out). */
  motions: number[];
  /** A wave of the hand is under way until this time. */
  wavingUntil: number;
}

const INITIAL: State = {
  t: 0,
  mode: 'fora',
  x: X_IN,
  walk: null,
  lamp: OFF,
  outcome: null,
  segments: [],
  motions: [],
  wavingUntil: -1,
};

interface Inputs {
  time: number;
  luxLimit: number;
  ambientLux: number;
}

/** The sensor sees movement at the current time of `s`. */
function sense(s: State, inputs: Inputs): State {
  const wasOn = isOn(s.lamp, s.t);
  const { lamp, outcome } = onMotion(s.lamp, s.t, inputs.ambientLux, {
    time: inputs.time,
    luxLimit: inputs.luxLimit,
  });
  let segments = s.segments;
  if (!wasOn && lamp.on) segments = [...segments, [s.t, null]];
  const last = s.motions[s.motions.length - 1];
  const motions = last === undefined || s.t - last >= 0.5 ? [...s.motions, s.t] : s.motions;
  // A walk is one movement: it keeps the message of how it started.
  const sameMovement = last !== undefined && s.t - last <= 1;
  const shown = outcome === 'renovou' && sameMovement && s.outcome ? s.outcome : outcome;
  return { ...s, lamp, outcome: shown, segments, motions };
}

/** Advances the simulated clock by dt seconds. */
function advance(state: State, dt: number, inputs: Inputs): State {
  let s = state;
  let left = dt;
  while (left > 1e-9) {
    const h = Math.min(SUB_STEP, left);
    left -= h;
    s = { ...s, t: s.t + h };
    const walk = s.walk;
    if (walk) {
      const k = Math.min(1, (s.t - walk.start) / walk.duration);
      s = sense({ ...s, x: walk.from + (walk.to - walk.from) * k }, inputs);
      if (k >= 1) s = { ...s, mode: walk.then, walk: null };
    }
    const lamp = tick(s.lamp, s.t);
    if (lamp !== s.lamp) {
      const segments = s.segments.map((seg): [number, number | null] =>
        seg[1] === null ? [seg[0], s.lamp.offAt] : seg,
      );
      s = { ...s, lamp, segments, outcome: null };
    }
  }
  const from = s.t - WINDOW;
  return {
    ...s,
    segments: s.segments.filter((seg) => seg[1] === null || seg[1] > from),
    motions: s.motions.filter((m) => m > from),
  };
}

const seconds = (v: number) =>
  v >= 60 && v % 60 === 0 ? `${v / 60} min` : `${formatNumber(v, 0)} s`;

function clock(t: number): string {
  const m = Math.floor(t / 60);
  const sec = Math.floor(t % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const OUTCOME_TEXT: Record<MotionOutcome, string> = {
  acendeu: 'O sensor viu movimento no escuro e acendeu a luz.',
  renovou: 'Movimento de novo: o sensor recomeçou a contagem do tempo.',
  'claro-demais':
    'O sensor viu movimento, mas o ambiente está mais claro que o ajuste LUX: a luz não acende.',
};

export default function SensorPresenca() {
  const id = useId();
  const [time, setTime] = useState(30);
  const [luxId, setLuxId] = useState('meio');
  const [ambientId, setAmbientId] = useState('noite');
  const [speed, setSpeed] = useState(5);
  const [state, setState] = useState<State>(INITIAL);

  const luxLimit = LUX_LIMITS.find((l) => l.id === luxId)!.limit;
  const ambient = AMBIENTS.find((a) => a.id === ambientId)!;
  const ambientLux = ambient.lux;
  const inputs: Inputs = { time, luxLimit, ambientLux };

  useEffect(() => {
    const now: Inputs = { time, luxLimit, ambientLux };
    const timer = window.setInterval(() => {
      setState((s) => advance(s, (TICK_MS / 1000) * speed, now));
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [speed, time, luxLimit, ambientLux]);

  const on = isOn(state.lamp, state.t);
  const left = remaining(state.lamp, state.t);

  function walk(from: number, to: number, duration: number, then: Walk['then']) {
    setState((s) =>
      sense(
        { ...s, mode: 'andando', x: from, walk: { from, to, start: s.t, duration, then } },
        inputs,
      ),
    );
  }

  function wave() {
    setState((s) => ({ ...sense(s, inputs), wavingUntil: s.t + 1.5 }));
  }

  const busy = state.mode === 'andando';
  const waving = state.t < state.wavingUntil;
  const night = ambient.lux < 10;
  const dusk = !night && ambient.lux < 100;

  const summary = `Corredor ${
    night ? 'à noite' : dusk ? 'no fim de tarde' : 'de dia'
  }, ${ambient.lux} lx. ${
    state.mode === 'fora'
      ? 'Ninguém no corredor.'
      : state.mode === 'parado'
        ? 'Uma pessoa parada embaixo do sensor.'
        : 'Uma pessoa andando pelo corredor.'
  } Luz ${on ? `acesa, apaga em ${formatNumber(left, 0)} s se nada se mexer` : 'apagada'}.`;

  // Timeline (viewBox 0 0 360 70).
  const tx = (t: number) => 10 + ((t - (state.t - WINDOW)) / WINDOW) * 340;

  return (
    <section
      className="lw sensor-presenca"
      aria-labelledby={`${id}-titulo`}
      data-lamp={on ? 'on' : 'off'}
    >
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          O sensor de presença no corredor
        </h3>
        <p className="lw__lead">
          Faça alguém atravessar o corredor, ou entrar e ficar parado. Depois mude o tempo (TIME), o
          ajuste de luz (LUX) e a hora do dia.
        </p>
      </header>

      <div className="lw__body">
        <svg
          className="sensor-presenca__scene"
          viewBox="0 0 360 176"
          role="img"
          aria-label={summary}
        >
          <rect
            x={0}
            y={CEIL}
            width={360}
            height={FLOOR - CEIL}
            className={`sensor-presenca__room${night ? ' is-night' : dusk ? ' is-dusk' : ''}`}
          />
          {on && (
            <polygon
              points={`${LAMP_X - 6},${CEIL + 12} ${LAMP_X + 6},${CEIL + 12} ${LAMP_X + 90},${FLOOR} ${LAMP_X - 90},${FLOOR}`}
              className="sensor-presenca__beam"
            />
          )}
          {/* Field of view of the PIR. */}
          <path
            d={`M${SENSOR_X} ${CEIL + 8} L${X_IN - 8} ${FLOOR} M${SENSOR_X} ${CEIL + 8} L${X_OUT + 8} ${FLOOR}`}
            className="sensor-presenca__fov"
          />
          {/* Window with the sky. */}
          <rect x={290} y={46} width={50} height={44} rx={3} className="sensor-presenca__window" />
          {night ? (
            <path d="M322 58a9 9 0 1 0 6 15a7 7 0 1 1 -6 -15z" className="sensor-presenca__moon" />
          ) : (
            <circle cx={315} cy={68} r={dusk ? 6 : 9} className="sensor-presenca__sun" />
          )}
          <line x1={0} x2={360} y1={CEIL} y2={CEIL} className="sensor-presenca__line" />
          <line x1={0} x2={360} y1={FLOOR} y2={FLOOR} className="sensor-presenca__line" />

          {/* Lamp. */}
          <line x1={LAMP_X} x2={LAMP_X} y1={CEIL} y2={CEIL + 4} className="sensor-presenca__line" />
          <circle
            cx={LAMP_X}
            cy={CEIL + 12}
            r={8}
            className={on ? 'sensor-presenca__bulb is-on' : 'sensor-presenca__bulb'}
          />
          <text x={LAMP_X} y={CEIL - 8} className="sensor-presenca__label">
            lâmpada
          </text>

          {/* Sensor dome. */}
          <path
            d={`M${SENSOR_X - 9} ${CEIL} a9 9 0 0 0 18 0z`}
            className="sensor-presenca__sensor"
          />
          <text x={SENSOR_X} y={CEIL - 8} className="sensor-presenca__label">
            sensor
          </text>

          {state.mode !== 'fora' && (
            <g
              className="sensor-presenca__person"
              transform={`translate(${state.x.toFixed(1)} ${FLOOR})`}
            >
              <circle cx={0} cy={-62} r={8} />
              <path d="M0 -53 V-24" />
              <path d={busy ? 'M0 -24 L-9 0 M0 -24 L9 0' : 'M0 -24 L-4 0 M0 -24 L4 0'} />
              <path
                d={
                  waving
                    ? 'M0 -46 L-11 -32 M0 -46 L12 -62'
                    : busy
                      ? 'M0 -46 L-10 -30 M0 -46 L10 -30'
                      : 'M0 -46 L-6 -28 M0 -46 L6 -28'
                }
              />
            </g>
          )}
        </svg>

        <div className="lw__controls lw__controls--cols">
          <label className="lw__field">
            <span>TIME (tempo aceso)</span>
            <select value={time} onChange={(e) => setTime(Number(e.target.value))}>
              {TIMES.map((v) => (
                <option key={v} value={v}>
                  {seconds(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="lw__field">
            <span>LUX (só acende abaixo de)</span>
            <select
              value={luxId}
              onChange={(e) => {
                setLuxId(e.target.value);
                setState((st) => ({ ...st, outcome: null }));
              }}
            >
              {LUX_LIMITS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="lw__field">
            <span>Luz do ambiente</span>
            <select
              value={ambientId}
              onChange={(e) => {
                setAmbientId(e.target.value);
                setState((st) => ({ ...st, outcome: null }));
              }}
            >
              {AMBIENTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="lw__field">
            <span>Velocidade do relógio</span>
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
              {SPEEDS.map((v) => (
                <option key={v} value={v}>
                  {v === 1 ? 'Tempo real' : `${v} vezes mais rápido`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="sensor-presenca__actions">
          {state.mode === 'parado' ? (
            <>
              <button type="button" className="lw__btn lw__btn--primary" onClick={wave}>
                Acenar com a mão
              </button>
              <button
                type="button"
                className="lw__btn"
                onClick={() => walk(state.x, X_OUT, WALK_S / 2, 'fora')}
              >
                Sair do corredor
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="lw__btn lw__btn--primary"
                disabled={busy}
                onClick={() => walk(X_IN, X_OUT, WALK_S, 'fora')}
              >
                Atravessar o corredor
              </button>
              <button
                type="button"
                className="lw__btn"
                disabled={busy}
                onClick={() => walk(X_IN, X_STOP, WALK_S / 2, 'parado')}
              >
                Entrar e ficar parado
              </button>
            </>
          )}
        </div>

        <div className="lw__output">
          <div className="sensor-presenca__readout">
            <div>
              <p className="lw__value-label">Relógio</p>
              <p className="lw__value num">{clock(state.t)}</p>
            </div>
            <div>
              <p className="lw__value-label">Apaga em</p>
              <p className="lw__value num" data-remaining>
                {on ? `${formatNumber(Math.ceil(left), 0)} s` : '–'}
              </p>
            </div>
          </div>
          <p className={`lw__status ${on ? 'lw__status--ok' : ''}`} aria-live="polite" data-status>
            <span className="lw__status-dot" aria-hidden="true" />
            <span>
              <strong>{on ? 'Luz acesa.' : 'Luz apagada.'}</strong>{' '}
              {state.outcome && (on || state.outcome === 'claro-demais')
                ? OUTCOME_TEXT[state.outcome]
                : ''}
            </span>
          </p>
          {state.mode === 'parado' && on && (
            <p className="lw__note">
              A pessoa está parada: o sensor não vê movimento, e a contagem continua.
            </p>
          )}
        </div>

        <figure className="sensor-presenca__timeline">
          <svg
            viewBox="0 0 360 74"
            role="img"
            aria-label="Linha do tempo dos últimos dois minutos: as barras mostram quando a luz ficou acesa e os traços, quando o sensor viu movimento."
          >
            <text x={10} y={14} className="sensor-presenca__tick sensor-presenca__tick--start">
              luz
            </text>
            <line x1={10} x2={350} y1={30} y2={30} className="sensor-presenca__axis" />
            {state.segments.map(([a, b]) => {
              const x1 = Math.max(10, tx(a));
              const x2 = tx(b ?? state.t);
              return (
                <rect
                  key={a}
                  x={x1}
                  y={20}
                  width={Math.max(0, x2 - x1)}
                  height={20}
                  rx={3}
                  className="sensor-presenca__on"
                />
              );
            })}
            <text x={10} y={54} className="sensor-presenca__tick sensor-presenca__tick--start">
              movimento
            </text>
            {state.motions.map((m) => (
              <line
                key={m}
                x1={tx(m)}
                x2={tx(m)}
                y1={58}
                y2={68}
                className="sensor-presenca__motion"
              />
            ))}
            <text x={350} y={14} className="sensor-presenca__tick sensor-presenca__tick--end">
              agora
            </text>
          </svg>
          <figcaption className="lw__note">
            Os últimos 2 minutos. Repare onde termina cada barra: o tempo conta a partir do último
            movimento.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
