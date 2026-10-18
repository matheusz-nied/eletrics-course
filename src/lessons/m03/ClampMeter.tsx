/**
 * Lesson 3.3: a clamp meter (alicate amperímetro) to play with. The student
 * chooses the load, what the jaw surrounds and the kind of clamp; the drawing
 * shows the conductors inside the jaw and the display reacts as on a real
 * clamp (rules in ./clamp/rules.ts). The drawing is decorative; the controls
 * beside it are the accessible way to operate it.
 */
import { useId, useState } from 'react';
import { CLAMPS, JAWS, LOADS, clampRead, type Clamp, type Jaw, type Load } from './clamp/rules';
import { Chips, Digits } from './multimeter/parts';
import './multimeter/trainer.css';
import './clamp/clamp.css';

export interface ClampMeterProps {
  load?: Load;
  jaw?: Jaw;
  clamp?: Clamp;
}

const JAW = { x: 150, y: 108 };

/** A conductor seen end-on: ⊙ current coming toward you, ⊗ going away. */
function Conductor({
  x,
  y,
  r = 12,
  kind,
  toward,
}: {
  x: number;
  y: number;
  r?: number;
  kind: 'f' | 'n' | 'pos' | 'neg';
  toward: boolean;
}) {
  const k = r * 0.45;
  return (
    <g className={`cl-cond is-${kind}`}>
      <circle cx={x} cy={y} r={r} className="cl-cond-ins" />
      <circle cx={x} cy={y} r={r * 0.62} className="cl-cond-cu" />
      {toward ? (
        <circle cx={x} cy={y} r={r * 0.18} className="cl-mark" />
      ) : (
        <path
          d={`M${x - k} ${y - k}L${x + k} ${y + k}M${x + k} ${y - k}L${x - k} ${y + k}`}
          className="cl-mark-x"
        />
      )}
    </g>
  );
}

