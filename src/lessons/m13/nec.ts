/**
 * Lesson 13.4: the NEC infrared remote protocol, used by many TVs, sound
 * bars and air conditioners' cousins. Pure, tested in nec.test.ts; drawn by
 * ControleIR.tsx.
 *
 * The LED blinks at a 38 kHz carrier in bursts ("marks"). A message is a
 * 9 ms burst and a 4,5 ms pause, then 32 bits sent least significant bit
 * first: address, inverted address, command and inverted command. Every bit
 * starts with a 562,5 µs burst; the pause after it says the value: 562,5 µs
 * for 0, 1.687,5 µs for 1. A final 562,5 µs burst closes the message. While
 * the button is held, the remote sends a short repeat code every 108 ms.
 * The button codes below are examples for a generic TV, not any brand's.
 */

export const CARRIER = 38_000;
export const UNIT = 562.5e-6;
export const REPEAT_PERIOD = 108e-3;

export interface Key {
  id: string;
  label: string;
  command: number;
}

/** Address of the example TV. */
export const ADDRESS = 0x20;

export const KEYS: Key[] = [
  { id: 'liga', label: 'Liga/desliga', command: 0x08 },
  { id: 'vol-mais', label: 'Volume +', command: 0x02 },
  { id: 'vol-menos', label: 'Volume −', command: 0x03 },
  { id: 'canal-mais', label: 'Canal +', command: 0x00 },
  { id: 'mudo', label: 'Mudo', command: 0x09 },
];

export type Part = 'inicio' | 'endereco' | 'endereco-inv' | 'comando' | 'comando-inv' | 'fim';

export interface Pulse {
  /** LED on (burst of carrier) or off. */
  on: boolean;
  /** Duration (s). */
  duration: number;
  part: Part;
}

export const PART_LABELS: Record<Part, string> = {
  inicio: 'Início',
  endereco: 'Endereço',
  'endereco-inv': 'Endereço invertido',
  comando: 'Comando',
  'comando-inv': 'Comando invertido',
  fim: 'Fim',
};

/** The 8 bits of a byte in the order they go out (least significant first). */
export function lsbFirst(byte: number): number[] {
  return Array.from({ length: 8 }, (_, i) => (byte >> i) & 1);
}

/** The four bytes of a message. */
export function bytesOf(address: number, command: number): [Part, number][] {
  return [
    ['endereco', address & 0xff],
    ['endereco-inv', ~address & 0xff],
    ['comando', command & 0xff],
    ['comando-inv', ~command & 0xff],
  ];
}

export function encode(address: number, command: number): Pulse[] {
  const out: Pulse[] = [
    { on: true, duration: 16 * UNIT, part: 'inicio' },
    { on: false, duration: 8 * UNIT, part: 'inicio' },
  ];
  for (const [part, byte] of bytesOf(address, command))
    for (const bit of lsbFirst(byte)) {
      out.push({ on: true, duration: UNIT, part });
      out.push({ on: false, duration: (bit ? 3 : 1) * UNIT, part });
    }
  out.push({ on: true, duration: UNIT, part: 'fim' });
  return out;
}

/** Repeat code sent every 108 ms while the button stays pressed. */
export function repeatCode(): Pulse[] {
  return [
    { on: true, duration: 16 * UNIT, part: 'inicio' },
    { on: false, duration: 4 * UNIT, part: 'inicio' },
    { on: true, duration: UNIT, part: 'fim' },
  ];
}

export const totalDuration = (pulses: Pulse[]) => pulses.reduce((a, p) => a + p.duration, 0);

/**
 * What the TV's receiver reads back: the burst lengths are fixed, so it
 * measures the pauses. Returns the address and command, or null when a
 * byte and its inverted copy do not match (noise, another remote).
 */
export function decode(pulses: Pulse[]): { address: number; command: number } | null {
  const spaces = pulses.filter((p, i) => !p.on && i > 1).map((p) => p.duration);
  if (spaces.length !== 32) return null;
  const bytes = [0, 0, 0, 0];
  spaces.forEach((d, i) => {
    if (d > 2 * UNIT) bytes[i >> 3]! |= 1 << (i & 7);
  });
  const [a, ai, c, ci] = bytes as [number, number, number, number];
  if ((a ^ ai) !== 0xff || (c ^ ci) !== 0xff) return null;
  return { address: a, command: c };
}

/** Carrier cycles inside one 562,5 µs burst: about 21. */
export const CYCLES_PER_UNIT = CARRIER * UNIT;

/** "0x08". */
export const hexByte = (b: number) => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`;
