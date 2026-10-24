/**
 * Firmware of lesson 12.3: a dusk-to-dawn light. An LDR from 5 V to A0 and
 * a 10 kΩ resistor to GND make a divider whose voltage rises with the light.
 * The program turns the light on when the reading stays below LIMIAR_NOITE
 * for CONFIRMAR seconds, and off when it stays above LIMIAR_DIA for as long:
 * two thresholds (hysteresis) and a confirmation time, so a passing car's
 * headlights or a cloud do not switch the light.
 *
 *   DIA --escuro--> ESCURECENDO --escuro por 3 s--> NOITE
 *   ESCURECENDO --claro de novo--> DIA
 *   NOITE --claro--> CLAREANDO --claro por 3 s--> DIA
 *   CLAREANDO --escuro de novo--> NOITE
 */
import { defineFirmware } from '../../../engine/firmware';
import { adc10, volts, VCC_5V } from '../arduino';

export type EstadoLuz = 'DIA' | 'ESCURECENDO' | 'NOITE' | 'CLAREANDO';

/** Below this reading it is dark, above the other it is day (ADC steps). */
export const LIMIAR_NOITE = 250;
export const LIMIAR_DIA = 350;
/** A change must last this long to count (s). */
export const CONFIRMAR = 3;

interface State {
  estado: EstadoLuz;
  /** Time in ESCURECENDO or CLAREANDO (s). */
  t: number;
}

export function stepLuz(s: State, leitura: number, dt: number): State {
  const escuro = leitura < LIMIAR_NOITE;
  const claro = leitura > LIMIAR_DIA;
  switch (s.estado) {
    case 'DIA':
      return escuro ? { estado: 'ESCURECENDO', t: 0 } : s;
    case 'ESCURECENDO':
      if (!escuro) return { estado: 'DIA', t: 0 };
      return s.t + dt + 1e-9 >= CONFIRMAR ? { estado: 'NOITE', t: 0 } : { ...s, t: s.t + dt };
    case 'NOITE':
      return claro ? { estado: 'CLAREANDO', t: 0 } : s;
    case 'CLAREANDO':
      if (!claro) return { estado: 'NOITE', t: 0 };
      return s.t + dt + 1e-9 >= CONFIRMAR ? { estado: 'DIA', t: 0 } : { ...s, t: s.t + dt };
  }
}

export default defineFirmware<State>({
  id: 'm12/luz-automatica',
  title: 'Luz automática com LDR',
  description:
    'Lê um LDR num divisor de tensão pela entrada A0. Acende a luz quando a leitura fica abaixo de 250 por 3 s seguidos e apaga quando fica acima de 350 por 3 s seguidos.',
  period: 0.001,
  vcc: VCC_5V,
  pins: [
    { name: 'A0', kind: 'analog-in', label: 'Divisor com o LDR (entrada A0)' },
    { name: 'LUZ', kind: 'digital-out', label: 'Luz (pino D8)' },
  ],
  readouts: { leitura: { label: 'Leitura do ADC (A0)' }, estado: { label: 'Estado' } },
  init: () => ({ estado: 'DIA', t: 0 }),
  step(state, { pins, dt }) {
    const leitura = adc10(volts(pins, 'A0'));
    const next = stepLuz(state, leitura, dt);
    const acesa = next.estado === 'NOITE' || next.estado === 'CLAREANDO';
    return {
      state: next,
      pins: { LUZ: acesa },
      readouts: { leitura, estado: next.estado },
      events: [],
    };
  },
});
