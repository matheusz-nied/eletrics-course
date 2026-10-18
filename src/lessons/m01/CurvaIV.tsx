/*
 * Lesson 1.4 (Ohm's law): the I×V graph. A resistor gives a straight line
 * through the origin (current proportional to voltage); the 12 V lamp of the
 * lesson bends, because its filament resistance grows as it heats up.
 */
import { useId, useState } from 'react';
import { formatSI } from '../m00/formato';
import { LAMP_POWER, LAMP_VOLTAGE, lampCurrent, ohmCurrent } from './curva-iv';
import '../m00/widget.css';
import './curva-iv.css';

const RESISTANCES = [15, 30, 60, 120];
const V_MAX = 12;
const I_MAX = 0.8;

/* Plot area inside the SVG viewBox (0 0 360 250). */
const X0 = 52;
const X1 = 344;
const Y0 = 212;
const Y1 = 14;
const px = (v: number) => X0 + (v / V_MAX) * (X1 - X0);
const py = (i: number) => Y0 - (Math.min(i, I_MAX) / I_MAX) * (Y0 - Y1);

const LAMP_PATH = Array.from({ length: 61 }, (_, k) => (k / 60) * V_MAX)
  .map((v, k) => `${k === 0 ? 'M' : 'L'}${px(v).toFixed(1)} ${py(lampCurrent(v)).toFixed(1)}`)
  .join('');

function resistorPath(ohms: number): string {
  const vEnd = Math.min(V_MAX, I_MAX * ohms);
  return `M${px(0)} ${py(0)}L${px(vEnd).toFixed(1)} ${py(ohmCurrent(vEnd, ohms)).toFixed(1)}`;
}

export default function CurvaIV() {
  const id = useId();
  const [volts, setVolts] = useState(6);
  const [ohms, setOhms] = useState(30);
  const [showLamp, setShowLamp] = useState(false);

  const current = ohmCurrent(volts, ohms);
  const lamp = lampCurrent(volts);
  const lampOhms = lamp > 0 ? volts / lamp : undefined;

  const summary = showLamp
    ? `Gráfico de corrente em função da tensão. O resistor de ${formatSI(ohms, 'Ω')} forma uma reta que sai do zero; a lâmpada forma uma curva que sobe depressa no começo e depois se inclina menos. Com ${formatSI(volts, 'V')}: resistor ${formatSI(current, 'A')}, lâmpada ${formatSI(lamp, 'A')}.`
    : `Gráfico de corrente em função da tensão. O resistor de ${formatSI(ohms, 'Ω')} forma uma reta que sai do zero. Com ${formatSI(volts, 'V')}, a corrente é ${formatSI(current, 'A')}.`;

  return (
    <section className="lw curva-iv" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          A curva I×V
        </h3>
        <p className="lw__lead">
          Cada ponto do gráfico é uma medida: a tensão aplicada e a corrente que passou. Mude a
          tensão e a resistência e veja onde o ponto cai.
        </p>
      </header>

      <div className="lw__body curva-iv__body">
        <svg className="curva-iv__plot" viewBox="0 0 360 250" role="img" aria-label={summary}>
          {[0, 2, 4, 6, 8, 10, 12].map((v) => (
            <g key={`v${v}`}>
              <line x1={px(v)} x2={px(v)} y1={Y1} y2={Y0} className="curva-iv__grid" />
              <text x={px(v)} y={Y0 + 16} textAnchor="middle" className="curva-iv__tick">
                {v}
              </text>
            </g>
          ))}
          {[0, 0.2, 0.4, 0.6, 0.8].map((i) => (
            <g key={`i${i}`}>
              <line x1={X0} x2={X1} y1={py(i)} y2={py(i)} className="curva-iv__grid" />
              <text x={X0 - 6} y={py(i) + 4} textAnchor="end" className="curva-iv__tick">
                {i.toLocaleString('pt-BR')}
              </text>
            </g>
          ))}
          <line x1={X0} x2={X1} y1={Y0} y2={Y0} className="curva-iv__axis" />
          <line x1={X0} x2={X0} y1={Y1} y2={Y0} className="curva-iv__axis" />
          <text x={(X0 + X1) / 2} y={246} textAnchor="middle" className="curva-iv__axis-label">
            Tensão (V)
          </text>
          <text
            x={14}
            y={(Y0 + Y1) / 2}
            textAnchor="middle"
            transform={`rotate(-90 14 ${(Y0 + Y1) / 2})`}
            className="curva-iv__axis-label"
          >
            Corrente (A)
          </text>

          <line x1={px(volts)} x2={px(volts)} y1={Y1} y2={Y0} className="curva-iv__cursor" />
          {showLamp && <path d={LAMP_PATH} className="curva-iv__lamp" />}
          <path d={resistorPath(ohms)} className="curva-iv__line" />
          {showLamp && lamp > 0 && (
            <circle cx={px(volts)} cy={py(lamp)} r="5.5" className="curva-iv__dot-lamp" />
          )}
          {current <= I_MAX && (
            <circle cx={px(volts)} cy={py(current)} r="5.5" className="curva-iv__dot" />
          )}
        </svg>

        <div className="curva-iv__side">
          <div className="lw__controls">
            <label className="lw__range">
              <span className="lw__range-head">
                <span>Tensão aplicada</span>
                <strong className="num">{formatSI(volts, 'V')}</strong>
              </span>
              <input
                type="range"
                min={0}
                max={V_MAX}
                step={0.5}
                value={volts}
                aria-valuetext={formatSI(volts, 'V')}
                onChange={(e) => setVolts(Number(e.target.value))}
              />
            </label>

            <fieldset className="lw__group">
              <legend className="lw__legend">Resistor</legend>
              <div className="lw__choices">
                {RESISTANCES.map((r) => (
                  <label key={r} className="lw__choice">
                    <input
                      type="radio"
                      name={`${id}-r`}
                      checked={r === ohms}
                      onChange={() => setOhms(r)}
                    />
                    {formatSI(r, 'Ω')}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="lw__check">
              <input
                type="checkbox"
                checked={showLamp}
                onChange={(e) => setShowLamp(e.target.checked)}
              />
              Comparar com uma lâmpada de {LAMP_VOLTAGE} V e {LAMP_POWER} W
            </label>
          </div>

          <div className="lw__output" aria-live="polite">
            <div>
              <p className="lw__value-label">
                <span className="curva-iv__key curva-iv__key--line" aria-hidden="true" />
                Corrente no resistor
              </p>
              <p className="lw__value">{formatSI(current, 'A')}</p>
            </div>
            <p className="lw__formula">
              I = {formatSI(volts, 'V')} ÷ {formatSI(ohms, 'Ω')} = {formatSI(current, 'A')}
            </p>
            {current > I_MAX && <p className="lw__note">O ponto passou do topo do gráfico.</p>}
            {showLamp && (
              <div>
                <p className="lw__value-label">
                  <span className="curva-iv__key curva-iv__key--lamp" aria-hidden="true" />
                  Corrente na lâmpada
                </p>
                <p className="lw__value">{formatSI(lamp, 'A')}</p>
                <p className="lw__note">
                  {lampOhms === undefined
                    ? 'Sem tensão, sem corrente: o filamento está frio.'
                    : `Resistência do filamento nesta tensão: ${formatSI(lampOhms, 'Ω')}. Ela muda com a tensão porque o filamento esquenta.`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
