import { formatSI } from '../format';
import { defineSymbol, num } from './_kit';

/** Relay: coil (rectangle) and changeover contact linked by a dashed line. */
export default defineSymbol({
  type: 'relay-spdt',
  pins: { coil1: [-2, -2], coil2: [-2, 2], com: [2, 2], nc: [1, -2], no: [3, -2] },
  box: [-28, -20, 60, 40],
  live: ['closed'],
  draw: ({ live }) => {
    const on = live.closed === true;
    const tip = on ? 'L28 -7' : 'L12 -7';
    return (
      <>
        <path d="M-20 -20V-9M-20 9V20" />
        <rect x={-27} y={-9} width={14} height={18} className={on ? 'sym-energized' : 'sym-body'} />
        <path d="M-27 9L-13 -9" strokeWidth={1.2} />
        <path d="M20 20V8M10 -20V-8M30 -20V-8" />
        <circle cx={10} cy={-8} r={1.8} className="sym-body" />
        <circle cx={30} cy={-8} r={1.8} className="sym-body" />
        <path d={`M20 8${tip}`} className="sym-blade" />
        <path d={`M-13 0H${on ? 24 : 16}`} strokeDasharray="3 2.5" strokeWidth={1.2} />
      </>
    );
  },
  value: (p) => `bobina ${formatSI(num(p.coilVoltage, 12), 'V')}`,
});
