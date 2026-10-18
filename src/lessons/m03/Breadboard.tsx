/**
 * Lesson 3.6: an interactive breadboard. Clicking (or moving with the arrow
 * keys to) a hole lights every hole on the same metal strip; a switch reveals
 * the strips; three "find the error" layouts end with a question. The rules
 * live in ./breadboard/board.ts.
 */
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  COLS,
  HOLES,
  SCENARIOS,
  connected,
  hole,
  holeName,
  isRail,
  move,
  netOf,
  partsOnNet,
  stripName,
  type Part,
  type Row,
  type Scenario,
} from './breadboard/board';
import './breadboard/breadboard.css';

const P = 20;
const X0 = 46;
const Y: Record<Row, number> = {
  'T-': 30,
  'T+': 50,
  a: 104,
  b: 124,
  c: 144,
  d: 164,
  e: 184,
  f: 224,
  g: 244,
  h: 264,
  i: 284,
  j: 304,
  'B+': 350,
  'B-': 370,
};
const W = X0 + (COLS - 1) * P + 30;
const H = 396;

const x = (col: number) => X0 + (col - 1) * P;
const pos = (id: string): [number, number] => {
  const h = hole(id);
  return [x(h.col), Y[h.row]];
};

function Strips({ split }: { split: boolean }) {
  const cols = Array.from({ length: COLS }, (_, i) => i + 1);
  const rails: { row: Row; from: number; to: number }[] = [];
  for (const row of ['T-', 'T+', 'B+', 'B-'] as Row[]) {
    if (split) {
      rails.push({ row, from: 3, to: 13 }, { row, from: 18, to: 28 });
    } else rails.push({ row, from: 3, to: 28 });
  }
  return (
    <g className="bb-strips">
      {cols.map((c) => (
        <g key={c}>
          <rect x={x(c) - 5} y={Y.a - 7} width={10} height={Y.e - Y.a + 14} rx={3} />
          <rect x={x(c) - 5} y={Y.f - 7} width={10} height={Y.j - Y.f + 14} rx={3} />
        </g>
      ))}
      {rails.map((r) => (
        <rect
          key={`${r.row}${r.from}`}
          x={x(r.from) - 7}
          y={Y[r.row] - 5}
          width={x(r.to) - x(r.from) + 14}
          height={10}
          rx={3}
        />
      ))}
    </g>
  );
}

function RailLines({ split }: { split: boolean }) {
  const seg = (y: number, cls: string) =>
    split ? (
      <>
        <line x1={x(3) - 8} x2={x(13) + 8} y1={y} y2={y} className={cls} />
        <line x1={x(18) - 8} x2={x(28) + 8} y1={y} y2={y} className={cls} />
      </>
    ) : (
      <line x1={x(3) - 8} x2={x(28) + 8} y1={y} y2={y} className={cls} />
    );
  return (
    <g>
      {seg(16, 'bb-line-neg')}
      {seg(64, 'bb-line-pos')}
      {seg(336, 'bb-line-pos')}
      {seg(384, 'bb-line-neg')}
      <text x={18} y={Y['T-'] + 4} className="bb-rail-sign neg">
        −
      </text>
      <text x={18} y={Y['T+'] + 4} className="bb-rail-sign pos">
        +
      </text>
      <text x={18} y={Y['B+'] + 4} className="bb-rail-sign pos">
        +
      </text>
      <text x={18} y={Y['B-'] + 4} className="bb-rail-sign neg">
        −
      </text>
    </g>
  );
}

