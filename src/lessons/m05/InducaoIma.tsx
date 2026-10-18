/*
 * Lesson 5.3 (electromagnetic induction): a magnet passes through a coil and
 * a scope draws the induced voltage. The pass runs in slow motion; the
 * previous pass stays on the screen, faded, to compare. A slider moves the
 * magnet by hand: standing still, even inside the coil, nothing is induced.
 * A centre-zero galvanometer and the poles drawn on the coil faces show the
 * direction of the current (Lenz). Physics in inducao.ts.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatNumber, formatSI } from '../m00/formato';
import {
  MAGNETS,
  TURNS,
  emf,
  fluxPerTurn,
  leftFacePole,
  passTrace,
  peakEmf,
  voltsPerDivision,
  type MagnetKind,
} from './inducao';
import '../m00/widget.css';
import './inducao-ima.css';

/** Half of the track drawn (m) and half of the scope's time window (s). */
const Z_MAX = 0.06;
const WINDOW = 0.15;
/** The 0,3 s of a pass take 3 s on the screen. */
const SLOW_MOTION = 10;
const SPEEDS = { min: 0.2, max: 3, step: 0.1 };

/* Drawing of the magnet and coil (viewBox 0 0 360 200). */
const AXIS_Y = 62;
const zx = (z: number) => 180 + Math.max(-1.2, Math.min(1.2, z / Z_MAX)) * 150;
const COIL_RINGS = [-12, -6, 0, 6, 12];
const GALV = { x: 180, y: 178, r: 36 };

/* Scope (viewBox 0 0 360 210): 10 × 8 divisions. */
const SX0 = 30;
const SX1 = 350;
const SY0 = 18;
const SY1 = 178;
const DIV_X = (SX1 - SX0) / 10;
const DIV_Y = (SY1 - SY0) / 8;
const tx = (t: number) => SX0 + ((t + WINDOW) / (2 * WINDOW)) * (SX1 - SX0);
const vy = (v: number, perDiv: number) => {
  const y = (SY0 + SY1) / 2 - (v / perDiv) * DIV_Y;
  return Math.max(SY0 - 6, Math.min(SY1 + 6, y));
};

interface Settings {
  turns: number;
  magnet: MagnetKind;
  front: 'N' | 'S';
  speed: number;
}

interface Pass {
  settings: Settings;
  peak: number;
}

const moment = (s: Settings) => MAGNETS[s.magnet].moment * (s.front === 'N' ? 1 : -1);

