/**
 * Firmware of lesson 12.3: a thermometer with a 10 kΩ NTC (B = 3950 K) at
 * the bottom of a divider with a 10 kΩ resistor to 5 V, read on A0. The
 * program turns the ADC reading back into the NTC resistance and the
 * resistance into °C with the Beta equation, and switches a fan on at
 * 30 °C and off again only at 28 °C (hysteresis).
 */
import { defineFirmware } from '../../../engine/firmware';
import { ADC_STEPS, adc10, volts, VCC_5V } from '../arduino';

/** Fixed resistor of the divider, NTC at 25 °C and its B constant, as the program assumes. */
export const R_FIXO = 10_000;
export const R25 = 10_000;
export const BETA = 3950;
const KELVIN = 273.15;

/** The fan turns on at or above this temperature and off at or below the other (°C). */
export const LIGA = 30;
export const DESLIGA = 28;

/**
 * NTC resistance from the ADC reading, NTC at the bottom of the divider:
 * V = 5·R/(R_FIXO + R), and the reading is V/5 × 1024.
 */
export function resistenciaNtc(leitura: number): number {
  const n = Math.min(ADC_STEPS - 1, Math.max(1, leitura));
  return (R_FIXO * n) / (ADC_STEPS - n);
}

/** Beta equation: 1/T = 1/T25 + ln(R/R25)/B, in °C. */
export function temperaturaNtc(r: number): number {
  return 1 / (1 / (25 + KELVIN) + Math.log(r / R25) / BETA) - KELVIN;
}

interface State {
  ventilador: boolean;
}

export default defineFirmware<State>({
  id: 'm12/termometro',
  title: 'Termômetro com NTC',
  description:
    'Lê um termistor NTC de 10 kΩ num divisor de tensão pela entrada A0, calcula a resistência e a temperatura, e liga o ventilador a partir de 30 °C, desligando só abaixo de 28 °C.',
  period: 0.001,
  vcc: VCC_5V,
  pins: [
    { name: 'A0', kind: 'analog-in', label: 'Divisor com o NTC (entrada A0)' },
    { name: 'VENT', kind: 'digital-out', label: 'Ventilador (pino D7)' },
  ],
  init: () => ({ ventilador: false }),
  step(state, { pins }) {
    const leitura = adc10(volts(pins, 'A0'));
    const resistencia = resistenciaNtc(leitura);
    const temperatura = temperaturaNtc(resistencia);
    let { ventilador } = state;
    if (!ventilador && temperatura >= LIGA) ventilador = true;
    else if (ventilador && temperatura <= DESLIGA) ventilador = false;
    return {
      state: { ventilador },
      pins: { VENT: ventilador },
      readouts: { leitura, resistance: resistencia, temperature: temperatura, ventilador },
      events: [],
    };
  },
});
