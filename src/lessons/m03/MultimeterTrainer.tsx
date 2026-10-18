/**
 * Lesson 3.1: a handheld multimeter to play with. The student turns the
 * selector, moves the red lead between the jacks and chooses what the probes
 * touch; the display, the beeper, the load and the fuses react as on a real
 * meter (rules in ./multimeter/rules.ts). The drawing is decorative and
 * clickable; the controls beside it are the accessible way to operate it.
 */
import { useId, useState } from 'react';
import {
  FUNCTIONS,
  JACKS,
  TARGETS,
  read,
  type Fn,
  type Jack,
  type MeterState,
  type Target,
} from './multimeter/rules';
import { Chips, Digits } from './multimeter/parts';
import './multimeter/trainer.css';

export interface MultimeterTrainerProps {
  /** What the probes touch at first. */
  target?: Target;
  fn?: Fn;
  red?: Jack;
  /** Targets offered (default: all). */
  targets?: Target[];
}

// Selector positions: angle from the top, clockwise, in degrees.
const ANGLES: Record<Fn, number> = {
  off: -135,
  vdc: -90,
  vac: -45,
  ohm: 0,
  cont: 45,
  ma: 90,
  a: 135,
};
const KNOB = { x: 150, y: 296 };
const JACK_X: Record<Jack | 'com', number> = { '10a': 62, ma: 114, com: 186, vohm: 238 };
const JACK_Y = 452;

function polar(angle: number, radius: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [KNOB.x + radius * Math.sin(rad), KNOB.y - radius * Math.cos(rad)];
}

