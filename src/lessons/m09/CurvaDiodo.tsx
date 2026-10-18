/*
 * Lesson 9.2: the diode's I×V curve, live. A source and a resistor drive the
 * chosen diode; the operating point is where the diode's curve meets the
 * resistor's load line. The curves are the engine's models (curva-diodo.ts),
 * so the widget and the simulations give the same numbers.
 */
import { useId, useState } from 'react';
import { NBSP, formatNumber, formatSI } from '../m00/formato';
import { diodeCurrent, diodeVoltage } from './diodo-modelo';
import {
  CURVE_PARTS,
  constantDropCurrent,
  curvePart,
  niceCeil,
  solve,
  type CurvePartId,
} from './curva-diodo';
import '../m00/widget.css';
import './curva-diodo.css';

const RESISTANCES = [100, 330, 1000, 10000];
const S_MIN = -5;
const S_MAX = 12;

/* Plot area inside the SVG viewBox (0 0 420 300): diode voltage from −1 V to 4 V. */
const V_LO = -1;
const V_HI = 4;
const X0 = 58;
const X1 = 404;
const Y0 = 250;
const Y1 = 18;
const px = (v: number) => X0 + ((v - V_LO) / (V_HI - V_LO)) * (X1 - X0);

/** "0,624 V", "−5 V". */
function volts(v: number, decimals = 3): string {
  return `${formatNumber(v, decimals)}${NBSP}V`;
}

/** The part's curve from −1 V up to where it leaves the top of the plot. */
function curvePath(id: CurvePartId, top: number, py: (i: number) => number): string {
  const d = curvePart(id).params;
  const vTop = Math.min(V_HI, diodeVoltage(top, d));
  const points: string[] = [];
  for (let v = V_LO; v < vTop; v += 0.01) {
    points.push(`${px(v).toFixed(1)} ${py(Math.max(0, diodeCurrent(v, d))).toFixed(1)}`);
  }
  points.push(`${px(vTop).toFixed(1)} ${py(Math.min(top, diodeCurrent(vTop, d))).toFixed(1)}`);
  return `M${points.join('L')}`;
}

/** The resistor's load line, I = (source − V)/R, clipped to the plot. */
function loadLine(source: number, ohms: number, top: number, py: (i: number) => number) {
  if (source <= V_LO) return undefined;
  const vStart = Math.max(V_LO, source - top * ohms);
  const vEnd = Math.min(V_HI, source);
  const at = (v: number) => (source - v) / ohms;
  return `M${px(vStart).toFixed(1)} ${py(at(vStart)).toFixed(1)}L${px(vEnd).toFixed(1)} ${py(at(vEnd)).toFixed(1)}`;
}

function stateOf(current: number): {
  label: string;
  note: string;
  tone: 'ok' | 'warn' | 'danger';
} {
  if (current < 0) {
    return {
      label: 'Bloqueia (polarização reversa)',
      note: 'O positivo da fonte está no catodo. Toda a tensão fica no diodo, e só passa a corrente de fuga.',
      tone: 'danger',
    };
  }
  if (current < 1e-6) {
    return {
      label: 'Quase não conduz',
      note: 'A fonte ainda não chega ao joelho da curva deste diodo.',
      tone: 'warn',
    };
  }
  return {
    label: 'Conduz (polarização direta)',
    note: 'O ponto de operação fica onde a curva do diodo cruza a reta do resistor.',
    tone: 'ok',
  };
}

