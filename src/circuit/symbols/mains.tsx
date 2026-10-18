import { formatSI } from '../format';
import { defineSymbol, num, Upright } from './_kit';

/** Mains supply (rede elétrica): phase L, neutral N and protective earth PE. */
export default defineSymbol({
  type: 'mains',
  pins: { l: [2, -2], n: [2, 0], pe: [2, 2] },
  box: [-24, -28, 44, 56],
  draw: (ctx) => (
    <>
      <rect x={-24} y={-28} width={32} height={56} rx={4} className="sym-body" />
      <path d="M8 -20H20M8 0H20M8 20H20" />
      <path d="M-16 -4C-14 -10 -11 -10 -8 -4S-2 2 0 -4" transform={`rotate(${-ctx.rot} -8 -4)`} />
      <Upright x={4} y={-20} ctx={ctx} size={8} weight={700} anchor="end">
        L
      </Upright>
      <Upright x={4} y={0} ctx={ctx} size={8} weight={700} anchor="end">
        N
      </Upright>
      <Upright x={4} y={20} ctx={ctx} size={8} weight={700} anchor="end">
        PE
      </Upright>
      <path d="M-16 14V18M-21 18H-11M-19 21H-13M-17 24H-15" strokeWidth={1.3} />
    </>
  ),
  value: (p) => `${formatSI(num(p.voltage, 127), 'V')} · ${formatSI(num(p.frequency, 60), 'Hz')}`,
});
