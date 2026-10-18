/**
 * Lesson 3.6: a bench power supply to play with. The student sets the
 * voltage and the current limit, turns the output on and picks a load; the
 * displays, the CV/CC lights and the load react as on a real supply (rules in
 * ./bench/supply.ts). The drawing is decorative; the controls beside it are
 * the accessible way to operate it.
 */
import { useId, useState } from 'react';
import { I_MAX, LOADS, V_MAX, read, type LoadId, type SupplyState } from './bench/supply';
import './bench/bench.css';

const SEG: Record<string, string> = {
  a: '3,0 15,0 12,3 6,3',
  b: '15.6,1.4 15.6,13.8 12.6,12.2 12.6,4.4',
  c: '15.6,16.2 15.6,28.6 12.6,25.6 12.6,17.8',
  d: '6,27 12,27 15,30 3,30',
  e: '0.4,16.2 3.4,17.8 3.4,25.6 0.4,28.6',
  f: '0.4,1.4 3.4,4.4 3.4,12.2 0.4,13.8',
  g: '3.6,15 5,13.6 11,13.6 12.4,15 11,16.4 5,16.4',
};
const CHARS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
};

/** Four seven-segment digits, like "12.00" or "0.417". */
function Digits({
  text,
  x,
  y,
  className,
}: {
  text: string;
  x: number;
  y: number;
  className: string;
}) {
  const cells: { c: string; dp: boolean }[] = [];
  for (const ch of text) {
    if (ch === '.') {
      if (cells.length) cells[cells.length - 1]!.dp = true;
    } else cells.push({ c: ch, dp: false });
  }
  while (cells.length < 4) cells.unshift({ c: ' ', dp: false });
  return (
    <g transform={`translate(${x} ${y}) skewX(-6)`} className={className}>
      {cells.slice(-4).map((cell, i) => (
        <g key={i} transform={`translate(${i * 29} 0) scale(1.35)`}>
          {Object.entries(SEG).map(([s, pts]) => (
            <polygon
              key={s}
              points={pts}
              className={(CHARS[cell.c] ?? '').includes(s) ? 'bs-seg on' : 'bs-seg'}
            />
          ))}
          <circle cx={17.6} cy={29} r={1.4} className={cell.dp ? 'bs-seg on' : 'bs-seg'} />
        </g>
      ))}
    </g>
  );
}

const voltsText = (v: number) => (v < 10 ? v.toFixed(2) : v.toFixed(2).slice(0, 5));
const ampsText = (i: number) => i.toFixed(3);
const br = (x: number, d: number) =>
  x.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

function Knob({ cx, cy, frac, label }: { cx: number; cy: number; frac: number; label: string }) {
  const angle = -135 + 270 * frac;
  return (
    <g>
      <circle cx={cx} cy={cy} r={24} className="bs-knob" />
      <line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={cy - 19}
        className="bs-knob-mark"
        transform={`rotate(${angle} ${cx} ${cy})`}
      />
      <text x={cx} y={cy + 40} className="bs-label">
        {label}
      </text>
    </g>
  );
}

