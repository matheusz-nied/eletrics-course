import { defineSymbol } from './_kit';

/** Buzzer: dome on a base; sound waves while it sounds. */
export default defineSymbol({
  type: 'buzzer',
  body: 24,
  half: 14,
  live: ['sounding'],
  draw: ({ live }) => (
    <>
      <path d="M-12 0H-9V4H9V0H12" />
      <path d="M-9 4V-2A9 9 0 0 1 9 -2V4" className="sym-body" />
      {live.sounding === true && (
        <path d="M-6 -15Q0 -19 6 -15M-9 -19Q0 -24 9 -19" className="sym-accent" strokeWidth={1.4} />
      )}
    </>
  ),
});
