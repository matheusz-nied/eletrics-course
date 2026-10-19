/*
 * Lesson 9.1: inside a PN junction. Holes on the P side, free electrons on
 * the N side and, between them, the depletion region with its fixed ions.
 * The applied voltage widens the region (reverse) or narrows it until the
 * carriers cross (forward); the current is the 1N4148 model of
 * diodo-modelo.ts, the same one the simulations use.
 */
import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { NBSP, formatNumber, formatSI } from '../m00/formato';
import { DIODES, depletionWidth, diodeCurrent } from './diodo-modelo';
import '../m00/widget.css';
import './juncao-pn.css';

const V_MIN = -10;
const V_MAX = 0.75;
const PRESETS = [-10, -2, 0, 0.4, 0.6, 0.7];

/* Crystal bar in the SVG (viewBox 0 0 640 316). */
const LEFT = 40;
const RIGHT = 600;
const MID = 320;
const TOP = 46;
const BOTTOM = 176;
/** Pixels per micrometre of depletion width. */
const PX_PER_UM = 180;

/** Fixed lattice of sites with a little jitter, the same on every render. */
const SITES = (() => {
  const out: { x: number; y: number }[] = [];
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let x = LEFT + 16; x < RIGHT - 8; x += 26) {
    for (let y = TOP + 16; y < BOTTOM - 8; y += 25) {
      out.push({ x: x + (rand() - 0.5) * 8, y: y + (rand() - 0.5) * 8 });
    }
  }
  return out;
})();

/** Lanes of the carriers that cross the junction while it conducts. */
const LANES = [TOP + 22, TOP + 52, TOP + 82, TOP + 112];
const STREAM = 12;
const RUN = 330;

