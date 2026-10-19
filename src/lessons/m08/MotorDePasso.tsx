/*
 * Lesson 8.5 (stepper, servo and brushless): a two-phase stepper reduced to
 * its idea. Four stator poles, coil A on the left and right ones, coil B on
 * the top and bottom ones, and a magnet as the rotor. Each step changes
 * which coil is on, and in which direction; the rotor lines up with the
 * new field. The table shows the sequence, and the output translates the
 * steps to the shaft of a real 200-step motor. Logic in passo-servo.ts.
 */
import { useEffect, useId, useState } from 'react';
import { formatNumber } from '../m00/formato';
import { usePrefersReducedMotion } from './reduced-motion';
import {
  coilState,
  fieldAngle,
  relativeTorque,
  sequence,
  sequenceIndex,
  shaftAngle,
  type StepMode,
} from './passo-servo';
import '../m00/widget.css';
import './passo-servo.css';

const C = 150;
const POLE_IN = 62;
const POLE_OUT = 112;

const MODES: { id: StepMode; label: string }[] = [
  { id: 'onda', label: 'Uma bobina por vez' },
  { id: 'completo', label: 'Duas bobinas juntas' },
  { id: 'meio', label: 'Meio passo' },
];

/** The four poles: angle, coil, and the sign of the coil current that makes this face S. */
const POLES = [
  { angle: 0, coil: 0, sign: 1, name: 'A' },
  { angle: 90, coil: 1, sign: 1, name: 'B' },
  { angle: 180, coil: 0, sign: -1, name: 'A' },
  { angle: 270, coil: 1, sign: -1, name: 'B' },
] as const;

const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '0');

