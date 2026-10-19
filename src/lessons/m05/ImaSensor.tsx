/*
 * Lesson 5.5 (magnetic sensors): a magnet comes closer to a reed switch and
 * to two Hall sensors. The field at the sensors falls fast with distance;
 * the reed and the Hall switch have hysteresis (they close nearer than they
 * open), the Hall switch only answers to a south pole, and the linear Hall
 * sensor gives a voltage that follows the field.
 */
import { useId, useState } from 'react';
import { formatNumber, formatSI } from '../m00/formato';
import {
  fieldAt,
  hallLinear,
  hallSwitchNext,
  HALL_SWITCH,
  MAGNETS,
  reedNext,
  REED,
  type MagnetId,
  type Pole,
} from './ima-sensor';
import '../m00/widget.css';
import './ima-sensor.css';

const D_MAX = 50;
const B_MAX = 15;

/* Scene (viewBox 0 0 360 130): the sensors sit at x = 300, the magnet moves left. */
const SENSOR_X = 300;
const MM = 4.4;
const MAGNET_W = 5 * MM;
const MAGNET_H = 10 * MM;
const AXIS_Y = 62;

/* Graph (viewBox 0 0 360 210). */
const X0 = 46;
const X1 = 346;
const Y0 = 176;
const Y1 = 12;
const gx = (d: number) => X0 + (d / D_MAX) * (X1 - X0);
const gy = (b: number) => Y0 - (Math.min(Math.abs(b), B_MAX) / B_MAX) * (Y0 - Y1);

function curve(magnet: MagnetId): string {
  return Array.from({ length: 101 }, (_, k) => (k / 100) * D_MAX)
    .map((d, k) => `${k === 0 ? 'M' : 'L'}${gx(d).toFixed(1)} ${gy(fieldAt(d, magnet)).toFixed(1)}`)
    .join('');
}

const THRESHOLDS = [
  { b: REED.closeMt, text: 'reed fecha', cls: 'reed', dy: -4 },
  { b: REED.openMt, text: 'reed abre', cls: 'reed', dy: 12 },
  { b: HALL_SWITCH.operateMt, text: 'Hall liga', cls: 'hall', dy: -4 },
  { b: HALL_SWITCH.releaseMt, text: 'Hall desliga', cls: 'hall', dy: 12 },
];

const mt = (b: number) => `${formatNumber(b, Math.abs(b) < 10 ? 1 : 0)} mT`;

