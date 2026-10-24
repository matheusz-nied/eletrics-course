/*
 * Lesson 11.6: an ADC at work. A 1 Hz sine between 0,5 V and 4,5 V is
 * sampled at the chosen rate and each sample is rounded down to one of 2ⁿ
 * codes (reference 5 V). The graph shows the signal, the samples and what
 * the program gets back: a staircase, held from one sample to the next.
 */
import { useId, useState } from 'react';
import { formatNumber, formatSI } from '../m00/formato';
import { nyquistOk, sample, signalAt, stepOf } from './adc';
import '../m00/widget.css';
import './adc.css';

const VREF = 5;
const DURATION = 2;
const SIGNAL_HZ = 1;
const BITS = [1, 2, 3, 4, 8, 10];
const RATES = [1.5, 4, 10, 50];

/* Graph (viewBox 0 0 360 210). */
const X0 = 34;
const X1 = 352;
const Y0 = 186;
const Y1 = 12;
const gx = (t: number) => X0 + (t / DURATION) * (X1 - X0);
const gy = (v: number) => Y0 - (v / VREF) * (Y0 - Y1);

const rateLabel = (r: number) => `${formatNumber(r, r % 1 ? 1 : 0)} por segundo`;

export default function ConversorAD() {
  const id = useId();
  const [bits, setBits] = useState(3);
  const [rate, setRate] = useState(10);
  const samples = sample(signalAt, rate, DURATION, VREF, bits);
  const step = stepOf(VREF, bits);
  const ok = nyquistOk(rate, SIGNAL_HZ);

  const analog = Array.from({ length: 201 }, (_, k) => {
    const t = (k / 200) * DURATION;
    return `${k ? 'L' : 'M'}${gx(t).toFixed(1)} ${gy(signalAt(t)).toFixed(1)}`;
  }).join('');
  const stairs = samples
    .map((s, k) => {
      const next = k + 1 < samples.length ? samples[k + 1].t : DURATION;
      const y = gy(s.back).toFixed(1);
      return `${k ? 'V' : `M${gx(s.t).toFixed(1)} `}${y}H${gx(next).toFixed(1)}`;
    })
    .join('');

  return (
    <section className="lw adc" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Amostrar e arredondar
        </h3>
        <p className="lw__lead">
          A linha fina é um sinal de 1 Hz, entre 0,5 V e 4,5 V. O conversor mede o sinal nos pontos
          e arredonda cada medida para um dos degraus que os seus bits conseguem escrever. A linha
          grossa é o que o programa recebe.
        </p>
      </header>

      <div className="lw__body">
        <div className="lw__controls lw__controls--cols">
          <fieldset className="lw__group">
            <legend className="lw__legend">Resolução</legend>
            <div className="lw__choices">
              {BITS.map((b) => (
                <label key={b} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-bits`}
                    checked={bits === b}
                    onChange={() => setBits(b)}
                  />
                  {b} {b === 1 ? 'bit' : 'bits'}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="lw__group">
            <legend className="lw__legend">Amostras</legend>
            <div className="lw__choices">
              {RATES.map((r) => (
                <label key={r} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-taxa`}
                    checked={rate === r}
                    onChange={() => setRate(r)}
                  />
                  {rateLabel(r)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="lw__output" aria-live="polite">
          <svg
            viewBox="0 0 360 210"
            className="adc__graph"
            role="img"
            aria-label={`Sinal de 1 Hz amostrado ${rateLabel(rate)} com ${bits} bits.`}
          >
            {[0, 2.5, 5].map((v) => (
              <g key={v}>
                <path d={`M${X0} ${gy(v)}H${X1}`} className="adc__grid" />
                <text x={X0 - 6} y={gy(v) + 4} className="adc__tick">
                  {formatNumber(v, v % 1 ? 1 : 0)} V
                </text>
              </g>
            ))}
            <path d={analog} className="adc__analog" />
            <path d={stairs} className="adc__stairs" />
            {rate <= 10 &&
              samples.map((s) => (
                <circle key={s.t} cx={gx(s.t)} cy={gy(s.v)} r={3} className="adc__dot" />
              ))}
            <text x={X1} y={Y0 + 18} className="adc__tick">
              2 s
            </text>
          </svg>

          <div className="adc__values">
            <div>
              <p className="lw__value-label">Degraus</p>
              <p className="lw__value num">{(2 ** bits).toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <p className="lw__value-label">Tamanho do degrau</p>
              <p className="lw__value num">{formatSI(step, 'V')}</p>
            </div>
          </div>
          <p className="lw__formula">
            5 V ÷ 2{bits === 1 ? '' : <sup>{bits}</sup>} = {formatSI(step, 'V')}. O erro de cada
            leitura fica entre 0 e um degrau.
          </p>
          {!ok && (
            <p className="lw__status lw__status--danger">
              <span className="lw__status-dot" aria-hidden="true" />
              Poucas amostras: menos de duas por ciclo do sinal. Os pontos desenham uma onda mais
              lenta, que não existe.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
