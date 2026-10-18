/**
 * Lesson 3.4: a bench of de-energized things to measure (extension cords,
 * wiring inside a wall, a gate motor, fuses, a switch, a resistor, a diode
 * and an LED). The student picks the function and touches the two probe tips
 * to labelled points; the display, the beeper and an explanation react
 * (rules in ./probe-bench/model.ts). The drawing is clickable; the controls
 * beside it are the accessible way to do the same.
 */
import { useId, useState, type ReactNode } from 'react';
import {
  FUNCTIONS,
  SCENARIOS,
  measure,
  scenarioById,
  spoken,
  type BenchState,
  type Fn,
  type Point,
  type Scenario,
} from './probe-bench/model';
import './probe-bench/probe-bench.css';

export interface ProbeBenchProps {
  /** Scenario shown first. */
  scenario?: string;
  fn?: Fn;
  /** Scenarios offered (default: all). */
  scenarios?: string[];
}

type Tip = 'red' | 'black';

const GROUPS = ['Cabos e fios', 'Peças'] as const;
const WIRES = ['m1', 'm2', 'm3'];
const pairKey = (a: string, b: string) => [a, b].sort().join('-');

export default function ProbeBench({
  scenario = 'extensao-a',
  fn = 'cont',
  scenarios,
}: ProbeBenchProps) {
  const uid = useId();
  const [state, setState] = useState<BenchState>({
    scenario,
    fn,
    red: null,
    black: null,
    options: {},
  });
  const [armed, setArmed] = useState<Tip>('red');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const current = scenarioById(state.scenario);
  const reading = measure(state);
  const offered = SCENARIOS.filter((s) => !scenarios || scenarios.includes(s.id));

  const update = (change: Partial<BenchState>) => {
    const next = { ...state, ...change };
    setState(next);
    if (next.scenario === 'motor' && next.fn === 'ohm' && next.red && next.black) {
      if (next.red !== next.black && WIRES.includes(next.red) && WIRES.includes(next.black)) {
        const r = measure(next);
        setNotes((n) => ({ ...n, [pairKey(next.red!, next.black!)]: spoken(r.digits, r.unit) }));
      }
    }
  };

  const touch = (id: string) => {
    update(armed === 'red' ? { red: id } : { black: id });
    setArmed(armed === 'red' ? 'black' : 'red');
  };

  const changeScenario = (id: string) => {
    setState({ ...state, scenario: id, red: null, black: null, options: {} });
    setArmed('red');
  };

  const fnInfo = FUNCTIONS.find((f) => f.id === state.fn)!;
  const shownText =
    reading.digits === 'OL' ? 'OL' : `${reading.digits.replace('.', ',')} ${reading.unit}`;

  return (
    <div className="pb" data-bench="pontas">
      <div className="pb-stage">
        <div className="pb-field">
          <label className="pb-legend" htmlFor={`${uid}-scenario`}>
            O que medir
          </label>
          <select
            id={`${uid}-scenario`}
            className="pb-select"
            value={state.scenario}
            onChange={(e) => changeScenario(e.target.value)}
            aria-describedby={`${uid}-detail`}
          >
            {GROUPS.map((g) => {
              const items = offered.filter((s) => s.group === g);
              return items.length ? (
                <optgroup key={g} label={g}>
                  {items.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
          <p className="pb-hint" id={`${uid}-detail`}>
            {current.detail}
          </p>
        </div>

        <div className="pb-drawing">
          <svg viewBox="0 0 360 220" aria-hidden="true" focusable="false">
            <Drawing scenario={current} options={state.options} glow={reading.glow} />
            {current.points.map((p) => (
              <PointMark
                key={p.id}
                point={p}
                red={state.red === p.id}
                black={state.black === p.id}
                onTouch={() => touch(p.id)}
              />
            ))}
          </svg>
        </div>

        <div className="pb-lcd" aria-hidden="true">
          <span className="pb-lcd-fn">{fnInfo.symbol}</span>
          <span className="pb-lcd-digits">{reading.digits}</span>
          <span className="pb-lcd-unit">{reading.unit}</span>
          <span className="pb-lcd-beep">{reading.beep ? '·))) BIP' : ''}</span>
        </div>
      </div>

      <div className="pb-panel">
        <Chips
          legend="Função do multímetro"
          name={`${uid}-fn`}
          value={state.fn}
          options={FUNCTIONS.map((f) => ({
            id: f.id,
            label: (
              <>
                <b>{f.symbol}</b> <span className="pb-chip-sub">{f.label}</span>
              </>
            ),
          }))}
          onChange={(v) => update({ fn: v })}
        />

        <fieldset className="pb-field">
          <legend className="pb-legend">Onde as pontas encostam</legend>
          <div className="pb-tips">
            <TipSelect
              id={`${uid}-red`}
              tip="red"
              value={state.red}
              points={current.points}
              onChange={(v) => update({ red: v })}
            />
            <TipSelect
              id={`${uid}-black`}
              tip="black"
              value={state.black}
              points={current.points}
              onChange={(v) => update({ black: v })}
            />
          </div>
          <p className="pb-hint">
            No desenho, o próximo clique encosta a ponta{' '}
            <button
              type="button"
              className={`pb-armed is-${armed}`}
              onClick={() => setArmed(armed === 'red' ? 'black' : 'red')}
              aria-label={`Ponta do próximo clique no desenho: ${armed === 'red' ? 'vermelha' : 'preta'}. Trocar`}
            >
              {armed === 'red' ? 'vermelha' : 'preta'}
            </button>
            .
          </p>
        </fieldset>

        {current.options?.map((o) => (
          <label key={o.id} className="pb-check">
            <input
              type="checkbox"
              checked={!!state.options[o.id]}
              onChange={(e) => update({ options: { ...state.options, [o.id]: e.target.checked } })}
            />
            <span>{o.label}</span>
          </label>
        ))}

        <div className={`pb-status is-${reading.tone}`} role="status" aria-live="polite">
          <p className="pb-reading">
            Visor: <b>{shownText}</b>
            {reading.beep ? ' (bipe)' : ''}
          </p>
          <p>{reading.message}</p>
        </div>

        {state.scenario === 'motor' && <MotorNotes notes={notes} />}
      </div>
    </div>
  );
}

function Chips<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: { id: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="pb-field">
      <legend className="pb-legend">{legend}</legend>
      <div className="pb-chips">
        {options.map((o) => (
          <label key={o.id} className={`pb-chip${value === o.id ? ' is-on' : ''}`}>
            <input
              type="radio"
              name={name}
              value={o.id}
              checked={value === o.id}
              onChange={() => onChange(o.id)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TipSelect({
  id,
  tip,
  value,
  points,
  onChange,
}: {
  id: string;
  tip: Tip;
  value: string | null;
  points: Point[];
  onChange: (v: string | null) => void;
}) {
  return (
    <div className={`pb-tip is-${tip}`}>
      <label htmlFor={id}>Ponta {tip === 'red' ? 'vermelha' : 'preta'}</label>
      <select
        id={id}
        className="pb-select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">No ar</option>
        {points.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function MotorNotes({ notes }: { notes: Record<string, string> }) {
  const pairs: [string, string, string][] = [
    ['m1', 'm2', '1 e 2'],
    ['m1', 'm3', '1 e 3'],
    ['m2', 'm3', '2 e 3'],
  ];
  const values = pairs.map(([a, b]) => notes[pairKey(a, b)]);
  const done = values.every(Boolean);
  let conclusion = '';
  if (done) {
    const num = values.map((v) => (v === 'OL' ? Infinity : parseFloat(v!.replace(',', '.'))));
    const max = num.indexOf(Math.max(...num));
    const [a, b] = pairs[max]!;
    const common = WIRES.find((w) => w !== a && w !== b)!.slice(1);
    conclusion = `O par de maior resistência é ${pairs[max]![2]}: são as pontas dos dois enrolamentos. O fio ${common} é o comum.`;
  }
  return (
    <div className="pb-notes">
      <p className="pb-legend">Suas anotações (função Ω)</p>
      <table>
        <thead>
          <tr>
            <th scope="col">Fios</th>
            <th scope="col">Leitura</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map(([a, b, label], i) => (
            <tr key={pairKey(a, b)}>
              <td>{label}</td>
              <td>{values[i] ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pb-hint">{done ? conclusion : 'Meça os três pares de fios na função Ω.'}</p>
    </div>
  );
}

function PointMark({
  point,
  red,
  black,
  onTouch,
}: {
  point: Point;
  red: boolean;
  black: boolean;
  onTouch: () => void;
}) {
  const { x, y, lp = 'above' } = point;
  const from = point.probe ?? (lp === 'above' ? 'below' : 'above');
  const label = {
    above: { x, y: y - 14, anchor: 'middle' },
    below: { x, y: y + 23, anchor: 'middle' },
    left: { x: x - 13, y: y + 4, anchor: 'end' },
    right: { x: x + 13, y: y + 4, anchor: 'start' },
  }[lp] as { x: number; y: number; anchor: 'middle' | 'start' | 'end' };
  return (
    <g className="pb-point" onClick={onTouch}>
      <circle cx={x} cy={y} r="16" className="pb-hit" />
      <circle cx={x} cy={y} r="6" className="pb-dot" />
      <text x={label.x} y={label.y} textAnchor={label.anchor} className="pb-label">
        {point.short}
      </text>
      {red && <Probe x={x} y={y} tip="red" from={from} />}
      {black && <Probe x={x} y={y} tip="black" from={from} />}
    </g>
  );
}

/** A probe tip touching (x, y), drawn coming from above and turned to `from`. */
function Probe({
  x,
  y,
  tip,
  from,
}: {
  x: number;
  y: number;
  tip: Tip;
  from: 'above' | 'below' | 'left';
}) {
  const dx = tip === 'red' ? -1 : 1;
  const transform = {
    above: undefined,
    below: `translate(0 ${2 * y}) scale(1 -1)`,
    // Mirrored across the diagonal: red from the upper left, black from the lower left.
    left: `matrix(0 1 1 0 ${x - y} ${y - x})`,
  }[from];
  return (
    <g className={`pb-probe is-${tip}`} transform={transform}>
      <line x1={x + dx * 26} y1={y - 40} x2={x + dx * 12} y2={y - 18} className="pb-probe-body" />
      <line x1={x + dx * 12} y1={y - 18} x2={x + dx * 2} y2={y - 3} className="pb-probe-needle" />
    </g>
  );
}

// Drawings (viewBox 360 × 220)

function Drawing({
  scenario,
  options,
  glow,
}: {
  scenario: Scenario;
  options: Record<string, boolean>;
  glow: boolean;
}) {
  switch (scenario.kind) {
    case 'extensao':
      return (
        <g>
          <path d="M134 110 C 186 176, 206 44, 252 110" className="pb-cable" />
          <rect x="56" y="88" width="30" height="8" rx="4" className="pb-metal" />
          <rect x="56" y="124" width="30" height="8" rx="4" className="pb-metal" />
          <rect x="82" y="76" width="54" height="68" rx="12" className="pb-plastic-dark" />
          <rect x="250" y="62" width="100" height="96" rx="16" className="pb-plastic" />
          <circle cx="300" cy="110" r="34" className="pb-socket" />
          <circle cx="284" cy="110" r="5" className="pb-hole" />
          <circle cx="316" cy="110" r="5" className="pb-hole" />
          <text x="180" y="30" className="pb-caption">
            {scenario.label}: cabo de 5 m
          </text>
        </g>
      );
    case 'parede':
      return (
        <g>
          <rect x="128" y="34" width="112" height="170" className="pb-wall" />
          <text x="184" y="26" className="pb-caption">
            15 m dentro da parede
          </text>
          <rect x="14" y="40" width="58" height="150" rx="6" className="pb-plastic" />
          <rect x="28" y="56" width="30" height="46" rx="3" className="pb-plastic-dark" />
          <rect x="37" y="80" width="12" height="16" rx="2" className="pb-lever" />
          <text x="43" y="118" className="pb-tiny">
            DESL.
          </text>
          <text x="43" y="182" className="pb-tiny">
            Quadro
          </text>
          <line x1="84" y1="84" x2="306" y2="84" className="pb-wire is-black" />
          <line x1="84" y1="144" x2="306" y2="144" className="pb-wire is-blue" />
          <rect x="280" y="56" width="66" height="116" rx="10" className="pb-plastic" />
          <circle cx="306" cy="84" r="5" className="pb-metal" />
          <circle cx="306" cy="144" r="5" className="pb-metal" />
          {options.jumper && (
            <>
              <path d="M306 84 C 284 96, 284 132, 306 144" className="pb-wire is-jumper" />
              <text x="326" y="118" className="pb-tiny is-dark">
                jumper
              </text>
            </>
          )}
          <text x="313" y="190" className="pb-tiny">
            Tomada
          </text>
        </g>
      );
    case 'motor':
      return (
        <g>
          <rect x="24" y="100" width="24" height="16" rx="3" className="pb-metal" />
          <rect x="44" y="52" width="160" height="112" rx="22" className="pb-motor" />
          {[70, 92, 114, 136, 158, 180].map((x) => (
            <line key={x} x1={x} y1="58" x2={x} y2="158" className="pb-fin" />
          ))}
          <rect x="200" y="94" width="24" height="30" rx="4" className="pb-plastic-dark" />
          <path d="M222 102 C 252 96, 262 44, 296 44" className="pb-wire is-black" />
          <path d="M222 110 C 260 110, 280 110, 316 110" className="pb-wire is-white" />
          <path d="M222 118 C 252 124, 262 176, 296 176" className="pb-wire is-red" />
          <text x="124" y="40" className="pb-caption">
            Motor (valores de exemplo)
          </text>
        </g>
      );
    case 'fusivel-vidro':
    case 'fusivel-ceramico': {
      const glass = scenario.kind === 'fusivel-vidro';
      return (
        <g>
          <rect
            x="96"
            y="92"
            width="168"
            height="36"
            rx="6"
            className={glass ? 'pb-glass' : 'pb-ceramic'}
          />
          {glass ? (
            <path d="M98 110 C 140 104, 220 116, 262 110" className="pb-filament" />
          ) : (
            <text x="180" y="115" className="pb-tiny is-dark">
              10 A
            </text>
          )}
          <rect x="60" y="88" width="40" height="44" rx="6" className="pb-metal" />
          <rect x="260" y="88" width="40" height="44" rx="6" className="pb-metal" />
          <text x="180" y="166" className="pb-caption">
            {glass ? 'Vidro: o filamento aparece' : 'Cerâmico: não dá para ver por dentro'}
          </text>
        </g>
      );
    }
    case 'interruptor': {
      const on = !!options.ligado;
      return (
        <g>
          <rect x="110" y="20" width="140" height="190" rx="12" className="pb-plastic" />
          <rect x="140" y="34" width="80" height="92" rx="8" className="pb-rocker" />
          <rect
            x="140"
            y={on ? 34 : 80}
            width="80"
            height="46"
            rx="8"
            className="pb-rocker is-pressed"
          />
          <line x1="140" y1="80" x2="220" y2="80" className="pb-slot" />
          <circle cx="150" cy="168" r="9" className="pb-metal" />
          <circle cx="210" cy="168" r="9" className="pb-metal" />
          <line x1="145" y1="168" x2="155" y2="168" className="pb-slot" />
          <line x1="205" y1="168" x2="215" y2="168" className="pb-slot" />
        </g>
      );
    }
    case 'resistor':
      return (
        <g>
          <line x1="70" y1="110" x2="290" y2="110" className="pb-leg" />
          <rect x="126" y="94" width="108" height="32" rx="14" className="pb-resistor" />
          <rect x="146" y="94" width="9" height="32" fill="#7a4a24" />
          <rect x="164" y="94" width="9" height="32" fill="#1b1b1b" />
          <rect x="182" y="94" width="9" height="32" fill="#2e8b3d" />
          <rect x="210" y="94" width="9" height="32" fill="#c9a227" />
          {options.dedos && (
            <>
              <ellipse cx="70" cy="96" rx="24" ry="15" className="pb-finger" />
              <ellipse cx="290" cy="96" rx="24" ry="15" className="pb-finger" />
            </>
          )}
          <text x="180" y="160" className="pb-caption">
            Marrom, preto, verde: 1 MΩ
          </text>
        </g>
      );
    case 'diodo':
      return (
        <g>
          <line x1="70" y1="110" x2="290" y2="110" className="pb-leg" />
          <rect x="132" y="98" width="96" height="24" rx="5" className="pb-diode" />
          <rect x="206" y="98" width="10" height="24" className="pb-band" />
          <text x="180" y="160" className="pb-caption">
            A faixa marca o catodo
          </text>
        </g>
      );
    case 'led':
      return (
        <g>
          {glow && <circle cx="180" cy="86" r="52" className="pb-glow" />}
          <line x1="170" y1="126" x2="170" y2="196" className="pb-leg" />
          <line x1="190" y1="126" x2="190" y2="176" className="pb-leg" />
          <path
            d="M152 126 V 86 A 28 28 0 0 1 208 86 V 126 Z"
            className={`pb-led${glow ? ' is-on' : ''}`}
          />
          <path d="M146 126 H 204 V 118 H 146 Z" className={`pb-led${glow ? ' is-on' : ''}`} />
        </g>
      );
  }
}
