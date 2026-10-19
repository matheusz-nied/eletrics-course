/*
 * Lesson 8.3 (three-phase induction motor): three coils 120° apart, fed by
 * the three phases. Each thin arrow is one coil's field, the thick arrow is
 * their sum: the stator field. Play makes the waves run (in slow motion) and
 * the sum turn; the instant slider moves through one cycle by hand. Swapping
 * two phases makes it turn the other way; with one phase missing it only
 * pulses along a line. Physics in campo-girante.ts.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatNumber } from '../m00/formato';
import { usePrefersReducedMotion } from './reduced-motion';
import {
  COIL_AXES,
  PHASES,
  coilCurrents,
  coilField,
  direction,
  fieldLocus,
  magnitude,
  rotation,
  statorField,
  type Feed,
} from './campo-girante';
import '../m00/widget.css';
import './campo-girante.css';

/* Stator drawing (viewBox 0 0 320 320). */
const C = 160;
const SCALE = 52; // px per one coil's peak field
const RING_IN = 112;
const RING_OUT = 138;

/* Waves (viewBox 0 0 360 200). */
const WX0 = 34;
const WX1 = 338;
const WY = 96;
const WA = 62;
const wx = (theta: number) => WX0 + (theta / 360) * (WX1 - WX0);
const wy = (i: number) => WY - i * WA;

const FEEDS: { id: Feed; label: string }[] = [
  { id: 'normal', label: 'L1, L2 e L3 ligadas' },
  { id: 'invertida', label: 'L2 e L3 trocadas' },
  { id: 'falta-fase', label: 'Faltando a fase L3' },
];

/** On-screen cycles per second (the real 60 Hz is far too fast to follow). */
const SPEEDS = [
  { id: 'lento', label: 'Bem devagar', cps: 0.1 },
  { id: 'medio', label: 'Devagar', cps: 0.25 },
  { id: 'rapido', label: 'Mais rápido', cps: 0.8 },
] as const;

const DEG = Math.PI / 180;
const px = (v: { x: number; y: number }) => ({ x: C + v.x * SCALE, y: C - v.y * SCALE });

function wavePath(k: 0 | 1 | 2, feed: Feed): string {
  let d = '';
  for (let t = 0; t <= 360; t += 4) {
    const i = coilCurrents(t, feed)[k];
    d += `${d ? 'L' : 'M'}${wx(t).toFixed(1)} ${wy(i).toFixed(1)}`;
  }
  return d;
}

/** Arrow from the centre to `tip` (px), with a head that scales down when short. */
function arrow(tip: { x: number; y: number }, head: number): string {
  const dx = tip.x - C;
  const dy = tip.y - C;
  const len = Math.hypot(dx, dy);
  if (len < 1) return '';
  const ux = dx / len;
  const uy = dy / len;
  const h = Math.min(head, len * 0.6);
  const bx = tip.x - ux * h;
  const by = tip.y - uy * h;
  return `M${C} ${C}L${bx.toFixed(1)} ${by.toFixed(1)}M${tip.x.toFixed(1)} ${tip.y.toFixed(1)}L${(bx - uy * h * 0.55).toFixed(1)} ${(by + ux * h * 0.55).toFixed(1)}L${(bx + uy * h * 0.55).toFixed(1)} ${(by - ux * h * 0.55).toFixed(1)}Z`;
}

const SENSE_TEXT = {
  1: 'Anti-horário',
  [-1]: 'Horário',
  0: 'Não gira, só pulsa',
} as const;

const NOTES: Record<Feed, string> = {
  normal:
    'O campo tem sempre o mesmo tamanho, 1,5 vez o de uma bobina sozinha, e dá uma volta inteira a cada ciclo da rede. É esse campo girando que arrasta o rotor.',
  invertida:
    'Trocando duas fases, a ordem em que as bobinas atingem o pico se inverte, e o campo gira para o outro lado. É assim que se inverte um motor trifásico.',
  'falta-fase':
    'Sem L3, as bobinas de L1 e L2 ficam em série e levam a mesma corrente. O campo só cresce, encolhe e troca de lado sobre a mesma linha: parado, o motor ronca e não parte.',
};