export default function CurvaDiodo() {
  const id = useId();
  const [partId, setPartId] = useState<CurvePartId>('1n4007');
  const [source, setSource] = useState(5);
  const [ohms, setOhms] = useState(1000);

  const part = curvePart(partId);
  const op = solve(source, ohms, part);
  const model = constantDropCurrent(source, ohms, part.drop);
  const state = stateOf(op.current);

  // Current axis in mA, from 0 to a round value above the largest possible current.
  const topMa = niceCeil(Math.max(Math.abs(source) / ohms, 1e-3) * 1000 * 1.2);
  const top = topMa / 1000;
  const py = (i: number) => Y0 - (Math.min(Math.max(i, 0), top) / top) * (Y0 - Y1);
  const ticksI = [0, 1, 2, 3, 4, 5].map((k) => (k * topMa) / 5);
  const line = loadLine(source, ohms, top, py);
  const inside = op.voltage >= V_LO;
  const labelX = Math.min(px(diodeVoltage(top, part.params)), X1 - 4);

  const summary = `Curva de corrente em função da tensão do ${part.label}, com uma fonte de ${volts(source, 1)} e um resistor de ${formatSI(ohms, 'Ω')}. ${state.label}: corrente de ${formatSI(op.current, 'A')} e ${volts(op.voltage)} no diodo.`;

  return (
    <section className="lw cdiodo" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          A curva do diodo ao vivo
        </h3>
        <p className="lw__lead">
          Uma fonte e um resistor alimentam o diodo. Escolha o diodo, a tensão da fonte e o
          resistor, e veja onde fica o ponto de operação.
        </p>
      </header>

      <div className="lw__body cdiodo__body">
        <div className="cdiodo__figure">
          <svg className="cdiodo__plot" viewBox="0 0 420 300" role="img" aria-label={summary}>
            {[-1, 0, 1, 2, 3, 4].map((v) => (
              <g key={`v${v}`}>
                <line x1={px(v)} x2={px(v)} y1={Y1} y2={Y0} className="cdiodo__grid" />
                <text x={px(v)} y={Y0 + 17} textAnchor="middle" className="cdiodo__tick">
                  {formatNumber(v, 0)}
                </text>
              </g>
            ))}
            {ticksI.map((i) => (
              <g key={`i${i}`}>
                <line
                  x1={X0}
                  x2={X1}
                  y1={py(i / 1000)}
                  y2={py(i / 1000)}
                  className="cdiodo__grid"
                />
                <text x={X0 - 7} y={py(i / 1000) + 4} textAnchor="end" className="cdiodo__tick">
                  {formatNumber(i, 2)}
                </text>
              </g>
            ))}
            <line x1={X0} x2={X1} y1={Y0} y2={Y0} className="cdiodo__axis" />
            <line x1={px(0)} x2={px(0)} y1={Y1} y2={Y0} className="cdiodo__axis" />
            <text x={(X0 + X1) / 2} y={294} textAnchor="middle" className="cdiodo__axis-label">
              Tensão no diodo (V)
            </text>
            <text
              x={15}
              y={(Y0 + Y1) / 2}
              textAnchor="middle"
              transform={`rotate(-90 15 ${(Y0 + Y1) / 2})`}
              className="cdiodo__axis-label"
            >
              Corrente (mA)
            </text>

            {CURVE_PARTS.filter((p) => p.id !== partId).map((p) => (
              <path key={p.id} d={curvePath(p.id, top, py)} className="cdiodo__other" />
            ))}
            {line && <path d={line} className="cdiodo__load" />}
            <path d={curvePath(partId, top, py)} className="cdiodo__curve" />
            <text x={labelX} y={Y1 + 14} textAnchor="end" className="cdiodo__curve-label">
              {part.short}
            </text>

            {inside ? (
              <g>
                <path
                  d={`M${px(op.voltage)} ${Y0}V${py(op.current)}H${px(0)}`}
                  className="cdiodo__guide"
                />
                <circle cx={px(op.voltage)} cy={py(op.current)} r="6" className="cdiodo__dot" />
              </g>
            ) : (
              <g>
                <path d={`M${X0 + 2} ${Y0 - 10}l10 -6v12z`} className="cdiodo__off" />
                <text x={X0 + 16} y={Y0 - 6} className="cdiodo__tick">
                  ponto em {volts(op.voltage, 1)}, fora do gráfico
                </text>
              </g>
            )}
          </svg>
          <p className="lw__note cdiodo__legend">
            <span>
              <span className="cdiodo__key cdiodo__key--curve" aria-hidden="true" />
              curva do diodo escolhido
            </span>
            <span>
              <span className="cdiodo__key cdiodo__key--load" aria-hidden="true" />
              reta do resistor
            </span>
            <span>
              <span className="cdiodo__key cdiodo__key--other" aria-hidden="true" />
              outros diodos
            </span>
          </p>
        </div>

        <div className="cdiodo__side">
          <div className="lw__controls">
            <fieldset className="lw__group">
              <legend className="lw__legend">Diodo</legend>
              <div className="lw__choices">
                {CURVE_PARTS.map((p) => (
                  <label key={p.id} className="lw__choice">
                    <input
                      type="radio"
                      name={`${id}-diodo`}
                      checked={p.id === partId}
                      onChange={() => setPartId(p.id)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="lw__range">
              <span className="lw__range-head">
                <span>Tensão da fonte</span>
                <strong className="num">{volts(source, 1)}</strong>
              </span>
              <input
                type="range"
                min={S_MIN}
                max={S_MAX}
                step={0.1}
                value={source}
                aria-valuetext={volts(source, 1)}
                onChange={(e) => setSource(Number(e.target.value))}
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
          </div>

          <div className="lw__output" aria-live="polite">
            <div className={`lw__status lw__status--${state.tone}`}>
              <span className="lw__status-dot" aria-hidden="true" />
              <div>
                <p>
                  <strong>{state.label}</strong>
                </p>
                <p className="lw__note">{state.note}</p>
              </div>
            </div>
            <div className="cdiodo__values">
              <div>
                <p className="lw__value-label">Corrente</p>
                <p className="lw__value cdiodo__value">{formatSI(op.current, 'A')}</p>
              </div>
              <div>
                <p className="lw__value-label">Tensão no diodo</p>
                <p className="lw__value cdiodo__value">{volts(op.voltage)}</p>
              </div>
            </div>
            <p className="lw__formula">
              No resistor: {volts(source - op.voltage)} ÷ {formatSI(ohms, 'Ω')} ={' '}
              {formatSI(op.current, 'A')}
            </p>
            <p className="lw__note">
              Com o modelo de queda fixa ({volts(part.drop, 1)}), a conta daria{' '}
              <strong>{formatSI(model, 'A')}</strong>. Potência no diodo:{' '}
              {formatSI(Math.max(op.power, 0), 'W')}.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
