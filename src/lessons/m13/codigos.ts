/**
 * Lesson 13.3: what a 433 MHz remote sends and what the receiver decides.
 * Pure, tested in codigos.test.ts; drawn by TransmissaoBits.tsx.
 *
 * Two frame formats, simplified from the two most common families of remote
 * chips (bit counts and pulse shapes as in their datasheets; the timing unit
 * is typical, it depends on each remote's oscillator):
 *
 * - Fixed code ("learning code", EV1527 style): sync (1 T on, 31 T off), then
 *   20 bits of serial and 4 bits of buttons; bit 0 = 1 T on + 3 T off, bit 1 =
 *   3 T on + 1 T off. T ≈ 350 µs, so a frame lasts 128 T ≈ 45 ms.
 * - Rolling code (HCS301 style): preamble of 12 pulses (23 Te), a 10 Te
 *   header, then 66 bits of 3 Te each: 32 encrypted bits (counter, button and
 *   a check value), 28 bits of serial, 4 of buttons and 2 of status; bit 1 =
 *   1 Te on + 2 Te off, bit 0 = 2 Te on + 1 Te off. Te ≈ 400 µs.
 *
 * The encryption here is a toy mixing function, enough to show that the
 * encrypted part changes completely at every press. Real remotes use KeeLoq
 * (HCS family) or AES with a secret key.
 */

export type CodeKind = 'fixo' | 'rolling';

export interface Remote {
  id: string;
  label: string;
  /** 20 bits for fixed code; 28 bits for rolling code. */
  serial: number;
  /** Secret key shared with the receiver (rolling code). */
  key: number;
}

export const REMOTES: Remote[] = [
  { id: 'a', label: 'Seu controle', serial: 0x5a3c91, key: 0x2f6b_93d1 },
  { id: 'b', label: 'Controle do vizinho', serial: 0x9e04b7, key: 0x71c4_0a5e },
];

/** Timing unit of each format (s). */
export const T_FIXED = 350e-6;
export const T_ROLLING = 400e-6;

/** Counter values the receiver accepts ahead of the last one. */
export const WINDOW = 16;

export interface Frame {
  kind: CodeKind;
  remote: string;
  serial: number;
  button: number;
  /** Rolling code only: the counter (encrypted on air) and what goes on air. */
  counter?: number;
  hop?: number;
}

export type FieldId = 'sync' | 'serial' | 'botao' | 'cifrado' | 'status';

export interface Field {
  id: FieldId;
  label: string;
  bits: number[];
}

/** One stretch of the carrier: on or off for `units` timing units. */
export interface Segment {
  on: boolean;
  units: number;
  field: FieldId;
}

const bitsOf = (value: number, count: number, lsbFirst = false): number[] => {
  const out = Array.from({ length: count }, (_, i) => (value >>> (count - 1 - i)) & 1);
  return lsbFirst ? out.reverse() : out;
};