export default function ImaSensor() {
  const id = useId();
  const [distance, setDistance] = useState(40);
  const [magnet, setMagnet] = useState<MagnetId>('ferrite');
  const [pole, setPole] = useState<Pole>('sul');
  const [reed, setReed] = useState(false);
  const [hall, setHall] = useState(false);

  const field = fieldAt(distance, magnet, pole);
  const linear = hallLinear(field);
  const inReedBand = Math.abs(field) > REED.openMt && Math.abs(field) < REED.closeMt;
  const inHallBand = field > HALL_SWITCH.releaseMt && field < HALL_SWITCH.operateMt;

  function update(d: number, m: MagnetId, p: Pole) {
    const b = fieldAt(d, m, p);
    setDistance(d);
    setMagnet(m);
    setPole(p);
    setReed((closed) => reedNext(closed, b));
    setHall((on) => hallSwitchNext(on, b));
  }

  const magnetX = SENSOR_X - 14 - distance * MM - MAGNET_W;
  const facing = pole === 'sul' ? 'S' : 'N';
  const back = pole === 'sul' ? 'N' : 'S';
  const summary = `Ímã de ${magnet === 'ferrite' ? 'ferrite' : 'neodímio'} a ${distance} mm dos sensores, com o polo ${pole} virado para eles. Campo no sensor: ${mt(Math.abs(field))}. Reed ${reed ? 'fechado' : 'aberto'}; sensor Hall digital ${hall ? 'ligado' : 'desligado'}; sensor Hall linear com ${formatSI(linear, 'V')}.`;

  return (
    <section className="lw ima-sensor" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Ímã se aproximando do sensor
        </h3>
        <p className="lw__lead">
          Aproxime e afaste o ímã devagar e observe em que distância cada sensor muda. Depois troque
          o ímã e vire o polo.
        </p>
      </header>

      <div className="lw__body">
        <svg className="ima-sensor__scene" viewBox="0 0 360 130" role="img" aria-label={summary}>
          <line x1={10} x2={350} y1={AXIS_Y} y2={AXIS_Y} className="ima-sensor__axis" />
          <g className="ima-sensor__magnet" transform={`translate(${magnetX.toFixed(1)} 0)`}>
            <rect
              x={0}
              y={AXIS_Y - MAGNET_H / 2}
              width={MAGNET_W / 2}
              height={MAGNET_H}
              className={`ima-sensor__pole ima-sensor__pole--${back === 'N' ? 'n' : 's'}`}
            />
            <rect
              x={MAGNET_W / 2}
              y={AXIS_Y - MAGNET_H / 2}
              width={MAGNET_W / 2}
              height={MAGNET_H}
              className={`ima-sensor__pole ima-sensor__pole--${facing === 'N' ? 'n' : 's'}`}
            />
            <text x={MAGNET_W / 4} y={AXIS_Y + 4} className="ima-sensor__pole-text">
              {back}
            </text>
            <text x={(3 * MAGNET_W) / 4} y={AXIS_Y + 4} className="ima-sensor__pole-text">
              {facing}
            </text>
          </g>

          {/* Reed capsule above the axis, Hall chip below, both at the same distance. */}
          <rect
            x={SENSOR_X - 12}
            y={20}
            width={56}
            height={14}
            rx={7}
            className="ima-sensor__glass"
          />
          <path
            d={
              reed
                ? `M${SENSOR_X - 22} 27H${SENSOR_X + 17}M${SENSOR_X + 54} 27H${SENSOR_X + 15}`
                : `M${SENSOR_X - 22} 27H${SENSOR_X + 10}L${SENSOR_X + 20} 24M${SENSOR_X + 54} 27H${SENSOR_X + 21}`
            }
            className={reed ? 'ima-sensor__reed is-on' : 'ima-sensor__reed'}
          />
          <text x={SENSOR_X + 16} y={14} className="ima-sensor__label">
            reed
          </text>
          <rect
            x={SENSOR_X - 12}
            y={78}
            width={16}
            height={20}
            rx={2}
            className="ima-sensor__chip"
          />
          <path
            d={`M${SENSOR_X - 8} 98v10M${SENSOR_X - 4} 98v10M${SENSOR_X} 98v10`}
            className="ima-sensor__leg"
          />
          <text x={SENSOR_X + 10} y={92} className="ima-sensor__label ima-sensor__label--start">
            Hall
          </text>

          <path
            d={`M${(magnetX + MAGNET_W).toFixed(1)} 122H${SENSOR_X - 12}`}
            className="ima-sensor__dim"
          />
          <text
            x={((magnetX + MAGNET_W + SENSOR_X - 12) / 2).toFixed(1)}
            y={118}
            className="ima-sensor__label"
          >
            {distance} mm
          </text>
        </svg>

        <div className="lw__controls lw__controls--cols">
          <label className="lw__range">
            <span className="lw__range-head">
              <span>Distância do ímã</span>
              <strong className="num">{distance} mm</strong>
            </span>
            <input
              type="range"
              min={0}
              max={D_MAX}
              step={1}
              value={distance}
              aria-valuetext={`${distance} milímetros`}
              onChange={(e) => update(Number(e.target.value), magnet, pole)}
            />
          </label>

          <fieldset className="lw__group">
            <legend className="lw__legend">Ímã</legend>
            <div className="lw__choices">
              {(Object.keys(MAGNETS) as MagnetId[]).map((m) => (
                <label key={m} className="lw__choice" title={MAGNETS[m].label}>
                  <input
                    type="radio"
                    name={`${id}-ima`}
                    checked={m === magnet}
                    onChange={() => update(distance, m, pole)}
                  />
                  {m === 'ferrite' ? 'Ferrite' : 'Neodímio'}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="lw__group">
            <legend className="lw__legend">Polo virado para o sensor</legend>
            <div className="lw__choices">
              {(['sul', 'norte'] as Pole[]).map((p) => (
                <label key={p} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-polo`}
                    checked={p === pole}
                    onChange={() => update(distance, magnet, p)}
                  />
                  {p === 'sul' ? 'Sul (S)' : 'Norte (N)'}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="lw__output" aria-live="polite">
          <div>
            <p className="lw__value-label">Campo no sensor</p>
            <p className="lw__value">{mt(Math.abs(field))}</p>
          </div>
          <ul className="ima-sensor__states">
            <li>
              <span
                className={reed ? 'ima-sensor__led is-on' : 'ima-sensor__led'}
                aria-hidden="true"
              />
              <span>
                <strong>Reed:</strong> {reed ? 'fechado, o LED em série acende' : 'aberto'}
              </span>
            </li>
            <li>
              <span
                className={hall ? 'ima-sensor__led is-on' : 'ima-sensor__led'}
                aria-hidden="true"
              />
              <span>
                <strong>Hall digital:</strong>{' '}
                {hall
                  ? 'ligado, saída em 0 V e o LED do pull-up acende'
                  : 'desligado, saída em 5 V pelo pull-up'}
              </span>
            </li>
            <li>
              <span className="ima-sensor__meter num" aria-hidden="true">
                {formatNumber(linear, 2)}
              </span>
              <span>
                <strong>Hall linear:</strong> saída de {formatSI(linear, 'V')} (2,5 V sem campo)
              </span>
            </li>
          </ul>
          {inReedBand && (
            <p className="lw__note">
              Nesta distância o reed fica como estava: se veio de longe, continua aberto; se veio de
              perto, continua fechado. É a histerese.
            </p>
          )}
          {inHallBand && (
            <p className="lw__note">
              O Hall digital também tem uma faixa em que mantém o estado anterior.
            </p>
          )}
          {pole === 'norte' && Math.abs(field) >= HALL_SWITCH.operateMt && (
            <p className="lw__note">
              O campo é forte, mas o Hall digital deste exemplo só liga com o polo sul. O reed não
              liga para o polo; o Hall linear desce abaixo de 2,5 V.
            </p>
          )}
        </div>

        <figure className="ima-sensor__graph">
          <svg
            viewBox="0 0 360 210"
            role="img"
            aria-label="Gráfico do campo no sensor em função da distância, com as linhas em que o reed e o sensor Hall ligam e desligam."
          >
            {[0, 10, 20, 30, 40, 50].map((d) => (
              <g key={`d${d}`}>
                <line x1={gx(d)} x2={gx(d)} y1={Y1} y2={Y0} className="ima-sensor__grid" />
                <text x={gx(d)} y={Y0 + 15} className="ima-sensor__tick">
                  {d}
                </text>
              </g>
            ))}
            {[0, 5, 10, 15].map((b) => (
              <g key={`b${b}`}>
                <line x1={X0} x2={X1} y1={gy(b)} y2={gy(b)} className="ima-sensor__grid" />
                <text x={X0 - 6} y={gy(b) + 4} className="ima-sensor__tick ima-sensor__tick--end">
                  {b}
                </text>
              </g>
            ))}
            {THRESHOLDS.map((t) => (
              <g key={t.text}>
                <line
                  x1={X0}
                  x2={X1}
                  y1={gy(t.b)}
                  y2={gy(t.b)}
                  className={`ima-sensor__threshold ima-sensor__threshold--${t.cls}`}
                />
                <text
                  x={X1 - 2}
                  y={gy(t.b) + t.dy}
                  className={`ima-sensor__tick ima-sensor__tick--end ima-sensor__tick--${t.cls}`}
                >
                  {t.text}
                </text>
              </g>
            ))}
            <path d={curve(magnet)} className="ima-sensor__curve" />
            <line
              x1={gx(distance)}
              x2={gx(distance)}
              y1={Y1}
              y2={Y0}
              className="ima-sensor__cursor"
            />
            <circle cx={gx(distance)} cy={gy(field)} r={5} className="ima-sensor__dot" />
            <text x={(X0 + X1) / 2} y={Y0 + 31} className="ima-sensor__axis-label">
              Distância (mm)
            </text>
            <text
              x={13}
              y={(Y0 + Y1) / 2}
              transform={`rotate(-90 13 ${(Y0 + Y1) / 2})`}
              className="ima-sensor__axis-label"
            >
              Campo (mT)
            </text>
          </svg>
          <figcaption className="lw__note">
            O campo cai muito depressa: dobrar a distância divide o campo por quase oito, longe do
            ímã. Acima de 15 mT a curva sai do gráfico.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
