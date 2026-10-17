import { formatSI } from '../format';
import { defineSymbol, num } from './_kit';

/**
 * Relay: coil (rectangle) and changeover contact linked by a dashed line. The
 * blade follows the armature position reported by the engine.
 */
export default defineSymbol({
  type: 'relay-spdt',
  pins: { coil1: [-4, -4], coil2: [-4, 4], com: [2, 4], nc: [0, -4], no: [4, -4] },
  box: [-48, -40, 92, 80],
  live: ['closed', 'energized', 'position', 'welded'],
  draw: ({ live }) => {
    const pos =
      typeof live.position === 'number'
        ? Math.min(1, Math.max(0, live.position))
        : live.closed === true
          ? 1
          : 0;
    const tipX = 3 + 34 * pos;
    const energized = live.energized === true || (live.energized === undefined && pos > 0.5);
    return (
      <>
        <path d="M-40 -40V-12M-40 12V40" />
        <rect
          x={-48}
          y={-12}
          width={16}
          height={24}
          className={energized ? 'sym-energized' : 'sym-body'}
        />
        <path d="M-48 12L-32 -12" strokeWidth={1.2} />
        <path d="M20 40V10M0 -40V-10M40 -40V-10" />
        <circle cx={0} cy={-10} r={2} className="sym-body" />
        <circle cx={40} cy={-10} r={2} className="sym-body" />
        <path
          d={`M20 10L${tipX} -9`}
          className={live.welded === true ? 'sym-blade sym-danger' : 'sym-blade'}
        />
        <path d={`M-32 0H${(20 + tipX) / 2}`} strokeDasharray="3 2.5" strokeWidth={1.2} />
      </>
    );
  },
  value: (p) => `bobina ${formatSI(num(p.coilVoltage, 12), 'V')}`,
});
