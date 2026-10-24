/*
 * Lesson 6.7 (single-, two- and three-phase systems): the three phases of a
 * star supply as phasors turning together and as waves, and the voltage
 * between two phases, drawn as the arrow from the tip of one phasor to the
 * tip of the other. Its length is √3 times a phase: 127 → 220 V, 220 → 380 V.
 * Pure maths in trifasico.ts.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { formatNumber } from '../m00/formato';
import {
  lineRms,
  lineVoltage,
  PAIRS,
  PHASES,
  phasorTip,
  phaseVoltage,
  sumOfPhases,
  SYSTEMS,
  type PairId,
  type PhaseId,
  type SystemId,
} from './trifasico';
import '../m00/widget.css';
import './trifasico-fasores.css';

/** One turn of the phasors takes 4 s on the screen (in the real supply, 1/60 s). */
const TURN_SECONDS = 4;
const DEG = Math.PI / 180;

/* Phasor diagram, viewBox 0 0 240 240. */
const C = 120;
const R = 62;
/* Waves, viewBox 0 0 360 240: one cycle from x0 to x1. */
const X0 = 34;
const X1 = 350;
const Y0 = 120;
const AMP = 100;

const CLASS: Record<PhaseId, string> = { L1: 'tf-l1', L2: 'tf-l2', L3: 'tf-l3' };

/** Volts in pt-BR; values that round to zero read "0 V", never "−0 V". */
const volts = (v: number, decimals = 0) => {
  const r = Number(v.toFixed(decimals));
  return `${formatNumber(r === 0 ? 0 : r, decimals)} V`;
};