function Load({
  load,
  glow,
  hot,
  burned,
}: {
  load: LoadId;
  glow: number;
  hot: boolean;
  burned: boolean;
}) {
  const wires = <path d="M150 196 V250 H160 M200 196 V250 H190" className="bs-wire-pair" />;
  switch (load) {
    case 'nada':
      return (
        <text x={175} y={260} className="bs-label dim">
          bornes livres
        </text>
      );
    case 'curto':
      return <path d="M150 196 V240 H200 V196" className="bs-short" />;
    case 'lampada':
      return (
        <g>
          <path d="M150 196 V262 H166 M200 196 V262 H184" className="bs-wire-pair" />
          <circle
            cx={175}
            cy={248}
            r={22}
            className="bs-glow"
            style={{ opacity: burned ? 0 : glow }}
          />
          <circle cx={175} cy={248} r={16} className="bs-bulb" />
          <path
            d={burned ? 'M168 252 l4 -6 M182 252 l-4 -6' : 'M168 252 q7 -12 14 0'}
            className="bs-filament"
          />
          <rect x={166} y={262} width={18} height={10} rx={2} className="bs-base" />
        </g>
      );
    case 'led':
      return (
        <g>
          {wires}
          <circle
            cx={175}
            cy={244}
            r={18}
            className="bs-glow led"
            style={{ opacity: burned ? 0 : glow }}
          />
          <path
            d="M163 252 A12 12 0 1 1 187 252 Z"
            className={burned ? 'bs-led burned' : 'bs-led'}
          />
        </g>
      );
    default:
      return (
        <g>
          {wires}
          <rect
            x={157}
            y={243}
            width={36}
            height={14}
            rx={5}
            className={hot ? 'bs-res hot' : burned ? 'bs-res burned' : 'bs-res'}
          />
        </g>
      );
  }
}

