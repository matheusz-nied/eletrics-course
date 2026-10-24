import { defineSymbol, isOn } from './_kit';

/**
 * Push button whose contact bounces. The bridge follows the contact (it
 * jumps while bouncing); the small zigzag marks the bounce.
 */
export default defineSymbol({
  type: 'bouncing-button',
  body: 30,
  half: 14,
  live: ['closed'],
  draw: ({ params, live }) => {
    const pressed = isOn(params.pressed);
    const touching = live.closed === undefined ? pressed : live.closed === true;
    const barY = touching ? 0 : pressed ? -3 : -7;
    return (
      <>
        <circle cx={-12} cy={0} r={2.2} className="sym-fill" />
        <circle cx={12} cy={0} r={2.2} className="sym-fill" />
        <path d={`M-13 ${barY}H13`} className="sym-blade" />
        <path d={`M0 ${barY}V-14`} strokeDasharray="2.5 2" strokeWidth={1.4} />
        <path d="M-6 -14H6" />
        <path d="M9 -13L11 -9L13 -12L15 -8" strokeWidth={1.2} />
      </>
    );
  },
});
