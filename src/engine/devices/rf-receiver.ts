import { bool, defineDevice, num, str } from '../device';
import type { RfFrame } from '../firmware';

/** Below this supply (V) the receiver decodes nothing. */
const V_MIN = 3;
/** Supply current at 5 V (A). */
const I_SUPPLY = 0.005;
/** Output idles low through this resistance (Ω). */
const R_OUT = 1000;
/** Frames waiting on the data line when nothing reads them. */
const QUEUE = 16;

/**
 * 433,92 MHz receiver with its decoder, and the remote control that talks to
 * it. Each press of the remote (the momentary `press` control) sends one
 * frame { serial, button, counter } on the `out` line, which a
 * microcontroller reads on its RF pin. With `rolling` the counter grows at
 * every press (rolling code, as current remotes do); without it the code is
 * fixed and a copy works forever. `replay` sends the last frame again, as a
 * code grabber would: a rolling-code central refuses it.
 */
export default defineDevice({
  info: {
    type: 'rf-receiver',
    label: 'Receptor de rádio 433 MHz',
    terminals: 'fixed',
    pins: [
      { name: 'vp', offset: [-3, -1], label: 'alimentação + (5 V)' },
      { name: 'gnd', offset: [-3, 1], label: 'alimentação − (GND)' },
      { name: 'out', offset: [3, 0], label: 'dados para o microcontrolador' },
    ],
    params: {
      press: { default: false, label: 'Apertar o botão do controle' },
      button: { default: 1, label: 'Botão do controle', min: 1, max: 4 },
      remote: {
        default: '5A3C91',
        label: 'Controle na mão',
        options: [
          { value: '5A3C91', label: 'Controle 1' },
          { value: '9E04B7', label: 'Controle 2' },
        ],
      },
      rolling: { default: true, label: 'Código variável (rolling code)' },
      replay: { default: false, label: 'Repetir o último código captado (clonador)' },
    },
    readouts: ['powered', 'sent', 'lastSerial', 'lastButton'],
    readoutInfo: {
      powered: { label: 'Alimentado' },
      sent: { label: 'Quadros entregues ao microcontrolador' },
      lastSerial: { label: 'Número de série do último controle' },
      lastButton: { label: 'Botão do último quadro' },
    },
  },
  create({ params, pins: [vp, gnd, out], signal }) {
    const line = signal(out);
    const counters = new Map<string, number>();
    const queue: RfFrame[] = [];
    let last: RfFrame | undefined;
    let powered = false;
    let sent = 0;
    let pressed = bool(params, 'press');
    let replayed = bool(params, 'replay');
    const gSupply = I_SUPPLY / 5;
    return {
      stamp(m) {
        m.conductance(vp, gnd, gSupply);
        m.conductance(out, gnd, 1 / R_OUT);
      },
      stampAc(m) {
        m.admittance(vp, gnd, gSupply);
        m.admittance(out, gnd, 1 / R_OUT);
      },
      paramChanged(name) {
        if (name === 'press') {
          const now = bool(params, 'press');
          if (now && !pressed) {
            const serial = str(params, 'remote');
            const frame: RfFrame = { serial, button: Math.round(num(params, 'button')) };
            if (bool(params, 'rolling')) {
              const counter = (counters.get(serial) ?? 0) + 1;
              counters.set(serial, counter);
              frame.counter = counter;
            }
            queue.push(frame);
            last = frame;
          }
          pressed = now;
        } else if (name === 'replay') {
          const now = bool(params, 'replay');
          if (now && !replayed && last) queue.push({ ...last });
          replayed = now;
        }
      },
      update(_step, x, ctx) {
        if (!ctx.commit) return;
        powered = x.v(vp) - x.v(gnd) >= V_MIN;
        if (!queue.length) return;
        if (powered && out >= 0) {
          line.frames.push(...queue);
          sent += queue.length;
          if (line.frames.length > QUEUE) line.frames.splice(0, line.frames.length - QUEUE);
        }
        queue.length = 0;
      },
      pinCurrents(x, currents) {
        const supply = gSupply * (x.v(vp) - x.v(gnd));
        const data = (x.v(out) - x.v(gnd)) / R_OUT;
        currents[0] = supply;
        currents[1] = -supply - data;
        currents[2] = data;
      },
      readouts(_x, o) {
        o('powered', powered);
        o('sent', sent);
        o('lastSerial', last?.serial ?? '');
        o('lastButton', last?.button ?? 0);
      },
      reset() {
        counters.clear();
        queue.length = 0;
        last = undefined;
        powered = false;
        sent = 0;
        pressed = bool(params, 'press');
        replayed = bool(params, 'replay');
      },
    };
  },
});
