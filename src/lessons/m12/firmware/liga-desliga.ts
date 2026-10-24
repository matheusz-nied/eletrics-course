/**
 * Firmware of lesson 12.4: each touch of the button (debounced, counted on
 * the press) toggles the relay output, and the buzzer beeps for 0,1 s to
 * confirm, as many appliances do.
 */
import { defineFirmware } from '../../../engine/firmware';
import { closed, debounce, released, VCC_5V, type Debounced } from '../arduino';

/** Confirmation beep (s). */
export const BIPE = 0.1;

interface State {
  rele: boolean;
  bipe: number;
  button: Debounced;
}

export default defineFirmware<State>({
  id: 'm12/liga-desliga',
  title: 'Liga e desliga com um botão',
  description:
    'Cada toque no botão do pino D2 inverte a saída do relé no pino D7 e faz o buzzer do pino D8 dar um bipe de 0,1 s.',
  period: 0.001,
  vcc: VCC_5V,
  pins: [
    { name: 'D2', kind: 'digital-in', pullUp: true, label: 'Botão (pino D2)' },
    { name: 'D7', kind: 'digital-out', label: 'Comando do relé (pino D7)' },
    { name: 'D8', kind: 'digital-out', label: 'Buzzer (pino D8)' },
  ],
  readouts: { rele: { label: 'Relé' } },
  init: () => ({ rele: false, bipe: 0, button: released() }),
  step(state, { pins, dt }) {
    const { button, edge } = debounce(state.button, closed(pins, 'D2'), dt);
    let { rele, bipe } = state;
    bipe = Math.max(0, bipe - dt);
    if (edge === 'press') {
      rele = !rele;
      bipe = BIPE;
    }
    return {
      state: { rele, bipe, button },
      pins: { D7: rele, D8: bipe > 1e-9 },
      readouts: { rele: rele ? 'ligado' : 'desligado' },
      events: [],
    };
  },
});
