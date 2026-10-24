/*
 * Lesson 6.1 (from DC to AC): a loop turning between two magnet poles, wired
 * through slip rings to an oscilloscope. The scope draws the voltage in step
 * with the loop, in slow motion (100×), and waits for the loop to pass the
 * start position before each new sweep, like a triggered scope. A slider sets
 * the speed (turns per second = hertz); another turns the loop by hand while
 * it is stopped. Physics in gerador.ts.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { formatNumber, formatSI } from '../m00/formato';
import {
  SCOPE_DIV,
  SCOPE_VDIV,
  SCOPE_WINDOW,
  SLOW_MOTION,
  SPEED,
  cyclesOnScreen,
  peak,
  period,
  rpm,
  trace,
  voltage,
  voltageAtAngle,
} from './gerador';
import '../m00/widget.css';
import './gerador-osciloscopio.css';

/* Generator drawing (viewBox 0 0 360 230). */
const CX = 180;
const CY = 92;
const LOOP = 46;

/* Scope (viewBox 0 0 360 210): 10 × 8 divisions. */
const SX0 = 30;
const SX1 = 350;
const SY0 = 18;
const SY1 = 178;
const DIV_X = (SX1 - SX0) / 10;
const DIV_Y = (SY1 - SY0) / 8;
const tx = (t: number) => SX0 + (t / SCOPE_WINDOW) * (SX1 - SX0);
const vy = (v: number) => (SY0 + SY1) / 2 - (v / SCOPE_VDIV) * DIV_Y;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

const fmtV = (v: number) => formatSI(v, 'V');
const fmtHz = (f: number) => `${formatNumber(f, 0)} Hz`;

function tracePath(f: number, until: number): string {
  return trace(f, until)
    .map((p, i) => `${i ? 'L' : 'M'}${tx(p.t).toFixed(1)} ${vy(p.v).toFixed(1)}`)
    .join('');
}

interface Anim {
  /** Total angle turned (degrees, not wrapped). */
  turned: number;
  /** Time since the current sweep started (s), or null while waiting for the trigger. */
  sweep: number | null;
  last: number | undefined;
}

