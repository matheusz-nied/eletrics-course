/**
 * Every schematic symbol, at rest and in its "active" state (lit, closed,
 * turning…), with its pins. Rendered at build time for /dev/circuitos/simbolos/.
 */
import type { ElementDoc } from '../../engine/contract';
import { deviceInfo, listDeviceTypes } from '../engine';
import { GRID, elementParams } from '../geometry';
import { getSymbol } from '../symbols';
import '../simulation.css';

/** Two-terminal parts are small (a resistor is 30 px long): drawn larger here. */
const SCALE_TWO = 1.4;

const ACTIVE: Record<string, number | boolean | string> = {
  brightness: 1,
  closed: true,
  energized: true,
  actuated: true,
  rpm: 1200,
  direction: 1,
  humming: false,
  sounding: true,
  open: true,
  position: 0.6,
  blocked: true,
  a: true,
  b: false,
  y: true,
  high: true,
  zone: 'AC-4',
};

/** Active state of a type when the shared one does not fit (armature fully pulled). */
const ACTIVE_BY_TYPE: Record<string, Record<string, number | boolean | string>> = {
  'relay-spdt': { position: 1 },
};

const BROKEN: Record<string, number | boolean | string> = {
  burned: true,
  damaged: true,
  blown: true,
  tripped: true,
  closed: false,
  welded: true,
  bulged: true,
};

function Glyph({ type, state }: { type: string; state: 'rest' | 'active' | 'broken' }) {
  const symbol = getSymbol(type);
  const el: ElementDoc = { id: 'X1', type, at: [0, 0] };
  const info = deviceInfo(type, el.params);
  const params = elementParams(el, info);
  const live =
    state === 'active' ? { ...ACTIVE, ...ACTIVE_BY_TYPE[type] } : state === 'broken' ? BROKEN : {};
  if (state === 'active') {
    for (const k of ['closed', 'pressed', 'actuated', 'fitted', 'blocked'])
      if (k in params) params[k] = !params[k];
  }
  const two = info?.terminals === 'two';
  const pins: Record<string, [number, number]> = {};
  for (const p of info?.pins ?? []) pins[p.name] = p.offset;
  const body = symbol.body ?? 30;
  const half = 40;
  const box = two ? [-half - 6, -26, 2 * half + 12, 52] : (symbol.box ?? [-30, -30, 60, 60]);
  const [x, y, w, h] = [box[0]! - 8, box[1]! - 8, box[2]! + 16, box[3]! + 16];
  return (
    <svg
      viewBox={`${x} ${y} ${w} ${h}`}
      width={w * (two ? SCALE_TWO : 1)}
      height={h * (two ? SCALE_TWO : 1)}
      className="sch symbol-sheet__svg"
      aria-hidden="true"
    >
      {two && <path d={`M${-half} 0H${-body / 2}M${body / 2} 0H${half}`} className="sch-wire" />}
      <g className="sym">
        {symbol.draw({ el, params, live, rot: 0, flip: false, pins, gradient: undefined })}
      </g>
      {!two &&
        Object.entries(pins).map(([name, [px, py]]) => (
          <g key={name} className="symbol-sheet__pin">
            <circle cx={px * GRID} cy={py * GRID} r={2.4} />
            <text x={px * GRID + 3} y={py * GRID - 3} fontSize={6}>
              {name}
            </text>
          </g>
        ))}
    </svg>
  );
}

export default function SymbolSheet() {
  const types = listDeviceTypes().filter((t) => t !== 'wire');
  return (
    <ul className="symbol-sheet">
      {types.map((type) => {
        const info = deviceInfo(type);
        const symbol = getSymbol(type);
        const breakable = (info?.readouts ?? []).some((r) => r in BROKEN);
        return (
          <li key={type} className="symbol-sheet__item" data-symbol={type}>
            <div className="symbol-sheet__glyphs">
              <Glyph type={type} state="rest" />
              {symbol.live?.some((k) => k in ACTIVE) ||
              info?.params.closed ||
              info?.params.pressed ||
              info?.params.actuated ? (
                <Glyph type={type} state="active" />
              ) : null}
              {breakable && <Glyph type={type} state="broken" />}
            </div>
            <p className="symbol-sheet__name">{info?.label ?? type}</p>
            <p className="symbol-sheet__type num">{type}</p>
          </li>
        );
      })}
    </ul>
  );
}
