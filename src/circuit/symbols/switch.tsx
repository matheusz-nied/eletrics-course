import { defineSymbol, isOn } from './_kit';

/** IEC switch (make contact). Click or Space toggles it when it has a control. */
export default defineSymbol({
  type: 'switch',
  body: 32,
  half: 12,
  draw: ({ params }) => {
    const closed = isOn(params.closed);
    return (
      <>
        <circle cx={-14} cy={0} r={2.2} className="sym-fill" />
        <circle cx={14} cy={0} r={2.2} className="sym-body" />
        <path d={closed ? 'M-14 0L14 0' : 'M-14 0L12 -12'} className="sym-blade" />
      </>
    );
  },
});
