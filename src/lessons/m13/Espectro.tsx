/*
 * Lesson 13.1: the electromagnetic spectrum on a logarithmic ruler. The
 * student moves the frequency (or picks something familiar) and reads the
 * wavelength, the band and the length of a quarter-wave antenna. Logic in
 * espectro.ts.
 */
import { useId, useState } from 'react';
import {
  BANDS,
  C,
  bandOf,
  EXAMPLES,
  F_MAX,
  F_MIN,
  formatFrequency,
  formatLength,
  quarterWave,
  radioBandOf,
  rulerPosition,
  sizeOf,
  wavelength,
} from './espectro';
import '../m00/widget.css';
import './espectro.css';

/* Ruler (viewBox 0 0 640 132). */
const X0 = 16;
const X1 = 624;
const BAR_Y = 34;
const BAR_H = 30;
const rx = (f: number) => X0 + rulerPosition(f) * (X1 - X0);

const LO = Math.log10(F_MIN);
const HI = Math.log10(F_MAX);
const STEPS = 1000;
const toSlider = (f: number) => Math.round(((Math.log10(f) - LO) / (HI - LO)) * STEPS);
const fromSlider = (v: number) => 10 ** (LO + (v / STEPS) * (HI - LO));

const DECADES: [number, string][] = [
  [1e3, '1 kHz'],
  [1e6, '1 MHz'],
  [1e9, '1 GHz'],
  [1e12, '1 THz'],
  [1e15, '1 PHz'],
  [1e18, '1 EHz'],
];
const LAMBDAS: [number, string][] = [
  [1e6, '1.000 km'],
  [1e3, '1 km'],
  [1, '1 m'],
  [1e-3, '1 mm'],
  [1e-6, '1 µm'],
  [1e-9, '1 nm'],
];

export default function Espectro() {
  const id = useId();
  const gradient = `${id.replace(/[^a-zA-Z0-9_-]/g, '')}-luz`;
  const portao = EXAMPLES.find((e) => e.id === 'portao')!;
  const [f, setF] = useState(portao.f);
  const [picked, setPicked] = useState<string | null>(portao.id);
  const example = EXAMPLES.find((e) => e.id === picked);
  const band = bandOf(f);
  const sub = band.id === 'radio' ? radioBandOf(f) : undefined;
  const lambda = wavelength(f);
  const antenna = band.id === 'radio' && f >= 1e6 ? quarterWave(f) : undefined;

  return (
    <section className="lw espectro" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Do rádio à luz: o espectro eletromagnético
        </h3>
        <p className="lw__lead">
          Mude a frequência ou escolha algo do dia a dia. A régua é logarítmica: cada marca é mil
          vezes a anterior.
        </p>
      </header>

      <div className="lw__body">
        <svg
          className="espectro__ruler"
          viewBox="0 0 640 132"
          role="img"
          aria-label={`Régua do espectro, de ${formatFrequency(F_MIN)} a ${formatFrequency(F_MAX)}: ondas de rádio, infravermelho, luz visível, ultravioleta e raios X. O marcador está em ${formatFrequency(f)}, na faixa ${band.name}.`}
        >
          <defs>
            <linearGradient id={gradient}>
              {['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#5e35b1'].map((c, i) => (
                <stop key={c} offset={i / 5} stopColor={c} />
              ))}
            </linearGradient>
          </defs>
          {BANDS.map((b) => (
            <rect
              key={b.id}
              x={rx(b.from)}
              y={BAR_Y}
              width={Math.max(rx(b.to) - rx(b.from), 1)}
              height={BAR_H}
              className={`espectro__band espectro__band--${b.id}`}
              style={b.id === 'visivel' ? { fill: `url(#${gradient})` } : undefined}
            />
          ))}
          {DECADES.map(([fd, label]) => (
            <g key={label}>
              <line x1={rx(fd)} x2={rx(fd)} y1={BAR_Y - 6} y2={BAR_Y} className="espectro__tick" />
              <text x={rx(fd)} y={BAR_Y - 10} className="espectro__tick-t">
                {label}
              </text>
            </g>
          ))}
          {LAMBDAS.map(([m, label]) => (
            <g key={label}>
              <line
                x1={rx(C / m)}
                x2={rx(C / m)}
                y1={BAR_Y + BAR_H}
                y2={BAR_Y + BAR_H + 6}
                className="espectro__tick"
              />
              <text x={rx(C / m)} y={BAR_Y + BAR_H + 18} className="espectro__tick-t">
                {label}
              </text>
            </g>
          ))}
          <text x={X0} y={12} className="espectro__axis-t">
            frequência
          </text>
          <text x={X0} y={BAR_Y + BAR_H + 34} className="espectro__axis-t">
            comprimento de onda
          </text>
          {EXAMPLES.map((e) => (
            <circle
              key={e.id}
              cx={rx(e.f)}
              cy={BAR_Y + BAR_H / 2}
              r={2.6}
              className="espectro__dot"
            />
          ))}
          <g className="espectro__marker">
            <line x1={rx(f)} x2={rx(f)} y1={BAR_Y - 4} y2={BAR_Y + BAR_H + 4} />
            <path
              d={`M${rx(f) - 6} ${BAR_Y + BAR_H + 50} L${rx(f)} ${BAR_Y + BAR_H + 40} L${rx(f) + 6} ${BAR_Y + BAR_H + 50} Z`}
            />
          </g>
        </svg>

        <label className="lw__range">
          <span className="lw__range-head">
            <span>Frequência</span>
            <strong className="num">{formatFrequency(f)}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={STEPS}
            step={1}
            value={toSlider(f)}
            aria-valuetext={`${formatFrequency(f)}, comprimento de onda de ${formatLength(lambda)}`}
            onChange={(e) => {
              setF(fromSlider(Number(e.target.value)));
              setPicked(null);
            }}
          />
        </label>

        <fieldset className="lw__group">
          <legend className="lw__legend">Exemplos</legend>
          <div className="lw__choices">
            {EXAMPLES.map((e) => (
              <label key={e.id} className="lw__choice">
                <input
                  type="radio"
                  name={`${id}-exemplo`}
                  checked={picked === e.id}
                  onChange={() => {
                    setF(e.f);
                    setPicked(e.id);
                  }}
                />
                {e.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="lw__output espectro__out" aria-live="polite">
          <div className="espectro__values">
            <div>
              <p className="lw__value-label">Comprimento de onda λ</p>
              <p className="lw__value" data-lambda>
                {formatLength(lambda)}
              </p>
            </div>
            <div>
              <p className="lw__value-label">Antena de ¼ de onda</p>
              <p className="lw__value" data-antena>
                {antenna !== undefined ? formatLength(antenna) : '—'}
              </p>
            </div>
          </div>
          <p className="espectro__band-name" data-faixa={band.id}>
            <span
              className={`espectro__swatch espectro__band--${band.id}`}
              aria-hidden="true"
            ></span>
            {band.name}
            {sub && <span className="espectro__sub"> · {sub}</span>}
          </p>
          <p className="lw__note">
            Uma onda de {formatFrequency(f)} tem λ = c / f = {formatLength(lambda)},{' '}
            {sizeOf(lambda)}.{' '}
            {antenna === undefined &&
              band.id === 'radio' &&
              'Abaixo de 1 MHz, a antena de um quarto de onda passa de 75 m: na prática se usam antenas bem mais curtas, de rendimento baixo. '}
            {example ? example.note : band.note}
          </p>
        </div>
      </div>
    </section>
  );
}