export default function MotorDePasso() {
  const id = useId();
  const [mode, setMode] = useState<StepMode>('onda');
  const [steps, setSteps] = useState(0);
  const [running, setRunning] = useState(false);
  const reduced = usePrefersReducedMotion();
  /** Unwrapped rotor angle, so the drawing turns the short way. */
  const [rotor, setRotor] = useState(0);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSteps((s) => s + 1), 500);
    return () => clearInterval(timer);
  }, [running]);

  // Follow the field the short way round, adjusting state while rendering.
  const target = fieldAngle(mode, steps);
  const offset = ((((target - rotor) % 360) + 540) % 360) - 180;
  if (Math.abs(offset) > 1e-9) setRotor(rotor + offset);

  const [ia, ib] = coilState(mode, steps);
  const row = sequenceIndex(mode, steps);
  const torque = relativeTorque(mode, steps);
  const shaft = shaftAngle(mode, steps);

  const changeMode = (m: StepMode) => {
    setMode(m);
    setSteps(0);
  };

  const coilText = (v: number, name: string) =>
    v === 0
      ? `bobina ${name} desligada`
      : `bobina ${name} com corrente ${v > 0 ? 'positiva' : 'negativa'}`;
  const label = `Motor de passo simplificado: ${coilText(ia, 'A')}, ${coilText(ib, 'B')}. O ímã do rotor aponta o norte para ${formatNumber(fieldAngle(mode, steps), 0)}°.`;

  return (
    <section className="lw passo" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Um passo de cada vez
        </h3>
        <p className="lw__lead">
          Dê passos para a frente e para trás e veja quais bobinas o driver liga. O desenho tem só
          quatro passos por volta; o motor de verdade tem 200, mas a sequência é a mesma.
        </p>
      </header>

      <div className="lw__body passo__body">
        <svg className="passo__motor" viewBox="0 0 300 300" role="img" aria-label={label}>
          <circle cx={C} cy={C} r={POLE_OUT + 14} className="passo__ring" />
          {POLES.map((p) => {
            const i = p.coil === 0 ? ia : ib;
            const face = i === 0 ? '' : i * p.sign > 0 ? 'S' : 'N';
            return (
              <g key={p.angle} transform={`rotate(${-p.angle} ${C} ${C})`}>
                <rect
                  x={C + POLE_IN}
                  y={C - 16}
                  width={POLE_OUT - POLE_IN}
                  height={32}
                  rx={3}
                  className={`passo__pole${face ? ` passo__pole--${face.toLowerCase()}` : ''}`}
                />
                <rect
                  x={C + POLE_IN + 14}
                  y={C - 22}
                  width={26}
                  height={44}
                  rx={4}
                  className={`passo__coil${i !== 0 ? ' passo__coil--on' : ''}`}
                />
              </g>
            );
          })}
          {POLES.map((p) => {
            const i = p.coil === 0 ? ia : ib;
            const face = i === 0 ? '' : i * p.sign > 0 ? 'S' : 'N';
            const r = (p.angle * Math.PI) / 180;
            return (
              <g key={`t${p.angle}`}>
                <text
                  x={C + Math.cos(r) * (POLE_OUT + 26)}
                  y={C - Math.sin(r) * (POLE_OUT + 26) + 5}
                  className="passo__coil-name"
                >
                  {p.name}
                </text>
                {face && (
                  <text
                    x={C + Math.cos(r) * (POLE_IN - 10)}
                    y={C - Math.sin(r) * (POLE_IN - 10) + 5}
                    className={`passo__face passo__face--${face.toLowerCase()}`}
                  >
                    {face}
                  </text>
                )}
              </g>
            );
          })}
          <g
            className={reduced ? 'passo__rotor' : 'passo__rotor passo__rotor--anim'}
            style={{ transform: `rotate(${-rotor}deg)`, transformOrigin: `${C}px ${C}px` }}
          >
            <rect
              x={C - 40}
              y={C - 10}
              width={40}
              height={20}
              rx={3}
              className="passo__mag passo__mag--s"
            />
            <rect
              x={C}
              y={C - 10}
              width={40}
              height={20}
              rx={3}
              className="passo__mag passo__mag--n"
            />
            <text x={C + 20} y={C + 5} className="passo__mag-t">
              N
            </text>
            <text x={C - 20} y={C + 5} className="passo__mag-t">
              S
            </text>
          </g>
          <circle cx={C} cy={C} r={4} className="passo__pivot" />
        </svg>

        <div className="passo__side">
          <div className="lw__controls">
            <div className="passo__buttons">
              <button type="button" className="lw__btn" onClick={() => setSteps((s) => s - 1)}>
                ◀ Passo para trás
              </button>
              <button
                type="button"
                className="lw__btn lw__btn--primary"
                onClick={() => setSteps((s) => s + 1)}
              >
                Passo à frente ▶
              </button>
              <button
                type="button"
                className="lw__btn"
                aria-pressed={running}
                onClick={() => setRunning((r) => !r)}
              >
                {running ? 'Parar' : 'Dar passos sozinho'}
              </button>
            </div>

            <fieldset className="lw__group">
              <legend className="lw__legend">Modo do driver</legend>
              <div className="lw__choices">
                {MODES.map((m) => (
                  <label key={m.id} className="lw__choice">
                    <input
                      type="radio"
                      name={`${id}-modo`}
                      checked={mode === m.id}
                      onChange={() => changeMode(m.id)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <table className="passo__table">
            <caption className="lw__legend">Sequência das bobinas</caption>
            <thead>
              <tr>
                <th scope="col">Estado</th>
                <th scope="col">Bobina A</th>
                <th scope="col">Bobina B</th>
              </tr>
            </thead>
            <tbody>
              {sequence(mode).map(([a, b], k) => (
                <tr
                  key={k}
                  className={k === row ? 'passo__row--on' : undefined}
                  aria-current={k === row ? 'step' : undefined}
                >
                  <td>{k + 1}</td>
                  <td>{sign(a)}</td>
                  <td>{sign(b)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="lw__output" aria-live="polite">
            <div>
              <p className="lw__value-label">Num motor de 200 passos, o eixo andou</p>
              <p className="lw__value" data-angulo>
                {formatNumber(shaft, 1)}°
              </p>
            </div>
            <p className="lw__note">
              {steps} {Math.abs(steps) === 1 ? 'passo' : 'passos'} de{' '}
              {mode === 'meio' ? '0,9°' : '1,8°'}. Torque para segurar o eixo parado:{' '}
              {torque > 1.2 ? 'cerca de 1,4 vez' : 'o de uma bobina'}.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