export default function TrifasicoFasores() {
  const id = useId();
  const [system, setSystem] = useState<SystemId>('127/220');
  const [pair, setPair] = useState<PairId>('L1-L2');
  const [theta, setTheta] = useState(60 * DEG);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      setTheta((t) => (t + (2 * Math.PI * dt) / TURN_SECONDS) % (2 * Math.PI));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const { phase: rms } = SYSTEMS[system];
  const nominalLine = SYSTEMS[system].line;
  const [a, b] = PAIRS[pair];
  const peakLine = lineRms(rms) * Math.SQRT2;
  /** Waves scale: the line voltage peak fills the plot. */
  const vy = (v: number) => Y0 - (v / peakLine) * AMP;
  const tx = (deg: number) => X0 + ((X1 - X0) * deg) / 360;
  /** Phasor length in the diagram: a phase is R, so the line arrow is R·√3. */
  const tip = (p: PhaseId): [number, number] => {
    const [x, y] = phasorTip(p, theta, R);
    return [C + x, C - y];
  };

  const wave = (f: (t: number) => number) =>
    Array.from({ length: 121 }, (_, i) => {
      const deg = i * 3;
      return `${i === 0 ? 'M' : 'L'}${tx(deg).toFixed(1)} ${vy(f(deg * DEG)).toFixed(1)}`;
    }).join(' ');

  const deg = (((theta / DEG) % 360) + 360) % 360;
  const [ax, ay] = tip(a);
  const [bx, by] = tip(b);
  const lineNow = lineVoltage(pair, theta, rms);
  const sum = sumOfPhases(theta, rms);
  const label = `${a} e ${b}`;

  return (
    <section className="lw trifasico" aria-labelledby={`${id}-t`}>
      <header className="lw__head">
        <span className="lw__kicker">Interativo</span>
        <h3 className="lw__title" id={`${id}-t`}>
          Três fases girando juntas
        </h3>
        <p className="lw__lead">
          Cada seta é uma fase. A altura da ponta da seta é a tensão daquela fase no instante. A
          seta tracejada liga a ponta de uma fase à ponta de outra: é a tensão entre as duas.
        </p>
      </header>
      <div className="lw__body">
        <div className="lw__controls lw__controls--cols">
          <fieldset className="lw__group">
            <legend className="lw__legend">Sistema</legend>
            <div className="lw__choices">
              {(Object.keys(SYSTEMS) as SystemId[]).map((s) => (
                <label key={s} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-sys`}
                    value={s}
                    checked={system === s}
                    onChange={() => setSystem(s)}
                  />
                  {s} V
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="lw__group">
            <legend className="lw__legend">Tensão entre</legend>
            <div className="lw__choices">
              {(Object.keys(PAIRS) as PairId[]).map((p) => (
                <label key={p} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-pair`}
                    value={p}
                    checked={pair === p}
                    onChange={() => setPair(p)}
                  />
                  {PAIRS[p][0]} e {PAIRS[p][1]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="trifasico__views">
          <svg
            viewBox="0 0 240 240"
            className="trifasico__svg"
            role="img"
            aria-label={`Diagrama de fasores: três setas iguais a 120° uma da outra, e a seta da tensão entre ${label}, 1,73 vez maior.`}
          >
            <circle cx={C} cy={C} r={R} className="tf-orbit" />
            <path
              d={`M${C - R - 14} ${C} H${C + R + 14} M${C} ${C - R - 14} V${C + R + 14}`}
              className="tf-axis"
            />
            {PHASES.map((p) => {
              const [x, y] = tip(p);
              const [lx, ly] = phasorTip(p, theta, R + 16);
              return (
                <g key={p} className={CLASS[p]}>
                  <line x1={C} y1={C} x2={x} y2={y} className="tf-arrow" />
                  <circle cx={x} cy={y} r="4" className="tf-dot" />
                  <text x={C + lx} y={C - ly + 4} className="tf-label">
                    {p}
                  </text>
                </g>
              );
            })}
            <line x1={bx} y1={by} x2={ax} y2={ay} className="tf-line" />
            <text x={C} y={232} className="tf-caption">
              N (neutro) no centro
            </text>
          </svg>

          <svg
            viewBox="0 0 360 240"
            className="trifasico__svg"
            role="img"
            aria-label={`Um ciclo das três fases, com pico de ${volts(rms * Math.SQRT2, 1)}, e da tensão entre ${label}, com pico de ${volts(peakLine)}.`}
          >
            <path d={`M${X0} ${Y0} H${X1}`} className="tf-axis" />
            <path d={`M${X0} ${Y0 - AMP - 8} V${Y0 + AMP + 8}`} className="tf-axis" />
            {PHASES.map((p) => (
              <path
                key={p}
                d={wave((t) => phaseVoltage(p, t, rms))}
                className={`${CLASS[p]} tf-wave`}
              />
            ))}
            <path d={wave((t) => lineVoltage(pair, t, rms))} className="tf-line-wave" />
            <line
              x1={tx(deg)}
              y1={Y0 - AMP - 8}
              x2={tx(deg)}
              y2={Y0 + AMP + 8}
              className="tf-cursor"
            />
            {PHASES.map((p) => (
              <circle
                key={p}
                cx={tx(deg)}
                cy={vy(phaseVoltage(p, theta, rms))}
                r="3.5"
                className={`${CLASS[p]} tf-dot`}
              />
            ))}
            <text x={X0 - 4} y={vy(peakLine) + 4} className="tf-tick">
              {formatNumber(peakLine, 0)}
            </text>
            <text x={X0 - 4} y={vy(rms * Math.SQRT2) + 4} className="tf-tick">
              {formatNumber(rms * Math.SQRT2, 0)}
            </text>
            <text x={X0 - 4} y={Y0 + 4} className="tf-tick">
              0
            </text>
            <text x={(X0 + X1) / 2} y={236} className="tf-caption">
              um ciclo (1/60 s); escala em volts
            </text>
          </svg>
        </div>

        <div className="trifasico__time">
          <button
            type="button"
            className="lw__btn lw__btn--primary"
            onClick={() => setPlaying((v) => !v)}
            aria-pressed={playing}
          >
            {playing ? 'Pausar' : 'Girar'}
          </button>
          <label className="lw__range">
            <span className="lw__range-head">
              <span>Instante (ângulo da volta)</span>
              <span>{formatNumber(deg, 0)}°</span>
            </span>
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              value={Math.round(deg) % 360}
              onChange={(e) => {
                setPlaying(false);
                setTheta(Number(e.target.value) * DEG);
              }}
            />
          </label>
        </div>

        <dl className="lw__output trifasico__out">
          <div>
            <dt className="lw__value-label">Entre fase e neutro</dt>
            <dd className="lw__value" data-phase-rms>
              {volts(rms)}
            </dd>
            <dd className="lw__note">pico de {volts(rms * Math.SQRT2, 1)}</dd>
          </div>
          <div>
            <dt className="lw__value-label">Entre {label}</dt>
            <dd className="lw__value" data-line-rms>
              {volts(nominalLine)}
            </dd>
            <dd className="lw__note">
              {formatNumber(rms, 0)} × √3 = {formatNumber(lineRms(rms), 1)} V; pico de{' '}
              {volts(peakLine)}
            </dd>
          </div>
          <div className="trifasico__now">
            <dt className="lw__value-label">Agora, neste instante</dt>
            <dd className="lw__formula" data-now>
              {PHASES.map((p) => `${p}: ${volts(phaseVoltage(p, theta, rms))}`).join(' · ')}
            </dd>
            <dd className="lw__formula" data-sum>
              L1 + L2 + L3 = {volts(sum)}
            </dd>
            <dd className="lw__formula" data-line-now>
              {a} − {b} = {volts(lineNow)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
