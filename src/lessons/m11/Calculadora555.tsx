/*
 * Lesson 11.5: 555 timing calculator. The student picks the mode
 * (astable or monostable), the resistors and the capacitor from standard
 * values, and sees the times, the frequency and the duty cycle.
 */
import { useId, useState } from 'react';
import { formatNumber, formatSI } from '../m00/formato';
import { astable, monostable } from './calc555';
import '../m00/widget.css';
import './calc555.css';

const RESISTORS = [1e3, 2.2e3, 4.7e3, 10e3, 15e3, 22e3, 33e3, 47e3, 68e3, 100e3, 220e3, 470e3, 1e6];
const CAPACITORS = [10e-9, 100e-9, 1e-6, 4.7e-6, 10e-6, 47e-6, 100e-6, 470e-6];

type Mode = 'astavel' | 'monoestavel';

function Pick({
  label,
  value,
  values,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  values: number[];
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="lw__field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {values.map((v) => (
          <option key={v} value={v}>
            {formatSI(v, unit)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Seconds as "0,54 s", "540 ms" or "1 min 2 s". */
function time(t: number) {
  if (t >= 60) return `${Math.floor(t / 60)} min ${formatNumber(t % 60, 0)} s`;
  return formatSI(t, 's');
}

export default function Calculadora555() {
  const id = useId();
  const [mode, setMode] = useState<Mode>('astavel');
  const [r1, setR1] = useState(10e3);
  const [r2, setR2] = useState(68e3);
  const [c, setC] = useState(10e-6);
  const a = astable(r1, r2, c);
  const t = monostable(r1, c);

  return (
    <section className="lw calc555" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Calcule</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Tempos do 555
        </h3>
        <p className="lw__lead">
          Escolha o modo, os resistores e o capacitor. A calculadora usa as fórmulas desta aula.
        </p>
      </header>

      <div className="lw__body">
        <fieldset className="lw__group">
          <legend className="lw__legend">Modo</legend>
          <div className="lw__choices">
            <label className="lw__choice">
              <input
                type="radio"
                name={`${id}-modo`}
                checked={mode === 'astavel'}
                onChange={() => setMode('astavel')}
              />
              Astável (pisca)
            </label>
            <label className="lw__choice">
              <input
                type="radio"
                name={`${id}-modo`}
                checked={mode === 'monoestavel'}
                onChange={() => setMode('monoestavel')}
              />
              Monoestável (temporizador)
            </label>
          </div>
        </fieldset>

        <div className="calc555__fields">
          <Pick
            label={mode === 'astavel' ? 'R1 (do VCC ao pino 7)' : 'R (do VCC aos pinos 6 e 7)'}
            value={r1}
            values={RESISTORS}
            unit="Ω"
            onChange={setR1}
          />
          {mode === 'astavel' && (
            <Pick
              label="R2 (do pino 7 aos pinos 6 e 2)"
              value={r2}
              values={RESISTORS}
              unit="Ω"
              onChange={setR2}
            />
          )}
          <Pick label="C (dos pinos 6 e 2 ao GND)" value={c} values={CAPACITORS} unit="F" onChange={setC} />
        </div>

        <div className="lw__output" aria-live="polite">
          {mode === 'astavel' ? (
            <>
              <div className="calc555__values">
                <div>
                  <p className="lw__value-label">Frequência</p>
                  <p className="lw__value">{formatSI(a.frequency, 'Hz')}</p>
                </div>
                <div>
                  <p className="lw__value-label">Ciclo de trabalho</p>
                  <p className="lw__value">{formatNumber(a.duty * 100, 0)} %</p>
                </div>
              </div>
              <div className="calc555__bar" aria-hidden="true">
                <span style={{ flexGrow: a.high }}>alto</span>
                <span style={{ flexGrow: a.low }}>baixo</span>
              </div>
              <p className="lw__formula">
                Alto: 0,693 · (R1 + R2) · C = {time(a.high)}. Baixo: 0,693 · R2 · C ={' '}
                {time(a.low)}.
              </p>
              {r2 < r1 / 10 && (
                <p className="lw__note">
                  Com R2 muito menor que R1, o ciclo de trabalho fica perto de 100 %: o LED quase
                  não apaga.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="lw__value-label">Tempo da saída em nível alto</p>
              <p className="lw__value">{time(t)}</p>
              <p className="lw__formula">t = 1,1 · R · C = {time(t)}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
