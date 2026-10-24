/**
 * Firmware of lesson 13.3: a 433 MHz receiver board with a relay, the kind
 * sold to open a gate or switch a light from a remote. One touch on APRENDER
 * waits 10 s for a remote button; holding it 5 s erases every remote. A
 * learned button toggles the relay. With rolling code, a counter that is not
 * ahead of the last accepted one (a copy) or more than 16 presses ahead is
 * refused. The LED is wired from 5 V into the LED pin, so it lights with the
 * pin low.
 */
import { defineFirmware, type FirmwareEvent, type RfFrame } from '../../../engine/firmware';

/** Remote buttons the memory holds. */
export const CAPACITY = 16;
/** How long the learn mode waits (s). */
export const LEARN_TIMEOUT = 10;
/** Holding APRENDER this long erases the memory (s). */
export const ERASE_HOLD = 5;
/** Counter values accepted ahead of the last one. */
export const WINDOW = 16;

interface Entry {
  serial: string;
  button: number;
  counter?: number;
}

interface State {
  memory: Entry[];
  /** End of the learn mode (s), or 0. */
  learnUntil: number;
  /** When APRENDER went down (s), or −1 while it is up. */
  pressedAt: number;
  /** The current hold already erased the memory. */
  erased: boolean;
  relay: boolean;
  /** LED blinking until this time (s), with this half period. */
  blinkUntil: number;
  blinkHalf: number;
  refused: number;
}

export default defineFirmware<State>({
  id: 'm13/receptor',
  title: 'Receptor de controle remoto com relé',
  description:
    'Recebe os quadros do receptor de 433 MHz e liga ou desliga o relé quando chega um botão cadastrado. Um toque em APRENDER espera um controle por 10 s; segurar APRENDER por 5 s apaga todos. Com rolling code, recusa contadores repetidos ou que pularam mais de 16 apertos.',
  period: 0.005,
  vcc: 5,
  pins: [
    {
      name: 'APRENDER',
      kind: 'digital-in',
      pullUp: true,
      label: 'Botão APRENDER (fecha para o GND)',
    },
    {
      name: 'LED',
      kind: 'digital-out',
      label: 'LED de cadastro (acende com o pino em nível baixo)',
    },
    { name: 'RELE', kind: 'digital-out', label: 'Transistor do relé' },
  ],
  init: (memory) => ({
    memory: Array.isArray(memory) ? (memory as Entry[]) : [],
    learnUntil: 0,
    pressedAt: -1,
    erased: false,
    relay: false,
    blinkUntil: 0,
    blinkHalf: 0.2,
    refused: 0,
  }),
  persist: (s) => s.memory,
  step(state, { t, pins, rf = [] }) {
    const s = { ...state };
    const events: FirmwareEvent[] = [];
    const down = pins.APRENDER === false;

    if (down && s.pressedAt < 0) {
      s.pressedAt = t;
      s.erased = false;
    }
    if (down && !s.erased && t - s.pressedAt >= ERASE_HOLD) {
      s.memory = [];
      s.erased = true;
      s.learnUntil = 0;
      s.blinkUntil = t + 2;
      s.blinkHalf = 0.05;
      events.push({ kind: 'info', message: 'APRENDER segurado 5 s: todos os controles apagados.' });
    }
    if (!down && s.pressedAt >= 0) {
      if (!s.erased) {
        s.learnUntil = t + LEARN_TIMEOUT;
        events.push({
          kind: 'info',
          message: 'Modo de cadastro: aperte o botão do controle em até 10 s.',
        });
      }
      s.pressedAt = -1;
    }
    if (s.learnUntil && t >= s.learnUntil) {
      s.learnUntil = 0;
      events.push({ kind: 'info', message: 'Tempo de cadastro esgotado: nenhum controle novo.' });
    }

    for (const frame of rf as readonly RfFrame[]) {
      const same = (e: Entry) => e.serial === frame.serial && e.button === frame.button;
      if (s.learnUntil) {
        if (s.memory.length >= CAPACITY && !s.memory.some(same)) {
          events.push({ kind: 'warning', message: 'Memória cheia: apague os controles antes.' });
        } else {
          s.memory = [...s.memory.filter((e) => !same(e)), { ...frame }];
          events.push({
            kind: 'info',
            message: `Controle cadastrado: ${s.memory.length} de ${CAPACITY} botões na memória.`,
          });
          s.blinkUntil = t + 1.2;
          s.blinkHalf = 0.2;
        }
        s.learnUntil = 0;
        continue;
      }
      const entry = s.memory.find(same);
      if (!entry) {
        s.refused++;
        events.push({ kind: 'warning', message: 'Controle não cadastrado: ignorado.' });
        continue;
      }
      if (frame.counter !== undefined) {
        const delta = frame.counter - (entry.counter ?? 0);
        if (delta <= 0) {
          s.refused++;
          events.push({
            kind: 'warning',
            message:
              'Código repetido recusado: o contador não avançou (cópia de um aperto antigo).',
          });
          continue;
        }
        if (delta > WINDOW) {
          s.refused++;
          events.push({
            kind: 'warning',
            message: 'Contador fora da janela: cadastre este controle de novo.',
          });
          continue;
        }
        s.memory = s.memory.map((e) => (e === entry ? { ...e, counter: frame.counter } : e));
      }
      s.relay = !s.relay;
      events.push({
        kind: 'info',
        message: `Controle aceito: relé ${s.relay ? 'ligado' : 'desligado'}.`,
      });
    }

    const blinking = t < s.blinkUntil;
    const led = blinking ? Math.floor((s.blinkUntil - t) / s.blinkHalf) % 2 === 0 : !!s.learnUntil;
    return {
      state: s,
      pins: { LED: !led, RELE: s.relay },
      readouts: {
        memoria: s.memory.length,
        cadastro: !!s.learnUntil,
        rele: s.relay,
        recusados: s.refused,
      },
      events,
    };
  },
});
