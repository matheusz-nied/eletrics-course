/**
 * Firmware of lesson 12.6: a Wi-Fi smart relay behind a wall switch, as the
 * ESP32 inside it runs it. Two things toggle the light: a command from the
 * app (here a momentary contact on APP, standing for a message received over
 * Wi-Fi) and any change of the wall switch on INT, so the switch works in
 * either position, like a three-way switch. The relay output is RELE.
 */
import { defineFirmware } from '../../../engine/firmware';
import { closed, debounce, released, type Debounced } from '../arduino';

/** The ESP32 runs at 3,3 V. */
export const VCC_ESP32 = 3.3;

interface State {
  lampada: boolean;
  app: Debounced;
  interruptor: Debounced;
  origem: string;
}

export default defineFirmware<State>({
  id: 'm12/rele-wifi',
  title: 'Relé inteligente Wi-Fi',
  description:
    'Inverte a lâmpada a cada comando do aplicativo, recebido pelo Wi-Fi, e a cada mudança de posição do interruptor da parede, ligado à entrada do relé.',
  period: 0.001,
  vcc: VCC_ESP32,
  pins: [
    { name: 'APP', kind: 'digital-in', pullUp: true, label: 'Comando do aplicativo (Wi-Fi)' },
    { name: 'INT', kind: 'digital-in', pullUp: true, label: 'Interruptor da parede (S1)' },
    { name: 'RELE', kind: 'digital-out', label: 'Comando do relé (GPIO 4)' },
  ],
  readouts: { lampada: { label: 'Lâmpada' }, origem: { label: 'Último comando' } },
  init: () => ({ lampada: false, app: released(), interruptor: released(), origem: '—' }),
  step(state, { pins, dt }) {
    const app = debounce(state.app, closed(pins, 'APP'), dt);
    const sw = debounce(state.interruptor, closed(pins, 'INT'), dt);
    let { lampada, origem } = state;
    if (app.edge === 'press') {
      lampada = !lampada;
      origem = 'aplicativo';
    }
    // Any change of the wall switch counts: up or down, it toggles the light.
    if (sw.edge) {
      lampada = !lampada;
      origem = 'interruptor';
    }
    return {
      state: { lampada, app: app.button, interruptor: sw.button, origem },
      pins: { RELE: lampada },
      readouts: { lampada: lampada ? 'acesa' : 'apagada', origem },
      events: [],
    };
  },
});
