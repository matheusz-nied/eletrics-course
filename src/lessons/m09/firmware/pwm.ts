/**
 * Firmware of lesson 9.8: an Arduino-like board reads a potentiometer on A0
 * and writes PWM on D9, like `analogWrite(9, analogRead(A0) / 4)`. The PWM
 * runs at 500 Hz with 1 % steps (the Uno's pin 9 runs at about 490 Hz with
 * 256 steps); the duty cycle changes only at the start of a period, as in
 * the hardware timer.
 */
import { defineFirmware } from '../../../engine/firmware';

/** Supply and ADC reference (V). */
const VCC = 5;
/** Firmware steps per PWM period: the duty cycle resolution. */
const STEPS = 100;
/** PWM frequency (Hz). */
export const PWM_FREQUENCY = 500;

interface State {
  /** Step within the period, 0 to STEPS − 1. */
  count: number;
  /** Duty cycle of the current period (0 to 1). */
  duty: number;
}

export default defineFirmware<State>({
  id: 'm09/pwm',
  title: 'PWM pelo potenciômetro',
  description:
    'Lê o potenciômetro na entrada analógica A0 e gera no pino D9 uma onda quadrada de 500 Hz cujo ciclo de trabalho acompanha o potenciômetro: 0 % com ele no mínimo, 100 % no máximo.',
  period: 1 / (PWM_FREQUENCY * STEPS),
  vcc: VCC,
  pins: [
    { name: 'A0', kind: 'analog-in', label: 'Potenciômetro (entrada analógica A0)' },
    { name: 'D9', kind: 'digital-out', label: 'Saída PWM (pino 9)' },
  ],
  init: () => ({ count: 0, duty: 0 }),
  step(state, { pins }) {
    const count = (state.count + 1) % STEPS;
    const reading = typeof pins.A0 === 'number' ? pins.A0 : 0;
    const duty = count === 0 ? Math.round((reading / VCC) * STEPS) / STEPS : state.duty;
    return {
      state: { count, duty },
      pins: { D9: count < duty * STEPS },
      readouts: { ciclo: duty },
      events: [],
    };
  },
});