export default function CampoGirante() {
  const id = useId();
  const [theta, setTheta] = useState(0);
  const [feed, setFeed] = useState<Feed>('normal');
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]['id']>('lento');
  const [playing, setPlaying] = useState(false);
  const reduced = usePrefersReducedMotion();
  const raf = useRef(0);

  useEffect(() => {
    if (!playing) return;
    const cps = SPEEDS.find((s) => s.id === speed)!.cps;
    let last: number | undefined;
    const tick = (time: number) => {
      const dt = last === undefined ? 0 : Math.min(0.1, (time - last) / 1000);
      last = time;
      setTheta((t) => (t + dt * cps * 360) % 360);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, speed]);

  const currents = coilCurrents(theta, feed);
  const field = statorField(theta, feed);
  const size = magnitude(field);
  const sense = rotation(feed);
  const tip = px(field);

  const locus = useMemo(() => {
    const pts = fieldLocus(feed).map(px);
    return pts.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
  }, [feed]);
  const waves = useMemo(
    () => [wavePath(0, feed), wavePath(1, feed), wavePath(2, feed)] as const,
    [feed],
  );

  const deg = Math.round(theta);
  const fieldText =
    size < 0.02
      ? 'o campo resultante está zerado neste instante'
      : `o campo resultante tem ${formatNumber(size, 2)} vez o de uma bobina e aponta para ${formatNumber(direction(field), 0)}°`;
  const statorLabel = `Estator com três bobinas a 120°, L1 em cima. Correntes agora: ${PHASES.map((p, k) => `${p} ${formatNumber(currents[k]!, 2)}`).join(', ')}. Neste instante ${fieldText}. Sentido de giro: ${SENSE_TEXT[sense].toLowerCase()}.`;
  const wavesLabel = `Correntes nas três bobinas ao longo de um ciclo, com o cursor em ${deg}°.${feed === 'falta-fase' ? ' A corrente de L3 é zero e as de L1 e L2 são iguais e opostas.' : ' As três ondas são iguais, defasadas de um terço de ciclo.'}`;

  return (
    <section className="lw campo" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          O campo girante de três bobinas
        </h3>
        <p className="lw__lead">
          Cada seta fina é o campo de uma bobina, que cresce e diminui com a corrente dela. A seta
          grossa é a soma das três. Ponha para girar, ou arraste o instante devagar.
        </p>
      </header>

      <div className="lw__body campo__body">
        <div className="campo__views">
          <svg className="campo__stator" viewBox="0 0 320 320" role="img" aria-label={statorLabel}>
            <circle cx={C} cy={C} r={(RING_IN + RING_OUT) / 2} className="campo__ring" />
            <circle cx={C} cy={C} r={RING_IN - 30} className="campo__rotor" />
            <text x={C} y={C + RING_IN - 38} className="campo__caption">
              rotor
            </text>
            {COIL_AXES.map((axis, k) => {
              const i = currents[k]!;
              return (
                <g key={axis} transform={`rotate(${-axis + 90} ${C} ${C})`}>
                  <rect
                    x={C - 20}
                    y={C - RING_OUT + 2}
                    width={40}
                    height={RING_OUT - RING_IN + 8}
                    rx={5}
                    className={`campo__coil campo__coil--${k + 1}`}
                    style={{ fillOpacity: 0.15 + 0.75 * Math.abs(i) }}
                  />
                </g>
              );
            })}
            {COIL_AXES.map((axis, k) => {
              const r = RING_OUT + 14;
              return (
                <text
                  key={`t${axis}`}
                  x={C + Math.cos(axis * DEG) * r}
                  y={C - Math.sin(axis * DEG) * r + 5}
                  className={`campo__phase campo__phase--${k + 1}`}
                >
                  {PHASES[k]}
                </text>
              );
            })}
            <path d={locus} className="campo__locus" />
            {COIL_AXES.map((axis, k) => (
              <path
                key={`a${axis}`}
                d={arrow(px(coilField(currents[k]!, k as 0 | 1 | 2)), 9)}
                className={`campo__arrow campo__arrow--${k + 1}`}
              />
            ))}
            <path d={arrow(tip, 15)} className="campo__field" />
            <circle cx={C} cy={C} r={4} className="campo__pivot" />
          </svg>

          <svg className="campo__waves" viewBox="0 0 360 200" role="img" aria-label={wavesLabel}>
            <line x1={WX0} x2={WX1} y1={WY} y2={WY} className="campo__axis" />
            <line x1={WX0} x2={WX0} y1={WY - WA - 8} y2={WY + WA + 8} className="campo__axis" />
            <text x={WX0 - 6} y={wy(1) + 4} className="campo__tick campo__tick--end">
              +1
            </text>
            <text x={WX0 - 6} y={wy(-1) + 4} className="campo__tick campo__tick--end">
              −1
            </text>
            {[90, 180, 270, 360].map((t) => (
              <text key={t} x={wx(t)} y={WY + WA + 22} className="campo__tick">
                {t}°
              </text>
            ))}
            {waves.map((d, k) => (
              <path key={k} d={d} className={`campo__wave campo__wave--${k + 1}`} />
            ))}
            <line
              x1={wx(theta)}
              x2={wx(theta)}
              y1={WY - WA - 10}
              y2={WY + WA + 6}
              className="campo__cursor"
            />
            {currents.map((i, k) => (
              <circle
                key={k}
                cx={wx(theta)}
                cy={wy(i)}
                r={4.5}
                className={`campo__dot campo__dot--${k + 1}`}
              />
            ))}
            <text x={WX0 + 4} y={14} className="campo__tick campo__tick--start">
              corrente em cada bobina (pico = 1)
            </text>
          </svg>
        </div>

        <div className="campo__side">
          <div className="lw__controls">
            <div className="campo__buttons">
              <button
                type="button"
                className="lw__btn lw__btn--primary"
                aria-pressed={playing}
                disabled={reduced}
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? 'Pausar' : 'Girar'}
              </button>
              {reduced && <p className="lw__note">Animação desligada: use a barra do instante.</p>}
            </div>

            <label className="lw__range">
              <span className="lw__range-head">
                <span>Instante (ângulo da onda de L1)</span>
                <strong className="num">{deg}°</strong>
              </span>
              <input
                type="range"
                min={0}
                max={360}
                step={5}
                value={deg}
                aria-valuetext={`${deg} graus`}
                onChange={(e) => {
                  setPlaying(false);
                  setTheta(Number(e.target.value) % 360);
                }}
              />
            </label>

            <fieldset className="lw__group">
              <legend className="lw__legend">Ligação</legend>
              <div className="lw__choices lw__choices--stack">
                {FEEDS.map((f) => (
                  <label key={f.id} className="lw__choice">
                    <input
                      type="radio"
                      name={`${id}-feed`}
                      value={f.id}
                      checked={feed === f.id}
                      onChange={() => setFeed(f.id)}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="lw__group">
              <legend className="lw__legend">Velocidade da animação</legend>
              <div className="lw__choices">
                {SPEEDS.map((s) => (
                  <label key={s.id} className="lw__choice">
                    <input
                      type="radio"
                      name={`${id}-speed`}
                      checked={speed === s.id}
                      onChange={() => setSpeed(s.id)}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="lw__output" aria-live="polite">
            <div>
              <p className="lw__value-label">Sentido do campo</p>
              <p className="lw__value campo__sense" data-sentido={sense}>
                {SENSE_TEXT[sense]}
              </p>
            </div>
            <p className="lw__note">{NOTES[feed]}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
