/*
 * Lesson 13.2: antenna length × range of a 433,92 MHz gate remote. The
 * student cuts the receiver's wire antenna, puts obstacles in the way and
 * weakens the remote's battery, and sees the link budget and the range.
 * Logic in antena.ts.
 */
import { useId, useState } from 'react';
import { formatNumber, NBSP } from '../m00/formato';
import {
  antennaGain,
  ENVIRONMENTS,
  FADE_MARGIN_DB,
  OBSTACLES,
  QUARTER,
  RESONANT,
  roundRange,
  RX_SENSITIVITY_DBM,
  solveLink,
  TX_EIRP_DBM,
} from './antena';
import '../m00/widget.css';
import './antena.css';

/* Antenna ruler (viewBox 0 0 360 96): 0 to 35 cm. */
const AX0 = 20;
const AX1 = 340;
const MAX_CM = 35;
const ax = (cm: number) => AX0 + (cm / MAX_CM) * (AX1 - AX0);

/* Range map (viewBox 0 0 360 120): 0 to 200 m. */
const MX0 = 34;
const MX1 = 344;
const MAX_M = 200;
const mx = (m: number) => MX0 + (Math.min(m, MAX_M) / MAX_M) * (MX1 - MX0);

const db = (v: number) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatNumber(Math.abs(v), 1)}${NBSP}dB`;
const meters = (m: number) => `${formatNumber(roundRange(m), 1)}${NBSP}m`;

export default function AntenaAlcance() {
  const id = useId();
  const [cm, setCm] = useState(17);
  const [environment, setEnvironment] = useState('rua');
  const [obstacles, setObstacles] = useState<string[]>([]);
  const [weakBattery, setWeakBattery] = useState(false);

  const input = { length: cm / 100, environment, obstacles, weakBattery };
  const r = solveLink(input);
  const best = solveLink({ ...input, length: RESONANT });
  const toggle = (o: string) =>
    setObstacles((list) => (list.includes(o) ? list.filter((x) => x !== o) : [...list, o]));
  const loss = antennaGain(cm / 100);
  const quality =
    loss > -1 ? 'ressoando' : loss > -6 ? 'fora de ressonância' : 'muito fora de ressonância';

  return (
    <section className="lw antena" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Comprimento da antena × alcance do controle
        </h3>
        <p className="lw__lead">
          Corte ou estique o fio da antena da central, ponha obstáculos no caminho e enfraqueça a
          bateria do controle. Modelo simplificado, com valores típicos.
        </p>
      </header>

      <div className="lw__body antena__body">
        <div className="antena__side">
          <label className="lw__range">
            <span className="lw__range-head">
              <span>Comprimento do fio da antena</span>
              <strong className="num">
                {formatNumber(cm, 1)}
                {NBSP}cm
              </strong>
            </span>
            <input
              type="range"
              min={0}
              max={MAX_CM}
              step={0.5}
              value={cm}
              aria-valuetext={`${formatNumber(cm, 1)} centímetros, ${quality}`}
              onChange={(e) => setCm(Number(e.target.value))}
            />
          </label>

          <svg
            className="antena__ruler"
            viewBox="0 0 360 96"
            role="img"
            aria-label={`Fio de ${formatNumber(cm, 1)} cm ao lado de uma régua. Um quarto de onda em 433,92 MHz é 17,3 cm; o fio real ressoa com cerca de 16,4 cm.`}
          >
            <line x1={AX0} x2={AX1} y1={60} y2={60} className="antena__axis" />
            {Array.from({ length: 8 }, (_, k) => k * 5).map((c) => (
              <g key={c}>
                <line x1={ax(c)} x2={ax(c)} y1={56} y2={64} className="antena__axis" />
                <text x={ax(c)} y={80} className="antena__t">
                  {c}
                </text>
              </g>
            ))}
            <text x={AX1} y={94} className="antena__t antena__t--end">
              cm
            </text>
            <rect
              x={ax(RESONANT * 100 * 0.93)}
              y={30}
              width={ax(RESONANT * 100 * 1.07) - ax(RESONANT * 100 * 0.93)}
              height={34}
              className="antena__sweet"
            />
            <line
              x1={ax(QUARTER * 100)}
              x2={ax(QUARTER * 100)}
              y1={22}
              y2={64}
              className="antena__quarter"
            />
            <text x={ax(QUARTER * 100) + 4} y={20} className="antena__t antena__t--start">
              λ/4 = 17,3 cm
            </text>
            <line x1={AX0} x2={ax(cm)} y1={44} y2={44} className="antena__wire" />
            <circle cx={AX0} cy={44} r={4} className="antena__solder" />
          </svg>

          <fieldset className="lw__group">
            <legend className="lw__legend">Onde o controle está</legend>
            <div className="lw__choices">
              {ENVIRONMENTS.map((e) => (
                <label key={e.id} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-ambiente`}
                    checked={environment === e.id}
                    onChange={() => setEnvironment(e.id)}
                  />
                  {e.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="lw__group">
            <legend className="lw__legend">Obstáculos entre o controle e a central</legend>
            <div className="lw__choices lw__choices--stack">
              {OBSTACLES.filter((o) => o.loss > 0).map((o) => (
                <label key={o.id} className="lw__check">
                  <input
                    type="checkbox"
                    checked={obstacles.includes(o.id)}
                    onChange={() => toggle(o.id)}
                  />
                  {o.label} (−{o.loss}
                  {NBSP}dB)
                </label>
              ))}
              <label className="lw__check">
                <input
                  type="checkbox"
                  checked={weakBattery}
                  onChange={(e) => setWeakBattery(e.target.checked)}
                />
                Bateria do controle fraca (−6{NBSP}dB)
              </label>
            </div>
          </fieldset>
        </div>

        <div className="antena__side">
          <svg
            className="antena__map"
            viewBox="0 0 360 120"
            role="img"
            aria-label={`Alcance estimado de ${meters(r.range)}, numa escala de 0 a 200 m. Com a antena no comprimento certo, seria ${meters(best.range)}.`}
          >
            <rect
              x={MX0}
              y={42}
              width={mx(best.range) - MX0}
              height={24}
              className="antena__best"
            />
            <rect x={MX0} y={42} width={mx(r.range) - MX0} height={24} className="antena__reach" />
            {[0, 50, 100, 150, 200].map((m) => (
              <g key={m}>
                <line x1={mx(m)} x2={mx(m)} y1={70} y2={76} className="antena__axis" />
                <text x={mx(m)} y={90} className="antena__t">
                  {m}
                </text>
              </g>
            ))}
            <text x={MX1} y={106} className="antena__t antena__t--end">
              metros até a central
            </text>
            <rect x={10} y={40} width={22} height={28} rx={3} className="antena__box" />
            <line
              x1={24}
              x2={24}
              y1={40}
              y2={40 - Math.min(cm, MAX_CM) * 0.9}
              className="antena__wire"
            />
            {r.range > MAX_M && (
              <text x={MX1} y={34} className="antena__t antena__t--end">
                passa de 200 m →
              </text>
            )}
            <g transform={`translate(${mx(r.range)} 54)`}>
              <rect x={-6} y={-10} width={12} height={20} rx={3} className="antena__remote" />
              <circle cx={0} cy={-4} r={2} className="antena__remote-led" />
            </g>
          </svg>

          <div className="lw__output" aria-live="polite">
            <div>
              <p className="lw__value-label">Alcance estimado</p>
              <p className="lw__value" data-alcance>
                {meters(r.range)}
              </p>
            </div>
            <dl className="antena__budget">
              <dt>Controle (potência irradiada, típica)</dt>
              <dd>
                {formatNumber(TX_EIRP_DBM, 0)}
                {NBSP}dBm
              </dd>
              <dt>Receptor (sensibilidade, típica)</dt>
              <dd>
                {formatNumber(RX_SENSITIVITY_DBM, 0)}
                {NBSP}dBm
              </dd>
              <dt>Margem para o sinal oscilar</dt>
              <dd>{db(-FADE_MARGIN_DB)}</dd>
              <dt>Antena ({quality})</dt>
              <dd data-perda-antena>{db(r.antenna)}</dd>
              <dt>Obstáculos</dt>
              <dd>{db(r.obstacles)}</dd>
              <dt>Bateria</dt>
              <dd>{db(r.battery)}</dd>
              <dt>Sobra para a distância</dt>
              <dd>{db(r.budget)}</dd>
            </dl>
            <p className="lw__note">
              Na rua, cada 6 dB a menos corta o alcance em cerca de um terço. O fio ressoa com cerca
              de 16,4 cm, um pouco menos que o quarto de onda, porque a ponta do fio também acumula
              carga. Com o fio no ponto certo, o alcance aqui seria {meters(best.range)}.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
