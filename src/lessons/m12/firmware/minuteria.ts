/**
 * Firmware of lesson 12.2: a staircase light timer (minuteria) written as a
 * state machine, the digital version of the analog timer of lesson 4.4.
 *
 *   APAGADA --toque--> ACESA (starts the timer)
 *   ACESA   --toque--> ACESA (starts the timer again)
 *   ACESA   --tempo esgotado--> APAGADA
 *   APAGADA or ACESA --botão seguro por 2 s--> FIXA (stays on)
 *   FIXA    --toque--> APAGADA
 *
 * A touch is counted when the debounced button is released, so holding it
 * for 2 s gives FIXA without an ACESA in between. The TEMPO trimpot sets the
 * timer from 5 to 60 s.
 */
import { defineFirmware } from '../../../engine/firmware';
import { closed, debounce, released, volts, VCC_5V, type Debounced } from '../arduino';

export type EstadoMinuteria = 'APAGADA' | 'ACESA' | 'FIXA';

/** Holding the button this long switches to FIXA (s). */
export const SEGURAR = 2;
/** Timer range set by the TEMPO trimpot (s). */
export const TEMPO_MIN = 5;
export const TEMPO_MAX = 60;

/** Timer for a trimpot voltage: 5 s at 0 V to 60 s at 5 V, in whole seconds. */
export function tempoMinuteria(v: number): number {
  const x = Math.min(1, Math.max(0, v / VCC_5V));
  return Math.round(TEMPO_MIN + x * (TEMPO_MAX - TEMPO_MIN));
}

export interface MinuteriaState {
  estado: EstadoMinuteria;
  /** Time left with the light on, in ACESA (s). */
  restante: number;
  button: Debounced;
  /** The current press already switched to FIXA (its release is not a touch). */
  usado: boolean;
  /** Last transition, for the readout. */
  ultima: string;
}

export function initMinuteria(): MinuteriaState {
  return { estado: 'APAGADA', restante: 0, button: released(), usado: false, ultima: '' };
}

/** One step of the state machine: state + inputs → next state. Pure. */
export function stepMinuteria(
  s: MinuteriaState,
  raw: boolean,
  tempo: number,
  dt: number,
): MinuteriaState {
  const { button, edge } = debounce(s.button, raw, dt);
  let { estado, restante, usado, ultima } = s;
  const go = (to: EstadoMinuteria, why: string) => {
    ultima = `${estado} → ${to} (${why})`;
    estado = to;
  };

  if (estado === 'ACESA') {
    restante = Math.max(0, restante - dt);
    if (restante <= 1e-9) go('APAGADA', 'tempo esgotado');
  }
  if (edge === 'press') usado = false;
  if (button.pressed && !usado && button.held + 1e-9 >= SEGURAR && estado !== 'FIXA') {
    go('FIXA', 'botão seguro por 2 s');
    usado = true;
  }
  if (edge === 'release') {
    if (usado) usado = false;
    else if (estado === 'FIXA') go('APAGADA', 'toque');
    else {
      go('ACESA', 'toque');
      restante = tempo;
    }
  }
  if (estado !== 'ACESA') restante = 0;
  return { estado, restante, button, usado, ultima };
}

export default defineFirmware<MinuteriaState>({
  id: 'm12/minuteria',
  title: 'Minuteria de escada',
  description:
    'Máquina de estados de uma luz de escada: um toque no botão acende a luz por um tempo ajustado no trimpot (de 5 a 60 s); outro toque com a luz acesa recomeça a contagem; segurar o botão por 2 s deixa a luz acesa direto, até o próximo toque.',
  period: 0.001,
  vcc: VCC_5V,
  pins: [
    { name: 'BOT', kind: 'digital-in', pullUp: true, label: 'Botão da escada' },
    { name: 'TEMPO', kind: 'analog-in', label: 'Trimpot do tempo' },
    { name: 'LUZ', kind: 'digital-out', label: 'Saída da luz' },
  ],
  init: initMinuteria,
  step(state, { pins, dt }) {
    const tempo = tempoMinuteria(volts(pins, 'TEMPO'));
    const next = stepMinuteria(state, closed(pins, 'BOT'), tempo, dt);
    return {
      state: next,
      pins: { LUZ: next.estado !== 'APAGADA' },
      readouts: {
        estado: next.estado,
        restante: next.restante,
        tempo,
        transicao: next.ultima,
      },
      events: [],
    };
  },
});
