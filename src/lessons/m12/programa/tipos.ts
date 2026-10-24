/**
 * Number types of the Arduino Uno (AVR, 8 bits): int is 16 bits, long 32,
 * float and double the same 32-bit float. Values live as JS numbers and are
 * wrapped to their type after every store and every operation, as the chip
 * does (`int x = 200 * 200` gives −25.536 on a Uno).
 */
import type { ValueType } from './ast';

const RANK: Record<ValueType, number> = {
  bool: 0,
  char: 0,
  byte: 0,
  int: 1,
  uint: 2,
  long: 3,
  ulong: 4,
  float: 5,
};

/** Integer promotion: bool, char and byte become int in arithmetic. */
export function promote(t: ValueType): ValueType {
  return RANK[t] === 0 ? 'int' : t;
}

/** The usual arithmetic conversions of C: the type an operation runs in. */
export function common(a: ValueType, b: ValueType): ValueType {
  const pa = promote(a);
  const pb = promote(b);
  return RANK[pa] >= RANK[pb] ? pa : pb;
}

export const isInteger = (t: ValueType) => t !== 'float';

/** Converts a number to a type the way C does (truncation, then wrap-around). */
export function conv(v: number, t: ValueType): number {
  switch (t) {
    case 'float':
      return Math.fround(v);
    case 'bool':
      return v !== 0 && !Number.isNaN(v) ? 1 : 0;
    case 'int':
      return (toInt(v) << 16) >> 16;
    case 'long':
      return toInt(v) | 0;
    case 'ulong':
      return toInt(v) >>> 0;
    case 'uint':
      return toInt(v) & 0xffff;
    case 'byte':
      return toInt(v) & 0xff;
    case 'char':
      return (toInt(v) << 24) >> 24;
  }
}

/** Float to integer: toward zero, and modulo 2^32 for the bit operations. */
function toInt(v: number): number {
  if (Number.isInteger(v)) return v;
  if (!Number.isFinite(v)) return 0;
  return Math.trunc(v);
}

export const RANGE: Record<ValueType, [number, number]> = {
  bool: [0, 1],
  char: [-128, 127],
  byte: [0, 255],
  int: [-32768, 32767],
  uint: [0, 65535],
  long: [-2147483648, 2147483647],
  ulong: [0, 4294967295],
  float: [-Infinity, Infinity],
};

/** pt-BR name of a type for messages. */
export const TYPE_LABEL: Record<ValueType, string> = {
  bool: 'bool',
  char: 'char',
  byte: 'byte',
  int: 'int',
  uint: 'unsigned int',
  long: 'long',
  ulong: 'unsigned long',
  float: 'float',
};