/** "+0,65 V", "−10 V", "0 V". */
function formatVolts(volts: number): string {
  if (volts === 0) return `0${NBSP}V`;
  return `${volts > 0 ? '+' : ''}${formatNumber(volts, 2)}${NBSP}V`;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/** Seconds since the animation started, while `running`. */
function useClock(running: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last: number | undefined;
    const tick = (now: number) => {
      if (last !== undefined) setT((old) => old + Math.min(now - last!, 100) / 1000);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);
  return t;
}

function stateOf(current: number): { label: string; note: string; tone: 'ok' | 'warn' | 'danger' } {
  if (current < 0) {
    return {
      label: 'Bloqueia (polarização reversa)',
      note: 'O positivo está no lado N: a camada de depleção se alarga e só passa a corrente de fuga, de poucos nanoampères.',
      tone: 'danger',
    };
  }
  if (current < 1e-6) {
    return {
      label: 'Quase não conduz',
      note: 'A tensão aplicada ainda é pequena perto da barreira da junção. Quase nenhum portador consegue atravessar.',
      tone: 'danger',
    };
  }
  if (current < 1e-3) {
    return {
      label: 'Começando a conduzir',
      note: 'A barreira baixou o bastante para alguns portadores atravessarem. Repare como a corrente cresce depressa a cada 0,1 V.',
      tone: 'warn',
    };
  }
  return {
    label: 'Conduz (polarização direta)',
    note: 'A camada de depleção quase sumiu: elétrons passam do N para o P e lacunas do P para o N, e a corrente dispara.',
    tone: 'ok',
  };
}

export default function JuncaoPN() {
  const id = useId();
  const [volts, setVolts] = useState(0);
  const reduced = usePrefersReducedMotion();

  const current = diodeCurrent(volts, DIODES.signal);
  const width = depletionWidth(volts);
  const half = (width * PX_PER_UM) / 2;
  const conducting = current >= 1e-6;
  const t = useClock(conducting && !reduced);
  const state = stateOf(current);

  // Carrier speed grows with the logarithm of the current.
  const speed = 25 + 30 * Math.max(0, Math.log10(current / 1e-6));
  const forward = volts > 0;
  const voltsText = formatVolts(volts);

  const summary = `Junção PN com ${voltsText} aplicados (lado P em relação ao lado N). ${state.label}. Camada de depleção com cerca de ${formatNumber(width, 2)} µm; corrente de ${formatSI(current, 'A')}.`;

  return (
    <section className="lw jpn" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          A junção PN por dentro
        </h3>
        <p className="lw__lead">
          Mude a tensão da bateria e acompanhe a camada de depleção, os portadores e a corrente.
          Tensão positiva quer dizer o positivo da bateria no lado P.
        </p>
      </header>

      <div className="lw__body">
        <svg className="jpn__svg" viewBox="0 0 640 316" role="img" aria-label={summary}>
          <text x={(LEFT + MID) / 2} y={TOP - 14} textAnchor="middle" className="jpn__region-label">
            Tipo P (anodo)
          </text>
          <text
            x={(MID + RIGHT) / 2}
            y={TOP - 14}
            textAnchor="middle"
            className="jpn__region-label"
          >
            Tipo N (catodo)
          </text>

          <rect x={LEFT} y={TOP} width={MID - LEFT} height={BOTTOM - TOP} className="jpn__p" />
          <rect x={MID} y={TOP} width={RIGHT - MID} height={BOTTOM - TOP} className="jpn__n" />
          <rect
            x={MID - half}
            y={TOP}
            width={2 * half}
            height={BOTTOM - TOP}
            className="jpn__dep"
          />

          {SITES.map((s, k) => {
            const inside = Math.abs(s.x - MID) < half;
            const pSide = s.x < MID;
            if (inside) {
              return pSide ? (
                <g key={k} className="jpn__ion jpn__ion--neg">
                  <rect x={s.x - 6} y={s.y - 6} width={12} height={12} rx={2} />
                  <path d={`M${s.x - 3.5} ${s.y}H${s.x + 3.5}`} />
                </g>
              ) : (
                <g key={k} className="jpn__ion jpn__ion--pos">
                  <rect x={s.x - 6} y={s.y - 6} width={12} height={12} rx={2} />
                  <path d={`M${s.x - 3.5} ${s.y}H${s.x + 3.5}M${s.x} ${s.y - 3.5}V${s.y + 3.5}`} />
                </g>
              );
            }
            return pSide ? (
              <circle key={k} cx={s.x} cy={s.y} r={5} className="jpn__hole" />
            ) : (
              <circle key={k} cx={s.x} cy={s.y} r={4.5} className="jpn__electron" />
            );
          })}

          {conducting &&
            LANES.flatMap((lane, l) =>
              Array.from({ length: STREAM }, (_, k) => {
                const offset = (k * RUN) / STREAM + l * 37;
                const d = reduced ? offset % RUN : (t * speed + offset) % RUN;
                // Electrons run from the N end towards P; holes the other way.
                const ex = RIGHT - 10 - d;
                const hx = LEFT + 10 + d;
                const fade = (x: number, towards: number) =>
                  Math.max(0, Math.min(1, 1 - (towards * (x - MID)) / 70));
                return [
                  <circle
                    key={`e${l}-${k}`}
                    cx={ex}
                    cy={lane + 6}
                    r={4.5}
                    className="jpn__electron jpn__moving"
                    opacity={fade(ex, -1)}
                  />,
                  <circle
                    key={`h${l}-${k}`}
                    cx={hx}
                    cy={lane - 6}
                    r={5}
                    className="jpn__hole jpn__moving"
                    opacity={fade(hx, 1)}
                  />,
                ];
              }),
            )}

          {/* Bracket over the depletion region */}
          <path
            d={`M${MID - half} ${BOTTOM + 8}V${BOTTOM + 14}H${MID + half}V${BOTTOM + 8}`}
            className="jpn__bracket"
          />
          <text x={MID} y={BOTTOM + 30} textAnchor="middle" className="jpn__small">
            camada de depleção ≈ {formatNumber(width, 2)} µm
          </text>

          {/* Wires and the battery */}
          <path
            d={`M${LEFT} ${(TOP + BOTTOM) / 2}H${LEFT - 22}V266H${MID - 34}M${MID + 34} 266H${RIGHT + 22}V${(TOP + BOTTOM) / 2}H${RIGHT}`}
            className="jpn__wire"
          />
          <g className="jpn__battery">
            <path d={`M${MID - 34} 266H${MID - 8}M${MID + 8} 266H${MID + 34}`} />
            <path
              d={
                forward
                  ? `M${MID - 8} 252V280M${MID + 8} 259V273`
                  : `M${MID - 8} 259V273M${MID + 8} 252V280`
              }
              className="jpn__plates"
            />
          </g>
          <text x={MID - 30} y={259} textAnchor="middle" className="jpn__sign">
            {volts === 0 ? '' : forward ? '+' : '−'}
          </text>
          <text x={MID + 30} y={259} textAnchor="middle" className="jpn__sign">
            {volts === 0 ? '' : forward ? '−' : '+'}
          </text>
          <text x={MID} y={238} textAnchor="middle" className="jpn__small">
            {volts === 0 ? 'bateria em 0 V' : voltsText}
          </text>
          {current >= 1e-3 && (
            <g className="jpn__arrow">
              <path d={`M${LEFT + 100} 298H${LEFT + 20}`} />
              <path d={`M${LEFT + 28} 293L${LEFT + 20} 298L${LEFT + 28} 303`} />
              <text x={LEFT + 108} y={303} className="jpn__small">
                sentido da corrente
              </text>
            </g>
          )}
        </svg>

        <div className="jpn__side">
          <div className="lw__controls">
            <label className="lw__range">
              <span className="lw__range-head">
                <span>Tensão aplicada (P em relação a N)</span>
                <strong className="num">{voltsText}</strong>
              </span>
              <input
                type="range"
                min={V_MIN}
                max={V_MAX}
                step={0.05}
                value={volts}
                aria-valuetext={voltsText}
                onChange={(e) => setVolts(Number(e.target.value))}
              />
            </label>
            <div className="lw__choices" role="group" aria-label="Tensões prontas">
              {PRESETS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="lw__btn"
                  aria-pressed={Math.abs(volts - v) < 1e-9}
                  onClick={() => setVolts(v)}
                >
                  {formatVolts(v)}
                </button>
              ))}
            </div>
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
            <div className="jpn__values">
              <div>
                <p className="lw__value-label">Corrente</p>
                <p className="lw__value jpn__value">{formatSI(current, 'A')}</p>
              </div>
              <div>
                <p className="lw__value-label">Camada de depleção</p>
                <p className="lw__value jpn__value">{formatNumber(width, 2)} µm</p>
              </div>
            </div>
            <p className="lw__note">
              Junção de silício de um diodo de sinal (tipo 1N4148). A largura da camada é a de uma
              junção típica, com 10¹⁶ átomos de impureza por cm³ de cada lado.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