export default function GeradorOsciloscopio() {
  const id = useId();
  const [f, setF] = useState(SPEED.initial);
  const [running, setRunning] = useState(false);
  /** Angle of the loop (degrees). Starts lying along the field: peak voltage. */
  const [theta, setTheta] = useState(90);
  /** How much of the trace is drawn (s); the whole window when stopped. */
  const [drawn, setDrawn] = useState(SCOPE_WINDOW);
  const [reduced, setReduced] = useState(false);
  /** Running and waiting for the trigger (the last sweep stays on the screen). */
  const [waiting, setWaiting] = useState(false);
  const raf = useRef(0);
  const anim = useRef<Anim>({ turned: 90, sweep: null, last: undefined });
  const freq = useRef(f);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const stop = () => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    setRunning(false);
    setWaiting(false);
    setDrawn(SCOPE_WINDOW);
  };

  const start = () => {
    if (prefersReducedMotion()) {
      setReduced(true);
      return;
    }
    const a = anim.current;
    a.turned = theta;
    a.sweep = null;
    a.last = undefined;
    setRunning(true);
    setWaiting(true);
    setDrawn(0);
    const tick = (time: number) => {
      const fNow = freq.current;
      const dt = a.last === undefined ? 0 : Math.min(0.1, (time - a.last) / 1000) / SLOW_MOTION;
      a.last = time;
      const before = a.turned;
      a.turned += 360 * fNow * dt;
      if (a.sweep === null) {
        // Waiting for the trigger: the loop passing 0° (rising voltage).
        if (Math.floor(a.turned / 360) > Math.floor(before / 360)) {
          a.sweep = (a.turned % 360) / 360 / fNow;
          setWaiting(false);
          setDrawn(a.sweep);
        }
      } else {
        a.sweep += dt;
        if (a.sweep >= SCOPE_WINDOW) {
          a.sweep = null;
          setWaiting(true);
          setDrawn(SCOPE_WINDOW);
        } else {
          setDrawn(a.sweep);
        }
      }
      setTheta(a.turned % 360);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const changeSpeed = (value: number) => {
    freq.current = value;
    setF(value);
    if (running) {
      // A new sweep starts at the next trigger, at the new speed.
      anim.current.sweep = null;
      setWaiting(true);
      setDrawn(0);
    }
  };

  const turnByHand = (deg: number) => {
    if (running) stop();
    setTheta(deg);
  };

  const sweeping = running && !waiting;
  const vNow = voltageAtAngle(f, theta);
  // Stopped: the marker sits on the first cycle at the loop's angle.
  const tMarker = running ? drawn : theta / 360 / f;
  const showMarker = running ? sweeping : true;
  const path = tracePath(f, running ? drawn : SCOPE_WINDOW);

  const rad = (theta * Math.PI) / 180;
  const ax = CX + LOOP * Math.sin(rad);
  const ay = CY - LOOP * Math.cos(rad);
  const bx = CX - LOOP * Math.sin(rad);
  const by = CY + LOOP * Math.cos(rad);
  // Current direction in the conductors: A out of the page (•) when v > 0.
  const sign = Math.abs(vNow) < peak(f) * 0.02 ? 0 : Math.sign(vNow);

  const cycles = cyclesOnScreen(f);
  const sceneLabel = `Gerador com a espira a ${formatNumber(theta, 0)} graus, girando ${formatNumber(f, 0)} voltas por segundo. Tensão agora: ${fmtV(vNow)}.`;
  const scopeLabel = `Osciloscópio, 5 V por divisão e 5 ms por divisão: ${formatNumber(cycles, 1)} ciclos de uma senoide com pico de ${fmtV(peak(f))} e período de ${formatSI(period(f), 's')}.`;

  return (
    <section className="lw gerador" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Um gerador ligado ao osciloscópio
        </h3>
        <p className="lw__lead">
          Aperte Girar e acompanhe, em câmera lenta, a espira e a tensão que ela produz. Depois mude
          a velocidade do gerador, ou pare e gire a espira à mão.
        </p>
      </header>

      <div className="lw__body gerador__body">
        <div className="gerador__views">
          <svg className="gerador__scene" viewBox="0 0 360 230" role="img" aria-label={sceneLabel}>
            <path d="M20 50h40a42 42 0 0 1 0 84h-40z" className="gerador__pole gerador__pole--n" />
            <path d="M340 50h-40a42 42 0 0 0 0 84h40z" className="gerador__pole gerador__pole--s" />
            <text x={40} y={97} className="gerador__pole-text">
              N
            </text>
            <text x={320} y={97} className="gerador__pole-text">
              S
            </text>
            {[-30, -15, 0, 15, 30].map((dy) => (
              <path key={dy} d={`M106 ${CY + dy}H254`} className="gerador__field" />
            ))}
            <circle cx={CX} cy={CY} r={LOOP + 8} className="gerador__orbit" />
            <path
              d={`M${CX + LOOP + 14} ${CY - 22}A${LOOP + 14} ${LOOP + 14} 0 0 1 ${CX + LOOP + 6} ${CY + 30}`}
              className="gerador__spin"
              markerEnd={`url(#${id}-arrow)`}
            />
            <defs>
              <marker
                id={`${id}-arrow`}
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0 0L10 5L0 10z" className="gerador__arrowhead" />
              </marker>
            </defs>
            <line x1={ax} y1={ay} x2={bx} y2={by} className="gerador__loop" />
            <circle cx={CX} cy={CY} r={4} className="gerador__axle" />
            <g className="gerador__cond">
              <circle cx={ax} cy={ay} r={9} />
              {sign > 0 && <circle cx={ax} cy={ay} r={2.5} className="gerador__dot" />}
              {sign < 0 && (
                <path
                  d={`M${ax - 5} ${ay - 5}L${ax + 5} ${ay + 5}M${ax + 5} ${ay - 5}L${ax - 5} ${ay + 5}`}
                />
              )}
            </g>
            <g className="gerador__cond">
              <circle cx={bx} cy={by} r={9} />
              {sign < 0 && <circle cx={bx} cy={by} r={2.5} className="gerador__dot" />}
              {sign > 0 && (
                <path
                  d={`M${bx - 5} ${by - 5}L${bx + 5} ${by + 5}M${bx + 5} ${by - 5}L${bx - 5} ${by + 5}`}
                />
              )}
            </g>
            <text x={ax + (ax >= CX ? 14 : -14)} y={ay + 4} className="gerador__cond-label">
              A
            </text>
            <text x={CX} y={176} className="gerador__caption">
              espira vista de topo · ângulo {formatNumber(theta, 0)}°
            </text>
            <text x={CX} y={196} className="gerador__caption">
              • corrente saindo da tela · × corrente entrando
            </text>
            <text x={CX} y={216} className="gerador__caption gerador__caption--muted">
              anéis coletores e escovas levam a tensão ao osciloscópio
            </text>
          </svg>

          <svg className="gerador__scope" viewBox="0 0 360 210" role="img" aria-label={scopeLabel}>
            <rect
              x={SX0}
              y={SY0}
              width={SX1 - SX0}
              height={SY1 - SY0}
              className="gerador__screen"
            />
            {Array.from({ length: 11 }, (_, k) => (
              <line
                key={`gx${k}`}
                x1={SX0 + k * DIV_X}
                x2={SX0 + k * DIV_X}
                y1={SY0}
                y2={SY1}
                className="gerador__grid"
              />
            ))}
            {Array.from({ length: 9 }, (_, k) => (
              <line
                key={`gy${k}`}
                x1={SX0}
                x2={SX1}
                y1={SY0 + k * DIV_Y}
                y2={SY0 + k * DIV_Y}
                className={k === 4 ? 'gerador__grid gerador__grid--axis' : 'gerador__grid'}
              />
            ))}
            {path && <path d={path} className="gerador__trace" />}
            {showMarker && tMarker <= SCOPE_WINDOW && (
              <circle
                cx={tx(tMarker)}
                cy={vy(voltage(f, tMarker))}
                r={4.5}
                className="gerador__marker"
              />
            )}
            <text x={SX0} y={12} className="gerador__scope-text gerador__scope-text--start">
              5 V/div
            </text>
            <text x={SX1} y={12} className="gerador__scope-text gerador__scope-text--end">
              {formatNumber(SCOPE_DIV * 1000, 0)} ms/div
            </text>
            <text x={(SX0 + SX1) / 2} y={198} className="gerador__scope-text">
              {running && !sweeping
                ? 'esperando a espira passar pelo início (disparo)'
                : 'tempo · a tela mostra 50 ms'}
            </text>
          </svg>
        </div>

        <div className="gerador__side">
          <div className="lw__controls">
            <div className="gerador__buttons">
              <button
                type="button"
                className="lw__btn lw__btn--primary"
                onClick={running ? stop : start}
                aria-pressed={running}
              >
                {running ? 'Parar' : 'Girar'}
              </button>
            </div>
            {reduced && (
              <p className="lw__note">
                Seu sistema pede menos movimento, então a animação fica desligada. Gire a espira à
                mão com a barra de posição.
              </p>
            )}

            <label className="lw__range">
              <span className="lw__range-head">
                <span>Velocidade (voltas por segundo)</span>
                <strong className="num">{formatNumber(f, 0)}</strong>
              </span>
              <input
                type="range"
                min={SPEED.min}
                max={SPEED.max}
                step={SPEED.step}
                value={f}
                aria-valuetext={`${formatNumber(f, 0)} voltas por segundo`}
                onChange={(e) => changeSpeed(Number(e.target.value))}
              />
            </label>

            <label className="lw__range">
              <span className="lw__range-head">
                <span>Posição da espira (gire à mão)</span>
                <strong className="num">{formatNumber(theta, 0)}°</strong>
              </span>
              <input
                type="range"
                min={0}
                max={359}
                step={1}
                value={Math.round(theta)}
                aria-valuetext={`${formatNumber(theta, 0)} graus`}
                onChange={(e) => turnByHand(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="lw__output">
            <dl className="gerador__values">
              <div>
                <dt className="lw__value-label">Frequência</dt>
                <dd className="lw__value" data-frequency>
                  {fmtHz(f)}
                </dd>
              </div>
              <div>
                <dt className="lw__value-label">Período</dt>
                <dd className="lw__value" data-period>
                  {formatSI(period(f), 's')}
                </dd>
              </div>
              <div>
                <dt className="lw__value-label">Pico</dt>
                <dd className="lw__value">{fmtV(peak(f))}</dd>
              </div>
              <div>
                <dt className="lw__value-label">Tensão agora</dt>
                <dd className="lw__value">{fmtV(Math.abs(vNow) < 0.005 ? 0 : vNow)}</dd>
              </div>
            </dl>
            <p className="lw__note">
              {formatNumber(rpm(f), 0)} rotações por minuto. Na tela cabem{' '}
              <span data-cycles>{formatNumber(cycles, 1)}</span> ciclos. A simulação roda 100 vezes
              mais devagar que o gerador real.
            </p>
          </div>
        </div>
      </div>
      <p className="lw__sr" aria-live="polite">
        {`${fmtHz(f)}, período de ${formatSI(period(f), 's')}, pico de ${fmtV(peak(f))}.`}
      </p>
    </section>
  );
}