export default function ClampMeter({
  load = 'chuveiro',
  jaw = 'cabo',
  clamp = 'ca',
}: ClampMeterProps) {
  const uid = useId();
  const [state, setState] = useState({ load, jaw, clamp });
  const reading = clampRead(state.load, state.jaw, state.clamp);
  const l = LOADS.find((x) => x.id === state.load)!;
  const go: 'f' | 'pos' = l.dc ? 'pos' : 'f';
  const back: 'n' | 'neg' = l.dc ? 'neg' : 'n';
  const dcMode = state.clamp === 'cacc-dc';
  const shown = reading.digits.trim().replace('.', ',');

  return (
    <div className="mt" data-trainer="alicate">
      <div className="mt-meter cl-meter">
        <svg viewBox="0 0 300 470" aria-hidden="true" focusable="false">
          {/* Body */}
          <rect x="70" y="168" width="160" height="292" rx="26" className="cl-body" />
          <rect x="52" y="186" width="22" height="78" rx="8" className="cl-trigger" />
          <rect x="70" y="168" width="160" height="22" className="cl-guard" />

          {/* Conductors and the jaw around them */}
          {state.jaw !== 'cabo' && state.jaw !== 'vazia' && (
            <circle
              cx={JAW.x}
              cy={JAW.y}
              r={state.jaw === 'separador' ? 44 : 34}
              className={`cl-field${state.jaw === 'separador' ? ' is-strong' : ''}`}
            />
          )}
          {state.jaw === 'um' && (
            <>
              <Conductor x={JAW.x} y={JAW.y} kind={go} toward />
              <Conductor x={272} y={JAW.y} kind={back} toward={false} />
            </>
          )}
          {state.jaw === 'cabo' && (
            <>
              <rect
                x={JAW.x - 34}
                y={JAW.y - 19}
                width="68"
                height="38"
                rx="19"
                className="cl-sheath"
              />
              <Conductor x={JAW.x - 15} y={JAW.y} r={11} kind={go} toward />
              <Conductor x={JAW.x + 15} y={JAW.y} r={11} kind={back} toward={false} />
            </>
          )}
          {state.jaw === 'separador' && (
            <>
              {Array.from({ length: 10 }, (_, i) => {
                const a = (i / 10) * 2 * Math.PI;
                return (
                  <Conductor
                    key={i}
                    x={JAW.x + 20 * Math.cos(a)}
                    y={JAW.y + 20 * Math.sin(a)}
                    r={6.5}
                    kind={go}
                    toward
                  />
                );
              })}
              <Conductor x={272} y={JAW.y} kind={back} toward={false} />
            </>
          )}
          {state.jaw === 'vazia' && (
            <>
              <Conductor x={272} y={JAW.y - 16} kind={go} toward />
              <Conductor x={272} y={JAW.y + 16} kind={back} toward={false} />
            </>
          )}
          <circle cx={JAW.x} cy={JAW.y} r="72" className="cl-jaw" />
          <line x1={JAW.x} y1={JAW.y - 86} x2={JAW.x} y2={JAW.y - 58} className="cl-split" />

          {/* Display */}
          <rect x="74" y="198" width="152" height="92" rx="10" className="mt-bezel" />
          <rect x="80" y="204" width="140" height="80" rx="5" className="mt-lcd" />
          <g className="mt-lcd-ink" transform="translate(150 244) scale(0.72) translate(-150 -244)">
            <text x="62" y="206" className="mt-flag">
              {reading.flags.join('  ')}
            </text>
            <Digits text={reading.digits} x={64} y={214} />
            <text x="238" y="290" className="mt-unit">
              {dcMode ? 'A⎓' : 'A~'}
            </text>
          </g>

          {/* Selector */}
          <circle cx="150" cy="352" r="34" className="mt-dial" />
          <text x="102" y="322" className="cl-pos">
            OFF
          </text>
          <text x="150" y="306" className={`cl-pos${dcMode ? '' : ' is-current'}`}>
            A~
          </text>
          {state.clamp !== 'ca' && (
            <text x="198" y="322" className={`cl-pos${dcMode ? ' is-current' : ''}`}>
              A⎓
            </text>
          )}
          <line
            x1="150"
            y1="352"
            x2={dcMode ? 172 : 150}
            y2={dcMode ? 330 : 324}
            className="mt-pointer"
          />
          <text x="150" y="416" className="mt-tiny">
            {state.clamp === 'ca' ? 'CA 600 A' : 'CA/CC 600 A'}
          </text>
          <text x="150" y="432" className="mt-tiny">
            CAT III 600 V
          </text>
        </svg>
      </div>

      <div className="mt-panel">
        <fieldset className="mt-field">
          <legend>Aparelho ligado</legend>
          <select
            className="mt-select"
            aria-label="Aparelho ligado"
            aria-describedby={`${uid}-load`}
            value={state.load}
            onChange={(e) => setState({ ...state, load: e.target.value as Load })}
          >
            {LOADS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
          <p className="mt-hint" id={`${uid}-load`}>
            {l.detail}
          </p>
        </fieldset>
        <Chips
          legend="Dentro da garra"
          name={`${uid}-jaw`}
          value={state.jaw}
          options={JAWS.map((j) => ({ id: j.id, label: j.label }))}
          onChange={(v) => setState({ ...state, jaw: v })}
        />
        <Chips
          legend="Alicate"
          name={`${uid}-clamp`}
          value={state.clamp}
          options={CLAMPS.map((c) => ({ id: c.id, label: c.label }))}
          onChange={(v) => setState({ ...state, clamp: v })}
        />
        <div className={`mt-status is-${reading.status}`} role="status" aria-live="polite">
          <p className="mt-reading">
            Visor: <b>{shown === 'OL' ? 'OL' : `${shown} A`}</b>
          </p>
          <p>{reading.message}</p>
        </div>
        <p className="mt-hint">
          No desenho, os condutores aparecem de frente: ⊙ é a corrente vindo na sua direção e ⊗ é a
          corrente indo embora. O círculo tracejado é o campo magnético que a garra sente.
        </p>
      </div>
    </div>
  );
}
