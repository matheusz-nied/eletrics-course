/**
 * Digital multimeter display for a probe: 7-segment LCD, autorange, CC/CA
 * modes (average or true RMS over the last 100 ms of simulated time), like
 * the meter the student holds. The reading is also given as pt-BR text.
 */
import { useMemo, useState } from 'react';
import type { ProbeDoc } from '../../engine/contract';
import { formatSI } from '../format';
import { probeMeta } from '../readouts';
import { probeChannel } from '../runtime/controller';
import { useSim, useSimState } from '../ui/context';
import { dcAndRms, dmmReading, meterValue } from './dmm';

const SEGMENTS: Record<string, string> = {
  a: '4,1 16,1 14,4.2 6,4.2',
  b: '18.6,2.6 18.6,16.8 15.4,15.2 15.4,5.6',
  c: '18.6,19.2 18.6,33.4 15.4,30.4 15.4,20.8',
  d: '6,31.8 14,31.8 16,35 4,35',
  e: '1.4,19.2 4.6,20.8 4.6,30.4 1.4,33.4',
  f: '1.4,2.6 4.6,5.6 4.6,15.2 1.4,16.8',
  g: '5,18 6.4,16.4 13.6,16.4 15,18 13.6,19.6 6.4,19.6',
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
  ' ': '',
};

/** Splits " 12.35" into 4 digit cells (right-aligned) with decimal points. */
function cells(digits: string): { sign: boolean; chars: { c: string; dp: boolean }[] } {
  const sign = digits.trimStart().startsWith('-');
  const body = digits.replace('-', '').trim();
  const out: { c: string; dp: boolean }[] = [];
  for (const ch of body) {
    if (ch === '.') {
      if (out.length) out[out.length - 1]!.dp = true;
    } else out.push({ c: ch, dp: false });
  }
  while (out.length < 4) out.unshift({ c: ' ', dp: false });
  return { sign, chars: out.slice(-4) };
}

export function SevenSegment({ digits }: { digits: string }) {
  const { sign, chars } = cells(digits);
  return (
    <svg className="dmm-digits" viewBox="0 0 112 38" aria-hidden="true">
      <g transform="skewX(-7) translate(5 1)">
        <polygon
          points={SEGMENTS.g!}
          className={sign ? 'on' : 'off'}
          transform="translate(-2 0) scale(0.7 1)"
        />
        {chars.map((cell, i) => {
          const lit = CHARS[cell.c] ?? '';
          return (
            <g key={i} transform={`translate(${12 + i * 24} 0)`}>
              {Object.entries(SEGMENTS).map(([s, pts]) => (
                <polygon key={s} points={pts} className={lit.includes(s) ? 'on' : 'off'} />
              ))}
              <circle cx={21.5} cy={33.6} r={1.7} className={cell.dp ? 'on' : 'off'} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

type Mode = 'dc' | 'ac';

const WINDOW_S = 0.1;

export function Multimeter({ probe, defaultMode }: { probe: ProbeDoc; defaultMode: Mode }) {
  const sim = useSim();
  const meta = probeMeta(probe);
  const [mode, setMode] = useState<Mode>(defaultMode);
  const slow = useSimState((s) => s.slow);
  const canAc = !sim.isDc && meta.quantity !== 'power';

  // Recomputed with the slow frame: real meters refresh a few times per second.
  const value = useMemo(() => {
    const now = slow ? sim.probeValue(probe, slow) : Number.NaN;
    if (sim.isDc || !canAc) return now;
    const h = sim.history;
    const end = h.lastT();
    if (!Number.isFinite(end)) return now;
    const { values } = h.window(end - WINDOW_S, end, [probeChannel(probe.id)], 4000);
    const { mean, rms } = dcAndRms(values[0] ?? []);
    return mode === 'dc' ? mean : rms;
  }, [slow, mode, sim, probe, canAc]);

  const shown = meterValue(value, meta.unit);
  const reading = dmmReading(shown, meta.unit);
  const symbol = meta.unit === 'V' ? 'V' : meta.unit === 'A' ? 'A' : 'W';
  const spoken = Number.isFinite(shown)
    ? `${formatSI(shown, meta.unit, { digits: 3 })}${mode === 'ac' && canAc ? ' eficaz (CA)' : ''}`
    : 'sem leitura';

  return (
    <figure className="dmm" data-probe={probe.id}>
      <figcaption className="dmm__label">{meta.label}</figcaption>
      <div className="dmm__lcd">
        <div className="dmm__flags" aria-hidden="true">
          <span>AUTO</span>
          <span>{mode === 'ac' && canAc ? 'AC' : 'DC'}</span>
        </div>
        <SevenSegment digits={reading.overload ? '  OL' : reading.digits} />
        <span className="dmm__unit" aria-hidden="true">
          {reading.unit}
          {mode === 'ac' && canAc ? '~' : '⎓'}
        </span>
      </div>
      <p className="sim-sr" data-reading>
        {meta.label}: {spoken}
      </p>
      {canAc && (
        <div
          className="dmm__modes"
          role="radiogroup"
          aria-label={`Modo do multímetro: ${meta.label}`}
        >
          {(['dc', 'ac'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={mode === m ? 'is-on' : undefined}
              onClick={() => setMode(m)}
            >
              {symbol}
              {m === 'dc' ? '⎓ CC' : '~ CA'}
            </button>
          ))}
        </div>
      )}
    </figure>
  );
}
