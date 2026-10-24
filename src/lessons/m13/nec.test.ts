import { describe, expect, it } from 'vitest';
import {
  ADDRESS,
  CYCLES_PER_UNIT,
  decode,
  encode,
  KEYS,
  lsbFirst,
  repeatCode,
  totalDuration,
  UNIT,
} from './nec';

describe('NEC infrared protocol', () => {
  it('sends a message of about 68 ms whatever the button', () => {
    for (const k of KEYS) {
      const m = encode(ADDRESS, k.command);
      // 9 ms + 4,5 ms + 32 bits (16 zeros and 16 ones, thanks to the inverted copies) + end burst.
      expect(totalDuration(m) * 1000).toBeCloseTo(13.5 + 16 * 1.125 + 16 * 2.25 + 0.5625, 6);
      expect(m.filter((p) => p.on)).toHaveLength(34);
    }
  });

  it('decodes what it encodes and rejects a corrupted bit', () => {
    for (const k of KEYS)
      expect(decode(encode(ADDRESS, k.command))).toEqual({
        address: ADDRESS,
        command: k.command,
      });
    const m = encode(ADDRESS, 0x08);
    const i = m.findIndex((p, j) => j > 1 && !p.on);
    m[i] = { ...m[i]!, duration: m[i]!.duration === UNIT ? 3 * UNIT : UNIT };
    expect(decode(m)).toBeNull();
  });

  it('sends the least significant bit first', () => {
    expect(lsbFirst(0x08)).toEqual([0, 0, 0, 1, 0, 0, 0, 0]);
  });

  it('has about 21 carrier cycles per burst and an 11,8 ms repeat code', () => {
    expect(CYCLES_PER_UNIT).toBeCloseTo(21.4, 1);
    expect(totalDuration(repeatCode()) * 1000).toBeCloseTo(11.8125, 6);
  });
});
