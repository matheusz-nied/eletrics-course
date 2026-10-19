/*
 * Lesson 8.5: a hobby servo and its signal. A pulse every 20 ms (50 Hz);
 * its width, from 1 to 2 ms, says the angle, from 0° to 180°. The horn turns
 * to the new angle at the servo's top speed. Logic in passo-servo.ts.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { formatNumber } from '../m00/formato';
import { SERVO, servoAngle, servoDuty, servoMove } from './passo-servo';
import '../m00/widget.css';
import './passo-servo.css';

/* Servo seen from above (viewBox 0 0 260 200). */
const HX = 130;
const HY = 112;

/* Signal (viewBox 0 0 360 150): two periods, 40 ms. */
const SX0 = 24;
const SX1 = 344;
const HIGH = 36;
const LOW = 104;
const sx = (ms: number) => SX0 + (ms / (2 * SERVO.period)) * (SX1 - SX0);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

export default function ServoPulso() {
  const id = useId();
  const [pulse, setPulse] = useState(1.5);
  const [horn, setHorn] = useState(servoAngle(1.5));
  const hornRef = useRef(horn);
  const raf = useRef(0);
  const target = servoAngle(pulse);

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    if (prefersReducedMotion()) {
      hornRef.current = target;
      setHorn(target);
      return;
    }
    let last: number | undefined;
    const tick = (time: number) => {
      const dt = last === undefined ? 0 : Math.min(0.05, (time - last) / 1000);
      last = time;
      const next = servoMove(hornRef.current, target, dt);
      hornRef.current = next;
      setHorn(next);
      if (next !== target) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);

  const wave = [0, SERVO.period]
    .map((t0) => `H${sx(t0).toFixed(1)}V${HIGH}H${sx(t0 + pulse).toFixed(1)}V${LOW}`)
    .join('');
  const path = `M${SX0} ${LOW}${wave}H${SX1}`;
  // 0° points left, 90° up, 180° right.
  const rad = (Math.PI * (180 - horn)) / 180;
  const tipX = HX + Math.cos(rad) * 70;
  const tipY = HY - Math.sin(rad) * 70;
  const ms = `${formatNumber(pulse, 2)} ms`;

  return (
    <section className="lw servo" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          O pulso que diz o ângulo
        </h3>
        <p className="lw__lead">
          Mude a largura do pulso e veja o braço do servo ir para o ângulo pedido. O pulso se
          repete a cada 20 ms; só a largura dele muda.
        </p>
      </header>

      <div className="lw__body servo__body">
        <div className="servo__views">
          <svg
            className="servo__top"
            viewBox="0 0 260 200"
            role="img"
            aria-label={`Servo visto de cima, com o braço a ${formatNumber(horn, 0)}°. 0° fica à esquerda, 90° para cima e 180° à direita.`}
          >
            <path d={`M${HX - 90} ${HY} A90 90 0 0 1 ${HX + 90} ${HY}`} className="servo__scale" />
            {[0, 45, 90, 135, 180].map((a) => {
              const r = (Math.PI * (180 - a)) / 180;
              return (
                <g key={a}>
                  <line
                    x1={HX + Math.cos(r) * 84}
                    y1={HY - Math.sin(r) * 84}
                    x2={HX + Math.cos(r) * 94}
                    y2={HY - Math.sin(r) * 94}
                    className="servo__tick"
                  />
                  <text x={HX + Math.cos(r) * 108} y={HY - Math.sin(r) * 108 + 4} className="servo__tick-t">
                    {a}°
                  </text>
                </g>
              );
            })}
            <rect x={HX - 58} y={HY - 22} width={116} height={64} rx={6} className="servo__case" />
            <rect x={HX - 74} y={HY - 8} width={148} height={20} rx={4} className="servo__case servo__ears" />
            <line x1={HX} y1={HY} x2={tipX} y2={tipY} className="servo__horn" />
            <circle cx={tipX} cy={tipY} r={7} className="servo__horn-end" />
            <circle cx={HX} cy={HY} r={13} className="servo__hub" />
            <text x={HX} y={HY + 34} className="servo__case-t">
              servo 9 g
            </text>
          </svg>

          <svg
            className="servo__signal"
            viewBox="0 0 360 150"
            role="img"
            aria-label={`Sinal de controle: pulsos de 5 V com ${ms} de largura, um a cada 20 ms.`}
          >
            <line x1={SX0} x2={SX1} y1={LOW} y2={LOW} className="servo__axis" />
            <path d={path} className="servo__wave" />
            <text x={SX0 - 4} y={HIGH + 4} className="servo__tick-t servo__tick-t--end">
              5 V
            </text>
            <text x={SX0 - 4} y={LOW + 4} className="servo__tick-t servo__tick-t--end">
              0
            </text>
            <path d={`M${sx(0)} 122 H${sx(SERVO.period)} M${sx(0)} 116 V128 M${sx(SERVO.period)} 116 V128`} className="servo__dim" />
            <text x={(sx(0) + sx(SERVO.period)) / 2} y={142} className="servo__tick-t">
              20 ms (50 Hz)
            </text>
            <text x={sx(pulse / 2)} y={HIGH - 8} className="servo__pulse-t">
              {ms}
            </text>
          </svg>
        </div>

        <div className="servo__side">
          <label className="lw__range">
            <span className="lw__range-head">
              <span>Largura do pulso</span>
              <strong className="num">{ms}</strong>
            </span>
            <input
              type="range"
              min={SERVO.minPulse}
              max={SERVO.maxPulse}
              step={0.05}
              value={pulse}
              aria-valuetext={`${ms}, ângulo de ${formatNumber(target, 0)} graus`}
              onChange={(e) => setPulse(Number(e.target.value))}
            />
          </label>

          <div className="lw__output" aria-live="polite">
            <div>
              <p className="lw__value-label">Ângulo pedido</p>
              <p className="lw__value" data-servo-angulo>
                {formatNumber(target, 0)}°
              </p>
            </div>
            <p className="lw__note">
              Ciclo de trabalho de {formatNumber(servoDuty(pulse) * 100, 1)} %. O servo compara o
              pulso com o potenciômetro do eixo e gira o motor até os dois concordarem; se alguém
              força o braço, ele força de volta.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
