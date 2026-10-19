/*
 * Lesson 10.4: the I×V and P×V curves of a 330 W, 60-cell module, live. The
 * student changes the sunlight, the cell temperature and a shadow on one
 * cell, and can take out the bypass diodes. The curves come from solar.ts
 * (single-diode cells, three strings with bypass diodes).
 */
import { useId, useMemo, useState } from 'react';
import { NBSP, formatNumber } from '../m00/formato';
import { panelCurve } from './solar';
import '../m00/widget.css';
import './curva-painel.css';

/* Plot area inside the SVG viewBox (0 0 440 300): 0 to 45 V, 0 to 12 A, 0 to 360 W. */
const V_MAX = 45;
const I_MAX = 12;
const P_MAX = 360;
const X0 = 50;
const X1 = 390;
const Y0 = 250;
const Y1 = 16;
const px = (v: number) => X0 + (v / V_MAX) * (X1 - X0);
const pyI = (i: number) => Y0 - (Math.max(0, i) / I_MAX) * (Y0 - Y1);
const pyP = (p: number) => Y0 - (Math.max(0, p) / P_MAX) * (Y0 - Y1);

const fmt = (value: number, unit: string, decimals = 1) =>
  `${formatNumber(value, decimals)}${NBSP}${unit}`;

export default function CurvaPainel() {
  const id = useId();
  const [irradiance, setIrradiance] = useState(1000);
  const [temperature, setTemperature] = useState(25);
  const [shade, setShade] = useState(0);
  const [bypass, setBypass] = useState(true);

  const curve = useMemo(
    () => panelCurve({ irradiance, temperature, shade: shade / 100, bypass }),
    [irradiance, temperature, shade, bypass],
  );
  const full = useMemo(
    () => panelCurve({ irradiance, temperature, shade: 0, bypass: true }),
    [irradiance, temperature],
  );

  const iPath = `M${curve.points.map((q) => `${px(q.v).toFixed(1)} ${pyI(q.i).toFixed(1)}`).join('L')}`;
  const pPath = `M${curve.points.map((q) => `${px(q.v).toFixed(1)} ${pyP(q.p).toFixed(1)}`).join('L')}`;
  const falsePeaks = curve.peaks.filter((q) => q !== curve.mpp);
  const loss = full.mpp.p > 0 ? 1 - curve.mpp.p / full.mpp.p : 0;

  let status: { tone: 'ok' | 'warn' | 'danger'; label: string; note: string };
  if (curve.shadedCellHeat > 60) {
    status = {
      tone: 'danger',
      label: 'Ponto quente',
      note: `Sem diodo de bypass, a célula sombreada é atravessada pela corrente das outras e dissipa cerca de ${fmt(curve.shadedCellHeat, 'W', 0)}. É assim que um painel queima e trinca o vidro.`,
    };
  } else if (falsePeaks.length > 0) {
    status = {
      tone: 'warn',
      label: 'A curva tem mais de um pico',
      note: `Além do máximo verdadeiro, há um pico menor de ${fmt(falsePeaks[0]!.p, 'W', 0)} em ${fmt(falsePeaks[0]!.v, 'V')}. Um rastreador simples, que só sobe a ladeira mais próxima, pode parar nele.`,
    };
  } else {
    status = {
      tone: 'ok',
      label: 'Curva normal',
      note: 'Um pico só: o rastreador do inversor (MPPT) acha o ponto de máxima potência sem confusão.',
    };
  }

  const summary = `Curvas de corrente e de potência de um painel de 60 células com ${irradiance} W/m², ${temperature} °C e ${shade} % de uma célula na sombra${bypass ? '' : ', sem diodos de bypass'}. Máxima potência de ${fmt(curve.mpp.p, 'W', 0)} em ${fmt(curve.mpp.v, 'V')} e ${fmt(curve.mpp.i, 'A', 2)}. Tensão em aberto ${fmt(curve.voc, 'V')}, corrente de curto ${fmt(curve.isc, 'A', 2)}.`;

  return (
    <section className="lw cpainel" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          A curva do painel solar
        </h3>
        <p className="lw__lead">
          Um painel de 330 W e 60 células, como os de telhado. Mude o sol, a temperatura e a sombra,
          e veja onde fica o ponto de máxima potência.
        </p>
      </header>

      <div className="lw__body cpainel__body">
        <div className="cpainel__figure">
          <svg className="cpainel__plot" viewBox="0 0 440 300" role="img" aria-label={summary}>
            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45].map((v) => (
              <g key={`v${v}`}>
                <line x1={px(v)} x2={px(v)} y1={Y1} y2={Y0} className="cpainel__grid" />
                <text x={px(v)} y={Y0 + 16} textAnchor="middle" className="cpainel__tick">
                  {v}
                </text>
              </g>
            ))}
            {[0, 2, 4, 6, 8, 10, 12].map((i) => (
              <g key={`i${i}`}>
                <line x1={X0} x2={X1} y1={pyI(i)} y2={pyI(i)} className="cpainel__grid" />
                <text
                  x={X0 - 6}
                  y={pyI(i) + 4}
                  textAnchor="end"
                  className="cpainel__tick cpainel__tick--i"
                >
                  {i}
                </text>
                <text x={X1 + 6} y={pyI(i) + 4} className="cpainel__tick cpainel__tick--p">
                  {(i / I_MAX) * P_MAX}
                </text>
              </g>
            ))}
            <line x1={X0} x2={X1} y1={Y0} y2={Y0} className="cpainel__axis" />
            <text x={(X0 + X1) / 2} y={292} textAnchor="middle" className="cpainel__axis-label">
              Tensão do painel (V)
            </text>
            <text
              x={14}
              y={(Y0 + Y1) / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${(Y0 + Y1) / 2})`}
              className="cpainel__axis-label cpainel__axis-label--i"
            >
              Corrente (A)
            </text>
            <text
              x={430}
              y={(Y0 + Y1) / 2}
              textAnchor="middle"
              transform={`rotate(90 430 ${(Y0 + Y1) / 2})`}
              className="cpainel__axis-label cpainel__axis-label--p"
            >
              Potência (W)
            </text>

            <path d={iPath} className="cpainel__curve-i" />
            <path d={pPath} className="cpainel__curve-p" />
            {falsePeaks.map((q) => (
              <circle key={q.v} cx={px(q.v)} cy={pyP(q.p)} r="5" className="cpainel__false" />
            ))}
            <path d={`M${px(curve.mpp.v)} ${Y0}V${pyI(curve.mpp.i)}`} className="cpainel__guide" />
            <circle cx={px(curve.mpp.v)} cy={pyI(curve.mpp.i)} r="5" className="cpainel__dot-i" />
            <circle cx={px(curve.mpp.v)} cy={pyP(curve.mpp.p)} r="6" className="cpainel__dot-p" />
          </svg>
          <p className="lw__note cpainel__legend">
            <span>
              <span className="cpainel__key cpainel__key--i" aria-hidden="true" />
              corrente × tensão
            </span>
            <span>
              <span className="cpainel__key cpainel__key--p" aria-hidden="true" />
              potência × tensão
            </span>
            <span>
              <span className="cpainel__key cpainel__key--dot" aria-hidden="true" />
              máxima potência
            </span>
          </p>
        </div>

        <div className="cpainel__side">
          <div className="lw__controls">
            <label className="lw__range">
              <span className="lw__range-head">
                <span>Sol (irradiância)</span>
                <strong className="num">{fmt(irradiance, 'W/m²', 0)}</strong>
              </span>
              <input
                type="range"
                min={100}
                max={1000}
                step={50}
                value={irradiance}
                aria-valuetext={fmt(irradiance, 'watts por metro quadrado', 0)}
                onChange={(e) => setIrradiance(Number(e.target.value))}
              />
            </label>
            <label className="lw__range">
              <span className="lw__range-head">
                <span>Temperatura das células</span>
                <strong className="num">{fmt(temperature, '°C', 0)}</strong>
              </span>
              <input
                type="range"
                min={0}
                max={75}
                step={5}
                value={temperature}
                aria-valuetext={fmt(temperature, 'graus Celsius', 0)}
                onChange={(e) => setTemperature(Number(e.target.value))}
              />
            </label>
            <label className="lw__range">
              <span className="lw__range-head">
                <span>Sombra numa célula</span>
                <strong className="num">{shade} %</strong>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={shade}
                aria-valuetext={`${shade} por cento de uma célula na sombra`}
                onChange={(e) => setShade(Number(e.target.value))}
              />
            </label>
            <label className="lw__check">
              <input
                type="checkbox"
                checked={bypass}
                onChange={(e) => setBypass(e.target.checked)}
              />
              Diodos de bypass na caixa de junção
            </label>
          </div>

          <div className="lw__output" aria-live="polite">
            <div className={`lw__status lw__status--${status.tone}`}>
              <span className="lw__status-dot" aria-hidden="true" />
              <div>
                <p>
                  <strong>{status.label}</strong>
                </p>
                <p className="lw__note">{status.note}</p>
              </div>
            </div>
            <div className="cpainel__values">
              <div>
                <p className="lw__value-label">Máxima potência</p>
                <p className="lw__value cpainel__value">{fmt(curve.mpp.p, 'W', 0)}</p>
              </div>
              <div>
                <p className="lw__value-label">No ponto</p>
                <p className="lw__value cpainel__value">
                  {fmt(curve.mpp.v, 'V')} · {fmt(curve.mpp.i, 'A', 2)}
                </p>
              </div>
              <div>
                <p className="lw__value-label">Em aberto (Voc)</p>
                <p className="lw__value cpainel__value">{fmt(curve.voc, 'V')}</p>
              </div>
              <div>
                <p className="lw__value-label">Em curto (Isc)</p>
                <p className="lw__value cpainel__value">{fmt(curve.isc, 'A', 2)}</p>
              </div>
            </div>
            {shade > 0 && (
              <p className="lw__formula">
                A sombra tira {Math.round(loss * 100)} % da potência, embora cubra{' '}
                {formatNumber(shade / 60, 1)} % da área do painel.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
