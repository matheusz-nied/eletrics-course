/*
 * Lesson 6.2 (peak, RMS and average): pick a waveform with the outlet's peak
 * and compare its peak, peak-to-peak, cycle average and true RMS with what a
 * common, average-responding multimeter shows. The dimmer wave has its firing
 * angle on a slider. Math in formas-de-onda.ts.
 */
import { useId, useMemo, useState } from 'react';
import { formatNumber } from '../m00/formato';
import { OUTLET_PEAK, WAVES, reading, sample, type WaveKind } from './formas-de-onda';
import '../m00/widget.css';
import './formas-de-onda.css';

/* Plot (viewBox 0 0 360 200): two cycles, ±peak over ±72 px. */
const X0 = 40;
const X1 = 350;
const Y0 = 96;
const AMP = 72;
const CYCLES = 2;

const fmtV = (v: number) => `${formatNumber(Math.abs(v) < 0.05 ? 0 : v, 1)} V`;
const fmtPct = (e: number) => `${e > 0 ? '+' : ''}${formatNumber(e * 100, 1)} %`;

function wavePath(kind: WaveKind, alpha: number): string {
  const n = 720;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const x = (CYCLES * i) / n;
    const px = X0 + ((X1 - X0) * i) / n;
    const py = Y0 - AMP * sample(kind, x, alpha);
    d += `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`;
  }
  return d;
}

export default function FormasDeOnda() {
  const id = useId();
  const [kind, setKind] = useState<WaveKind>('senoide');
  const [alpha, setAlpha] = useState(90);
  const r = reading(kind, OUTLET_PEAK, alpha);
  const path = useMemo(() => wavePath(kind, alpha), [kind, alpha]);
  const yRms = Y0 - (AMP * r.rms) / OUTLET_PEAK;
  const ok = Math.abs(r.error) < 0.005;

  const plotLabel = `Dois ciclos de uma onda ${WAVES[kind].label.toLowerCase()}${kind === 'dimmer' ? ` com disparo em ${alpha} graus` : ''}, com pico de ${fmtV(r.peak)} e valor eficaz de ${fmtV(r.rms)}.`;

  return (
    <section className="lw formas" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          O multímetro comum e o true RMS
        </h3>
        <p className="lw__lead">
          Todas as ondas partem do mesmo pico da tomada de 127 V, 179,6 V. Escolha uma e compare o
          valor eficaz verdadeiro com o que um multímetro comum mostraria em V~.
        </p>
      </header>

      <div className="lw__body formas__body">
        <div className="formas__views">
          <fieldset className="lw__group">
            <legend className="lw__legend">Forma de onda</legend>
            <div className="lw__choices">
              {(Object.keys(WAVES) as WaveKind[]).map((k) => (
                <label key={k} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-onda`}
                    checked={kind === k}
                    onChange={() => setKind(k)}
                  />
                  {WAVES[k].label}
                </label>
              ))}
            </div>
          </fieldset>

          {kind === 'dimmer' && (
            <label className="lw__range">
              <span className="lw__range-head">
                <span>Ângulo de disparo do dimmer</span>
                <strong className="num">{alpha}°</strong>
              </span>
              <input
                type="range"
                min={0}
                max={150}
                step={15}
                value={alpha}
                aria-valuetext={`${alpha} graus`}
                onChange={(e) => setAlpha(Number(e.target.value))}
              />
            </label>
          )}

          <svg className="formas__plot" viewBox="0 0 360 200" role="img" aria-label={plotLabel}>
            <line x1={X0} x2={X1} y1={Y0} y2={Y0} className="formas__axis" />
            <line x1={X0} x2={X0} y1={Y0 - AMP - 10} y2={Y0 + AMP + 10} className="formas__axis" />
            <line x1={X0} x2={X1} y1={Y0 - AMP} y2={Y0 - AMP} className="formas__peak" />
            <line x1={X0} x2={X1} y1={Y0 + AMP} y2={Y0 + AMP} className="formas__peak" />
            <line x1={X0} x2={X1} y1={yRms} y2={yRms} className="formas__rms" />
            <path d={path} className="formas__wave" />
            <text x={X0 - 6} y={Y0 - AMP + 4} className="formas__tick">
              +180
            </text>
            <text x={X0 - 6} y={Y0 + 4} className="formas__tick">
              0
            </text>
            <text x={X0 - 6} y={Y0 + AMP + 4} className="formas__tick">
              −180
            </text>
            <text x={X1} y={yRms - 5} className="formas__rms-text">
              eficaz {fmtV(r.rms)}
            </text>
            <text x={(X0 + X1) / 2} y={192} className="formas__caption">
              tempo · dois ciclos de 60 Hz (33,3 ms) · tensão em volts
            </text>
          </svg>
          <p className="lw__note">{WAVES[kind].where}</p>
        </div>

        <div className="formas__side">
          <dl className="lw__output formas__values">
            <div>
              <dt className="lw__value-label">Pico</dt>
              <dd className="formas__value">{fmtV(r.peak)}</dd>
            </div>
            <div>
              <dt className="lw__value-label">Pico a pico</dt>
              <dd className="formas__value">{fmtV(r.peakToPeak)}</dd>
            </div>
            <div>
              <dt className="lw__value-label">Média do ciclo</dt>
              <dd className="formas__value">{fmtV(r.mean)}</dd>
            </div>
            <div>
              <dt className="lw__value-label">Média de meio ciclo</dt>
              <dd className="formas__value">{fmtV(r.average)}</dd>
            </div>
            <div>
              <dt className="lw__value-label">Eficaz (true RMS)</dt>
              <dd className="formas__value formas__value--rms" data-rms>
                {fmtV(r.rms)}
              </dd>
            </div>
            <div>
              <dt className="lw__value-label">Multímetro comum</dt>
              <dd className="formas__value" data-meter>
                {fmtV(r.meter)}
              </dd>
            </div>
          </dl>
          <p
            className={`lw__status ${ok ? 'lw__status--ok' : 'lw__status--warn'}`}
            aria-live="polite"
          >
            <span className="lw__status-dot" aria-hidden="true" />
            <span>
              {ok
                ? 'Nesta onda, o multímetro comum acerta: ele foi calibrado para a senoide.'
                : `O multímetro comum erra ${fmtPct(r.error)}. Só um true RMS mostra ${fmtV(r.rms)}.`}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