/** Toy 32-bit mixing (murmur3 finalizer) of the plain block with the key. */
export function encrypt(plain: number, key: number): number {
  let h = (plain ^ key) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85eb_ca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2_ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** The 32-bit block a rolling-code remote encrypts: button, check bits, counter. */
export function plainBlock(button: number, serial: number, counter: number): number {
  return (((button & 0xf) << 28) | ((serial & 0x3ff) << 16) | (counter & 0xffff)) >>> 0;
}

export function remoteById(id: string): Remote {
  return REMOTES.find((r) => r.id === id) ?? REMOTES[0]!;
}

/** The frame of one press. `counter` is the remote's counter after the press. */
export function makeFrame(kind: CodeKind, remoteId: string, button: number, counter = 0): Frame {
  const remote = remoteById(remoteId);
  if (kind === 'fixo') {
    return { kind, remote: remote.id, serial: remote.serial & 0xfffff, button };
  }
  const serial = remote.serial & 0xfffffff;
  return {
    kind,
    remote: remote.id,
    serial,
    button,
    counter,
    hop: encrypt(plainBlock(button, serial, counter), remote.key),
  };
}

/** The button field: one bit per button (button 1 is the first bit sent). */
const buttonBits = (button: number) => [1, 2, 3, 4].map((b) => (b === button ? 1 : 0));

/** The fields of a frame in the order they are sent. */
export function fieldsOf(frame: Frame): Field[] {
  if (frame.kind === 'fixo') {
    return [
      { id: 'sync', label: 'Sincronismo', bits: [] },
      { id: 'serial', label: 'Serial (20 bits)', bits: bitsOf(frame.serial, 20) },
      { id: 'botao', label: 'Botões (4 bits)', bits: buttonBits(frame.button) },
    ];
  }
  return [
    { id: 'sync', label: 'Preâmbulo e cabeçalho', bits: [] },
    { id: 'cifrado', label: 'Parte cifrada (32 bits)', bits: bitsOf(frame.hop ?? 0, 32, true) },
    { id: 'serial', label: 'Serial (28 bits)', bits: bitsOf(frame.serial, 28, true) },
    { id: 'botao', label: 'Botões (4 bits)', bits: buttonBits(frame.button) },
    { id: 'status', label: 'Bateria e repetição (2 bits)', bits: [0, 0] },
  ];
}

/** The frame as the carrier switches on and off (OOK), in timing units. */
export function segmentsOf(frame: Frame): Segment[] {
  const out: Segment[] = [];
  const push = (on: boolean, units: number, field: FieldId) => out.push({ on, units, field });
  const fields = fieldsOf(frame);
  if (frame.kind === 'fixo') {
    push(true, 1, 'sync');
    push(false, 31, 'sync');
    for (const f of fields.slice(1))
      for (const b of f.bits) {
        push(true, b ? 3 : 1, f.id);
        push(false, b ? 1 : 3, f.id);
      }
    return out;
  }
  for (let i = 0; i < 11; i++) {
    push(true, 1, 'sync');
    push(false, 1, 'sync');
  }
  push(true, 1, 'sync');
  push(false, 10, 'sync');
  for (const f of fields.slice(1))
    for (const b of f.bits) {
      push(true, b ? 1 : 2, f.id);
      push(false, b ? 2 : 1, f.id);
    }
  return out;
}

/** The segments with where each one starts (timing units from the frame start). */
export function timeline(segments: Segment[]): (Segment & { start: number })[] {
  const out: (Segment & { start: number })[] = [];
  let start = 0;
  for (const s of segments) {
    out.push({ ...s, start });
    start += s.units;
  }
  return out;
}

/** Length of a frame (s). */
export function frameDuration(frame: Frame): number {
  const units = segmentsOf(frame).reduce((a, s) => a + s.units, 0);
  return units * (frame.kind === 'fixo' ? T_FIXED : T_ROLLING);
}

/** Hex in groups of four, as the widget shows it: "5A3C 91". */
export function hex(value: number, digits: number): string {
  const h = (value >>> 0).toString(16).toUpperCase().padStart(digits, '0').slice(-digits);
  return h.replace(/(.{4})(?=.)/g, '$1 ');
}

/* Receiver. */

export interface Entry {
  remote: string;
  serial: number;
  button: number;
  kind: CodeKind;
  /** Last counter accepted (rolling code). */
  counter?: number;
}

export interface Receiver {
  learning: boolean;
  memory: Entry[];
}

export type Verdict =
  'cadastrado' | 'aceito' | 'desconhecido' | 'repetido' | 'fora-da-janela' | 'formato';

export const VERDICTS: Record<Verdict, { ok: boolean; text: string }> = {
  cadastrado: { ok: true, text: 'Cadastrado: o receptor guardou este controle e este botão.' },
  aceito: { ok: true, text: 'Aceito: o relé fecha e o portão abre.' },
  desconhecido: {
    ok: false,
    text: 'Recusado: este serial e botão não estão na memória do receptor.',
  },
  repetido: {
    ok: false,
    text: 'Recusado: o contador decifrado não é maior que o último aceito. É uma cópia.',
  },
  'fora-da-janela': {
    ok: false,
    text: `Recusado: o contador pulou mais de ${WINDOW} apertos. Cadastre o controle de novo.`,
  },
  formato: {
    ok: false,
    text: 'Recusado: o receptor não entende este formato de código.',
  },
};

export const emptyReceiver = (): Receiver => ({ learning: false, memory: [] });

const same = (e: Entry, f: Frame) => e.serial === f.serial && e.button === f.button;

/**
 * What the receiver does with a frame. `accepts` is the code family the
 * receiver understands (a fixed-code receiver does not decode rolling code
 * and the other way round).
 */
export function receive(
  rx: Receiver,
  frame: Frame,
  accepts: CodeKind,
): { rx: Receiver; verdict: Verdict } {
  if (frame.kind !== accepts) return { rx, verdict: 'formato' };
  // The receiver decrypts with the key it knows; the toy model carries the counter along.
  const counter = frame.counter;
  if (rx.learning) {
    const entry: Entry = {
      remote: frame.remote,
      serial: frame.serial,
      button: frame.button,
      kind: frame.kind,
      counter,
    };
    return {
      rx: { learning: false, memory: [...rx.memory.filter((e) => !same(e, frame)), entry] },
      verdict: 'cadastrado',
    };
  }
  const entry = rx.memory.find((e) => same(e, frame));
  if (!entry) return { rx, verdict: 'desconhecido' };
  if (frame.kind === 'fixo') return { rx, verdict: 'aceito' };
  const delta = (counter ?? 0) - (entry.counter ?? 0);
  if (delta <= 0) return { rx, verdict: 'repetido' };
  if (delta > WINDOW) return { rx, verdict: 'fora-da-janela' };
  return {
    rx: {
      ...rx,
      memory: rx.memory.map((e) => (e === entry ? { ...e, counter } : e)),
    },
    verdict: 'aceito',
  };
}
