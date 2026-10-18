import { defineSymbol, isOn } from './_kit';

/** Reed switch: contacts sealed in a glass tube, closed by a nearby magnet. */
export default defineSymbol({
  type: 'reed-switch',
  body: 36,
  half: 10,
  live: ['closed'],
  draw: ({ params, live }) => {
    const closed = typeof live.closed === 'boolean' ? live.closed : isOn(params.closed);
    return (
      <>
        <rect
          x={-18}
          y={-8}
          width={36}
          height={16}
          rx={8}
          strokeWidth={1.2}
          className="sym-glass-tube"
        />
        <path d={closed ? 'M-18 0H1M18 0H-1' : 'M-18 0H-4L4 -4M18 0H5'} className="sym-blade" />
      </>
    );
  },
});
