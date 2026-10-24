/*
 * Lesson 6.3 (phase and phasors): two sine waves of the same frequency, each
 * drawn as an arrow (phasor) turning once per cycle, next to the waves they
 * draw. The height of each arrow tip is the value of its wave at the instant
 * marked on the waves. The student changes the amplitude and the phase of
 * the second wave and can show their sum, which is the two arrows tip to
 * tail. Starts still; "Girar" turns the arrows in slow motion (one 60 Hz
 * cycle in 4 s). Maths in fasores.ts.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { formatNumber } from '../m00/formato';
import { degreesToMs, instant, shiftWords, sum, tip, type Phasor } from './fasores';
import '../m00/widget.css';
import './fasores.css';

/** One 60 Hz cycle (16,7 ms) takes this long on the screen. */
const CYCLE_MS = 4000;
/** Pixels for 100 % (the amplitude of wave A), the same in both drawings. */
const SCALE = 0.44;

/* Phasor diagram (viewBox 0 0 240 240). */
const CX = 120;
const CY = 120;

/* Waves (viewBox 0 0 360 240): two cycles, 0 to 720°. */
const WX0 = 24;
const WX1 = 332;
const wx = (deg: number) => WX0 + (deg / 720) * (WX1 - WX0);
const wy = (v: number) => CY - v * SCALE;

const A: Phasor = { amplitude: 100, phase: 0 };

const PRESETS: { label: string; amplitude: number; phase: number }[] = [
  { label: 'Em fase', amplitude: 100, phase: 0 },
  { label: 'Adiantada 90° (capacitor)', amplitude: 100, phase: 90 },
  { label: 'Atrasada 90° (bobina)', amplitude: 100, phase: -90 },
  { label: 'Oposição (180°)', amplitude: 100, phase: 180 },
];

function wavePath(p: Phasor): string {
  let d = '';
  for (let deg = 0; deg <= 720; deg += 6) {
    d += `${d ? 'L' : 'M'}${wx(deg).toFixed(1)} ${wy(instant(p, deg)).toFixed(1)}`;
  }
  return d;
}

/** Arrow from (x0, y0) to (x1, y1) with a head at the end. */
function Arrow({
  x0,
  y0,
  x1,
  y1,
  className,
}: {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  className: string;
}) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 0.5) return null;
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  const head = Math.min(9, len * 0.6);
  const bx = x1 - ux * head;
  const by = y1 - uy * head;
  return (
    <g className={className}>
      <line x1={x0} y1={y0} x2={bx} y2={by} className="fasores__shaft" />
      <path
        d={`M${x1} ${y1}L${bx - uy * head * 0.45} ${by + ux * head * 0.45}L${bx + uy * head * 0.45} ${by - ux * head * 0.45}Z`}
        className="fasores__head"
      />
    </g>
  );
}

const pct = (v: number) => `${formatNumber(v, 0)} %`;
const deg = (v: number) => `${formatNumber(Math.abs(v), 0)}°`;
const ms = (v: number) => `${formatNumber(Math.abs(degreesToMs(v)), 2)} ms`;

/** "90° adiantada (4,17 ms)", "em fase", "180° (em oposição)". */
function shiftText(phase: number): string {
  const words = shiftWords(phase);
  if (words === 'em fase') return 'em fase';
  if (words === 'em oposição') return '180°, em oposição (8,33 ms)';
  return `${deg(phase)} ${words} (${ms(phase)})`;
}