function PartShape({ part }: { part: Part }) {
  if (part.kind === 'lead+' || part.kind === 'lead-') {
    const [hx, hy] = pos(part.legs[0]!);
    const plus = part.kind === 'lead+';
    return (
      <g className="bb-part">
        <path
          d={`M0 ${hy - 6} C${hx - 30} ${hy - 6} ${hx - 14} ${hy} ${hx} ${hy}`}
          className={plus ? 'bb-lead pos' : 'bb-lead neg'}
        />
        <circle cx={hx} cy={hy} r={3.5} className={plus ? 'bb-pin pos' : 'bb-pin neg'} />
      </g>
    );
  }
  const [x1, y1] = pos(part.legs[0]!);
  const [x2, y2] = pos(part.legs[1]!);
  if (part.kind === 'jumper') {
    const lift = Math.max(24, Math.hypot(x2 - x1, y2 - y1) * 0.25);
    const mx = (x1 + x2) / 2;
    const my = Math.min(y1, y2) - lift;
    return (
      <g className="bb-part">
        <path
          d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`}
          className="bb-jumper"
          style={{ stroke: part.color }}
        />
        <circle cx={x1} cy={y1} r={3} className="bb-pin" />
        <circle cx={x2} cy={y2} r={3} className="bb-pin" />
      </g>
    );
  }
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  if (part.kind === 'resistor') {
    return (
      <g className="bb-part">
        <line x1={x1} y1={y1} x2={x2} y2={y2} className="bb-leg" />
        <g transform={`translate(${mx} ${my}) rotate(${angle})`}>
          <rect x={-17} y={-6} width={34} height={12} rx={5} className="bb-resistor" />
          <rect x={-11} y={-6} width={3} height={12} className="bb-band orange" />
          <rect x={-5} y={-6} width={3} height={12} className="bb-band orange" />
          <rect x={1} y={-6} width={3} height={12} className="bb-band brown" />
          <rect x={10} y={-6} width={3} height={12} className="bb-band gold" />
        </g>
      </g>
    );
  }
  // LED: legs to a dome between them, flat side on the cathode.
  return (
    <g className="bb-part">
      <line x1={x1} y1={y1} x2={mx} y2={my} className="bb-leg" />
      <line x1={mx} y1={my} x2={x2} y2={y2} className="bb-leg" />
      <g transform={`translate(${mx} ${my}) rotate(${angle - 90})`}>
        <path d="M-9 4 A9 9 0 1 1 9 4 L9 7 L-9 7 Z" className="bb-led" />
      </g>
    </g>
  );
}

export default function Breadboard() {
  const uid = useId();
  const [mode, setMode] = useState<'livre' | Scenario['id']>('livre');
  const [freeSplit, setFreeSplit] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [active, setActive] = useState('a1');
  const [picked, setPicked] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const board = useRef<SVGGElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const scenario = SCENARIOS.find((s) => s.id === mode);
  const split = scenario ? scenario.split : freeSplit;
  const parts = useMemo(() => scenario?.parts ?? [], [scenario]);
  const lit = useMemo(() => new Set(picked ? connected(picked, split) : []), [picked, split]);
  const legHoles = useMemo(() => new Set(parts.flatMap((p) => p.legs)), [parts]);

  const select = (id: string, focus = false) => {
    setActive(id);
    setPicked(id);
    if (focus) {
      requestAnimationFrame(() =>
        board.current?.querySelector<SVGElement>(`[data-hole="${id}"]`)?.focus(),
      );
    }
  };

  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    const step: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const d = step[e.key];
    if (!d) return;
    e.preventDefault();
    select(move(active, d[0], d[1]), true);
  };

  const status = (() => {
    if (!picked) return null;
    const others = connected(picked, split).filter((h) => h !== picked);
    const on = partsOnNet(parts, netOf(picked, split), split);
    return {
      title: `${holeName(picked).replace(/^./, (c) => c.toUpperCase())}`,
      strip: `Ligado a mais ${others.length} furos: ${stripName(picked, split)}.`,
      parts: on.length ? `Nesta trilha: ${on.join(', ')}.` : 'Nada mais está ligado nesta trilha.',
    };
  })();

  const choose = (m: typeof mode) => {
    setMode(m);
    setPicked(null);
    // On a phone the board scrolls sideways: center it on the resistor and LED.
    const el = scroller.current;
    const cols = (SCENARIOS.find((s) => s.id === m)?.parts ?? [])
      .filter((p) => p.kind === 'resistor' || p.kind === 'led')
      .flatMap((p) => p.legs.map((l) => hole(l).col));
    if (el && cols.length) {
      const mid = cols.reduce((a, b) => a + b, 0) / cols.length;
      el.scrollLeft = (x(mid) / W) * el.scrollWidth - el.clientWidth / 2;
    }
  };

  return (
    <div className="bb">
      <div className="bb-board" ref={scroller}>
        <svg viewBox={`0 0 ${W} ${H}`}>
          <rect x={4} y={2} width={W - 8} height={H - 4} rx={10} className="bb-body" />
          <rect
            x={X0 - 14}
            y={Y.e + 12}
            width={x(COLS) - X0 + 28}
            height={16}
            className="bb-channel"
          />
          {reveal && <Strips split={split} />}
          <RailLines split={split} />
          {Array.from({ length: COLS }, (_, i) => i + 1)
            .filter((c) => c === 1 || c % 5 === 0)
            .map((c) => (
              <g key={c}>
                <text x={x(c)} y={88} className="bb-num">
                  {c}
                </text>
                <text x={x(c)} y={326} className="bb-num">
                  {c}
                </text>
              </g>
            ))}
          {(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as Row[]).map((r) => (
            <text key={r} x={24} y={Y[r] + 4} className="bb-num">
              {r.toUpperCase()}
            </text>
          ))}
          <g ref={board} role="group" aria-label="Furos da protoboard" onKeyDown={onKey}>
            {HOLES.map((h) => {
              const cx = x(h.col);
              const cy = Y[h.row];
              const on = lit.has(h.id);
              const cls = [
                'bb-hole',
                on ? 'is-lit' : '',
                h.id === picked ? 'is-picked' : '',
                isRail(h.row) ? 'is-rail' : '',
              ].join(' ');
              return (
                <g
                  key={h.id}
                  data-hole={h.id}
                  className={cls}
                  role="button"
                  tabIndex={h.id === active ? 0 : -1}
                  aria-label={`${holeName(h.id)}${legHoles.has(h.id) ? ', com uma peça encaixada' : ''}`}
                  aria-pressed={h.id === picked}
                  onClick={() => select(h.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      select(h.id);
                    }
                  }}
                >
                  <rect x={cx - P / 2} y={cy - P / 2} width={P} height={P} className="bb-hit" />
                  <rect x={cx - 3.5} y={cy - 3.5} width={7} height={7} rx={1} className="bb-dot" />
                </g>
              );
            })}
          </g>
          {parts.map((p) => (
            <PartShape key={p.id} part={p} />
          ))}
        </svg>
      </div>
      <p className="bb-scroll-hint">Arraste a placa para o lado para ver todas as 30 colunas.</p>

      <div className="bb-panel">
        <fieldset className="bb-field">
          <legend>O que fazer</legend>
          <div className="bb-chips" role="radiogroup">
            {[{ id: 'livre', title: 'Explorar livre' }, ...SCENARIOS].map((s, i) => (
              <label key={s.id} className={`bb-chip${mode === s.id ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name={`${uid}-mode`}
                  value={s.id}
                  checked={mode === s.id}
                  onChange={() => choose(s.id)}
                />
                {i === 0 ? s.title : `Defeito ${i}: ${s.title}`}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="bb-switches">
          <label className="bb-check">
            <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} />
            Mostrar as trilhas de metal por dentro
          </label>
          {!scenario && (
            <label className="bb-check">
              <input
                type="checkbox"
                checked={freeSplit}
                onChange={(e) => {
                  setFreeSplit(e.target.checked);
                }}
              />
              Protoboard grande, com trilhos divididos no meio
            </label>
          )}
        </div>

        <div className="bb-status" role="status" aria-live="polite">
          {status ? (
            <>
              <p className="bb-status-title">{status.title}</p>
              <p>{status.strip}</p>
              {scenario && <p>{status.parts}</p>}
            </>
          ) : (
            <p>Clique num furo (ou use Tab e as setas) para ver que furos estão ligados a ele.</p>
          )}
        </div>

        {scenario && (
          <fieldset className="bb-field bb-question">
            <legend>{scenario.title}</legend>
            <p className="bb-symptom">{scenario.symptom}</p>
            <p className="bb-ask">{scenario.question}</p>
            {scenario.options.map((o, i) => {
              const chosen = answers[scenario.id] === i;
              return (
                <label
                  key={i}
                  className={`bb-option${chosen ? (o.correct ? ' is-right' : ' is-wrong') : ''}`}
                >
                  <input
                    type="radio"
                    name={`${uid}-${scenario.id}`}
                    checked={chosen}
                    onChange={() => setAnswers((a) => ({ ...a, [scenario.id]: i }))}
                  />
                  <span>{o.text}</span>
                </label>
              );
            })}
            {answers[scenario.id] !== undefined && (
              <p
                className={`bb-feedback${scenario.options[answers[scenario.id]!]!.correct ? ' is-right' : ' is-wrong'}`}
                role="status"
              >
                {scenario.options[answers[scenario.id]!]!.correct ? 'Certo. ' : 'Ainda não. '}
                {scenario.options[answers[scenario.id]!]!.feedback}
              </p>
            )}
          </fieldset>
        )}
      </div>
    </div>
  );
}
