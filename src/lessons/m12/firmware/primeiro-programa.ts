/**
 * Firmware of lesson 12.1: the four basic jobs of a microcontroller in one
 * program, as an Arduino sketch would do them:
 *
 *   - digital input with the internal pull-up: a button on D2 to GND;
 *   - digital output: D13 lights its LED while the button is held;
 *   - timer: D12 blinks once a second (500 ms on, 500 ms off), counted with
 *     the clock like `millis()`, without stopping the rest of the program;
 *   - ADC: A0 reads a potentiometer, 0 to 1023 for 0 to 5 V.
 */
import { defineFirmware } from '../../../engine/firmware';
import { adc10, adcVolts, closed, volts, VCC_5V } from '../arduino';

/** Half period of the blinking LED (s). */
export const BLINK_HALF = 0.5;

interface State {
  /** Time of the next blink toggle (s since power-up). */
  next: number;
  blink: boolean;
}

export default defineFirmware<State>({
  id: 'm12/primeiro-programa',
  title: 'Primeiro programa',
  description:
    'Acende o LED do pino D13 enquanto o botão do pino D2 está apertado, pisca o LED do pino D12 uma vez por segundo contando o tempo pelo relógio interno e lê o potenciômetro na entrada analógica A0, de 0 a 1023.',
  period: 0.001,
  vcc: VCC_5V,
  pins: [
    { name: 'D2', kind: 'digital-in', pullUp: true, label: 'Botão (pino D2)' },
    { name: 'A0', kind: 'analog-in', label: 'Potenciômetro (entrada analógica A0)' },
    { name: 'D13', kind: 'digital-out', label: 'LED do botão (pino D13)' },
    { name: 'D12', kind: 'digital-out', label: 'LED que pisca (pino D12)' },
  ],
  init: () => ({ next: BLINK_HALF, blink: true }),
  step(state, { t, pins }) {
    let { next, blink } = state;
    if (t >= next - 1e-9) {
      blink = !blink;
      next += BLINK_HALF;
    }
    const pressed = closed(pins, 'D2');
    const leitura = adc10(volts(pins, 'A0'));
    return {
      state: { next, blink },
      pins: { D13: pressed, D12: blink },
      readouts: {
        // "pressed" and "voltage" get the course's labels and units in the inspector.
        pressed,
        leitura,
        voltage: adcVolts(leitura),
      },
      events: [],
    };
  },
});
