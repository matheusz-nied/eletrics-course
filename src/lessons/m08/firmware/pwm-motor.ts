/**
 * Firmware of lesson 8.2: an Arduino-like board reads a potentiometer on A0
 * and writes PWM on D9 at 4 kHz, fast enough for the motor's inductance to
 * keep its current flowing between pulses. The duty cycle moves in 5 %
 * steps (20 per period) and changes only at the start of a period, as in
 * the hardware timer.
 */
import { defineFirmware } from '../../../engine/firmware';

/** Supply and ADC reference (V). */
const VCC = 5;
/** Firmware steps per PWM period: the duty cycle resolution. */
const STEPS = 20;
/** PWM frequency (Hz). */
export const PWM_FREQUENCY = 4000;

interface State {
  /** Step within the period, 0 to STEPS − 1. */
  count: number;
  /** Steps the pin stays high in the current period, 0 to STEPS. */
  onSteps: number;
}

export default defineFirmware<State>({
  id: 'm08/pwm-motor',
  title: 'PWM de motor pelo potenciômetro',
  description:
    'Lê o potenciômetro na entrada analógica A0 e gera no pino D9 uma onda quadrada de 4 kHz cujo ciclo de trabalho acompanha o potenciômetro, em passos de 5 %: 0 % com ele no mínimo, 100 % no máximo.',
  period: 1 / (PWM_FREQUENCY * STEPS),
  vcc: VCC,
  pins: [
    { name: 'A0', kind: 'analog-in', label: 'Potenciômetro (entrada analógica A0)' },
    { name: 'D9', kind: 'digital-out', label: 'Saída PWM (pino 9)' },
  ],
  init: () => ({ count: 0, onSteps: 0 }),
  step(state, { pins }) {
    const count = (state.count + 1) % STEPS;
    const reading = typeof pins.A0 === 'number' ? pins.A0 : 0;
    const onSteps = count === 0 ? Math.round((reading / VCC) * STEPS) : state.onSteps;
    return {
      state: { count, onSteps },
      pins: { D9: count < onSteps },
      readouts: { ciclo: onSteps / STEPS },
      events: [],
    };
  },
});
