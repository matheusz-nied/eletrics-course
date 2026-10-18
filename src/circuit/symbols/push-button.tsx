import { defineSymbol, isOn } from './_kit';

/** Push button (NA or NF). Held down while pressed. */
export default defineSymbol({
  type: 'push-button',
  body: 30,
  half: 14,
  draw: ({ params }) => {
    const nc = isOn(params.normallyClosed);
    const pressed = isOn(params.pressed);
    // NA: bridge above the contacts, touches when pressed. NF: touches until pressed.
    const touching = pressed !== nc;
    const barY = nc ? (touching ? 0 : 7) : touching ? 0 : -7;
    return (
      <>
        <circle cx={-12} cy={0} r={2.2} className="sym-fill" />
        <circle cx={12} cy={0} r={2.2} className="sym-fill" />
        <path d={`M-13 ${barY}H13`} className="sym-blade" />
        <path d={`M0 ${barY}V-14`} strokeDasharray="2.5 2" strokeWidth={1.4} />
        <path d={`M-6 -14H6`} />
      </>
    );
  },
});
