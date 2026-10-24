/**
 * Firmware of lesson 12.4: speed of a DC motor by PWM. The potentiometer on
 * A0 sets the duty cycle (0 to 100 % in steps of 5 %) of a 1 kHz square wave
 * on D9, which switches a logic-level MOSFET. With the soft start switch on
 * (D4 to GND), the duty cycle moves towards the potentiometer by at most
 * 100 % per RAMPA seconds, so the motor does not take its stall current
 * when it starts; off, it jumps straight to the new value.
 */
import { defineFirmware } from '../../../engine/firmware';
import { closed, volts, VCC_5V } from '../arduino';

/** PWM frequency (Hz) and steps per period (the duty cycle resolution). */
export const PWM_FREQUENCY = 1000;
export const STEPS = 20;
/** Soft start: time to go from 0 to 100 % (s). */
export const RAMPA = 1;

interface State {
  /** Step within the PWM period, 0 to STEPS − 1. */
  count: number;
  /** Duty cycle now, 0 to 1 (follows the target, ramped with soft start). */
  duty: number;
  /** Steps the pin stays high in the current period. */
  onSteps: number;
}

export default defineFirmware<State>({
  id: 'm12/motor-pwm',
  title: 'Velocidade do motor por PWM',
  description:
    'Lê o potenciômetro na entrada A0 e gera no pino D9 uma onda quadrada de 1 kHz cujo ciclo de trabalho acompanha o potenciômetro, de 5 em 5 %. Com a partida suave ligada, o ciclo de trabalho sobe no máximo de 0 a 100 % em 1 s.',
  period: 1 / (PWM_FREQUENCY * STEPS),
  vcc: VCC_5V,
  pins: [
    { name: 'A0', kind: 'analog-in', label: 'Potenciômetro da velocidade (A0)' },
    { name: 'D4', kind: 'digital-in', pullUp: true, label: 'Chave da partida suave (D4)' },
    { name: 'D9', kind: 'digital-out', label: 'Saída PWM para o MOSFET (D9)' },
  ],
  readouts: {
    ciclo: { label: 'Ciclo de trabalho', unit: '%' },
    alvo: { label: 'Ciclo pedido pelo potenciômetro', unit: '%' },
    partidaSuave: { label: 'Partida suave' },
  },
  init: () => ({ count: 0, duty: 0, onSteps: 0 }),
  step(state, { pins, dt }) {
    const target = Math.round((volts(pins, 'A0') / VCC_5V) * STEPS) / STEPS;
    const suave = closed(pins, 'D4');
    const maxStep = dt / RAMPA;
    const duty = suave
      ? state.duty + Math.max(-maxStep, Math.min(maxStep, target - state.duty))
      : target;
    const count = (state.count + 1) % STEPS;
    // The timer takes a new duty cycle only at the start of a period, in whole steps.
    const onSteps = count === 0 ? Math.round(duty * STEPS) : state.onSteps;
    return {
      state: { count, duty, onSteps },
      pins: { D9: count < onSteps },
      readouts: { ciclo: (100 * onSteps) / STEPS, alvo: 100 * target, partidaSuave: suave },
      events: [],
    };
  },
});