export default function BenchSupply() {
  const uid = useId();
  const [state, setState] = useState<SupplyState>({
    vSet: 12,
    iLimit: 1,
    on: false,
    load: 'lampada',
  });
  const [event, setEvent] = useState<string | null>(null);

  const apply = (patch: Partial<SupplyState>) => {
    const next: SupplyState = { ...state, ...patch };
    if (patch.load && patch.load !== state.load) next.burned = false;
    next.vSet = Math.round(Math.min(V_MAX, Math.max(0, next.vSet)) * 10) / 10;
    next.iLimit = Math.round(Math.min(I_MAX, Math.max(0, next.iLimit)) * 100) / 100;
    const r = read(next);
    if (r.burns && next.on && !next.burned) {
      next.burned = true;
      setEvent(r.message);
    } else if (patch.load !== undefined || patch.burned === false) {
      setEvent(null);
    }
    setState(next);
  };

  const r = read(state);
  const shownV = state.on ? r.v : state.vSet;
  const shownI = state.on ? r.i : state.iLimit;
  const loadInfo = LOADS.find((l) => l.id === state.load)!;
  const status = event ? 'danger' : r.status;

  return (
    <div className="bs">
      <div className="bs-device" aria-hidden="true">
        <svg viewBox="0 0 350 290">
          <rect x={6} y={6} width={338} height={200} rx={12} className="bs-case" />
          <rect x={6} y={6} width={338} height={22} rx={12} className="bs-top" />
          <rect x={22} y={38} width={150} height={60} rx={6} className="bs-display" />
          <rect x={182} y={38} width={150} height={60} rx={6} className="bs-display" />
          <Digits
            text={voltsText(shownV)}
            x={40}
            y={48}
            className={state.on ? 'bs-digits v' : 'bs-digits v dim'}
          />
          <Digits
            text={ampsText(shownI)}
            x={200}
            y={48}
            className={state.on ? 'bs-digits a' : 'bs-digits a dim'}
          />
          <text x={162} y={92} className="bs-unit v">
            V
          </text>
          <text x={322} y={92} className="bs-unit a">
            A
          </text>
          <circle
            cx={36}
            cy={118}
            r={6}
            className={r.mode === 'cv' ? 'bs-led-ind cv on' : 'bs-led-ind cv'}
          />
          <text x={48} y={122} className="bs-label start">
            CV
          </text>
          <circle
            cx={86}
            cy={118}
            r={6}
            className={r.mode === 'cc' ? 'bs-led-ind cc on' : 'bs-led-ind cc'}
          />
          <text x={98} y={122} className="bs-label start">
            CC
          </text>
          <rect
            x={22}
            y={140}
            width={78}
            height={24}
            rx={5}
            className={state.on ? 'bs-out on' : 'bs-out'}
          />
          <text x={61} y={156} className="bs-label light">
            OUTPUT
          </text>
          <Knob cx={234} cy={136} frac={state.vSet / V_MAX} label="VOLTAGE" />
          <Knob cx={300} cy={136} frac={state.iLimit / I_MAX} label="CURRENT" />
          <circle cx={150} cy={186} r={10} className="bs-post pos" />
          <circle cx={200} cy={186} r={10} className="bs-post neg" />
          <text x={150} y={160} className="bs-label">
            +
          </text>
          <text x={200} y={160} className="bs-label">
            −
          </text>
          <Load
            load={state.load}
            glow={state.on ? r.glow : 0}
            hot={
              state.on &&
              (r.status === 'warn' || r.status === 'danger') &&
              state.load.startsWith('resistor')
            }
            burned={!!state.burned}
          />
        </svg>
      </div>

      <div className="bs-panel">
        <div className={`bs-status is-${status}`} role="status" aria-live="polite">
          <p className="bs-reading">
            Visor: {br(shownV, 2)} V e {br(shownI, 3)} A
            {state.on ? ` · modo ${r.mode === 'cc' ? 'CC' : 'CV'}` : ' · saída desligada'}
          </p>
          {event && (
            <p className="bs-event">
              Antes de queimar: {event.charAt(0).toLowerCase() + event.slice(1)}
            </p>
          )}
          <p>{r.message}</p>
        </div>

        <div className="bs-field">
          <label htmlFor={`${uid}-v`}>
            Tensão ajustada (VOLTAGE): <strong>{br(state.vSet, 1)} V</strong>
          </label>
          <div className="bs-row">
            <button
              type="button"
              className="bs-btn small"
              onClick={() => apply({ vSet: state.vSet - 0.1 })}
              aria-label="Baixar a tensão 0,1 V"
            >
              −
            </button>
            <input
              id={`${uid}-v`}
              type="range"
              min={0}
              max={V_MAX}
              step={0.1}
              value={state.vSet}
              onChange={(e) => apply({ vSet: Number(e.target.value) })}
            />
            <button
              type="button"
              className="bs-btn small"
              onClick={() => apply({ vSet: state.vSet + 0.1 })}
              aria-label="Subir a tensão 0,1 V"
            >
              +
            </button>
          </div>
        </div>

        <div className="bs-field">
          <label htmlFor={`${uid}-i`}>
            Limite de corrente (CURRENT): <strong>{br(state.iLimit, 2)} A</strong>
          </label>
          <div className="bs-row">
            <button
              type="button"
              className="bs-btn small"
              onClick={() => apply({ iLimit: state.iLimit - 0.01 })}
              aria-label="Baixar o limite 0,01 A"
            >
              −
            </button>
            <input
              id={`${uid}-i`}
              type="range"
              min={0}
              max={I_MAX}
              step={0.01}
              value={state.iLimit}
              onChange={(e) => apply({ iLimit: Number(e.target.value) })}
            />
            <button
              type="button"
              className="bs-btn small"
              onClick={() => apply({ iLimit: state.iLimit + 0.01 })}
              aria-label="Subir o limite 0,01 A"
            >
              +
            </button>
          </div>
        </div>

        <div className="bs-field">
          <label htmlFor={`${uid}-load`}>Ligado nos bornes</label>
          <select
            id={`${uid}-load`}
            className="bs-select"
            value={state.load}
            onChange={(e) => apply({ load: e.target.value as LoadId })}
          >
            {LOADS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <p className="bs-hint">{loadInfo.detail}</p>
        </div>

        <div className="bs-actions">
          <button
            type="button"
            className={state.on ? 'bs-btn is-on' : 'bs-btn'}
            onClick={() => apply({ on: !state.on })}
          >
            {state.on ? 'Desligar a saída (OUTPUT)' : 'Ligar a saída (OUTPUT)'}
          </button>
          {state.burned && (
            <button
              type="button"
              className="bs-btn"
              onClick={() => apply({ burned: false, on: false })}
            >
              Trocar a peça
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