function tracePath(s: Settings, perDiv: number, until = WINDOW): string {
  const pts = passTrace(s.turns, s.speed, moment(s), WINDOW, 900);
  let d = '';
  for (const p of pts) {
    if (p.t > until) break;
    d += `${d ? 'L' : 'M'}${tx(p.t).toFixed(1)} ${vy(p.v, perDiv).toFixed(1)}`;
  }
  return d;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

const fmtV = (v: number) => formatSI(v, 'V');
const signed = (v: number) => `${v > 0 ? '+' : ''}${fmtV(v)}`;

export default function InducaoIma() {
  const id = useId();
  const [settings, setSettings] = useState<Settings>({
    turns: 500,
    magnet: 'neodimio',
    front: 'N',
    speed: 1,
  });
  const [z, setZ] = useState(-Z_MAX);
  /** Instantaneous voltage and speed while something moves. */
  const [now, setNow] = useState<{ v: number; u: number }>({ v: 0, u: 0 });
  /** The last pass, and how much of it (s, up to WINDOW) the scope has drawn. */
  const [last, setLast] = useState<Pass | null>(null);
  const [drawn, setDrawn] = useState(WINDOW);
  /** The pass before it, faded, to compare. */
  const [previous, setPrevious] = useState<Pass | null>(null);

  const raf = useRef(0);
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastMove = useRef<{ z: number; at: number } | null>(null);

  const m = moment(settings);
  const running = last !== null && drawn < WINDOW;

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(idle.current);
    },
    [],
  );

  /** Stops the animation; the scope keeps the whole trace of the last pass. */
  const stopPass = () => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    setDrawn(WINDOW);
  };

  const change = (patch: Partial<Settings>) => {
    stopPass();
    setNow({ v: 0, u: 0 });
    setSettings((s) => ({ ...s, ...patch }));
  };

  const startPass = () => {
    stopPass();
    clearTimeout(idle.current);
    const s = settings;
    const pass: Pass = { settings: s, peak: peakEmf(s.turns, s.speed, MAGNETS[s.magnet].moment) };
    setPrevious(last);
    setLast(pass);
    const finish = () => {
      setDrawn(WINDOW);
      setZ(Math.min(Z_MAX, s.speed * WINDOW));
      setNow({ v: 0, u: 0 });
      raf.current = 0;
    };
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    let start: number | undefined;
    const tick = (time: number) => {
      start ??= time;
      const t = -WINDOW + (time - start) / 1000 / SLOW_MOTION;
      if (t >= WINDOW) {
        finish();
        return;
      }
      const zt = s.speed * t;
      setDrawn(t);
      setZ(Math.max(-Z_MAX, Math.min(Z_MAX, zt)));
      setNow({ v: emf(s.turns, zt, s.speed, moment(s)), u: s.speed });
      raf.current = requestAnimationFrame(tick);
    };
    setDrawn(-WINDOW);
    raf.current = requestAnimationFrame(tick);
  };

  /** The magnet moved by hand: the speed comes from how fast the slider moves. */
  const moveByHand = (zNew: number, at: number) => {
    stopPass();
    const prev = lastMove.current;
    const dt = prev ? Math.min(0.25, Math.max(0.016, (at - prev.at) / 1000)) : 0.1;
    const u = (zNew - (prev?.z ?? z)) / dt;
    lastMove.current = { z: zNew, at };
    setZ(zNew);
    setNow({ v: emf(settings.turns, zNew, u, m), u });
    clearTimeout(idle.current);
    idle.current = setTimeout(() => {
      setNow({ v: 0, u: 0 });
      lastMove.current = null;
    }, 180);
  };

  // Scale: the current settings at their speed, and the faded pass if there is one.
  const perDiv = useMemo(() => {
    const own = peakEmf(settings.turns, settings.speed, MAGNETS[settings.magnet].moment);
    return voltsPerDivision(Math.max(own, last?.peak ?? 0, previous?.peak ?? 0));
  }, [settings, last, previous]);

  const lastPath = useMemo(
    () => (last ? tracePath(last.settings, perDiv, drawn) : ''),
    [last, drawn, perDiv],
  );
  const prevPath = useMemo(
    () => (previous ? tracePath(previous.settings, perDiv) : ''),
    [previous, perDiv],
  );

  const pole = leftFacePole(z, now.u, m);
  const other = pole === 'N' ? 'S' : 'N';
  const arriving = z * now.u < 0;
  const fullScale = 4 * perDiv;
  const needle = Math.max(-1, Math.min(1, now.v / fullScale)) * 55;
  const flux = fluxPerTurn(z, MAGNETS[settings.magnet].moment);
  const done = last !== null && drawn >= WINDOW;
  const frontColor = settings.front === 'N' ? 'n' : 's';
  const backColor = settings.front === 'N' ? 's' : 'n';

  const lenzText =
    pole === undefined
      ? 'Ímã parado (ou fluxo sem mudar): nenhuma corrente induzida, o ponteiro fica no zero.'
      : `A corrente induzida faz da bobina um ímã com o polo ${pole} na face esquerda e o ${other} na direita: ela ${arriving ? 'empurra o ímã que chega' : 'segura o ímã que sai'}.`;

  const sceneLabel = `Ímã de ${MAGNETS[settings.magnet].label.toLowerCase()} a ${`${formatNumber(z * 100, 1)} cm`} do centro da bobina de ${settings.turns} espiras, com o polo ${settings.front === 'N' ? 'norte' : 'sul'} na frente. Tensão agora: ${fmtV(now.v)}.`;
  const scopeLabel = done
    ? `Osciloscópio: a passagem do ímã deu dois pulsos de sinais opostos, de ${signed(-Math.sign(m) * last.peak)} e depois ${signed(Math.sign(m) * last.peak)}, separados por ${`${formatNumber((0.01 / last.settings.speed) * 1000, 1)} ms`}. Escala de ${fmtV(perDiv)} por divisão e 30 ms por divisão.`
    : `Osciloscópio, ${fmtV(perDiv)} por divisão e 30 ms por divisão. Aperte "Passar o ímã" para desenhar a tensão.`;

  return (
    <section className="lw inducao" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Um ímã atravessando a bobina
        </h3>
        <p className="lw__lead">
          Passe o ímã pela bobina e veja a tensão no osciloscópio, em câmera lenta. Depois arraste o
          ímã com a barra de posição, devagar, depressa e parado dentro da bobina.
        </p>
      </header>

      <div className="lw__body inducao__body">
        <div className="inducao__views">
          <svg className="inducao__scene" viewBox="0 0 360 222" role="img" aria-label={sceneLabel}>
            <line x1={20} x2={340} y1={AXIS_Y} y2={AXIS_Y} className="inducao__track" />
            {/* back half of the coil, behind the magnet */}
            {COIL_RINGS.map((dx) => (
              <path
                key={`b${dx}`}
                d={`M${180 + dx} ${AXIS_Y - 25}A6 25 0 0 0 ${180 + dx} ${AXIS_Y + 25}`}
                className="inducao__ring inducao__ring--back"
              />
            ))}
            <g transform={`translate(${zx(z)} ${AXIS_Y})`}>
              <rect
                x={-25}
                y={-8}
                width={25}
                height={16}
                className={`inducao__pole inducao__pole--${backColor}`}
              />
              <rect
                x={0}
                y={-8}
                width={25}
                height={16}
                className={`inducao__pole inducao__pole--${frontColor}`}
              />
              <text x={-12.5} y={4.5} className="inducao__pole-text">
                {settings.front === 'N' ? 'S' : 'N'}
              </text>
              <text x={12.5} y={4.5} className="inducao__pole-text">
                {settings.front}
              </text>
            </g>
            {COIL_RINGS.map((dx) => (
              <path
                key={`f${dx}`}
                d={`M${180 + dx} ${AXIS_Y - 25}A6 25 0 0 1 ${180 + dx} ${AXIS_Y + 25}`}
                className="inducao__ring"
              />
            ))}
            {pole && (
              <>
                <text
                  x={158}
                  y={AXIS_Y - 32}
                  className={`inducao__face inducao__face--${pole === 'N' ? 'n' : 's'}`}
                >
                  {pole}
                </text>
                <text
                  x={202}
                  y={AXIS_Y - 32}
                  className={`inducao__face inducao__face--${other === 'N' ? 'n' : 's'}`}
                >
                  {other}
                </text>
              </>
            )}
            <text x={180} y={AXIS_Y + 44} className="inducao__caption">
              bobina de {settings.turns} espiras
            </text>

            {/* leads to the galvanometer */}
            <path
              d={`M168 ${AXIS_Y + 25}V${AXIS_Y + 58}H${GALV.x - 22}V${GALV.y - 14}M192 ${AXIS_Y + 25}V${AXIS_Y + 58}H${GALV.x + 22}V${GALV.y - 14}`}
              className="inducao__lead"
            />
            <path
              d={`M${GALV.x - GALV.r} ${GALV.y}A${GALV.r} ${GALV.r} 0 0 1 ${GALV.x + GALV.r} ${GALV.y}Z`}
              className="inducao__dial"
            />
            {[-55, -27.5, 0, 27.5, 55].map((a) => {
              const r = (a * Math.PI) / 180;
              return (
                <line
                  key={a}
                  x1={GALV.x + Math.sin(r) * (GALV.r - 7)}
                  y1={GALV.y - Math.cos(r) * (GALV.r - 7)}
                  x2={GALV.x + Math.sin(r) * (GALV.r - 2)}
                  y2={GALV.y - Math.cos(r) * (GALV.r - 2)}
                  className="inducao__tick"
                />
              );
            })}
            <text
              x={GALV.x - GALV.r - 4}
              y={GALV.y}
              className="inducao__dial-sign inducao__dial-sign--end"
            >
              −
            </text>
            <text x={GALV.x + GALV.r + 4} y={GALV.y} className="inducao__dial-sign">
              +
            </text>
            <line
              x1={GALV.x}
              y1={GALV.y}
              x2={GALV.x + Math.sin((needle * Math.PI) / 180) * (GALV.r - 4)}
              y2={GALV.y - Math.cos((needle * Math.PI) / 180) * (GALV.r - 4)}
              className="inducao__needle"
            />
            <circle cx={GALV.x} cy={GALV.y} r={3} className="inducao__pivot" />
            <text
              x={GALV.x + GALV.r + 22}
              y={GALV.y - 4}
              className="inducao__caption inducao__caption--start"
            >
              galvanômetro
            </text>
            <text
              x={GALV.x + GALV.r + 22}
              y={GALV.y + 10}
              className="inducao__caption inducao__caption--start"
            >
              (zero no meio)
            </text>
          </svg>

          <svg className="inducao__scope" viewBox="0 0 360 210" role="img" aria-label={scopeLabel}>
            <rect
              x={SX0}
              y={SY0}
              width={SX1 - SX0}
              height={SY1 - SY0}
              className="inducao__screen"
            />
            {Array.from({ length: 11 }, (_, k) => (
              <line
                key={`gx${k}`}
                x1={SX0 + k * DIV_X}
                x2={SX0 + k * DIV_X}
                y1={SY0}
                y2={SY1}
                className={k === 5 ? 'inducao__grid inducao__grid--axis' : 'inducao__grid'}
              />
            ))}
            {Array.from({ length: 9 }, (_, k) => (
              <line
                key={`gy${k}`}
                x1={SX0}
                x2={SX1}
                y1={SY0 + k * DIV_Y}
                y2={SY0 + k * DIV_Y}
                className={k === 4 ? 'inducao__grid inducao__grid--axis' : 'inducao__grid'}
              />
            ))}
            {prevPath && <path d={prevPath} className="inducao__trace inducao__trace--prev" />}
            {lastPath && <path d={lastPath} className="inducao__trace" />}
            <text x={SX0} y={12} className="inducao__scope-text inducao__scope-text--start">
              {fmtV(perDiv)}/div
            </text>
            <text x={SX1} y={12} className="inducao__scope-text inducao__scope-text--end">
              30 ms/div
            </text>
            <text x={(SX0 + SX1) / 2} y={196} className="inducao__scope-text">
              tempo · o ímã cruza o centro da bobina no meio da tela
            </text>
          </svg>
        </div>

        <div className="inducao__side">
          <div className="lw__controls">
            <div className="inducao__buttons">
              <button type="button" className="lw__btn lw__btn--primary" onClick={startPass}>
                {running ? 'Recomeçar a passagem' : 'Passar o ímã pela bobina'}
              </button>
            </div>

            <label className="lw__range">
              <span className="lw__range-head">
                <span>Velocidade da passagem</span>
                <strong className="num">{`${formatNumber(settings.speed, 1)} m/s`}</strong>
              </span>
              <input
                type="range"
                min={SPEEDS.min}
                max={SPEEDS.max}
                step={SPEEDS.step}
                value={settings.speed}
                aria-valuetext={`${formatNumber(settings.speed, 1)} m/s`}
                onChange={(e) => change({ speed: Number(e.target.value) })}
              />
            </label>

            <label className="lw__range">
              <span className="lw__range-head">
                <span>Posição do ímã (mova à mão)</span>
                <strong className="num">{`${formatNumber(z * 100, 1)} cm`}</strong>
              </span>
              <input
                type="range"
                min={-Z_MAX}
                max={Z_MAX}
                step={0.0025}
                value={z}
                aria-valuetext={`${`${formatNumber(z * 100, 1)} cm`} do centro da bobina`}
                onChange={(e) => moveByHand(Number(e.target.value), e.timeStamp)}
              />
            </label>

            <fieldset className="lw__group">
              <legend className="lw__legend">Espiras da bobina</legend>
              <div className="lw__choices">
                {TURNS.map((n) => (
                  <label key={n} className="lw__choice">
                    <input
                      type="radio"
                      name={`${id}-n`}
                      checked={settings.turns === n}
                      onChange={() => change({ turns: n })}
                    />
                    {n}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="lw__group">
              <legend className="lw__legend">Ímã</legend>
              <div className="lw__choices">
                {(Object.keys(MAGNETS) as MagnetKind[]).map((k) => (
                  <label key={k} className="lw__choice">
                    <input
                      type="radio"
                      name={`${id}-m`}
                      checked={settings.magnet === k}
                      onChange={() => change({ magnet: k })}
                    />
                    {MAGNETS[k].label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="lw__group">
              <legend className="lw__legend">Polo na frente</legend>
              <div className="lw__choices">
                {(['N', 'S'] as const).map((p) => (
                  <label key={p} className="lw__choice">
                    <input
                      type="radio"
                      name={`${id}-p`}
                      checked={settings.front === p}
                      onChange={() => change({ front: p })}
                    />
                    {p === 'N' ? 'Norte' : 'Sul'}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="lw__output">
            <div>
              <p className="lw__value-label">Tensão agora</p>
              <p className="lw__value">{fmtV(now.v)}</p>
              <p className="lw__note">
                Fluxo numa espira: {formatSI(flux, 'Wb')}. {lenzText}
              </p>
            </div>
            <div aria-live="polite">
              <p className="lw__value-label">Pico da última passagem</p>
              <p className="lw__value inducao__peak" data-peak>
                {done ? `± ${fmtV(last.peak)}` : '—'}
              </p>
              {done && (
                <p className="lw__note">
                  {last.settings.turns} espiras, {MAGNETS[last.settings.magnet].label.toLowerCase()}
                  , {`${formatNumber(last.settings.speed, 1)} m/s`}.
                  {previous
                    ? ` A passagem anterior (${previous.settings.turns} espiras, ${MAGNETS[previous.settings.magnet].label.toLowerCase()}, ${formatNumber(previous.settings.speed, 1) + ' m/s'}, pico de ${fmtV(previous.peak)}) aparece apagada para comparar.`
                    : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
