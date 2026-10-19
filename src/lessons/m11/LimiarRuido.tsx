/*
 * Lesson 11.1: a slow sensor signal with noise read by a digital input. With
 * one threshold, the noise makes the reading flip back and forth near it;
 * with hysteresis (two thresholds, as a Schmitt trigger input), the reading
 * changes once going up and once going down (limiar.ts).
 */
import { useId, useState } from 'react';
import { formatNumber } from '../m00/formato';
import {
  countChanges,
  HYSTERESIS,
  readInput,
  sampleSignal,
  THRESHOLD,
  type InputKind,
} from './limiar';
import '../m00/widget.css';
import './limiar.css';

/* Graph (viewBox 0 0 360 236): analog signal on top, the reading below. */
const X0 = 40;
const X1 = 350;
const VY0 = 140;
const VY1 = 12;
const DY0 = 214;
const DY1 = 176;
const gx = (k: number, n: number) => X0 + (k / (n - 1)) * (X1 - X0);
const gy = (v: number) => VY0 - (Math.min(Math.max(v, 0), 5) / 5) * (VY0 - VY1);

const KINDS: { id: InputKind; label: string }[] = [
  { id: 'simples', label: 'Um limiar só (2,5 V)' },
  { id: 'histerese', label: 'Com histerese (sobe em 3 V, desce em 2 V)' },
];

const volts = (v: number) => `${formatNumber(v, 2)} V`;

export default function LimiarRuido() {
  const id = useId();
  const [noise, setNoise] = useState(0.3);
  const [kind, setKind] = useState<InputKind>('simples');

  const samples = sampleSignal(noise);
  const levels = readInput(samples, kind);
  const changes = countChanges(levels);
  const n = samples.length;
  const analog = samples
    .map((v, k) => `${k === 0 ? 'M' : 'L'}${gx(k, n).toFixed(1)} ${gy(v).toFixed(1)}`)
    .join('');
  const digital = levels
    .map((on, k) => `${k === 0 ? 'M' : 'L'}${gx(k, n).toFixed(1)} ${on ? DY1 : DY0}`)
    .join('');

  const clean = changes === 2;
  const status = clean
    ? {
        tone: 'ok',
        label: 'Leitura limpa',
        note: 'A entrada mudou só duas vezes: para 1 quando o sinal subiu e para 0 quando ele desceu.',
      }
    : {
        tone: 'danger',
        label: `A leitura mudou ${changes} vezes`,
        note: 'O certo seriam duas. Perto do limiar, o ruído leva o sinal para cima e para baixo dele, e cada cruzamento vira uma troca falsa. Um contador ou um microcontrolador veria vários eventos onde houve um só.',
      };

  return (
    <section className="lw limiar" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Ruído na entrada digital
        </h3>
        <p className="lw__lead">
          A linha de cima é a tensão de um sensor que sobe devagar de 0,5 V até 4,5 V e volta, com
          ruído por cima. A de baixo é o que uma entrada digital lê: 1 ou 0.
        </p>
      </header>

      <div className="lw__body">
        <div className="lw__controls lw__controls--cols">
          <label className="lw__range">
            <span className="lw__range-head">
              <span>Ruído (pico)</span>
              <strong className="num">{volts(noise)}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={noise}
              aria-valuetext={volts(noise)}
              onChange={(e) => setNoise(Number(e.target.value))}
            />
          </label>
          <fieldset className="lw__group">
            <legend className="lw__legend">Entrada</legend>
            <div className="lw__choices lw__choices--stack">
              {KINDS.map((k) => (
                <label key={k.id} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-entrada`}
                    checked={kind === k.id}
                    onChange={() => setKind(k.id)}
                  />
                  {k.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="lw__output" aria-live="polite">
          <svg
            viewBox="0 0 360 236"
            className="limiar__graph"
            role="img"
            aria-label={`Gráfico do sinal com ${volts(noise)} de ruído e da leitura da entrada, que muda ${changes} vezes.`}
          >
            {[0, 1, 2, 3, 4, 5].map((v) => (
              <g key={v}>
                <path d={`M${X0} ${gy(v)}H${X1}`} className="limiar__grid" />
                <text x={X0 - 6} y={gy(v) + 4} className="limiar__tick">
                  {v} V
                </text>
              </g>
            ))}
            {kind === 'histerese' ? (
              <>
                <rect
                  x={X0}
                  y={gy(HYSTERESIS.up)}
                  width={X1 - X0}
                  height={gy(HYSTERESIS.down) - gy(HYSTERESIS.up)}
                  className="limiar__band"
                />
                <path d={`M${X0} ${gy(HYSTERESIS.up)}H${X1}`} className="limiar__th" />
                <path d={`M${X0} ${gy(HYSTERESIS.down)}H${X1}`} className="limiar__th" />
              </>
            ) : (
              <path d={`M${X0} ${gy(THRESHOLD)}H${X1}`} className="limiar__th" />
            )}
            <path d={analog} className="limiar__analog" />
            <text x={X0 - 6} y={DY1 + 4} className="limiar__tick">
              1
            </text>
            <text x={X0 - 6} y={DY0 + 4} className="limiar__tick">
              0
            </text>
            <path d={`M${X0} ${DY0}H${X1}`} className="limiar__grid" />
            <path d={digital} className="limiar__digital" />
            <text x={X0} y={DY1 - 10} className="limiar__caption">
              leitura da entrada
            </text>
          </svg>

          <div className={`lw__status lw__status--${status.tone}`}>
            <span className="lw__status-dot" aria-hidden="true" />
            <div>
              <p>
                <strong>{status.label}</strong>
              </p>
              <p className="lw__note">{status.note}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
