/*
 * Lesson 6.5 (AC power and power factor): the power triangle of a load.
 * The student picks a load (typical values) or sets its active power and
 * power factor, then adds a capacitor in parallel and watches the reactive
 * side shrink, the power factor rise and the mains current fall while the
 * active power stays the same. Maths in triangulo-potencias.ts.
 */
import { useId, useState } from 'react';
import { formatNumber, formatSI } from '../m00/formato';
import { LOADS, capacitorFor, corrected, loadTriangle } from './triangulo-potencias';
import '../m00/widget.css';
import './triangulo-potencias.css';

const VOLTAGES = [127, 220] as const;
const C_MAX = 200; // µF

/* Drawing (viewBox 0 0 360 220): P to the right from the origin, Q upwards. */
const OX = 30;
const OY = 190;
const W = 300;
const H = 170;

const fmtPf = (pf: number) => formatNumber(pf, 2);
const fmtW = (w: number) => `${formatNumber(w, 0)} W`;
const fmtVar = (q: number) => `${formatNumber(Math.abs(q), 0)} var`;
const fmtVA = (s: number) => `${formatNumber(s, 0)} VA`;
const fmtUf = (f: number) => `${formatNumber(f * 1e6, 1)} µF`;

export default function TrianguloPotencias() {
  const id = useId();
  const first = LOADS[0];
  const [load, setLoad] = useState<string>(first.id);
  const [p, setP] = useState<number>(first.p);
  const [pf, setPf] = useState<number>(first.pf);
  const [volts, setVolts] = useState<(typeof VOLTAGES)[number]>(127);
  const [uf, setUf] = useState(0);

  const choose = (loadId: string) => {
    const l = LOADS.find((x) => x.id === loadId);
    if (!l) return;
    setLoad(l.id);
    setP(l.p);
    setPf(l.pf);
    setUf(0);
  };

  const before = loadTriangle(p, pf, volts);
  const after = corrected(p, pf, volts, uf * 1e-6, 60);
  const c92 = capacitorFor(p, pf, 0.92, volts);
  const c100 = capacitorFor(p, pf, 1, volts);

  // One scale for both triangles, so the capacitor visibly shortens Q.
  const qMax = Math.max(before.q, Math.abs(after.q), 1);
  const k = Math.min(W / Math.max(p, 1), H / qMax) * 0.95;
  const px = OX + p * k;
  const qyBefore = OY - before.q * k;
  const qyAfter = OY - after.q * k;

  const state = uf === 0 ? null : after.q < -0.02 * p ? 'over' : after.pf >= 0.92 ? 'ok' : 'low';

  return (
    <section className="lw tri-pot" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          O triângulo das potências
        </h3>
        <p className="lw__lead">
          Escolha uma carga, com valores típicos, ou ajuste a potência e o fator de potência. Depois
          ligue um capacitor em paralelo e veja o que muda na corrente da rede.
        </p>
      </header>

      <div className="lw__body">
        <fieldset className="lw__group">
          <legend className="lw__legend">Carga</legend>
          <div className="lw__choices">
            {LOADS.map((l) => (
              <label key={l.id} className="lw__choice">
                <input
                  type="radio"
                  name={`${id}-carga`}
                  checked={load === l.id}
                  onChange={() => choose(l.id)}
                />
                {l.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="lw__controls lw__controls--cols">
          <label className="lw__range">
            <span className="lw__range-head">
              <span>Potência ativa</span>
              <span className="num">{fmtW(p)}</span>
            </span>
            <input
              type="range"
              min={10}
              max={6000}
              step={10}
              value={p}
              aria-valuetext={fmtW(p)}
              onChange={(e) => {
                setP(Number(e.target.value));
                setLoad('');
              }}
            />
          </label>
          <label className="lw__range">
            <span className="lw__range-head">
              <span>Fator de potência da carga</span>
              <span className="num">{fmtPf(pf)}</span>
            </span>
            <input
              type="range"
              min={0.4}
              max={1}
              step={0.01}
              value={pf}
              aria-valuetext={fmtPf(pf)}
              onChange={(e) => {
                setPf(Number(e.target.value));
                setLoad('');
              }}
            />
          </label>
          <fieldset className="lw__group">
            <legend className="lw__legend">Tensão da rede</legend>
            <div className="lw__choices">
              {VOLTAGES.map((v) => (
                <label key={v} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-tensao`}
                    checked={volts === v}
                    onChange={() => setVolts(v)}
                  />
                  {v} V
                </label>
              ))}
            </div>
          </fieldset>
          <label className="lw__range">
            <span className="lw__range-head">
              <span>Capacitor em paralelo</span>
              <span className="num">{uf === 0 ? 'nenhum' : `${uf} µF`}</span>
            </span>
            <input
              type="range"
              min={0}
              max={C_MAX}
              step={1}
              value={uf}
              aria-valuetext={uf === 0 ? 'nenhum' : `${uf} microfarads`}
              onChange={(e) => setUf(Number(e.target.value))}
            />
          </label>
        </div>

        <svg className="tri-pot__fig" viewBox="0 0 360 220" aria-hidden="true">
          <path d={`M${OX} ${OY} H${OX + W + 12}`} className="tri-pot__axis" />
          <path d={`M${OX} ${OY + 10} V${OY - H - 12}`} className="tri-pot__axis" />
          {uf > 0 && (
            <>
              <path
                d={`M${OX} ${OY} L${px} ${qyBefore} L${px} ${OY} Z`}
                className="tri-pot__ghost"
              />
              <path d={`M${px + 10} ${qyBefore} V${qyAfter}`} className="tri-pot__cap" />
              <text x={px + 16} y={(qyBefore + qyAfter) / 2 + 4} className="tri-pot__lbl start">
                Qc
              </text>
            </>
          )}
          <path d={`M${OX} ${OY} H${px}`} className="tri-pot__p" />
          <path d={`M${px} ${OY} V${qyAfter}`} className="tri-pot__q" />
          <path d={`M${OX} ${OY} L${px} ${qyAfter}`} className="tri-pot__s" />
          <text x={(OX + px) / 2} y={OY + 16} className="tri-pot__lbl">
            P
          </text>
          <text x={px - 8} y={(OY + qyAfter) / 2 + 4} className="tri-pot__lbl end">
            Q
          </text>
          <text
            x={(OX + px) / 2 - 8}
            y={(OY + qyAfter) / 2 - 6}
            className="tri-pot__lbl end tri-pot__lbl--s"
          >
            S
          </text>
        </svg>

        <div className="lw__output" aria-live="polite">
          <dl className="tri-pot__values">
            <div>
              <dt className="lw__value-label">Potência ativa (P)</dt>
              <dd className="num">{fmtW(after.p)}</dd>
            </div>
            <div>
              <dt className="lw__value-label">Potência reativa (Q)</dt>
              <dd className="num">
                {fmtVar(after.q)}
                {Math.abs(after.q) > 0.5 && (after.q > 0 ? ' indutiva' : ' capacitiva')}
              </dd>
            </div>
            <div>
              <dt className="lw__value-label">Potência aparente (S)</dt>
              <dd className="num">{fmtVA(after.s)}</dd>
            </div>
            <div>
              <dt className="lw__value-label">Fator de potência</dt>
              <dd className="num" data-pf>
                {fmtPf(after.pf)}
              </dd>
            </div>
            <div>
              <dt className="lw__value-label">Corrente da rede</dt>
              <dd className="num" data-current>
                {formatSI(after.current, 'A')}
                {uf > 0 && (
                  <span className="tri-pot__was"> (era {formatSI(before.current, 'A')})</span>
                )}
              </dd>
            </div>
          </dl>
          <p className="lw__formula">
            S = √(P² + Q²) = √({formatNumber(after.p, 0)}² + {formatNumber(Math.abs(after.q), 0)}²)
            = {fmtVA(after.s)} · FP = P ÷ S = {fmtPf(after.pf)}
          </p>
          <p className="lw__note" data-capacitors>
            {c100 === 0
              ? 'Esta carga já tem fator de potência 1: não há o que corrigir.'
              : `Para chegar a 0,92: cerca de ${fmtUf(c92)}. Para chegar a 1: cerca de ${fmtUf(c100)}.`}
          </p>
          {state && (
            <div
              className={`lw__status lw__status--${state === 'ok' ? 'ok' : state === 'over' ? 'danger' : 'warn'}`}
            >
              <span className="lw__status-dot" aria-hidden="true" />
              <p>
                {state === 'ok' &&
                  'Corrigido: a rede entrega a mesma potência ativa com menos corrente.'}
                {state === 'low' &&
                  'Melhorou, mas o fator de potência ainda está abaixo de 0,92. Aumente o capacitor.'}
                {state === 'over' &&
                  'Passou do ponto: agora sobra potência reativa capacitiva, e a corrente volta a subir.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
