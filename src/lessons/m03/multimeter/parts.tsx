/**
 * Pieces shared by the module 3 instrument trainers (MultimeterTrainer,
 * ClampMeter): the four-digit seven-segment display drawn in SVG and the
 * radio "chips" that operate the instrument accessibly.
 */
import type { ReactNode } from 'react';

// Seven-segment digits.
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
  '-': 'g',
  O: 'abcdef',
  L: 'fed',
};

export function Digits({ text, x = 64, y = 76 }: { text: string; x?: number; y?: number }) {
  const cells: { c: string; dp: boolean }[] = [];
  let sign = false;
  for (const ch of text) {
    if (ch === '-' && cells.length === 0 && text.trim() !== '----') {
      sign = true;
      continue;
    }
    if (ch === '.') {
      if (cells.length) cells[cells.length - 1]!.dp = true;
      continue;
    }
    if (ch === ' ' && cells.length === 0) continue;
    cells.push({ c: ch, dp: false });
  }
  while (cells.length < 4) cells.unshift({ c: ' ', dp: false });
  const shown = cells.slice(-4);
  return (
    <g transform={`translate(${x} ${y}) skewX(-6)`}>
      {sign && <polygon points={SEG.g} transform="translate(-14 0) scale(0.7 1)" />}
      {shown.map((cell, i) => (
        <g key={i} transform={`translate(${i * 37} 0) scale(1.75)`}>
          {Object.entries(SEG).map(([s, pts]) => (
            <polygon
              key={s}
              points={pts}
              className={(CHARS[cell.c] ?? '').includes(s) ? 'mt-seg on' : 'mt-seg'}
            />
          ))}
          <circle cx={17.6} cy={29} r={1.4} className={cell.dp ? 'mt-seg on' : 'mt-seg'} />
        </g>
      ))}
    </g>
  );
}

export function Chips<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: { id: T; label: ReactNode; title?: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="mt-field">
      <legend>{legend}</legend>
      <div className="mt-chips">
        {options.map((o) => (
          <label
            key={o.id}
            className={`mt-chip${value === o.id ? ' is-on' : ''}${o.disabled ? ' is-disabled' : ''}`}
            title={o.title}
          >
            <input
              type="radio"
              name={name}
              value={o.id}
              checked={value === o.id}
              disabled={o.disabled}
              onChange={() => onChange(o.id)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