export default function MultimeterTrainer({
  target = 'pilha',
  fn = 'off',
  red = 'vohm',
  targets,
}: MultimeterTrainerProps) {
  const uid = useId();
  const [state, setState] = useState<MeterState>({
    fn,
    red,
    target,
    blown: { ma: false, '10a': false },
  });
  const [event, setEvent] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);

  const apply = (change: Partial<MeterState>) => {
    const next = { ...state, ...change };
    const r = read(next);
    if (r.blows && !next.blown[r.blows]) {
      next.blown = { ...next.blown, [r.blows]: true };
      setEvent(r.message);
      setFlash((n) => n + 1);
    } else {
      setEvent(null);
    }
    setState(next);
  };

  const reading = read(state);
  const shownStatus = event ? 'danger' : reading.status;
  const message = event ?? reading.message;
  const offered = TARGETS.filter((t) => !targets || targets.includes(t.id));
  const seriesTarget = state.target.startsWith('serie');
  const loadLabel = state.target === 'serie-led' ? 'LED' : 'Lâmpada';
  const anyBlown = state.blown.ma || state.blown['10a'];
  const [px, py] = polar(ANGLES[state.fn], 40);

  return (
    <div className="mt" data-trainer="multimetro">
      <div className={`mt-meter${flash ? ' is-flash' : ''}`} key={flash}>
        <svg viewBox="0 0 300 540" aria-hidden="true" focusable="false">
          <rect x="4" y="4" width="292" height="532" rx="36" className="mt-holster" />
          <rect x="22" y="22" width="256" height="496" rx="22" className="mt-body" />
          <rect x="40" y="40" width="220" height="116" rx="12" className="mt-bezel" />
          <rect
            x="50"
            y="50"
            width="200"
            height="96"
            rx="5"
            className={`mt-lcd${state.fn === 'off' ? ' is-off' : ''}`}
          />
          {state.fn !== 'off' && (
            <g className="mt-lcd-ink">
              <text x="58" y="66" className="mt-flag">
                {reading.flags.join('  ')}
              </text>
              {(state.fn === 'cont' || reading.beep) && (
                <text x="242" y="66" className={`mt-flag end${reading.beep ? '' : ' dim'}`}>
                  ·)))
                </text>
              )}
              {reading.digits && <Digits text={reading.digits} />}
              <text x="242" y="136" className="mt-unit">
                {reading.unit}
                {state.fn === 'vac' ? '~' : ''}
              </text>
            </g>
          )}

          <g className="mt-buttons">
            {['HOLD', 'SELECT', 'RANGE'].map((b, i) => (
              <g key={b} transform={`translate(${52 + i * 70} 172)`}>
                <rect width="56" height="22" rx="8" />
                <text x="28" y="15">
                  {b}
                </text>
              </g>
            ))}
          </g>

          {/* Selector */}
          <circle cx={KNOB.x} cy={KNOB.y} r="70" className="mt-dial" />
          {FUNCTIONS.map((f) => {
            const [x, y] = polar(ANGLES[f.id], 96);
            const [tx, ty] = polar(ANGLES[f.id], 72);
            const current = f.id === 'ma' || f.id === 'a';
            return (
              <g
                key={f.id}
                className={`mt-pos${state.fn === f.id ? ' is-on' : ''}${current ? ' is-current' : ''}`}
                onClick={() => apply({ fn: f.id })}
              >
                <circle cx={x} cy={y} r="17" className="mt-hit" />
                <line
                  x1={tx}
                  y1={ty}
                  x2={polar(ANGLES[f.id], 78)[0]}
                  y2={polar(ANGLES[f.id], 78)[1]}
                />
                <text x={x} y={y + 5}>
                  {f.symbol}
                </text>
              </g>
            );
          })}
          <g className="mt-knob">
            <circle cx={KNOB.x} cy={KNOB.y} r="54" />
            <rect
              x={KNOB.x - 9}
              y={KNOB.y - 54}
              width="18"
              height="108"
              rx="9"
              transform={`rotate(${ANGLES[state.fn]} ${KNOB.x} ${KNOB.y})`}
              className="mt-grip"
            />
            <line x1={KNOB.x} y1={KNOB.y} x2={px} y2={py} className="mt-pointer" />
          </g>

          {/* Jacks */}
          <text x="150" y="386" className="mt-tiny">
            CAT III 600 V
          </text>
          {JACKS.map((j) => {
            const x = JACK_X[j.id];
            const isRed = j.id === state.red;
            const clickable = j.id !== 'com';
            return (
              <g
                key={j.id}
                className={`mt-jack${j.id === 'com' ? ' is-com' : ''}${clickable ? ' is-clickable' : ''}`}
                onClick={clickable ? () => apply({ red: j.id as Jack }) : undefined}
              >
                <circle cx={x} cy={JACK_Y} r="17" className="mt-jack-ring" />
                <circle cx={x} cy={JACK_Y} r="8" className="mt-jack-hole" />
                <text x={x} y={JACK_Y - 26}>
                  {j.label}
                </text>
                {j.id !== 'com' && j.id !== 'vohm' && (
                  <text
                    x={x}
                    y={JACK_Y - 46}
                    className={`mt-tiny${state.blown[j.id as 'ma' | '10a'] ? ' is-blown' : ''}`}
                  >
                    {state.blown[j.id as 'ma' | '10a']
                      ? 'QUEIMADO'
                      : `F ${j.id === 'ma' ? '400 mA' : '10 A'}`}
                  </text>
                )}
                {isRed && <Plug x={x} color="red" />}
                {j.id === 'com' && <Plug x={x} color="black" />}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-panel">
        <Chips
          legend="Seletor"
          name={`${uid}-fn`}
          value={state.fn}
          options={FUNCTIONS.map((f) => ({
            id: f.id,
            label: (
              <>
                <b>{f.symbol}</b> <span className="mt-chip-sub">{f.label}</span>
              </>
            ),
          }))}
          onChange={(v) => apply({ fn: v })}
        />
        <Chips
          legend="Ponta vermelha no borne (a preta fica no COM)"
          name={`${uid}-red`}
          value={state.red}
          options={JACKS.filter((j) => j.id !== 'com').map((j) => ({
            id: j.id as Jack,
            label: (
              <>
                <b>{j.label}</b> <span className="mt-chip-sub">{j.short}</span>
              </>
            ),
          }))}
          onChange={(v) => apply({ red: v })}
        />
        <fieldset className="mt-field">
          <legend>As pontas de prova encostam em</legend>
          <select
            className="mt-select"
            aria-label="As pontas de prova encostam em"
            value={state.target}
            onChange={(e) => apply({ target: e.target.value as Target })}
            aria-describedby={`${uid}-target`}
          >
            {offered.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="mt-hint" id={`${uid}-target`}>
            {TARGETS.find((t) => t.id === state.target)?.detail}
            {seriesTarget && (
              <span className={`mt-load${reading.loadOn ? ' is-on' : ''}`}>
                {loadLabel} {reading.loadOn ? 'acesa' : 'apagada'}
              </span>
            )}
          </p>
        </fieldset>

        <div className={`mt-status is-${shownStatus}`} role="status" aria-live="polite">
          <p className="mt-reading">
            Visor:{' '}
            <b>
              {state.fn === 'off'
                ? 'apagado'
                : `${reading.digits.trim().replace('.', ',') || '—'} ${reading.unit}${reading.beep ? ' (bipe)' : ''}`}
            </b>
          </p>
          <p>{message}</p>
        </div>

        {anyBlown && (
          <div className="mt-fuses">
            <span>
              Fusível queimado:{' '}
              {[state.blown.ma && 'borne mA (400 mA)', state.blown['10a'] && 'borne 10A (10 A)']
                .filter(Boolean)
                .join(' e ')}
            </span>
            <button
              type="button"
              className="mt-btn"
              onClick={() => {
                setEvent(null);
                setState({ ...state, blown: { ma: false, '10a': false } });
              }}
            >
              Trocar o fusível
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Plug({ x, color }: { x: number; color: 'red' | 'black' }) {
  return (
    <g className={`mt-plug is-${color}`}>
      <path
        d={`M${x} ${JACK_Y + 10} C ${x} ${JACK_Y + 60}, ${x + (color === 'red' ? 20 : -20)} 520, ${x + (color === 'red' ? 30 : -30)} 540`}
        className="mt-cable"
      />
      <rect x={x - 9} y={JACK_Y - 9} width="18" height="26" rx="5" className="mt-plug-body" />
    </g>
  );
}