export default function Fasores() {
  const id = useId();
  const [b, setB] = useState<Phasor>({ amplitude: 80, phase: -60 });
  const [showSum, setShowSum] = useState(false);
  const [theta, setTheta] = useState(30);
  const [running, setRunning] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = now - last;
      last = now;
      setTheta((t) => (t + (dt / CYCLE_MS) * 360) % 720);
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
  }, [running]);

  const s = sum(A, b);
  const tipA = tip(A, theta);
  const tipB = tip(b, theta);
  const tipS = tip(s, theta);
  const px = (p: { x: number; y: number }) => ({ x: CX + p.x * SCALE, y: CY - p.y * SCALE });
  const pA = px(tipA);
  const pB = px(tipB);
  const pS = px(tipS);
  const cursor = wx(theta % 720);

  // A peak of A (90° or 450°) and the peak of B next to it, for the time bracket.
  const peakA = b.phase > 90 ? 450 : 90;
  const peakB = peakA - b.phase;
  const showBracket = b.amplitude > 0 && Math.abs(b.phase) >= 10 && Math.abs(b.phase) <= 170;
  const bracketY = 22;

  const phaseText = shiftText(b.phase);
  const sumText =
    s.amplitude < 0.5
      ? 'as duas ondas se anulam: a soma é zero'
      : `amplitude de ${pct(s.amplitude)} da onda A, ${shiftText(s.phase)} em relação à onda A`;

  const diagramLabel = `Diagrama de fasores: a seta da onda A tem 100 % e a da onda B tem ${pct(b.amplitude)}, ${phaseText}. ${showSum ? `A seta da soma tem ${pct(s.amplitude)}.` : ''} As setas estão a ${deg(theta % 360)} do ciclo.`;
  const wavesLabel = `Gráfico das ondas em dois ciclos de 60 Hz (33,3 ms). Onda A: 100 %; onda B: ${pct(b.amplitude)}, ${phaseText}${showSum ? `; soma: ${pct(s.amplitude)}` : ''}. Agora: A vale ${pct(instant(A, theta))}, B vale ${pct(instant(b, theta))}${showSum ? `, a soma vale ${pct(instant(s, theta))}` : ''}.`;

  const pause = () => setRunning(false);

  return (
    <section className="lw fasores" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Fasores girando e as ondas que eles desenham
        </h3>
        <p className="lw__lead">
          Cada seta gira uma volta por ciclo. A altura da ponta é o valor da onda naquele instante.
          Mude a defasagem da onda B e ligue a soma.
        </p>
      </header>

      <div className="lw__body">
        <div className="fasores__views">
          <svg
            className="fasores__diagram"
            viewBox="0 0 240 240"
            role="img"
            aria-label={diagramLabel}
          >
            <circle cx={CX} cy={CY} r={100 * SCALE} className="fasores__ref" />
            <line x1={8} x2={232} y1={CY} y2={CY} className="fasores__axis" />
            <line x1={CX} x2={CX} y1={8} y2={232} className="fasores__axis" />
            {/* projections: the height of each tip */}
            <line x1={pA.x} x2={232} y1={pA.y} y2={pA.y} className="fasores__proj fasores--a" />
            <line x1={pB.x} x2={232} y1={pB.y} y2={pB.y} className="fasores__proj fasores--b" />
            {showSum && (
              <>
                <line x1={pS.x} x2={232} y1={pS.y} y2={pS.y} className="fasores__proj fasores--s" />
                <line
                  x1={pA.x}
                  y1={pA.y}
                  x2={pS.x}
                  y2={pS.y}
                  className="fasores__ghost fasores--b"
                />
                <Arrow x0={CX} y0={CY} x1={pS.x} y1={pS.y} className="fasores--s" />
              </>
            )}
            <Arrow x0={CX} y0={CY} x1={pA.x} y1={pA.y} className="fasores--a" />
            <Arrow x0={CX} y0={CY} x1={pB.x} y1={pB.y} className="fasores--b" />
            <circle cx={CX} cy={CY} r={2.5} className="fasores__pivot" />
            <text x={12} y={20} className="fasores__label fasores__label--start">
              gira no sentido
            </text>
            <text x={12} y={35} className="fasores__label fasores__label--start">
              anti-horário
            </text>
          </svg>

          <svg className="fasores__waves" viewBox="0 0 360 240" role="img" aria-label={wavesLabel}>
            <line x1={WX0} x2={WX1} y1={CY} y2={CY} className="fasores__axis" />
            <line x1={WX0} x2={WX0} y1={30} y2={210} className="fasores__axis" />
            {[0, 180, 360, 540, 720].map((d) => (
              <g key={d}>
                <line x1={wx(d)} x2={wx(d)} y1={CY - 3} y2={CY + 3} className="fasores__axis" />
                <text x={wx(d)} y={232} className="fasores__label">
                  {d === 0 ? '0' : `${formatNumber((d / 360) * (1000 / 60), 1)} ms`}
                </text>
              </g>
            ))}
            <path d={wavePath(A)} className="fasores__wave fasores--a" />
            <path d={wavePath(b)} className="fasores__wave fasores--b" />
            {showSum && <path d={wavePath(s)} className="fasores__wave fasores--s" />}
            {showBracket && (
              <g className="fasores__bracket">
                <line x1={wx(peakA)} x2={wx(peakA)} y1={bracketY} y2={wy(100)} />
                <line x1={wx(peakB)} x2={wx(peakB)} y1={bracketY} y2={wy(b.amplitude)} />
                <line x1={wx(peakA)} x2={wx(peakB)} y1={bracketY} y2={bracketY} />
                <text x={(wx(peakA) + wx(peakB)) / 2} y={bracketY - 6} className="fasores__label">
                  {ms(b.phase)}
                </text>
              </g>
            )}
            <line x1={cursor} x2={cursor} y1={30} y2={210} className="fasores__cursor" />
            <circle
              cx={cursor}
              cy={wy(instant(A, theta))}
              r={4}
              className="fasores__dot fasores--a"
            />
            <circle
              cx={cursor}
              cy={wy(instant(b, theta))}
              r={4}
              className="fasores__dot fasores--b"
            />
            {showSum && (
              <circle
                cx={cursor}
                cy={wy(instant(s, theta))}
                r={4}
                className="fasores__dot fasores--s"
              />
            )}
          </svg>
        </div>

        <ul className="fasores__legend" aria-hidden="true">
          <li className="fasores--a">Onda A (referência, 100 %)</li>
          <li className="fasores--b">Onda B</li>
          {showSum && <li className="fasores--s">Soma A + B</li>}
        </ul>

        <div className="lw__controls">
          <div className="fasores__buttons">
            <button
              type="button"
              className="lw__btn lw__btn--primary"
              onClick={() => setRunning((r) => !r)}
            >
              {running ? 'Pausar' : 'Girar (câmera lenta)'}
            </button>
            <label className="lw__check">
              <input
                type="checkbox"
                checked={showSum}
                onChange={(e) => setShowSum(e.target.checked)}
              />
              Mostrar a soma A + B
            </label>
          </div>
          <div className="fasores__sliders">
            <label className="lw__range">
              <span className="lw__range-head">
                <span>Instante no ciclo</span>
                <strong className="num">{deg(theta % 360)}</strong>
              </span>
              <input
                type="range"
                min={0}
                max={355}
                step={5}
                value={(Math.round((theta % 360) / 5) * 5) % 360}
                aria-valuetext={`${deg(theta % 360)} do ciclo`}
                onChange={(e) => {
                  pause();
                  setTheta(Number(e.target.value));
                }}
              />
            </label>

            <label className="lw__range">
              <span className="lw__range-head">
                <span>Amplitude da onda B</span>
                <strong className="num">{pct(b.amplitude)}</strong>
              </span>
              <input
                type="range"
                min={0}
                max={150}
                step={5}
                value={b.amplitude}
                aria-valuetext={`${pct(b.amplitude)} da onda A`}
                onChange={(e) => setB({ ...b, amplitude: Number(e.target.value) })}
              />
            </label>

            <label className="lw__range">
              <span className="lw__range-head">
                <span>Defasagem da onda B</span>
                <strong className="num">
                  {b.phase > 0 ? '+' : b.phase < 0 ? '−' : ''}
                  {deg(b.phase)}
                </strong>
              </span>
              <input
                type="range"
                min={-180}
                max={180}
                step={5}
                value={b.phase}
                aria-valuetext={phaseText}
                onChange={(e) => setB({ ...b, phase: Number(e.target.value) })}
              />
            </label>
          </div>

          <fieldset className="lw__group">
            <legend className="lw__legend">Casos prontos</legend>
            <div className="lw__choices">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="lw__btn"
                  onClick={() => setB({ amplitude: p.amplitude, phase: p.phase })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="lw__output" aria-live="polite">
          <div>
            <p className="lw__value-label">Onda B em relação à A</p>
            <p className="fasores__value" data-shift>
              {phaseText}
            </p>
          </div>
          <div>
            <p className="lw__value-label">Soma A + B</p>
            <p className="lw__value" data-sum>
              {pct(s.amplitude)}
            </p>
            <p className="lw__note">
              {sumText}. Para somar ondas da mesma frequência, ponha as setas uma na ponta da outra.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
