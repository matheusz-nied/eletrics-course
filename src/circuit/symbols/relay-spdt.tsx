import { formatSI } from '../format';
import { defineSymbol, num } from './_kit';

/**
 * Relay: coil (rectangle) and changeover contact linked by a dashed line. The
 * blade follows the armature position reported by the engine.
 */
export default defineSymbol({
  type: 'relay-spdt',
  pins: { coil1: [-2, -2], coil2: [-2, 2], com: [2, 2], nc: [1, -2], no: [3, -2] },
  box: [-28, -20, 60, 40],
  live: ['closed', 'energized', 'position', 'welded'],
  draw: ({ live }) => {
    const pos =
      typeof live.position === 'number'
        ? Math.min(1, Math.max(0, live.position))
        : live.closed === true
          ? 1
          : 0;
    const tipX = 12 + 16 * pos;
    const energized = live.energized === true || (live.energized === undefined && pos > 0.5);
    return (
      <>
        <path d="M-20 -20V-9M-20 9V20" />
        <rect
          x={-27}
          y={-9}
          width={14}
          height={18}
          className={energized ? 'sym-energized' : 'sym-body'}
        />
        <path d="M-27 9L-13 -9" strokeWidth={1.2} />
        <path d="M20 20V8M10 -20V-8M30 -20V-8" />
        <circle cx={10} cy={-8} r={1.8} className="sym-body" />
        <circle cx={30} cy={-8} r={1.8} className="sym-body" />
        <path
          d={`M20 8L${tipX} -7`}
          className={live.welded === true ? 'sym-blade sym-danger' : 'sym-blade'}
        />
        <path d={`M-13 0H${(20 + tipX) / 2}`} strokeDasharray="3 2.5" strokeWidth={1.2} />
      </>
    );
  },
  value: (p) => `bobina ${formatSI(num(p.coilVoltage, 12), 'V')}`,
});
